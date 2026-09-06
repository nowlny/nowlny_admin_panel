/**
 * Menu extraction through Kimi (Moonshot AI), a fifth option beside Gemini,
 * Claude, OpenAI and the keyless reader.
 *
 * Worth having for this job specifically: Kimi's vision models are strong on
 * dense, non-Latin documents — an Arabic menu photographed at an angle is the
 * case where scanners diverge most — and its keys are cheap and easy to get in
 * regions where OpenAI does not serve traffic at all.
 *
 * Moonshot exposes an OpenAI-*compatible* API, but the compatible surface is
 * `/chat/completions`, not the Responses API this app's OpenAI path uses — so
 * this is its own module rather than a base-URL swap.
 */

/**
 * Both overridable, because a model name and a regional endpoint are exactly
 * the two things that move without warning:
 *  - `KIMI_MENU_MODEL` — `kimi-latest` tracks the current vision model.
 *  - `KIMI_BASE_URL` — `api.moonshot.ai` is the international endpoint;
 *    accounts created on the mainland platform use `api.moonshot.cn`.
 */
const MODEL = process.env.KIMI_MENU_MODEL || "kimi-latest";
const BASE_URL = (process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1").replace(
  /\/+$/,
  "",
);

/** A 250-dish menu serialises to a lot of JSON. */
const MAX_OUTPUT_TOKENS = 16_000;

/** What the vision endpoint accepts inline. */
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

export class KimiMenuError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KimiMenuError";
    this.status = status;
  }
}

/** True for a file Kimi's vision models can read directly. */
export function kimiCanRead(mimeType: string): boolean {
  return IMAGE_TYPES.has(mimeType);
}

export interface KimiScanOptions {
  apiKey: string;
  /** The same instruction block every other scanner is given. */
  prompt: string;
  pages: MenuPage[];
  pageText?: string;
  structuredText?: boolean;
  timeoutMs: number;
}

export async function scanMenuWithKimi({
  apiKey,
  prompt,
  pages,
  pageText,
  structuredText,
  timeoutMs,
}: KimiScanOptions): Promise<string> {
  const unreadable = pages.find((page) => !kimiCanRead(page.mimeType));
  if (unreadable) {
    // The browser renders a PDF to pages before it gets here; anything else
    // that reaches this point genuinely cannot be read.
    throw new KimiMenuError(
      `Kimi reads images, not ${unreadable.mimeType} files. Upload the menu as a PDF — it is turned into pages automatically — or as a photo.`,
      415,
    );
  }

  const content = pages.length
    ? [
        ...pages.map((page) => ({
          type: "image_url" as const,
          image_url: { url: `data:${page.mimeType};base64,${page.data}` },
        })),
        { type: "text" as const, text: prompt },
      ]
    : [
        {
          type: "text" as const,
          text: `${prompt}\n\n--- ${
            structuredText ? "MENU PAGE DATA (JSON)" : "MENU PAGE TEXT"
          } ---\n${pageText ?? ""}`,
        },
      ];

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Reading dishes off a page is extraction, not invention.
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract menus from documents and return JSON only. Never wrap " +
              "the JSON in markdown fences, and never add commentary around it.",
          },
          { role: "user", content },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const aborted =
      (error as { name?: string })?.name === "TimeoutError" ||
      (error as { name?: string })?.name === "AbortError";
    if (aborted) {
      throw new KimiMenuError(
        "The scan took too long to finish. Upload the menu as a PDF so it can be read a few pages at a time.",
        504,
      );
    }
    console.error("[parse-menu] Kimi request failed:", error);
    throw new KimiMenuError(
      `Couldn't reach Kimi at ${BASE_URL}. Check your connection, or set KIMI_BASE_URL to the endpoint your account belongs to.`,
      502,
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(
      `[parse-menu] Kimi responded ${response.status}:`,
      errorText.slice(0, 2000),
    );
    throw new KimiMenuError(
      messageForStatus(response.status, errorText),
      response.status >= 500 ? 502 : response.status,
    );
  }

  const payload = await response.json().catch(() => null);
  const choice = (payload as { choices?: unknown } | null)?.choices;
  const text =
    Array.isArray(choice) && typeof (choice[0] as { message?: { content?: unknown } })
      ?.message?.content === "string"
      ? ((choice[0] as { message: { content: string } }).message.content).trim()
      : "";

  if (!text) {
    throw new KimiMenuError("Kimi returned an empty result for that menu.", 502);
  }

  // A menu cut off mid-object parses as a bad scan, which sends the operator
  // looking at the file rather than at the ceiling that actually stopped it.
  const finish = (choice as { finish_reason?: unknown }[] | undefined)?.[0]
    ?.finish_reason;
  if (finish === "length") {
    console.warn("[parse-menu] Kimi hit its output ceiling; menu may be truncated");
  }

  return text;
}

/** What the API actually said, when it says it the documented way. */
function readApiError(errorText: string): { code: string; message: string } {
  try {
    const parsed = JSON.parse(errorText);
    const error = parsed?.error ?? parsed;
    return {
      code: typeof error?.type === "string" ? error.type : "",
      message: typeof error?.message === "string" ? error.message : "",
    };
  } catch {
    return { code: "", message: "" };
  }
}

/**
 * Turns a failure into something an operator can act on.
 *
 * Passes Moonshot's own sentence through wherever we don't recognise the
 * case — the lesson from the OpenAI path, where "the key was rejected" hid a
 * region block and sent someone chasing a key that was never the problem.
 */
export function messageForStatus(status: number, errorText: string): string {
  const { code, message } = readApiError(errorText);
  const said = message ? ` Kimi said: ${message.slice(0, 220)}` : "";

  if (status === 401) {
    return `The Kimi API key was rejected.${said || " Check the key in AI Settings."}`;
  }
  if (status === 403) {
    return `Kimi refused that request.${
      said || " The key may not have access to this model."
    }`;
  }
  if (status === 404 || /model/i.test(code)) {
    return `This account can't use the "${MODEL}" model, or ${BASE_URL} is the wrong endpoint for it. Set KIMI_MENU_MODEL or KIMI_BASE_URL on the server.${said}`;
  }
  if (status === 429) {
    return /balance|quota|insufficient/i.test(message)
      ? `That Kimi account is out of credit.${said}`
      : `Kimi is rate limited right now. Wait a moment and try again.${said}`;
  }
  if (status === 413) {
    return "That file is too large for Kimi to read in one request. Upload the menu as a PDF so it can be read a few pages at a time.";
  }
  if (status >= 500) {
    return "Kimi is temporarily unavailable. Please try again shortly.";
  }
  return `Kimi couldn't read that menu.${said}`;
}
