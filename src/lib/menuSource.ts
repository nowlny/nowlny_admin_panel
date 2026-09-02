import { lookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";

/**
 * Fetches a menu the operator pasted a link to, so it can be scanned the same
 * way an uploaded file is.
 *
 * Server-only. The URL comes from an authenticated admin, but it is still an
 * arbitrary address this server is being asked to open, so every hop is
 * checked against private address space before it is fetched — otherwise this
 * is an SSRF hole straight into the cloud metadata endpoint and whatever else
 * shares the deployment's network.
 */

/** Long enough for a slow restaurant site, short enough to leave Gemini its budget. */
const FETCH_TIMEOUT_MS = 15_000;

/** Base64 inflates by ~4/3, keeping this under the route's upload ceiling. */
const MAX_BINARY_BYTES = 6 * 1024 * 1024;

/** A menu page that is bigger than this is not a menu page. */
const MAX_HTML_BYTES = 3 * 1024 * 1024;

/** Trimmed page text handed to the model. Well inside the context window. */
const MAX_TEXT_CHARS = 80_000;

/** A page yielding less than this rendered nothing useful — almost always JS-only. */
const MIN_TEXT_CHARS = 200;

/** Enough to cover a long menu; beyond it the list stops helping the model. */
const MAX_IMAGES = 80;

/** Redirect chains longer than this are a loop or a tracker, not a menu. */
const MAX_REDIRECTS = 4;

/** Some sites 403 anything that doesn't look like a browser. */
const USER_AGENT =
  "Mozilla/5.0 (compatible; NowlnyMenuImporter/1.0; +https://nowlny.com)";

export type MenuSource =
  | { kind: "binary"; label: string; mimeType: string; base64: string }
  | {
      kind: "text";
      label: string;
      text: string;
      /** Absolute image URLs, referenced from `text` as `[IMAGE#1]`, `[IMAGE#2]`… */
      images: string[];
      /**
       * True when `text` is raw JSON lifted out of the page's own script tags
       * rather than readable prose — the model needs telling, and it can take
       * image URLs straight out of it.
       */
      structured?: boolean;
    };

/** Carries a message that is safe to show the operator, unlike a raw fetch error. */
export class MenuSourceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MenuSourceError";
    this.status = status;
  }
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;

  return (
    a === 0 || // "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata at 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0) || // protocol assignments
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

function isPrivateIPv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0];

  // Dual-stack hosts hand back IPv4 addresses in ::ffff:a.b.c.d form.
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return (
    value === "::" ||
    value === "::1" ||
    /^f[cd]/.test(value) || // unique local
    /^fe[89ab]/.test(value) || // link-local
    /^ff/.test(value) // multicast
  );
}

function isPrivateAddress(address: string): boolean {
  if (isIPv4(address)) return isPrivateIPv4(address);
  if (isIPv6(address)) return isPrivateIPv6(address);
  return true; // unparseable — refuse rather than guess
}

/**
 * Resolve the host and refuse anything that points inside the network.
 *
 * DNS is re-resolved by `fetch` after this check, so a deliberately rebinding
 * domain could still slip through the gap; blocking that outright needs a
 * pinned-IP connector. This stops every accidental and casual case, which is
 * what an admin-gated importer is actually exposed to.
 */
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new MenuSourceError("That doesn't look like a valid link. Paste the full address, starting with https://");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new MenuSourceError("Only http and https links can be scanned.");
  }

  if (url.username || url.password) {
    throw new MenuSourceError("Links with a username or password in them can't be scanned.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (isIPv4(host) || isIPv6(host)) {
    if (isPrivateAddress(host)) {
      throw new MenuSourceError("That link points to a private address, so it can't be scanned.");
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new MenuSourceError("Couldn't find that website. Check the link and try again.", 502);
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new MenuSourceError("That link points to a private address, so it can't be scanned.");
  }

  return url;
}

/** Read a body with a hard ceiling, so a huge file can't be pulled into memory. */
async function readCapped(response: Response, maxBytes: number, what: string): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new MenuSourceError(`That ${what} is too large to scan (over ${Math.round(maxBytes / 1024 / 1024)} MB).`, 413);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new MenuSourceError("That link returned an empty page.", 502);

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new MenuSourceError(`That ${what} is too large to scan (over ${Math.round(maxBytes / 1024 / 1024)} MB).`, 413);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&euro;": "€",
  "&pound;": "£",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => {
      const named = ENTITIES[entity.toLowerCase()];
      if (named) return named;
      const numeric = entity.match(/^&#(\d+);$/);
      return numeric ? String.fromCodePoint(Number(numeric[1])) : entity;
    });
}

function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return (match?.[2] ?? match?.[3] ?? match?.[4] ?? "").trim();
}

/** Framework state blobs worth reading when the visible page is empty. */
const STATE_ASSIGNMENT =
  /(?:window\.)?(?:__NUXT__|__INITIAL_STATE__|__INITIAL_DATA__|__remixContext|__APOLLO_STATE__|__PRELOADED_STATE__)\s*=\s*/;

/** Total embedded JSON handed on. Menus are small; app bundles are not. */
const MAX_EMBEDDED_CHARS = 60_000;

/**
 * Walk a balanced JSON object starting at `start`, respecting strings and
 * escapes — `indexOf("}")` finds the wrong brace on anything real.
 */
function balancedObject(source: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  return null;
}

/**
 * Pull the page's own data out of its `<script>` tags.
 *
 * A single-page app renders an empty shell, but plenty of them still ship the
 * whole menu in `__NEXT_DATA__`, a schema.org block or a state assignment —
 * stripping scripts before reading the text throws exactly that away. Only
 * blobs that actually parse as JSON are kept, so a minified bundle or a
 * `__NUXT__` IIFE is skipped rather than handed on as noise.
 */
function extractEmbeddedJson(html: string): string[] {
  const blobs: string[] = [];
  let budget = MAX_EMBEDDED_CHARS;

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (budget <= 0) break;

    const attributes = match[1];
    const body = match[2];
    let candidate: string | null = null;

    if (/application\/ld\+json/i.test(attributes) || /__NEXT_DATA__/.test(attributes)) {
      candidate = body.trim();
    } else {
      const assignment = body.match(STATE_ASSIGNMENT);
      if (assignment?.index !== undefined) {
        const brace = body.indexOf("{", assignment.index + assignment[0].length - 1);
        if (brace >= 0) candidate = balancedObject(body, brace);
      }
    }

    if (!candidate) continue;

    try {
      JSON.parse(candidate); // proves it is data, not code
    } catch {
      continue;
    }

    const kept = candidate.slice(0, budget);
    budget -= kept.length;
    blobs.push(kept);
  }

  return blobs;
}

/** Logos, icons and tracking pixels are never dish photos. */
const JUNK_IMAGE =
  /(logo|icon|sprite|favicon|avatar|placeholder|pixel|spacer|banner-ad|symbol|badge|1x1)/i;

/** Below this, an `<img>` is furniture — a rating star, a flag, a UI glyph. */
const MIN_IMAGE_DIMENSION = 96;

/**
 * Flatten a menu page into text the model can read, leaving `[IMAGE#n]`
 * markers where the pictures sat.
 *
 * The markers matter more than they look: they let the model say *which*
 * picture belongs to a dish by index, instead of copying a 200-character CDN
 * URL back out — which it gets subtly wrong often enough to matter.
 */
function htmlToMenuText(html: string, baseUrl: URL): { text: string; images: string[] } {
  const images: string[] = [];
  const seen = new Set<string>();

  let text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, " ");

  text = text.replace(/<img\b[^>]*>/gi, (tag) => {
    // Lazy-loading menus keep the real photo in a data attribute.
    // Attribute values arrive HTML-encoded, so a query string reads as
    // `?a=1&amp;b=2` — fetched verbatim that is a different URL.
    const raw = decodeEntities(
      attribute(tag, "src") ||
        attribute(tag, "data-src") ||
        attribute(tag, "data-lazy-src") ||
        attribute(tag, "srcset").split(",")[0]?.trim().split(/\s+/)[0] ||
        "",
    );
    const alt = decodeEntities(attribute(tag, "alt"));

    if (!raw || raw.startsWith("data:")) return ` ${alt} `;

    // A declared size is the cheapest way to tell a dish photo from a glyph.
    const width = Number(attribute(tag, "width"));
    const height = Number(attribute(tag, "height"));
    if (
      (width > 0 && width < MIN_IMAGE_DIMENSION) ||
      (height > 0 && height < MIN_IMAGE_DIMENSION)
    ) {
      return ` ${alt} `;
    }

    let resolved: URL;
    try {
      resolved = new URL(raw, baseUrl);
    } catch {
      return ` ${alt} `;
    }

    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return ` ${alt} `;
    if (/\.svg($|\?)/i.test(resolved.pathname) || JUNK_IMAGE.test(resolved.href)) return ` ${alt} `;
    if (images.length >= MAX_IMAGES) return ` ${alt} `;

    const href = resolved.href;
    if (!seen.has(href)) {
      seen.add(href);
      images.push(href);
    }

    return `\n[IMAGE#${images.indexOf(href) + 1}${alt ? `: ${alt}` : ""}]\n`;
  });

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  text = decodeEntities(text)
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: text.slice(0, MAX_TEXT_CHARS), images };
}

/**
 * Fetch whatever the link points at and return it in a form the scanner can
 * send to Gemini: PDFs and photos go up as-is, web pages go up as text.
 */
export async function fetchMenuSource(rawUrl: string): Promise<MenuSource> {
  let url = await assertPublicUrl(rawUrl);
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    try {
      response = await fetch(url, {
        redirect: "manual", // every hop is re-checked against private space
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/pdf,image/*,text/plain;q=0.9,*/*;q=0.5",
          "Accept-Language": "ar,en;q=0.9",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      const aborted =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      console.error("[menu-source] fetch failed:", error);
      throw new MenuSourceError(
        aborted
          ? "That site took too long to answer. Try again, or upload the menu file instead."
          : "Couldn't open that link. Check it opens in a browser and try again.",
        aborted ? 504 : 502,
      );
    }

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      url = await assertPublicUrl(new URL(location, url).href);
      response = null;
      continue;
    }
    break;
  }

  if (!response) {
    throw new MenuSourceError("That link redirects too many times to follow.", 502);
  }

  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) {
      throw new MenuSourceError(
        "That page is behind a login or blocks automated readers. Save it as a PDF and upload it instead.",
        422,
      );
    }
    if (response.status === 404) {
      throw new MenuSourceError("That link doesn't exist any more (404).", 404);
    }
    throw new MenuSourceError(`That site answered with an error (${response.status}).`, 502);
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const label = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || url.hostname);

  if (contentType.includes("application/pdf") || /\.pdf($|\?)/i.test(url.pathname)) {
    const body = await readCapped(response, MAX_BINARY_BYTES, "PDF");
    return {
      kind: "binary",
      label,
      mimeType: "application/pdf",
      base64: Buffer.from(body).toString("base64"),
    };
  }

  if (contentType.startsWith("image/")) {
    const body = await readCapped(response, MAX_BINARY_BYTES, "image");
    return {
      kind: "binary",
      label,
      mimeType: contentType.split(";")[0].trim(),
      base64: Buffer.from(body).toString("base64"),
    };
  }

  if (contentType.includes("html") || contentType.includes("text/") || contentType === "") {
    const body = await readCapped(response, MAX_HTML_BYTES, "page");
    const html = new TextDecoder("utf-8").decode(body);
    const isHtml = contentType.includes("html") || /<html|<body|<div/i.test(html.slice(0, 2000));

    const { text, images } = isHtml
      ? htmlToMenuText(html, url)
      : { text: html.slice(0, MAX_TEXT_CHARS).trim(), images: [] as string[] };

    if (text.length < MIN_TEXT_CHARS) {
      // The page painted nothing readable — but a single-page app often still
      // ships the whole menu as data in its own script tags.
      const embedded = isHtml ? extractEmbeddedJson(html) : [];
      const joined = embedded.join("\n\n");

      if (joined.length >= MIN_TEXT_CHARS) {
        return { kind: "text", label, text: joined, images, structured: true };
      }

      throw new MenuSourceError(
        `That page's menu is drawn by JavaScript, so there was no text to read (${url.hostname} sent an empty page). Open it in a browser, save it as a PDF or screenshot, and upload that instead.`,
        422,
      );
    }

    return { kind: "text", label, text, images };
  }

  await response.body?.cancel();
  throw new MenuSourceError(
    "That link isn't a menu page, PDF or image. Paste a link to the menu itself, or upload the file.",
  );
}
