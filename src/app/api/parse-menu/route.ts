import { NextResponse } from "next/server";
import { normalizeParsedMenu } from "../../../lib/menuParsing";
import { fetchMenuSource, MenuSourceError } from "../../../lib/menuSource";
import { tryStorefrontMenu } from "../../../lib/storefrontAdapters";

/**
 * Gemini menu OCR proxy.
 *
 * This route falls back to the *server's* `GEMINI_API_KEY` when the caller
 * doesn't supply one, so without an auth check it is an open proxy that anyone
 * who finds the URL can use to burn the project's Gemini quota. There is no
 * `middleware.ts` in this app, so the gate has to live here.
 *
 * Takes either an uploaded file (`fileData`) or a link to the menu (`url`),
 * which is fetched server-side — see `lib/menuSource.ts` for why that fetch is
 * fenced off from private address space.
 */

/** Vercel/Next serverless cap. Multi-page PDFs regularly need ~30-45s. */
export const maxDuration = 60;

/** Leave ~5s of headroom under `maxDuration` so we can return a real message. */
const UPSTREAM_TIMEOUT_MS = 55_000;

/** Fetching the link has already spent part of the budget by the time we call out. */
const UPSTREAM_TIMEOUT_AFTER_FETCH_MS = 38_000;

/** Photo phrases are a nice-to-have — never let them hold up the import. */
const IMAGE_QUERY_TIMEOUT_MS = 20_000;

/** Enough for a very long menu without turning the prompt into a novel. */
const MAX_IMAGE_QUERY_NAMES = 300;

const MODEL_NAME = "gemini-2.5-flash";

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
function messageForUpstreamStatus(
  status: number,
  errorText: string,
  retryHint: string,
): string {
  // A bad key comes back as 400 INVALID_ARGUMENT, not 401 — telling the
  // operator to "upload a clearer photo" sends them chasing the wrong thing.
  const keyRejected = /api[_ ]key|api key not valid|invalid.{0,12}key/i.test(errorText);

  if (status === 429)
    return "The AI scanner is rate limited right now. Wait a minute and try again.";
  if (status === 400)
    return keyRejected
      ? "The Gemini API key was rejected. Check the key in AI Settings."
      : `The AI scanner couldn't read that menu. ${retryHint}`;
  if (status === 401 || status === 403)
    return "The Gemini API key was rejected. Check the key in AI Settings.";
  if (status === 413)
    return "That file is too large for the AI scanner. Try a smaller or lower-resolution file.";
  if (status >= 500)
    return "The AI scanner is temporarily unavailable. Please try again shortly.";
  return GENERIC_ERROR;
}

/**
 * Ask the model for an English stock-photo phrase per dish name.
 *
 * Only used on the direct-import path, where the menu came back as structured
 * data with no `imageQuery` in it. Without this an Arabic menu searches photo
 * libraries in Arabic, finds nothing, and every dish lands on the same generic
 * plate. Best-effort by design: any failure just means no phrases.
 */
async function generateImageQueries(
  names: string[],
  apiKey: string,
): Promise<Map<string, string>> {
  const queries = new Map<string, string>();
  if (names.length === 0) return queries;

  const prompt = `For each numbered dish name below, write a short ENGLISH stock-photo search phrase (2 to 5 words) describing what the dish looks like. Translate where the name is not English. No brand names, no prices, no sizes.

Respond strictly as JSON: {"queries": ["phrase for 1", "phrase for 2", ...]} with exactly ${names.length} entries, in order.

${names.map((name, index) => `${index + 1}. ${name}`).join("\n")}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(IMAGE_QUERY_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`status ${response.status}`);

    const result = await response.json();
    const parsed = JSON.parse(result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
    const phrases = Array.isArray(parsed?.queries) ? parsed.queries : [];

    names.forEach((name, index) => {
      const phrase = phrases[index];
      if (typeof phrase === "string" && phrase.trim()) queries.set(name, phrase.trim());
    });
  } catch (error) {
    // The dish still imports; it just falls back to searching by its own name.
    console.warn("[parse-menu] image query generation skipped:", error);
  }

  return queries;
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
    const { fileData, mimeType, customApiKey, url } = body;
    const link = typeof url === "string" ? url.trim() : "";

    if (!fileData && !link) {
      return NextResponse.json(
        { error: "No file or menu link received in request." },
        { status: 400 },
      );
    }

    // A link to a storefront platform we can read directly never reaches the
    // model: its own API returns the menu exactly, dish for dish and price for
    // price, which no amount of prompting can match.
    if (link) {
      let adapted;
      try {
        adapted = await tryStorefrontMenu(link);
      } catch (adapterError) {
        if (adapterError instanceof MenuSourceError) {
          return NextResponse.json(
            { error: adapterError.message },
            { status: adapterError.status },
          );
        }
        throw adapterError;
      }

      if (adapted) {
        const menu = normalizeParsedMenu(adapted.data, adapted.images);
        const photoless = menu.categories
          .flatMap((category) => category.items)
          .filter((item) => !item.image);

        // The one thing the model is still better at here: naming, in English,
        // what a dish looks like so a stock photo can be found for it.
        const key = customApiKey || process.env.GEMINI_API_KEY;
        if (key && photoless.length > 0) {
          const queries = await generateImageQueries(
            [...new Set(photoless.map((item) => item.name))].slice(0, MAX_IMAGE_QUERY_NAMES),
            key,
          );
          for (const item of photoless) {
            const phrase = queries.get(item.name);
            if (phrase) item.imageQuery = phrase;
          }
        }

        return NextResponse.json({ ...menu, label: adapted.label });
      }
    }

    // Resolved before anything is fetched — there is no point pulling down a
    // menu page we then can't send anywhere.
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Gemini API Key is missing. Please paste your Gemini API Key in the 'AI Settings' key box on the screen or set it as GEMINI_API_KEY in your server environment."
        },
        { status: 400 }
      );
    }

    // What ends up going to Gemini: a document to look at, or page text to read.
    let document: { mimeType: string; data: string } | null = null;
    let pageText = "";
    /** Photos found on the linked page, referenced from `pageText` by number. */
    let sourceImages: string[] = [];

    if (link) {
      try {
        const source = await fetchMenuSource(link);
        if (source.kind === "binary") {
          document = { mimeType: source.mimeType, data: source.base64 };
        } else {
          pageText = source.text;
          sourceImages = source.images;
        }
      } catch (sourceError) {
        if (sourceError instanceof MenuSourceError) {
          return NextResponse.json(
            { error: sourceError.message },
            { status: sourceError.status },
          );
        }
        throw sourceError;
      }
    } else {
      if (typeof fileData !== "string") {
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

      document = { mimeType: mimeType || "image/png", data: fileData };
    }

    // Prepare prompt instructing Gemini to do structural OCR extraction and
    // return structured JSON. The language rules are the load-bearing part:
    // without them the model quietly translates Arabic menus into English,
    // which then goes straight into the storefront customers read.
    const intro = document
      ? `Analyze the attached menu document (which could be an image of a flyer, a PDF menu, or a spreadsheet).`
      : `Analyze the menu page text at the end of this prompt. It was extracted from a restaurant's website, so it also contains navigation, opening hours and footer noise — ignore everything that is not a menu item.`;

    // Pictures only exist when the menu came from a web page, and the model
    // refers to them by number: asked for the URL itself it returns a
    // plausible-looking but subtly wrong CDN address often enough to matter.
    const imageRule = sourceImages.length
      ? `
      Dish photo requirement:
      15. The page text contains markers like [IMAGE#4: grilled chicken]. When a marker clearly belongs to an item, set that item's "imageRef" to the marker's number (4 in that example).
      16. Give "imageRef" ONLY when the picture really is that dish. Never guess, never reuse one number for several items, and never invent a number that is not in the text. Omit the field when unsure — a missing photo is fixed automatically later, a wrong one is not.
      17. Never write image URLs yourself. The number is the only thing we read.`
      : "";

    const prompt = `
      You are an expert menu digitizer and OCR extractor.
      ${intro}
      Extract all menu items, their descriptions, their prices, and group them into logical categories (e.g., Appetizers, Main Dishes, Drinks, Special Menu, Desserts).

      LANGUAGE RULES — these override every other instruction:
      1. First detect the language the menu is actually written in, and return every human-readable string in THAT SAME language and script.
      2. NEVER translate and NEVER transliterate. An English menu must come back in English. An Arabic menu must come back in Arabic script (e.g. "شاورما دجاج", not "Chicken Shawarma" and not "Shawarma Djaj").
      3. This applies to item names, item descriptions AND category names alike. On an Arabic menu, invent Arabic category names such as "المقبلات", "الأطباق الرئيسية", "المشروبات", "الحلويات" — do not fall back to English headings.
      4. Any description you write yourself must be in the menu's language too. Write Arabic descriptions in clear Modern Standard Arabic.
      5. If the menu prints the same dish in two languages, pick the language that dominates the document and use it consistently everywhere. Do not mix languages across items.
      6. Keep the original spelling, diacritics and punctuation of names as printed; only clean up OCR noise, embedded prices and decorative characters.

      Extraction requirements:
      7. Correctly parse and extract all dishes, sweet items, appetizers, and beverages.
      8. Clean up item titles. If a price is embedded in the title, extract it separately into the 'price' field.
      9. For 'price', extract it strictly as a floating-point number. Do not include currency symbols. If no price is found, assign 0.00.
      10. Write a concise, appetizing description for each item if none is present or if it is very brief (respecting rule 4).
      11. Group items into their correct category name.

      Image search requirement:
      12. For every item add an 'imageQuery': a short stock-photo search phrase of 2 to 5 words describing what the dish LOOKS like, so we can find a photo for items the menu has no picture for.
      13. 'imageQuery' must ALWAYS be written in ENGLISH, even when the rest of the output is Arabic. Translate the dish for this field only (e.g. name "شاورما دجاج" -> imageQuery "chicken shawarma wrap").
      14. Keep 'imageQuery' generic and visual: no restaurant names, no brand names, no prices, no sizes. Prefer "grilled lamb kebab skewers" over "Chef Special #4".
${imageRule}

      You must respond strictly with a valid JSON matching this schema:
      {
        "language": "ISO 639-1 code of the detected menu language, e.g. \"en\" or \"ar\"",
        "categories": [
          {
            "name": "Category Name, in the menu's language",
            "items": [
              {
                "name": "Item Name, in the menu's language",
                "description": "Item Description, in the menu's language",
                "price": 12.99,
                "category": "Category Name, in the menu's language",
                "imageQuery": "english stock photo search phrase"${
                  sourceImages.length ? ',\n                "imageRef": 4' : ""
                }
              }
            ]
          }
        ]
      }
    `;

    // Advice for a dead end differs by where the menu came from.
    const retryHint = link
      ? "Try a link that opens the menu directly, or upload the menu file instead."
      : "Try a clearer photo, or a text-based PDF instead of a scan.";

    const parts = document
      ? [{ text: prompt }, { inlineData: { mimeType: document.mimeType, data: document.data } }]
      : [{ text: `${prompt}\n\n--- MENU PAGE TEXT ---\n${pageText}` }];

    // Construct request payload for Gemini Multimodal API (supports images, pdfs, and excels)
    const geminiPayload = {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1 // Low temperature for high precision OCR extraction
      }
    };

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

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
        signal: AbortSignal.timeout(
          link ? UPSTREAM_TIMEOUT_AFTER_FETCH_MS : UPSTREAM_TIMEOUT_MS,
        )
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
        { error: messageForUpstreamStatus(response.status, errorText, retryHint) },
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
        { error: `The AI scanner returned nothing for that menu. ${retryHint}` },
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
        { error: `The AI scanner returned an empty result. ${retryHint}` },
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
          { error: `We couldn't read a menu out of that. ${retryHint}` },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(normalizeParsedMenu(parsedMenu, sourceImages));

  } catch (error: any) {
    // `error.message` here can be a stack-revealing internal string.
    console.error("[parse-menu] unhandled error:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
