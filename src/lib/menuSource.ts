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

/**
 * Structured payloads get far more room than prose: a React Server Components
 * stream carries the whole menu as JSON plus a lot of framework noise, and
 * truncating at 80k routinely cuts the menu in half. 400k characters is
 * roughly 100k tokens — comfortable for the model we call.
 */
const MAX_STRUCTURED_CHARS = 400_000;

/** Discovery is only worth doing while there is still time to use the result. */
const DISCOVERY_BUDGET_MS = 22_000;

/** Shorter than a first fetch — these are speculative. */
const DISCOVERY_FETCH_TIMEOUT_MS = 10_000;

/** Paths that look like a menu, in the languages this admin sees. */
const MENU_PATH = /(menu|food|order|dishes|carte|eat|meals|قائمة|منيو|طعام|وجبات)/i;

/**
 * Prices are what separates a menu from an "about us" page: a decimal amount,
 * a currency, or a price field in a JSON payload.
 */
const PRICE_HINT =
  /(?:"price"\s*:|\d[\d.,]{0,9}\s*(?:\$|€|£|usd|lbp|l\.l|ل\.ل|ر\.س|ج\.م|aed|sar|egp|tl)|\b\d+[.,]\d{2}(?!\d))/gi;

/** How many price-ish hits before we believe a page is really a menu. */
const MENU_CONFIDENCE = 4;

/** A page yielding less than this rendered nothing useful — almost always JS-only. */
const MIN_TEXT_CHARS = 200;

/** Enough to cover a long menu; beyond it the list stops helping the model. */
const MAX_IMAGES = 80;

/** Redirect chains longer than this are a loop or a tracker, not a menu. */
const MAX_REDIRECTS = 4;

/**
 * Plenty of restaurant sites serve a 404 or a 403 to anything that doesn't
 * look like a browser, so the string leads with a normal Chrome UA and still
 * says who we are on the end.
 */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Safari/537.36 NowlnyMenuImporter/1.0 (+https://nowlny.com)";

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
      /**
       * Where the relative image paths in `text` actually live, once we have
       * worked it out. Dish photos in a page's own data are usually stored as
       * `menu_images/<id>.webp`, which is useless on its own.
       */
      imageBase?: string;
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
 * Decode a Next.js App Router page's RSC stream.
 *
 * App Router pages routinely render an empty body and ship everything through
 * `self.__next_f.push([1, "…"])` chunks instead — for a restaurant site that
 * stream holds the entire menu as JSON. The chunks are JS string literals, so
 * `JSON.parse` on each one un-escapes it; concatenated they are the stream.
 */
function extractFlightStream(html: string): string {
  const chunks: string[] = [];

  for (const match of html.matchAll(/self\.__next_f\.push\(\[\d+\s*,\s*("(?:[^"\\]|\\.)*")/g)) {
    try {
      const decoded: unknown = JSON.parse(match[1]);
      if (typeof decoded === "string") chunks.push(decoded);
    } catch {
      // A chunk we can't decode is skipped; the rest of the stream still reads.
    }
  }

  return chunks.join("");
}

/**
 * Strip the bookkeeping out of a structured payload.
 *
 * A page's own data carries a timestamp and a rating counter on every record,
 * which is a fifth of the bytes and none of the menu. Record *ids* are kept:
 * they are what ties a dish to its category, and dropping them makes the model
 * guess the grouping.
 */
function compactStructuredPayload(text: string): string {
  return text
    .replace(/"[a-zA-Z_]*_at"\s*:\s*(?:"[^"]*"|null)\s*,?/g, "")
    .replace(/"(average_rating|rating_count|view_count|click_count)"\s*:\s*[\d.]+\s*,?/g, "")
    .replace(/,\s*}/g, "}");
}

/** Does this text actually look like a menu, or just a page from the site? */
function looksLikeMenu(text: string): boolean {
  let hits = 0;
  PRICE_HINT.lastIndex = 0;
  while (PRICE_HINT.exec(text) !== null) {
    hits += 1;
    if (hits >= MENU_CONFIDENCE) {
      PRICE_HINT.lastIndex = 0;
      return true;
    }
  }
  return false;
}

/**
 * Find the site's menu page when the operator pasted some other page of it.
 *
 * People paste the link they have — the home page, "about us", a QR landing
 * page. Rather than send them away to go and find the right one, follow the
 * site's own signposts: its sitemap, and its own navigation links.
 */
async function discoverMenuUrls(html: string, pageUrl: URL): Promise<string[]> {
  const candidates = new Map<string, number>();

  const consider = (href: string) => {
    let candidate: URL;
    try {
      candidate = new URL(href, pageUrl);
    } catch {
      return;
    }
    if (candidate.hostname !== pageUrl.hostname) return;
    if (candidate.protocol !== "https:" && candidate.protocol !== "http:") return;
    if (!MENU_PATH.test(candidate.pathname)) return;

    candidate.hash = "";
    const href2 = candidate.href;
    if (href2 === pageUrl.href || candidates.has(href2)) return;

    // A delivery menu is the one this admin is importing into; after that,
    // prefer the shortest path — "/menu" over "/menu/categories/dine_in".
    const score =
      (/deliver|توصيل/i.test(candidate.pathname) ? -100 : 0) + candidate.pathname.length;
    candidates.set(href2, score);
  };

  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    consider(decodeEntities(match[2] ?? match[3] ?? ""));
  }

  try {
    const sitemap = await fetch(new URL("/sitemap.xml", pageUrl), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(DISCOVERY_FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (sitemap.ok) {
      const xml = (await sitemap.text()).slice(0, MAX_HTML_BYTES);
      for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        consider(match[1]);
      }
    } else {
      await sitemap.body?.cancel();
    }
  } catch {
    // No sitemap, or too slow — the in-page links may still be enough.
  }

  return [...candidates.entries()].sort((a, b) => a[1] - b[1]).map(([href]) => href);
}

/** Image paths sitting in a page's own data, e.g. `"image":"menu_images/x.webp"`. */
const IMAGE_FIELD =
  /"(?:image|image_url|img|photo|picture|thumbnail|cover)"\s*:\s*"([^"?<>\s]{4,180}\.(?:webp|jpe?g|png|avif))"/gi;

/** Object stores a restaurant site is likely to keep its dish photos in. */
const STORAGE_HOST =
  /https:\/\/[a-z0-9][a-z0-9.-]{2,60}\.(?:supabase\.co|cloudinary\.com|amazonaws\.com|cloudfront\.net|digitaloceanspaces\.com|blob\.core\.windows\.net)/gi;

/** Buckets to try when a store needs one and the page never names it. */
const COMMON_BUCKETS = ["images", "media", "assets", "uploads", "public", "menu"];

/** Bounded because each one is a request; the right base is usually first. */
const MAX_IMAGE_BASE_PROBES = 10;

/** Only a couple of bundles are worth opening to find a storage hostname. */
const MAX_CHUNKS_SCANNED = 3;

const IMAGE_PROBE_TIMEOUT_MS = 6_000;

/** Paths without a scheme — the ones that need a base to be usable. */
function collectRelativeImagePaths(payload: string): string[] {
  const paths = new Set<string>();

  IMAGE_FIELD.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMAGE_FIELD.exec(payload)) !== null) {
    const value = match[1];
    if (!/^(?:https?:)?\/\//i.test(value) && !value.startsWith("data:")) {
      paths.add(value.replace(/^\/+/, ""));
    }
    if (paths.size >= 5) break;
  }

  return [...paths];
}

/** Does this URL actually serve an image? One probe, one answer. */
async function servesImage(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      // A single byte is enough to see the status and content type.
      headers: { "User-Agent": USER_AGENT, Range: "bytes=0-0" },
      signal: AbortSignal.timeout(IMAGE_PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    await response.body?.cancel();
    return response.ok && type.startsWith("image/");
  } catch {
    return false;
  }
}

/**
 * Work out where a page's relative dish photos are actually served from.
 *
 * The data says `menu_images/<id>.webp` and the absolute URL only ever exists
 * in the browser, built at render time from an environment variable. So we
 * reconstruct it: find the object store the site talks to — in the page, or
 * failing that in its bundles — then try the handful of shapes that store
 * uses and keep the one that returns an actual image.
 */
async function findImageBase(
  payload: string,
  html: string,
  pageUrl: URL,
): Promise<string | undefined> {
  const [sample] = collectRelativeImagePaths(payload);
  if (!sample) return undefined;

  // Cheapest possible answer: the page already spells one of them out.
  const spelledOut = payload.match(
    new RegExp(`https?://[^"\\s]{4,200}?${sample.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
  );
  if (spelledOut) {
    const base = spelledOut[0].slice(0, spelledOut[0].length - sample.length);
    if (await servesImage(`${base}${sample}`)) return base;
  }

  let hosts = [...new Set(html.match(STORAGE_HOST) ?? [])];

  if (hosts.length === 0) {
    // The hostname lives in an environment variable compiled into a bundle.
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/gi)]
      .map((match) => match[1])
      // The client that talks to the store is set up in the root layout.
      .sort((a, b) => Number(b.includes("layout")) - Number(a.includes("layout")))
      .slice(0, MAX_CHUNKS_SCANNED);

    const bundles = await Promise.all(
      scripts.map(async (src) => {
        try {
          const response = await fetch(new URL(src, pageUrl), {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(IMAGE_PROBE_TIMEOUT_MS),
            cache: "no-store",
          });
          return response.ok ? (await response.text()).slice(0, MAX_HTML_BYTES) : "";
        } catch {
          return "";
        }
      }),
    );

    hosts = [...new Set(bundles.join("").match(STORAGE_HOST) ?? [])];
  }

  const bases: string[] = [];
  const folder = sample.split("/")[0];

  for (const host of hosts.slice(0, 2)) {
    if (host.includes("supabase.co")) {
      // Supabase needs a bucket in the path, and the folder name is very
      // often it — modulo the dash/underscore the two conventions disagree on.
      const buckets = [
        folder,
        folder.replace(/_/g, "-"),
        folder.replace(/-/g, "_"),
        ...COMMON_BUCKETS,
      ];
      for (const bucket of [...new Set(buckets)]) {
        bases.push(`${host}/storage/v1/object/public/${bucket}/`);
      }
    } else {
      bases.push(`${host}/`);
    }
  }

  bases.push(new URL("/", pageUrl).href);

  for (const base of bases.slice(0, MAX_IMAGE_BASE_PROBES)) {
    if (await servesImage(`${base}${sample}`)) return base;
  }

  return undefined;
}

/**
 * Fetch whatever the link points at and return it in a form the scanner can
 * send to Gemini: PDFs and photos go up as-is, web pages go up as text.
 */
export async function fetchMenuSource(
  rawUrl: string,
  /** Set on a discovery follow-up, so a site can't send us round in circles. */
  discovered = false,
  /** Wall-clock cut-off for looking around the site for a better page. */
  deadline = Date.now() + DISCOVERY_BUDGET_MS,
): Promise<MenuSource> {
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

    // Best reading of this page, in preference order: what it renders, then
    // the data it ships without rendering.
    let best: MenuSource | null =
      text.length >= MIN_TEXT_CHARS ? { kind: "text", label, text, images } : null;

    if (isHtml && (!best || !looksLikeMenu(text))) {
      // A single-page app paints nothing but still ships the whole menu — in
      // its script tags, or in a React Server Components stream.
      const payload = compactStructuredPayload(
        [...extractEmbeddedJson(html), extractFlightStream(html)]
          .filter((blob) => blob.length > 0)
          .join("\n\n"),
      ).slice(0, MAX_STRUCTURED_CHARS);

      if (payload.length >= MIN_TEXT_CHARS && (looksLikeMenu(payload) || !best)) {
        best = {
          kind: "text",
          label,
          text: payload,
          images,
          structured: true,
          imageBase: await findImageBase(payload, html, url),
        };
      }
    }

    // Still not a menu? The operator probably pasted the home page or an
    // "about us" — ask the site itself where its menu lives.
    if (isHtml && !discovered && Date.now() < deadline && (!best || !looksLikeMenu(best.text))) {
      for (const candidate of (await discoverMenuUrls(html, url)).slice(0, 2)) {
        if (Date.now() >= deadline) break;
        try {
          const found = await fetchMenuSource(candidate, true, deadline);
          if (found.kind === "binary" || looksLikeMenu(found.text)) return found;
        } catch {
          // That page didn't work out either — try the next signpost.
        }
      }
    }

    if (best) return best;

    throw new MenuSourceError(
      `That page's menu is drawn by JavaScript, so there was no text to read (${url.hostname} sent an empty page). Open it in a browser, save it as a PDF or screenshot, and upload that instead.`,
      422,
    );
  }

  await response.body?.cancel();
  throw new MenuSourceError(
    "That link isn't a menu page, PDF or image. Paste a link to the menu itself, or upload the file.",
  );
}
