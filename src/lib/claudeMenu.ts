import Anthropic from "@anthropic-ai/sdk";

/**
 * Menu OCR through Claude, as an alternative to Gemini.
 *
 * Same job, same prompt, same JSON contract — only the provider differs, so the
 * route can hand either one the pages and get back the model's raw answer to
 * parse. It exists because Gemini's free tier allows 20 requests a day, which
 * is not a number an onboarding workflow can run on.
 */

/** Opus 5 — the model the scanner is pointed at unless someone changes this. */
const MODEL = "claude-opus-5";

/**
 * A long menu serialises to a lot of JSON. Streaming is what makes a ceiling
 * this high safe: the SDK would otherwise have to hold one non-streaming
 * request open past its own timeout heuristics.
 */
const MAX_OUTPUT_TOKENS = 32_000;

/** What Claude accepts as an image block. Anything else has to go as a PDF. */
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

export class ClaudeMenuError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ClaudeMenuError";
    this.status = status;
  }
}

/** True for a file Claude can actually read as a document. */
export function claudeCanRead(mimeType: string): boolean {
  return mimeType === "application/pdf" || IMAGE_TYPES.has(mimeType);
}

function toContentBlock(page: MenuPage): Anthropic.ContentBlockParam {
  if (page.mimeType === "application/pdf") {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: page.data,
      },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      // Narrowed by `claudeCanRead` before we get here.
      media_type: page.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: page.data,
    },
  };
}

export interface ScanOptions {
  apiKey: string;
  /** The same instruction block the Gemini path builds. */
  prompt: string;
  /** Uploaded or fetched pages. Empty when the source was text. */
  pages: MenuPage[];
  /** Page text, when there were no pages to attach. */
  pageText?: string;
  /** Whether `pageText` is the platform's own JSON rather than prose. */
  structuredText?: boolean;
  /** How long the route can still afford to wait, in ms. */
  timeoutMs: number;
}

/**
 * Runs the scan and returns the model's raw text, for the caller to parse the
 * same way it parses Gemini's.
 */
export async function scanMenuWithClaude({
  apiKey,
  prompt,
  pages,
  pageText,
  structuredText,
  timeoutMs,
}: ScanOptions): Promise<string> {
  const unreadable = pages.find((page) => !claudeCanRead(page.mimeType));
  if (unreadable) {
    throw new ClaudeMenuError(
      `Claude can't read ${unreadable.mimeType} files. Upload the menu as a PDF or an image, or switch the scanner to Gemini.`,
      415,
    );
  }

  const client = new Anthropic({
    apiKey,
    timeout: timeoutMs,
    // The route owns the clock; a retry inside the SDK would spend a budget it
    // cannot see and return a timeout instead of a menu.
    maxRetries: 0,
  });

  // Documents go before the instruction — Claude reads a prompt that follows
  // its attachments more reliably than one that precedes them.
  const content: Anthropic.ContentBlockParam[] = pages.length
    ? [...pages.map(toContentBlock), { type: "text", text: prompt }]
    : [
        {
          type: "text",
          text: `${prompt}\n\n--- ${
            structuredText ? "MENU PAGE DATA (JSON)" : "MENU PAGE TEXT"
          } ---\n${pageText ?? ""}`,
        },
      ];

  let message: Anthropic.Message;
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Reading dishes off a page is extraction, not reasoning. Low effort
      // keeps thinking on — disabling it outright on this model has its own
      // failure modes — while not spending the route's budget deliberating.
      output_config: { effort: "low" },
      system:
        "You extract menus from documents and return JSON only. Never wrap the " +
        "JSON in markdown fences, and never add commentary before or after it.",
      messages: [{ role: "user", content }],
    });
    message = await stream.finalMessage();
  } catch (error) {
    throw asMenuError(error);
  }

  if (message.stop_reason === "refusal") {
    throw new ClaudeMenuError(
      "Claude declined to read that file. Try a different copy of the menu, or switch the scanner to Gemini.",
      422,
    );
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new ClaudeMenuError(
      "Claude returned an empty result for that menu.",
      502,
    );
  }

  // A menu cut off mid-object parses as a bad scan, which sends the operator
  // looking at the file rather than at the ceiling that actually stopped it.
  if (message.stop_reason === "max_tokens") {
    console.warn("[parse-menu] Claude hit max_tokens; menu may be truncated");
  }

  return text;
}

/** Turns an SDK error into something an operator can act on. */
function asMenuError(error: unknown): ClaudeMenuError {
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 502;
    if (status === 401 || status === 403) {
      return new ClaudeMenuError(
        "The Claude API key was rejected. Check the key in AI Settings.",
        status,
      );
    }
    if (status === 429) {
      return new ClaudeMenuError(
        "Claude is rate limited right now, or this key's credit has run out. Wait a moment, or check the balance in the Anthropic Console.",
        429,
      );
    }
    if (status === 413) {
      return new ClaudeMenuError(
        "That file is too large for Claude to read in one request. Split the PDF into fewer pages.",
        413,
      );
    }
    if (status >= 500) {
      return new ClaudeMenuError(
        "Claude is temporarily unavailable. Please try again shortly.",
        502,
      );
    }
    return new ClaudeMenuError(
      `Claude couldn't read that menu (${error.message}).`,
      status,
    );
  }

  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ClaudeMenuError(
      "The scan took too long to finish. Try a smaller file, or paste a link to the menu instead.",
      504,
    );
  }

  console.error("[parse-menu] Claude request failed:", error);
  return new ClaudeMenuError(
    "Something went wrong while scanning the menu with Claude.",
    502,
  );
}
