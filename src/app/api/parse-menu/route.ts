import { NextResponse } from "next/server";

/**
 * Gemini menu OCR proxy.
 *
 * This route falls back to the *server's* `GEMINI_API_KEY` when the caller
 * doesn't supply one, so without an auth check it is an open proxy that anyone
 * who finds the URL can use to burn the project's Gemini quota. There is no
 * `middleware.ts` in this app, so the gate has to live here.
 */

/** Vercel/Next serverless cap. Multi-page PDFs regularly need ~30-45s. */
export const maxDuration = 60;

/** Leave ~5s of headroom under `maxDuration` so we can return a real message. */
const UPSTREAM_TIMEOUT_MS = 55_000;

/**
 * Base64 inflates by ~4/3, so this is roughly a 7.5 MB source document —
 * comfortably above a phone photo or a short menu PDF, and below the point
 * where the upstream call cannot finish inside `maxDuration`.
 */
const MAX_FILE_DATA_CHARS = 10 * 1024 * 1024;

const GENERIC_ERROR =
  "Something went wrong while scanning the menu. Please try again.";

/**
 * Upstream responses are logged in full server-side but never returned: they
 * contain the request URL (which carries the API key) and walls of Google JSON
 * that mean nothing to an operator.
 */
function messageForUpstreamStatus(status: number): string {
  if (status === 429)
    return "The AI scanner is rate limited right now. Wait a minute and try again.";
  if (status === 400)
    return "The AI scanner couldn't read that file. Upload a clear PNG, JPEG or text-based PDF.";
  if (status === 401 || status === 403)
    return "The Gemini API key was rejected. Check the key in AI Settings.";
  if (status === 413)
    return "That file is too large for the AI scanner. Try a smaller or lower-resolution file.";
  if (status >= 500)
    return "The AI scanner is temporarily unavailable. Please try again shortly.";
  return GENERIC_ERROR;
}

export async function POST(request: Request) {
  // Gate first — before reading the body, so an unauthenticated caller can't
  // even make us buffer a multi-megabyte upload.
  const authHeader = request.headers.get("authorization") ?? "";
  if (!/^bearer\s+\S+/i.test(authHeader)) {
    return NextResponse.json(
      { error: "You must be signed in to use the AI menu scanner." },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { fileData, mimeType, customApiKey } = body;

    if (!fileData || typeof fileData !== "string") {
      return NextResponse.json(
        { error: "No file data received in request." },
        { status: 400 },
      );
    }

    if (fileData.length > MAX_FILE_DATA_CHARS) {
      return NextResponse.json(
        {
          error:
            "That file is too large to scan. Please upload a file under ~7 MB, or split a long PDF into fewer pages.",
        },
        { status: 413 },
      );
    }

    // Resolve API key: first check headers/body for custom client key, then fallback to environment
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Gemini API Key is missing. Please paste your Gemini API Key in the 'AI Settings' key box on the screen or set it as GEMINI_API_KEY in your server environment."
        },
        { status: 400 }
      );
    }

    // Prepare prompt instructing Gemini to do structural OCR extraction and return structured JSON
    const prompt = `
      You are an expert menu digitizer and OCR extractor.
      Analyze the attached menu document (which could be an image of a flyer, a PDF menu, or a spreadsheet).
      Extract all menu items, their descriptions, their prices, and group them into logical categories (e.g., Appetizers, Main Dishes, Drinks, Special Menu, Desserts).

      Requirements:
      1. Correctly parse and extract all dishes, sweet items, appetizers, and beverages.
      2. Clean up item titles. If a price is embedded in the title, extract it separately into the 'price' field.
      3. For 'price', extract it strictly as a floating-point number. Do not include currency symbols. If no price is found, assign 0.00.
      4. Try to write a concise, appetizing description for each item if none is present or if it's brief.
      5. Group items into their correct category name.

      You must respond strictly with a valid JSON matching this schema:
      {
        "categories": [
          {
            "name": "Category Name",
            "items": [
              {
                "name": "Item Name",
                "description": "Item Description",
                "price": 12.99,
                "category": "Category Name"
              }
            ]
          }
        ]
      }
    `;

    // Construct request payload for Gemini Multimodal API (supports images, pdfs, and excels)
    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || "image/png",
                data: fileData // base64 string
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1 // Low temperature for high precision OCR extraction
      }
    };

    const modelName = "gemini-2.5-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    let response: Response;
    try {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(geminiPayload),
        // Without this a large PDF hangs until the platform kills the function
        // with an opaque 504 and no JSON body for the client to read.
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      });
    } catch (fetchError: any) {
      const aborted =
        fetchError?.name === "TimeoutError" || fetchError?.name === "AbortError";
      console.error("[parse-menu] upstream request failed:", fetchError);
      return NextResponse.json(
        {
          error: aborted
            ? "The scan took too long to finish. Try a smaller file or a single-page PDF."
            : "Couldn't reach the AI scanner. Check your connection and try again."
        },
        { status: aborted ? 504 : 502 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[parse-menu] Gemini responded ${response.status}:`,
        errorText.slice(0, 2000),
      );
      return NextResponse.json(
        { error: messageForUpstreamStatus(response.status) },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const result = await response.json();

    // Extract the raw text from the Gemini model's response candidate
    const candidates = result.candidates || [];
    if (candidates.length === 0) {
      console.error(
        "[parse-menu] no candidates returned:",
        JSON.stringify(result).slice(0, 2000),
      );
      return NextResponse.json(
        {
          error:
            "The AI scanner returned nothing for that file. Try a clearer photo of the menu."
        },
        { status: 502 }
      );
    }

    const textResponse = candidates[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      console.error(
        "[parse-menu] empty candidate content:",
        JSON.stringify(candidates[0]).slice(0, 2000),
      );
      return NextResponse.json(
        {
          error:
            "The AI scanner returned an empty result. Try a clearer photo of the menu."
        },
        { status: 502 }
      );
    }

    // Parse the JSON returned by the model
    let parsedMenu;
    try {
      parsedMenu = JSON.parse(textResponse.trim());
    } catch {
      // In case there is some stray text wrap, try to extract JSON block using regex
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      try {
        if (!jsonMatch) throw new Error("no JSON block in model output");
        parsedMenu = JSON.parse(jsonMatch[0].trim());
      } catch {
        // The whole model output used to be piped into the client toast.
        console.error(
          "[parse-menu] unparseable model output:",
          String(textResponse).slice(0, 2000),
        );
        return NextResponse.json(
          {
            error:
              "We couldn't read a menu out of that file. Try a clearer photo, or a text-based PDF instead of a scan."
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(parsedMenu);

  } catch (error: any) {
    // `error.message` here can be a stack-revealing internal string.
    console.error("[parse-menu] unhandled error:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
