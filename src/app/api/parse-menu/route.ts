import { NextResponse } from "next/server";
import { normalizeParsedMenu } from "../../../lib/menuParsing";
import { fetchMenuSource, MenuSourceError } from "../../../lib/menuSource";
import {
  isCategoryItemsMenuPayload,
  isFlatMenuPayload,
  isStorecMenuPayload,
  mapCategoryItemsMenu,
  mapFlatMenu,
  mapStorecMenu,
  tryStorefrontMenu,
  type AdaptedMenu,
} from "../../../lib/storefrontAdapters";
import { ClaudeMenuError, scanMenuWithClaude } from "../../../lib/claudeMenu";
import { extractJsonPayload } from "../../../lib/pastedJson";

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

/**
 * Vercel/Next serverless cap. Multi-page PDFs regularly need ~30-45s, and a
 * whole-site menu more. Must be a literal; keep it in step with
 * `MENU_SCAN_BUDGET_MS` if that is raised.
 */
export const maxDuration = 60;

/**
 * Mirrors `maxDuration`, in milliseconds, for the budget maths below.
 *
 * Serverless hosts cap a request at 60s on entry-level plans, but a longer
 * ceiling elsewhere is worth using — a 250-dish menu genuinely needs it — so
 * this follows `MENU_SCAN_BUDGET_MS` when the deployment raises the limit.
 *
 * Raising it alone does nothing: `maxDuration` above has to go up to match,
 * and it must stay a literal for Next to read it at build time.
 */
const TOTAL_BUDGET_MS = Math.min(
  Math.max(Number(process.env.MENU_SCAN_BUDGET_MS) || 60_000, 20_000),
  290_000,
);

/** Leave ~5s of headroom so a timeout still returns a real message. */
const RESPONSE_HEADROOM_MS = 5_000;

/** Even a fast source shouldn't hand the model an unbounded wait. */
const UPSTREAM_TIMEOUT_MS = 55_000;

/** Below this the call cannot plausibly finish, so fail fast and say why. */
const MIN_UPSTREAM_TIMEOUT_MS = 10_000;

/** Photo phrases are a nice-to-have — never let them hold up the import. */
const IMAGE_QUERY_TIMEOUT_MS = 20_000;

/** Enough for a very long menu without turning the prompt into a novel. */
const MAX_IMAGE_QUERY_NAMES = 300;

const MODEL_NAME = "gemini-2.5-flash";

/** Which scanner runs. Both answer with the same JSON, so only the call differs. */
export type Provider = "gemini" | "claude";

/** A 250-dish menu serialises to a lot of JSON — well under the model's cap. */
const MAX_OUTPUT_TOKENS = 32_768;

/** Past this much source data, the scan is fighting the clock. */
const LARGE_MENU_CHARS = 50_000;

/**
 * The base64 ceiling per scanner — keep these in step with `MAX_UPLOAD_MB`,
 * which is what the browser refuses on. Base64 inflates a file by ~4/3, so
 * these are roughly 14 MB and 30 MB of original document.
 *
 * They differ because the providers do: Gemini has to inline the document in a
 * request capped at 20 MB, while Claude uploads anything large to its Files API
 * first and sends only an id. See `MAX_UPLOAD_MB` in `lib/httpErrors.ts`.
 */
const MAX_FILE_DATA_CHARS: Record<Provider, number> = {
  gemini: 19 * 1024 * 1024,
  claude: 41 * 1024 * 1024,
};

/**
 * Ceiling on a pasted payload that the **model** has to read, per scanner.
 *
 * A payload we map ourselves has no ceiling here at all: nothing reads it but
 * our own field mapping, so the only limit is what the host accepts in one
 * request body. This applies solely to the fallback path, where every
 * character of the payload becomes prompt tokens — roughly 250k tokens for
 * Gemini's million-token window, and 150k for Claude's 200k one, each leaving
 * room for the menu that has to come back out.
 *
 * They differ for the same reason `MAX_FILE_DATA_CHARS` does: the scanners do.
 */
const MAX_PASTED_JSON_CHARS: Record<Provider, number> = {
  gemini: 1_000_000,
  claude: 600_000,
};

/**
 * Where the relative image paths inside a pasted payload actually live.
 *
 * Nothing in the JSON says: a storec payload stores `uploads\images\x.jpeg`
 * and a hivehub one `/api/uploads/x.webp`, both meaningless without the host
 * they were served from. The operator supplies it, and it is treated as a
 * directory — `https://site.com/menu` has to keep its path when
 * `uploads/x.jpg` resolves against it.
 *
 * https only: `normalizeParsedMenu` drops anything else anyway rather than
 * downgrade the storefront to mixed content, and a silently dropped photo is
 * worse than being told why.
 */
function readImageBase(value: string): { base?: string; error?: string } {
  if (!value) return {};

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      error:
        "That image address isn't a URL. Paste the site the menu data came from, e.g. https://restaurant.com",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      error:
        "The image address has to start with https:// — a storefront can't show pictures served over plain http.",
    };
  }

  return { base: parsed.href.endsWith("/") ? parsed.href : `${parsed.href}/` };
}

/** The store's own name, when the payload happens to carry one. */
function readPastedLabel(payload: unknown): string {
  const root =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const settings =
    root.settings && typeof root.settings === "object"
      ? (root.settings as Record<string, unknown>)
      : {};

  const place =
    root.place && typeof root.place === "object"
      ? (root.place as Record<string, unknown>)
      : {};

  const candidate = [
    root.name,
    root.title,
    root.storeName,
    place.name,
    settings.restaurant_name,
    settings.name,
  ].find((value) => typeof value === "string" && value.trim());

  return typeof candidate === "string" ? candidate.trim().slice(0, 80) : "";
}

/** Mirrors `MAX_PAGES` in `lib/pdfPages.ts`; a longer document is a brochure. */
const MAX_UPLOADED_PAGES = 12;

const GENERIC_ERROR =
  "Something went wrong while scanning the menu. Please try again.";

/**
 * Upstream responses are logged in full server-side but never returned: they
 * contain the request URL (which carries the API key) and walls of Google JSON
 * that mean nothing to an operator.
 */
/**
 * A bad key comes back as 400 INVALID_ARGUMENT, not 401 — telling the operator
 * to "upload a clearer photo" sends them chasing the wrong thing.
 */
function looksLikeKeyRejection(errorText: string): boolean {
  return /api[_ ]key|api key not valid|invalid.{0,12}key/i.test(errorText);
}

/**
 * What Google actually said in a 429.
 *
 * A `RESOURCE_EXHAUSTED` body carries a `QuotaFailure` naming the quota that
 * was hit and a `RetryInfo` saying how long to wait. Collapsing all of that
 * into "wait a minute" sent an operator chasing a new Google account for a key
 * whose project simply had no quota to begin with, so the specifics are read
 * out and reported.
 */
export interface QuotaFailure {
  /** e.g. `GenerateRequestsPerDayPerProjectPerModel-FreeTier`. */
  quotaId: string;
  /** The allowance itself. `"0"` means the project was never granted any. */
  quotaValue: string;
  /** Seconds Google asks us to wait, when it says. */
  retryDelaySeconds: number | null;
  /** Google's own sentence, kept so nothing is hidden from the operator. */
  message: string;
}

export function readQuotaFailure(errorText: string): QuotaFailure {
  const empty: QuotaFailure = {
    quotaId: "",
    quotaValue: "",
    retryDelaySeconds: null,
    message: "",
  };
  if (!errorText) return empty;

  try {
    const error = JSON.parse(errorText)?.error;
    if (!error) return empty;

    const details: unknown[] = Array.isArray(error.details) ? error.details : [];
    const violation = details
      .flatMap((detail) => {
        const record = detail as { violations?: unknown };
        return Array.isArray(record?.violations) ? record.violations : [];
      })
      .find(Boolean) as { quotaId?: string; quotaValue?: string } | undefined;

    const retry = details.find((detail) =>
      String((detail as { "@type"?: string })?.["@type"] ?? "").endsWith("RetryInfo"),
    ) as { retryDelay?: string } | undefined;

    // RetryInfo serialises as a duration string — "51s", occasionally "1.5s".
    const seconds = Number(String(retry?.retryDelay ?? "").replace(/s$/, ""));

    return {
      quotaId: String(violation?.quotaId ?? ""),
      quotaValue: String(violation?.quotaValue ?? ""),
      retryDelaySeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      message: typeof error.message === "string" ? error.message : "",
    };
  } catch {
    return empty;
  }
}

function messageForQuota(errorText: string): string {
  const { quotaId, quotaValue, retryDelaySeconds, message } =
    readQuotaFailure(errorText);

  // An allowance of zero is not a rate limit at all: the key's project has no
  // quota for this model, which is what a project with no billing and no free
  // tier looks like. Waiting changes nothing, and neither does a new account.
  if (quotaValue === "0") {
    return (
      "That Gemini key's project has no quota for this model (its limit is 0), " +
      "so no amount of waiting will help. Open the project in AI Studio and " +
      "enable billing on it, then try again."
    );
  }

  if (/PerDay/i.test(quotaId)) {
    const allowance = quotaValue ? ` (${quotaValue} requests)` : "";
    return (
      `Today's Gemini quota for this key is used up${allowance}. It resets at ` +
      "midnight Pacific time. To scan sooner, use a different key or enable " +
      "billing on this one's project."
    );
  }

  if (retryDelaySeconds) {
    return `The AI scanner is rate limited right now. Try again in about ${Math.ceil(
      retryDelaySeconds,
    )} seconds.`;
  }

  if (/TokensPerMinute|InputToken/i.test(quotaId)) {
    return (
      "That file is too big for this key's per-minute token allowance. Split " +
      "the PDF into fewer pages, or paste a link to the menu instead."
    );
  }

  return message
    ? `The AI scanner is rate limited right now. Google said: ${message}`
    : "The AI scanner is rate limited right now. Wait a minute and try again.";
}

function messageForUpstreamStatus(
  status: number,
  errorText: string,
  retryHint: string,
): string {
  const keyRejected = looksLikeKeyRejection(errorText);

  if (status === 429) return messageForQuota(errorText);
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
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            // Naming dishes in English needs no deliberation, and this call
            // sits between the operator and their menu.
            thinkingConfig: { thinkingBudget: 0 },
          },
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

/**
 * Answer with a menu read straight from its source — no OCR, no model in the
 * loop. The model is only asked for photo-search phrases for dishes without a
 * picture, and only when there is a key to ask it with.
 */
async function respondWithImportedMenu(
  adapted: AdaptedMenu,
  geminiKey: string | undefined,
): Promise<NextResponse> {
  const menu = normalizeParsedMenu(adapted.data, adapted.images);

  // Same rule as the model path: an empty menu is a failure.
  if (menu.categories.every((category) => category.items.length === 0)) {
    return NextResponse.json(
      { error: "That store's menu has no dishes in it yet." },
      { status: 422 },
    );
  }

  const photoless = menu.categories
    .flatMap((category) => category.items)
    .filter((item) => !item.image);

  // The one thing the model is still better at here: naming, in English,
  // what a dish looks like so a stock photo can be found for it.
  if (geminiKey && photoless.length > 0) {
    const queries = await generateImageQueries(
      [...new Set(photoless.map((item) => item.name))].slice(0, MAX_IMAGE_QUERY_NAMES),
      geminiKey,
    );
    for (const item of photoless) {
      const phrase = queries.get(item.name);
      if (phrase) item.imageQuery = phrase;
    }
  }

  return NextResponse.json({ ...menu, label: adapted.label });
}

export async function POST(request: Request) {
  // Fetching a link or a QR menu's pages spends part of the budget before we
  // ever reach the model, and how much varies wildly — so the model gets
  // whatever is actually left rather than a guessed constant.
  const startedAt = Date.now();

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
    const { fileData, mimeType, customApiKey, claudeApiKey, url } = body;
    // Set when the browser uploaded the file straight to Claude because it was
    // past what a Vercel function will accept in a request body.
    const claudeFileId =
      typeof body.claudeFileId === "string" ? body.claudeFileId.trim() : "";
    const link = typeof url === "string" ? url.trim() : "";
    // Menu data the operator pasted straight out of another platform's API,
    // with the site those relative image paths belong to.
    const pastedJson =
      typeof body.jsonData === "string" ? body.jsonData.trim() : "";
    /**
     * Pages of one document, rendered in the browser.
     *
     * A menu PDF too big to upload whole is rasterised client-side and arrives
     * as its pages instead — see `lib/pdfPages.ts`. They are read as a single
     * menu, which the multi-document prompt below already handles.
     */
    const uploadedPages: { mimeType: string; data: string }[] = Array.isArray(
      body.pages,
    )
      ? body.pages
          .filter(
            (page: unknown): page is { mimeType: string; data: string } =>
              !!page &&
              typeof (page as { data?: unknown }).data === "string" &&
              typeof (page as { mimeType?: unknown }).mimeType === "string",
          )
          .slice(0, MAX_UPLOADED_PAGES)
      : [];
    const imageBaseInput =
      typeof body.imageBase === "string" ? body.imageBase.trim() : "";
    // Gemini stays the default so an operator who never opens AI Settings sees
    // no change; Claude is opt-in per request.
    const provider: Provider = body.provider === "claude" ? "claude" : "gemini";

    if (claudeFileId && provider !== "claude") {
      return NextResponse.json(
        {
          error:
            "That file was uploaded to Claude, so the Claude scanner has to read it. Switch the AI scanner in AI Settings.",
        },
        { status: 400 },
      );
    }

    if (!fileData && !link && !claudeFileId && !pastedJson && uploadedPages.length === 0) {
      return NextResponse.json(
        { error: "No file, menu link or menu data received in request." },
        { status: 400 },
      );
    }

    /** Page text handed to the model when the menu is a web page, not a file. */
    let pageText = "";
    /** `pageText` is the page's own JSON rather than readable prose. */
    let structuredText = false;
    /** Where relative image paths inside `pageText` resolve to. */
    let imageBase: string | undefined;
    /** Photos found on the linked page, referenced from `pageText` by number. */
    let sourceImages: string[] = [];

    // A link to a storefront platform we can read directly never reaches the
    // model as a web page: its own API gives us either the menu exactly, or
    // the menu's page images to read, or the address it really points at.
    let linkToFetch = link;
    /** Menu pages to OCR: one uploaded file, or every page of a QR menu. */
    let documents: { mimeType: string; data: string }[] = [];
    let sourceLabel = "";

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

      if (adapted?.kind === "menu") {
        return respondWithImportedMenu(adapted, customApiKey || process.env.GEMINI_API_KEY);
      }

      if (adapted?.kind === "documents") {
        documents = adapted.documents.map((page) => ({
          mimeType: page.mimeType,
          data: page.base64,
        }));
        sourceLabel = adapted.label;
      } else if (adapted?.kind === "text") {
        pageText = adapted.text;
        structuredText = true;
        sourceLabel = adapted.label;
      } else if (adapted?.kind === "follow") {
        // The QR was only a redirect — scan what it actually points at.
        linkToFetch = adapted.url;
      }
    }

    /*
     * Menu data pasted straight out of another platform's API.
     *
     * Nothing is fetched and nothing is OCR'd: the payload already *is* the
     * menu. It takes the same two routes a linked storefront's data takes —
     * mapped field for field when the shape is one we know, and read by the
     * model as structured text when it is not.
     */
    if (pastedJson) {
      // The browser sends the body it already found, but this route is also
      // reachable on its own — and a paste that arrives still wrapped in the
      // cURL command it was copied with is a body, not a bad request.
      const payloadText = extractJsonPayload(pastedJson);
      if (!payloadText) {
        return NextResponse.json(
          {
            error:
              "We couldn't find any JSON in that. Paste the response body the menu endpoint returned — copying the cURL command along with it is fine.",
          },
          { status: 400 },
        );
      }

      // `extractJsonPayload` only returns text it has already parsed.
      const payload: unknown = JSON.parse(payloadText);

      const { base, error: baseError } = readImageBase(imageBaseInput);
      if (baseError) {
        return NextResponse.json({ error: baseError }, { status: 400 });
      }

      const label = readPastedLabel(payload) || "Pasted menu data";

      /*
       * A payload in a shape we already read exactly never reaches the model.
       *
       * A field mapping keeps every dish and every price, which an LLM round
       * trip does not — and it is the difference between an instant free
       * import and sending 216 KB of JSON, four fifths of it add-on options,
       * to a model to have 90 dishes read back out of it.
       */
      const exactImport = isStorecMenuPayload(payload)
        ? () => mapStorecMenu(payload as Record<string, unknown>, base ?? "", label)
        : isFlatMenuPayload(payload)
          ? () => mapFlatMenu(payload as Record<string, unknown>, base ?? "", label)
          : isCategoryItemsMenuPayload(payload)
            ? () => mapCategoryItemsMenu(payload as Record<string, unknown>, base ?? "", label)
            : null;

      if (exactImport) {
        try {
          return await respondWithImportedMenu(
            exactImport(),
            customApiKey || process.env.GEMINI_API_KEY,
          );
        } catch (mapError) {
          // Close enough to pass the shape check but not to map. The model
          // reads it below rather than the operator hitting a dead end.
          console.warn("[parse-menu] pasted payload did not map:", mapError);
        }
      }

      // Nothing here maps it, so the model has to read the payload itself —
      // and only now does its context become the constraint. Refusing this
      // before trying to map it would turn a menu we could have imported
      // exactly, in a second, for nothing, into a size complaint.
      if (payloadText.length > MAX_PASTED_JSON_CHARS[provider]) {
        const megabytes = (payloadText.length / 1_000_000).toFixed(1);
        return NextResponse.json(
          {
            error:
              `That payload is ${megabytes} MB and it's in a format we don't recognise, so the AI scanner has to read the whole thing — which is more than ${
                provider === "claude" ? "Claude" : "Gemini"
              } can take in one go.` +
              (provider === "claude"
                ? " Switch the AI scanner to Gemini in AI Settings, or paste one section of the menu at a time."
                : " Paste one section of the menu at a time, or paste a link to the menu instead."),
          },
          { status: 413 },
        );
      }

      pageText = payloadText;
      structuredText = true;
      imageBase = base;
      sourceLabel = label;
    }

    // Resolved before anything is fetched — there is no point pulling down a
    // menu page we then can't send anywhere.
    const apiKey =
      provider === "claude"
        ? claudeApiKey || process.env.ANTHROPIC_API_KEY
        : customApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            provider === "claude"
              ? "Claude API key is missing. Paste your Anthropic API key in the 'AI Settings' key box on the screen, or set ANTHROPIC_API_KEY in your server environment."
              : "Gemini API Key is missing. Please paste your Gemini API Key in the 'AI Settings' key box on the screen or set it as GEMINI_API_KEY in your server environment.",
        },
        { status: 400 }
      );
    }

    // Pages the browser rendered are already exactly what the model reads.
    if (uploadedPages.length > 0 && documents.length === 0 && !pageText) {
      const encodedBytes = uploadedPages.reduce(
        (total, page) => total + page.data.length,
        0,
      );
      if (encodedBytes > MAX_FILE_DATA_CHARS[provider]) {
        return NextResponse.json(
          {
            error:
              "Those pages are too large to scan in one request. Try a shorter section of the menu.",
          },
          { status: 413 },
        );
      }
      documents = uploadedPages;
    }

    // Skipped entirely when a platform adapter already produced the pages or
    // the text — the upload branch below is only for when there is no link.
    const needsSource = documents.length === 0 && !pageText && !claudeFileId;

    if (needsSource && linkToFetch) {
      try {
        const source = await fetchMenuSource(linkToFetch);
        // The page turned out to be a storefront whose API we can read exactly.
        if (source.kind === "menu") {
          return respondWithImportedMenu(source, customApiKey || process.env.GEMINI_API_KEY);
        }
        sourceLabel = sourceLabel || source.label;
        if (source.kind === "binary") {
          documents = [{ mimeType: source.mimeType, data: source.base64 }];
        } else {
          pageText = source.text;
          sourceImages = source.images;
          structuredText = source.structured === true;
          imageBase = source.imageBase;
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
    } else if (needsSource) {
      if (typeof fileData !== "string") {
        return NextResponse.json(
          { error: "No file data received in request." },
          { status: 400 },
        );
      }

      if (fileData.length > MAX_FILE_DATA_CHARS[provider]) {
        return NextResponse.json(
          {
            error:
              provider === "claude"
                ? "That file is too large to scan. Split a long PDF into fewer pages, or paste a link to the menu instead."
                : "That file is too large for the Gemini scanner, which has to send it inline. Switch the scanner to Claude in AI Settings, split the PDF into fewer pages, or paste a link to the menu instead.",
          },
          { status: 413 },
        );
      }

      documents = [{ mimeType: mimeType || "image/png", data: fileData }];
    }

    // On a very large menu, a written-from-scratch description per dish is the
    // difference between finishing inside the platform's limit and not — and
    // a payload this size almost always carries its own descriptions anyway.
    const terseDescriptions = structuredText && pageText.length > LARGE_MENU_CHARS;

    // Prepare prompt instructing Gemini to do structural OCR extraction and
    // return structured JSON. The language rules are the load-bearing part:
    // without them the model quietly translates Arabic menus into English,
    // which then goes straight into the storefront customers read.
    const intro = documents.length
      ? documents.length > 1
        ? `The ${documents.length} attached images are consecutive pages of ONE menu. Read them all and merge them into a single set of categories — never repeat a category once per page.`
        : `Analyze the attached menu document (which could be an image of a flyer, a PDF menu, or a spreadsheet).`
      : structuredText
        ? pastedJson
          ? `The text at the end of this prompt is a JSON payload copied straight out of another restaurant platform's own API. Walk it and pull out the menu. The keys are that platform's, not ours: a dish name may sit under "title" or "name", a price under "price" or "finalPrice", and the same dish may repeat itself in a second language under a key like "name_ar".`
          : `The text at the end of this prompt is raw JSON taken out of a restaurant website's own page data. Walk it and pull out the menu, ignoring routing, analytics, theme and configuration keys.`
        : `Analyze the menu page text at the end of this prompt. It was extracted from a restaurant's website, so it also contains navigation, opening hours and footer noise — ignore everything that is not a menu item.`;

    // Pictures only exist when the menu came from a web page, and the model
    // refers to them by number: asked for the URL itself it returns a
    // plausible-looking but subtly wrong CDN address often enough to matter.
    const imageRule = structuredText
      ? `
      Dish photo requirement:
      15. The JSON usually holds a picture for a dish. Copy that value into the item's "image" field EXACTLY as it appears — character for character. It is often a relative path such as "menu_images/8ebefc39.webp" rather than a full URL; copy it as-is, do not turn it into a URL, do not guess it, do not build one out of an id.
      16. Leave "image" out entirely when the data has no picture for that dish. Never reuse another dish's picture.`
      : sourceImages.length
      ? `
      Dish photo requirement:
      15. The page text contains markers like [IMAGE#4: grilled chicken]. When a marker clearly belongs to an item, set that item's "imageRef" to the marker's number (4 in that example).
      16. Give "imageRef" ONLY when the picture really is that dish. Never guess, never reuse one number for several items, and never invent a number that is not in the text. Omit the field when unsure — a missing photo is fixed automatically later, a wrong one is not.
      17. Never write image URLs yourself. The number is the only thing we read.`
      : "";

    // Only ever reached with `structuredText`, so these follow on from the
    // structured image rules above (15 and 16).
    const pastedRules = pastedJson
      ? `
      Pasted payload rules:
      17. Ignore everything in the payload that is not a dish: theme, colours, settings, banners, carousels, page sections, opening hours, branches and analytics.
      18. When a dish carries several sizes or price options, return ONE ITEM PER SIZE and put the size in that item's name (e.g. "Margherita - Large"). Spell the size out in the menu's language; never leave a bare code like "l" or "m".
      19. When a dish carries both a list price and a final or discounted one, use the price the payload marks as final or current.
      20. When the payload marks a dish as unavailable, sold out or hidden, still return it and add "isAvailable": false to that item. Leave the field out otherwise.
      21. Return every dish in the payload. Do not summarise, sample or stop early.

      Modifiers — the choices a customer makes about a dish:
      22. Option groups, modifiers, add-ons and extras (keys like "optionGroups", "choices", "addons", "modifiers", "variations") are NEVER menu items of their own. Never return "Oat Dough" or "Add pickles" as a dish. They belong in that dish's "optionGroups" instead.
      23. For each such group give its "name" and its "options", each option with a "name" and a "price".
      24. An option's "price" is what the choice ADDS to the dish, not a total: a free choice is 0, and a choice the payload prices at null, "" or 0 is 0.
      25. Set "type" to "radio" when the customer picks exactly one (sizes, dough, cooking level) and "checkbox" when they may pick several (toppings, extras, sauces). Set "isRequired" to true only when the payload says the group must be answered.
      26. Keep the group and option names in the menu's own language, exactly like dish names.`
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
      ${
        terseDescriptions
          ? `10. Use ONLY the description the source already gives an item (its ingredients text, if that is what it has). Do not write descriptions for items that have none — leave the field out. Getting every dish and price out of a menu this size matters far more than prose.`
          : `10. Write a concise, appetizing description for each item if none is present or if it is very brief (respecting rule 4).`
      }
      11. Group items into their correct category name.

      Image search requirement:
      12. For every item add an 'imageQuery': a short stock-photo search phrase of 2 to 5 words describing what the dish LOOKS like, so we can find a photo for items the menu has no picture for.
      13. 'imageQuery' must ALWAYS be written in ENGLISH, even when the rest of the output is Arabic. Translate the dish for this field only (e.g. name "شاورما دجاج" -> imageQuery "chicken shawarma wrap").
      14. Keep 'imageQuery' generic and visual: no restaurant names, no brand names, no prices, no sizes. Prefer "grilled lamb kebab skewers" over "Chef Special #4".
${imageRule}${pastedRules}

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
                  pastedJson
                    ? ',\n                "optionGroups": [{ "name": "Group name, in the menu\'s language", "type": "radio", "isRequired": false, "options": [{ "name": "Choice name", "price": 0 }] }]'
                    : ""
                }${
                  structuredText
                    ? ',\n                "image": "exactly as written in the data"'
                    : sourceImages.length
                      ? ',\n                "imageRef": 4'
                      : ""
                }
              }
            ]
          }
        ]
      }
    `;

    const upstreamTimeout = Math.min(
      UPSTREAM_TIMEOUT_MS,
      TOTAL_BUDGET_MS - (Date.now() - startedAt) - RESPONSE_HEADROOM_MS,
    );

    if (upstreamTimeout < MIN_UPSTREAM_TIMEOUT_MS) {
      return NextResponse.json(
        {
          error:
            "Reading that menu took so long there was no time left to scan it. Try again, or upload the menu file instead.",
        },
        { status: 504 },
      );
    }

    // A timeout on a huge linked menu is a different problem from a timeout on
    // a big upload, and the advice has to match.
    const timeoutHint = pastedJson
      ? "That payload is very large. Paste one section of the menu at a time."
      : link
        ? "That menu is very large. Try a link to one section of it, or upload the menu file instead."
        : "Try a smaller file or a single-page PDF.";

    // Advice for a dead end differs by where the menu came from.
    const retryHint = pastedJson
      ? "Check that you pasted the whole response body, not just part of it."
      : link
        ? "Try a link that opens the menu directly, or upload the menu file instead."
        : "Try a clearer photo, or a text-based PDF instead of a scan.";

    /*
     * One scan, either provider.
     *
     * Everything downstream — parsing the JSON, normalising it, looking up
     * photos — is provider-agnostic, so the seam is narrow: each branch's job
     * is to end up holding the model's raw answer.
     */
    let textResponse: string | undefined;

    if (provider === "claude") {
      try {
        textResponse = await scanMenuWithClaude({
          apiKey,
          prompt,
          pages: documents.map((page) => ({
            mimeType: page.mimeType,
            data: page.data,
          })),
          fileIds: claudeFileId ? [claudeFileId] : undefined,
          pageText,
          structuredText,
          timeoutMs: Math.max(
            MIN_UPSTREAM_TIMEOUT_MS,
            TOTAL_BUDGET_MS - (Date.now() - startedAt) - RESPONSE_HEADROOM_MS,
          ),
        });
      } catch (error) {
        if (error instanceof ClaudeMenuError) {
          return NextResponse.json(
            { error: error.message },
            { status: error.status },
          );
        }
        throw error;
      }
    } else {
      const parts = documents.length
        ? [
            { text: prompt },
            ...documents.map((page) => ({
              inlineData: { mimeType: page.mimeType, data: page.data },
            })),
          ]
        : [
            {
              text: `${prompt}\n\n--- ${structuredText ? "MENU PAGE DATA (JSON)" : "MENU PAGE TEXT"} ---\n${pageText}`,
            },
          ];

      // Construct request payload for Gemini Multimodal API (supports images, pdfs, and excels)
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

      const baseConfig = {
        responseMimeType: "application/json",
        temperature: 0.1, // Low temperature for high precision OCR extraction
        // A 200-dish menu is a lot of JSON; the default ceiling truncates it
        // mid-object, which then fails to parse and reads as a bad scan.
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      };

      const attempt = async (
        generationConfig: Record<string, unknown>,
        timeoutMs: number,
      ): Promise<{ response: Response; errorText: string }> => {
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }], generationConfig }),
          // Without this a large PDF hangs until the platform kills the function
          // with an opaque 504 and no JSON body for the client to read.
          signal: AbortSignal.timeout(timeoutMs),
        });
        return {
          response,
          errorText: response.ok ? "" : await response.text().catch(() => ""),
        };
      };

      let response: Response;
      let errorText: string;
      try {
        // Thinking is the biggest cost on a long menu: reading 100+ dishes off a
        // page is extraction, not reasoning, and the deliberation was pushing
        // whole-menu scans past the time the platform allows.
        ({ response, errorText } = await attempt(
          { ...baseConfig, thinkingConfig: { thinkingBudget: 0 } },
          upstreamTimeout,
        ));

        // Any 400 that isn't about the key might be the model refusing
        // `thinkingConfig`, and the wording varies between versions — so retry
        // plainly rather than reading tea leaves in the error string.
        if (response.status === 400 && !looksLikeKeyRejection(errorText)) {
          const remaining =
            TOTAL_BUDGET_MS - (Date.now() - startedAt) - RESPONSE_HEADROOM_MS;
          if (remaining >= MIN_UPSTREAM_TIMEOUT_MS) {
            ({ response, errorText } = await attempt(baseConfig, remaining));
          }
        }

        // A per-minute limit is the one quota that clears on its own, and Google
        // says exactly how long it needs. Waiting it out here turns a failed
        // import the operator has to notice and redo into a slower one that
        // simply works — but only when the wait plus a real attempt still fit in
        // the budget, since a serverless host kills the request at `maxDuration`.
        if (response.status === 429) {
          const { retryDelaySeconds } = readQuotaFailure(errorText);
          const remaining =
            TOTAL_BUDGET_MS - (Date.now() - startedAt) - RESPONSE_HEADROOM_MS;
          const waitMs = (retryDelaySeconds ?? 0) * 1000;
          if (
            waitMs > 0 &&
            remaining - waitMs >= MIN_UPSTREAM_TIMEOUT_MS
          ) {
            console.warn(
              `[parse-menu] rate limited; waiting ${retryDelaySeconds}s before one retry`,
            );
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            ({ response, errorText } = await attempt(
              { ...baseConfig, thinkingConfig: { thinkingBudget: 0 } },
              remaining - waitMs,
            ));
          }
        }
      } catch (fetchError: any) {
        const aborted =
          fetchError?.name === "TimeoutError" || fetchError?.name === "AbortError";
        console.error("[parse-menu] upstream request failed:", fetchError);
        return NextResponse.json(
          {
            error: aborted
              ? `The scan took too long to finish. ${timeoutHint}`
              : "Couldn't reach the AI scanner. Check your connection and try again."
          },
          { status: aborted ? 504 : 502 }
        );
      }

      if (!response.ok) {
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

      textResponse = candidates[0]?.content?.parts?.[0]?.text;
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
    }

    // Parse the JSON returned by the model
    let parsedMenu;
    try {
      parsedMenu = JSON.parse(String(textResponse).trim());
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

    const menu = normalizeParsedMenu(parsedMenu, sourceImages, imageBase);
    const dishCount = menu.categories.reduce(
      (total, category) => total + category.items.length,
      0,
    );

    // The model answering with an empty menu is a failure, not a success. It
    // used to come back as a green "parsed successfully" toast over an empty
    // preview, which reads as "this restaurant has no food".
    if (dishCount === 0) {
      console.warn(
        `[parse-menu] no dishes extracted from ${
          pastedJson ? "pasted data" : link ? link : "upload"
        }`,
      );
      return NextResponse.json(
        {
          error: pastedJson
            ? "There are no dishes in that data. Paste the response from the menu endpoint itself — the one that lists categories and items."
            : link
              ? "We opened that page but found no dishes on it: its menu is drawn after the page loads, so the page itself holds nothing to read. Two ways round it — open the site, print the menu to PDF and upload that; or open the browser's Network tab, find the request that fetches the menu, copy its response and paste it into the menu-data box."
              : `We couldn't find any dishes in that file. ${retryHint}`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ...menu,
      ...(sourceLabel ? { label: sourceLabel } : {}),
    });

  } catch (error: any) {
    // `error.message` here can be a stack-revealing internal string.
    console.error("[parse-menu] unhandled error:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
