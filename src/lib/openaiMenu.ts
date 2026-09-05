/**
 * Menu extraction through OpenAI, as a third scanner beside Gemini and Claude.
 *
 * Same job, same prompt, same JSON contract: the route hands it the pages and
 * gets back the model's raw answer to parse, exactly as with the other two. It
 * earns its place on documents — a photographed menu with three columns and a
 * price list down the side is where the scanners differ most, and having a
 * third opinion available costs nothing until someone selects it.
 *
 * Raw `fetch` rather than the `openai` package, matching how the Gemini path
 * already calls its provider and keeping a dependency out of the bundle.
 */

/**
 * The model this points at.
 *
 * Overridable without a deploy because model names move faster than releases
 * do: set `OPENAI_MENU_MODEL` to pin a different one.
 */
const MODEL = process.env.OPENAI_MENU_MODEL || "gpt-5";

/** A 250-dish menu is a lot of JSON. */
const MAX_OUTPUT_TOKENS = 32_000;

/** What the Responses API accepts as an image. Anything else goes as a file. */
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export interface MenuPage {
  mimeType: string;
  /** Base64, no data: prefix. */
  data: string;
}

export class OpenAiMenuError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAiMenuError";
    this.status = status;
  }
}

export interface OpenAiScanOptions {
  apiKey: string;
  /** The same instruction block the other two scanners are given. */
  prompt: string;
  pages: MenuPage[];
  /** Page text, when there were no pages to attach. */
  pageText?: string;
  /** Whether `pageText` is the platform's own JSON rather than prose. */
  structuredText?: boolean;
  timeoutMs: number;
}

/** One content part per page: an image inline, or a PDF as a named file. */
function toContentPart(page: MenuPage, index: number) {
  if (IMAGE_TYPES.has(page.mimeType)) {
    return {
      type: "input_image",
      image_url: `data:${page.mimeType};base64,${page.data}`,
      detail: "high",
    };
  }

  return {
    type: "input_file",
    // The API keys the file's type off this name, so the extension matters.
    filename: `menu-${index + 1}.pdf`,
    file_data: `data:${page.mimeType};base64,${page.data}`,
  };
}

/**
 * The assistant's text, wherever this response shape happens to keep it.
 *
 * The Responses API nests output items, each with its own content parts. The
 * SDKs flatten that into `output_text`; over raw HTTP the walk is ours, and
 * the top-level convenience field is checked first in case it is present.
 */
function readOutputText(payload: unknown): string {
  const root = (payload ?? {}) as {
    output_text?: unknown;
    output?: unknown;
  };

  if (typeof root.output_text === "string" && root.output_text.trim()) {
    return root.output_text.trim();
  }
  if (Array.isArray(root.output_text)) {
    return root.output_text.filter((part) => typeof part === "string").join("").trim();
  }

  const items = Array.isArray(root.output) ? root.output : [];
  return items
    .flatMap((item) => {
      const content = (item as { content?: unknown }).content;
      return Array.isArray(content) ? content : [];
    })
    .map((part) => {
      const block = part as { type?: unknown; text?: unknown };
      return block.type === "output_text" && typeof block.text === "string"
        ? block.text
        : "";
    })
    .join("")
    .trim();
}

export async function scanMenuWithOpenAi({
  apiKey,
  prompt,
  pages,
  pageText,
  structuredText,
  timeoutMs,
}: OpenAiScanOptions): Promise<string> {
  const attachments = pages.map(toContentPart);

  // Documents first, then the instruction — the same order the Claude path
  // uses, and for the same reason.
  const content = attachments.length
    ? [...attachments, { type: "input_text", text: prompt }]
    : [
        {
          type: "input_text",
          text: `${prompt}\n\n--- ${
            structuredText ? "MENU PAGE DATA (JSON)" : "MENU PAGE TEXT"
          } ---\n${pageText ?? ""}`,
        },
      ];

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        // Reading dishes off a page is extraction, not reasoning.
        reasoning: { effort: "low" },
        text: { format: { type: "json_object" } },
        instructions:
          "You extract menus from documents and return JSON only. Never wrap " +
          "the JSON in markdown fences, and never add commentary around it.",
        input: [{ role: "user", content }],
      }),
      // Without this a large document hangs until the platform kills the
      // function with an opaque 504 and no JSON body for the client to read.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const aborted =
      (error as { name?: string })?.name === "TimeoutError" ||
      (error as { name?: string })?.name === "AbortError";
    if (aborted) {
      throw new OpenAiMenuError(
        "The scan took too long to finish. Try a smaller file, or upload the menu as a PDF so it can be read a few pages at a time.",
        504,
      );
    }
    console.error("[parse-menu] OpenAI request failed:", error);
    throw new OpenAiMenuError(
      "Couldn't reach OpenAI. Check your connection and try again.",
      502,
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(
      `[parse-menu] OpenAI responded ${response.status}:`,
      errorText.slice(0, 2000),
    );
    throw new OpenAiMenuError(messageForStatus(response.status, errorText), 
      response.status >= 500 ? 502 : response.status);
  }

  const payload = await response.json().catch(() => null);
  const text = readOutputText(payload);

  if (!text) {
    // An incomplete response is a ceiling, not a bad menu; say which.
    const status = (payload as { status?: unknown } | null)?.status;
    if (status === "incomplete") {
      throw new OpenAiMenuError(
        "That menu was too long for one answer. Upload it as a PDF so it can be read a few pages at a time.",
        502,
      );
    }
    throw new OpenAiMenuError("OpenAI returned an empty result for that menu.", 502);
  }

  return text;
}

/** What OpenAI put in the error body, when it is shaped the documented way. */
function readApiError(errorText: string): { code: string; message: string } {
  try {
    const error = JSON.parse(errorText)?.error;
    return {
      code: typeof error?.code === "string" ? error.code : "",
      message: typeof error?.message === "string" ? error.message : "",
    };
  } catch {
    return { code: "", message: "" };
  }
}

/**
 * Turns an API failure into something an operator can act on.
 *
 * Exported for the tests, and written around one lesson: a 401/403 is not
 * always a bad key. OpenAI returns 403 for a region it does not serve, and
 * "check the key in AI Settings" then sends someone to re-paste a key that was
 * never the problem. So the reason OpenAI gave is read, and when it is not one
 * we recognise, its own sentence is passed through rather than replaced.
 */
export function messageForStatus(status: number, errorText: string): string {
  const { code, message } = readApiError(errorText);
  const said = message ? ` OpenAI said: ${message.slice(0, 220)}` : "";

  if (code === "unsupported_country_region_territory" || /country, region/i.test(message)) {
    return (
      "OpenAI doesn't serve the country this server is in, so the key can't be used from here. " +
      "Switch the AI scanner to Gemini or Claude in AI Settings."
    );
  }
  if (code === "insufficient_quota" || /quota|billing/i.test(message)) {
    return "That OpenAI key has no credit left. Add billing to the account, or switch the scanner in AI Settings.";
  }
  if (code === "model_not_found" || (status === 404 && /model/i.test(errorText))) {
    return `This account can't use the "${MODEL}" model. Set OPENAI_MENU_MODEL on the server to one it can.${said}`;
  }
  if (code === "invalid_api_key" || status === 401) {
    return `The OpenAI API key was rejected.${said || " Check the key in AI Settings."}`;
  }
  if (status === 403) {
    return `OpenAI refused that request.${said || " The key may not have access to this model."}`;
  }
  if (status === 429) {
    return `OpenAI is rate limited right now. Wait a moment and try again.${said}`;
  }
  if (status === 413) {
    return "That file is too large for OpenAI to read in one request. Upload the menu as a PDF so it can be read a few pages at a time.";
  }
  if (status >= 500) {
    return "OpenAI is temporarily unavailable. Please try again shortly.";
  }
  // A 400 is usually the request, not the menu — passing the parameter name
  // through is the difference between a fix and a guess.
  return `OpenAI couldn't read that menu.${said}`;
}
