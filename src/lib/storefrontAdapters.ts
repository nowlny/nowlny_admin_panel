import { MenuSourceError } from "./menuSourceError";
import { fetchPublic } from "./httpFallback";

/**
 * Direct importers for storefront platforms whose menus we can read exactly.
 *
 * A link to one of these is a single-page app: the HTML is an empty shell and
 * the menu arrives later from the platform's own API. Rather than tell the
 * operator to go and screenshot it, we read that API and map it ourselves.
 *
 * Doing it here rather than through the model is not just a shortcut — it is
 * more faithful. A 235-dish menu round-tripped through an LLM loses items and
 * nudges prices; a field mapping cannot. The model is still used afterwards,
 * for the one thing it is genuinely needed for: English photo-search phrases
 * for dishes the store has no picture of.
 */

const FETCH_TIMEOUT_MS = 15_000;

/** Some platforms answer differently to anything that isn't a browser. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Safari/537.36 NowlnyMenuImporter/1.0 (+https://nowlny.com)";

/** These payloads are a few hundred KB at most. */
const MAX_JSON_BYTES = 8 * 1024 * 1024;

/** Slugs are path segments on a host we hard-code, so keep them boring. */
const SLUG = /^[a-z0-9][a-z0-9._-]{0,80}$/i;

/**
 * What a platform can give us, best first:
 *  - `menu`      the dishes themselves, mapped field for field (no model needed)
 *  - `documents` page images to OCR, e.g. a QR menu that is really 11 posters
 *  - `text`      the platform's own JSON, for the model to read
 *  - `follow`    the QR just points somewhere else; scan that instead
 */
export type StorefrontResult =
  | ({ kind: "menu" } & AdaptedMenu)
  | { kind: "documents"; label: string; documents: { mimeType: string; base64: string }[] }
  | { kind: "text"; label: string; text: string }
  | { kind: "follow"; url: string };

/** Shaped exactly like the model's own output, so it normalizes identically. */
export interface AdaptedMenu {
  /** Store name, for the "Source:" line in the preview. */
  label: string;
  data: {
    categories: {
      name: string;
      items: {
        name: string;
        description?: string;
        price: number;
        /** 1-based index into `images`. */
        imageRef?: number;
        isAvailable: boolean;
        /** Modifiers, in the shape `normalizeParsedMenu` reads. */
        optionGroups?: {
          name: string;
          type: "radio" | "checkbox";
          isRequired: boolean;
          options: { name: string; price: number }[];
        }[];
      }[];
    }[];
  };
  images: string[];
}

async function getJson(
  url: string,
  /**
   * Off for an address that came out of someone else's JavaScript: the caller
   * vetted *this* URL against private address space, not wherever it might
   * redirect to. A 3xx then simply reads as "not ok".
   */
  { followRedirects = true }: { followRedirects?: boolean } = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchPublic(url, {
      headers: { Accept: "application/json", "User-Agent": BROWSER_UA },
      redirect: followRedirects ? "follow" : "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[storefront] fetch failed:", error);
    throw new MenuSourceError(
      "Couldn't reach that store's menu. Try again in a moment.",
      502,
    );
  }

  if (response.status === 404) {
    throw new MenuSourceError("That store doesn't exist, or its menu is not public.", 404);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new MenuSourceError(`That store's menu service answered with an error (${response.status}).`, 502);
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) {
    throw new MenuSourceError("That menu is too large to import in one go.", 413);
  }

  try {
    return await response.json();
  } catch {
    throw new MenuSourceError("That store returned a menu we couldn't read.", 502);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** `order` decides the menu's own sequence; missing ones sink to the bottom. */
function byOrder(a: unknown, b: unknown): number {
  const left = Number(asRecord(a).order);
  const right = Number(asRecord(b).order);
  return (Number.isFinite(left) ? left : 1e9) - (Number.isFinite(right) ? right : 1e9);
}

const ARABIC = /[؀-ۿ]/;
const ARABIC_LETTERS = /[؀-ۿ]/g;
const LATIN_LETTERS = /[A-Za-z]/g;

/**
 * Sizes come through as bare `s`/`m`/`l`, which would import as a dish called
 * "Pizza (l)". Spelled out in the menu's own language instead.
 */
function sizeLabel(size: string, arabic: boolean): string {
  const key = size.trim().toLowerCase();
  if (!key || key === "none") return "";

  const labels: Record<string, [string, string]> = {
    s: ["Small", "صغير"],
    m: ["Medium", "وسط"],
    l: ["Large", "كبير"],
    xl: ["Extra large", "كبير جدًا"],
  };

  const known = labels[key];
  if (known) return arabic ? known[1] : known[0];
  return size.trim();
}

/** storec.app — `https://storec.app/store/<slug>`. */
function storecSlug(url: URL): string | null {
  if (url.hostname !== "storec.app" && !url.hostname.endsWith(".storec.app")) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  // Both the public page and the API link people copy out of devtools.
  const slug =
    segments[0] === "store" && segments[1]
      ? segments[1]
      : segments[0] === "api" && segments[1] === "menu" && segments[2] === "categories"
        ? segments[3]
        : null;

  return slug && SLUG.test(slug) ? slug : null;
}

/**
 * Does this look like what storec's menu endpoint answers with? The hosted
 * platform and a restaurant running its own copy of the app share the shape.
 */
export function isStorecMenuPayload(payload: unknown): boolean {
  return asArray(asRecord(asRecord(payload).menu).categories).some((rawCategory) =>
    asArray(asRecord(rawCategory).items).some((rawItem) => {
      const item = asRecord(rawItem);
      return "title" in item && ("priceOptions" in item || "images" in item);
    }),
  );
}

/**
 * Map a storec menu payload field for field.
 *
 * `imageOrigin` is where the relative upload paths live: storec.app itself for
 * a hosted store, the site's own backend for a self-hosted one — which stores
 * them with Windows separators (`uploads\images\x.jpeg`). It is empty when
 * the operator pasted the payload in without saying where it came from, and
 * every dish then simply imports without its picture.
 *
 * A payload can carry several branches, each with its own copy of every
 * category. The admin imports into one restaurant, so the branch with the most
 * dishes is taken and named in the label; the operator can see which one they
 * got rather than receiving every category twice.
 */
export function mapStorecMenu(
  payload: Record<string, unknown>,
  imageOrigin: string,
  label: string,
): AdaptedMenu {
  let rawCategories = asArray(asRecord(payload.menu).categories);

  if (rawCategories.length === 0) {
    throw new MenuSourceError("That store's menu is empty.", 422);
  }

  const dishesPerBranch = new Map<string, number>();
  for (const rawCategory of rawCategories) {
    const category = asRecord(rawCategory);
    const branch = text(category.branchCode);
    if (branch) {
      dishesPerBranch.set(
        branch,
        (dishesPerBranch.get(branch) ?? 0) + asArray(category.items).length,
      );
    }
  }

  let branchLabel = "";
  if (dishesPerBranch.size > 1) {
    const [primary] = [...dishesPerBranch.entries()].sort((a, b) => b[1] - a[1])[0];
    rawCategories = rawCategories.filter(
      (rawCategory) => text(asRecord(rawCategory).branchCode) === primary,
    );
    branchLabel = primary.replace(/[_-]+/g, " ");
  }

  const images: string[] = [];
  const imageRefs = new Map<string, number>();

  /** Uploads are stored as paths relative to the site root. */
  const registerImage = (path: string): number | undefined => {
    const clean = text(path).replace(/\\/g, "/");
    if (!clean) return undefined;

    let href: string;
    try {
      href = new URL(clean, imageOrigin).href;
    } catch {
      return undefined;
    }
    const existing = imageRefs.get(href);
    if (existing) return existing;

    images.push(href);
    imageRefs.set(href, images.length);
    return images.length;
  };

  // Size labels follow the menu's main language. Bilingual menus put Arabic in
  // a title here and there, so one Arabic word must not flip an English menu.
  const names = rawCategories
    .flatMap((rawCategory) => [
      text(asRecord(rawCategory).title),
      ...asArray(asRecord(rawCategory).items).map((rawItem) => text(asRecord(rawItem).title)),
    ])
    .join(" ");
  const arabic = (names.match(ARABIC_LETTERS)?.length ?? 0) > (names.match(LATIN_LETTERS)?.length ?? 0);

  const categories = rawCategories
    .slice()
    .sort(byOrder)
    .map((rawCategory) => {
      const category = asRecord(rawCategory);
      const items = asArray(category.items)
        .slice()
        .sort(byOrder)
        .flatMap((rawItem) => {
          const item = asRecord(rawItem);
          const name = text(item.title);
          if (!name) return [];

          const description = text(item.description) || undefined;
          const isAvailable = item.available !== false;
          const firstImage = asArray(item.images)
            .map((image) => text(asRecord(image).image))
            .find(Boolean);
          const imageRef = firstImage ? registerImage(firstImage) : undefined;

          const options = asArray(item.priceOptions)
            .map((option) => asRecord(option))
            .filter((option) => Number.isFinite(Number(option.price)));

          if (options.length === 0) {
            return [{ name, description, price: 0, imageRef, isAvailable }];
          }

          // One dish per size, because the menu we import into prices a dish
          // once. A single unnamed option stays a plain dish.
          return options.map((option) => {
            const label = options.length > 1 ? sizeLabel(text(option.size), arabic) : "";
            return {
              name: label ? `${name} - ${label}` : name,
              description,
              price: Number(option.price),
              imageRef,
              isAvailable,
            };
          });
        });

      return { name: text(category.title), items };
    })
    .filter((category) => category.items.length > 0);

  if (categories.length === 0) {
    throw new MenuSourceError("That store's menu has no dishes in it yet.", 422);
  }

  return {
    label: branchLabel ? `${label} (${branchLabel})` : label,
    data: { categories },
    images,
  };
}

async function adaptStorec(slug: string): Promise<AdaptedMenu> {
  const payload = asRecord(await getJson(`https://storec.app/api/menu/categories/${slug}`));
  const details = asRecord(
    await getJson(`https://storec.app/api/storeDetails/${slug}`).catch(() => ({})),
  );
  return mapStorecMenu(payload, "https://storec.app/", text(details.name) || slug);
}

/**
 * A restaurant running its own copy of the storec app, on its own domain, with
 * the backend somewhere else entirely. The page is the usual empty React
 * shell; `apiUrl` and `serverUrl` are the constants its bundle was built with,
 * found and vetted against private address space by `menuSource`.
 *
 * Returns null when the backend is not storec after all, so the caller can go
 * on looking; a storec backend with nothing on it is reported as such.
 */
export async function adaptSelfHostedStorec(
  apiUrl: string,
  serverUrl: string,
  label: string,
): Promise<AdaptedMenu | null> {
  let payload: unknown;
  try {
    payload = await getJson(`${apiUrl.replace(/\/+$/, "")}/menu/categories`, {
      followRedirects: false,
    });
  } catch {
    return null;
  }

  if (!isStorecMenuPayload(payload)) return null;
  return mapStorecMenu(asRecord(payload), `${serverUrl.replace(/\/+$/, "")}/`, label);
}


/**
 * The other shape a restaurant backend hands out: categories with their items
 * nested straight inside them, each item carrying its own name, price, picture
 * and — the reason this is worth mapping rather than reading — a tree of
 * option groups several times the size of the menu itself.
 *
 * Validated against hivehub.systems, whose 90-dish menu arrives as 216 KB of
 * JSON, 1,179 entries of which are add-on choices that must not become dishes.
 * The shape is generic enough that other backends fit it too, which is why it
 * is named for the shape and not for a platform.
 */
export function isCategoryItemsMenuPayload(payload: unknown): boolean {
  return asArray(asRecord(payload).categories).some((rawCategory) =>
    asArray(asRecord(rawCategory).items).some((rawItem) => {
      const item = asRecord(rawItem);
      return (
        text(item.name) !== "" &&
        (Number.isFinite(Number(item.price)) || Number.isFinite(Number(item.finalPrice)))
      );
    }),
  );
}

/** `sort` is this shape's own ordering key; missing ones sink to the bottom. */
function bySort(a: unknown, b: unknown): number {
  const left = Number(asRecord(a).sort);
  const right = Number(asRecord(b).sort);
  return (Number.isFinite(left) ? left : 1e9) - (Number.isFinite(right) ? right : 1e9);
}

/**
 * Map a categories-with-items payload field for field.
 *
 * Bilingual menus store the second language in parallel `_ar` keys. The store
 * says which one it actually publishes in (`settings.menu_language`), and that
 * choice is honoured per field so a dish translated on one side only still
 * imports with a name.
 */
export function mapCategoryItemsMenu(
  payload: Record<string, unknown>,
  imageOrigin: string,
  label: string,
): AdaptedMenu {
  const settings = asRecord(payload.settings);
  const arabic = text(settings.menu_language).toLowerCase().startsWith("ar");

  /** The published language first, the other as a fallback. */
  const localized = (record: Record<string, unknown>, key: string): string => {
    const arabicText = text(record[`${key}_ar`]);
    const latinText = text(record[key]);
    return (arabic ? arabicText || latinText : latinText || arabicText) || "";
  };

  const images: string[] = [];
  const imageRefs = new Map<string, number>();

  const registerImage = (path: string): number | undefined => {
    const clean = text(path).replace(/\\/g, "/");
    if (!clean) return undefined;

    let href: string;
    try {
      href = new URL(clean, imageOrigin).href;
    } catch {
      return undefined;
    }
    const existing = imageRefs.get(href);
    if (existing) return existing;

    images.push(href);
    imageRefs.set(href, images.length);
    return images.length;
  };

  const categories = asArray(payload.categories)
    .slice()
    .sort(bySort)
    .map((rawCategory) => {
      const category = asRecord(rawCategory);

      const items = asArray(category.items)
        .slice()
        .sort(bySort)
        .flatMap((rawItem) => {
          const item = asRecord(rawItem);
          const name = localized(item, "name");
          if (!name) return [];

          // A discounted store prices its dishes twice; the customer pays the
          // final one, so that is the one the menu has to carry.
          const final = Number(item.finalPrice);
          const listed = Number(item.price);
          const price = Number.isFinite(final) ? final : Number.isFinite(listed) ? listed : 0;

          /*
           * Modifiers map straight across: this platform's choices are priced
           * the way ours are — as what they add to the dish, free ones at
           * zero — so "Replace Dough / Oat Dough +100,000" survives the import
           * as the same question the customer was being asked before.
           *
           * `required` is the only thing said about how many may be picked, so
           * a group that must be answered becomes a single choice and every
           * other group stays multi-select.
           */
          const optionGroups = asArray(item.optionGroups)
            .slice()
            .sort(bySort)
            .flatMap((rawGroup) => {
              const group = asRecord(rawGroup);
              const groupName = localized(group, "name");
              if (!groupName) return [];

              const options = asArray(group.choices)
                .slice()
                .sort(bySort)
                .flatMap((rawChoice) => {
                  const choice = asRecord(rawChoice);
                  const choiceName = localized(choice, "name");
                  // A sold-out choice would import as one nobody can pick:
                  // our options carry no availability of their own.
                  if (!choiceName || choice.available === false) return [];

                  const surcharge = Number(choice.price);
                  return [
                    {
                      name: choiceName,
                      price: Number.isFinite(surcharge) && surcharge > 0 ? surcharge : 0,
                    },
                  ];
                });

              if (options.length === 0) return [];

              const isRequired = group.required === true;
              return [
                {
                  name: groupName,
                  type: (isRequired ? "radio" : "checkbox") as "radio" | "checkbox",
                  isRequired,
                  options,
                },
              ];
            });

          return [
            {
              name,
              description: localized(item, "description") || undefined,
              price,
              imageRef: registerImage(text(item.image)),
              isAvailable: item.available !== false,
              ...(optionGroups.length ? { optionGroups } : {}),
            },
          ];
        });

      return { name: localized(category, "name"), items };
    })
    .filter((category) => category.items.length > 0);

  if (categories.length === 0) {
    throw new MenuSourceError("That store's menu has no dishes in it yet.", 422);
  }

  return { label, data: { categories }, images };
}


/** Menu posters are read at full size; OCR on a 400px thumbnail loses prices. */
const QRFY_IMAGE_BASE = "https://img.qrfy.com/img/original/";

/** A QR menu is a handful of posters. More than this is not a menu. */
const MAX_QRFY_IMAGES = 15;

/** Total base64 across all pages, keeping the upstream request sane. */
const MAX_QRFY_TOTAL_BYTES = 9 * 1024 * 1024;

/** qrfy.io — `https://qrfy.io/p/<uri>`. */
function qrfyUri(url: URL): string | null {
  if (!/(^|\.)qrfy\.(io|com)$/.test(url.hostname)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const uri =
    (segments[0] === "p" || segments[0] === "preview" || segments[0] === "r") && segments[1]
      ? segments[1]
      : null;

  return uri && SLUG.test(uri) ? uri : null;
}

async function fetchImage(url: string): Promise<{ mimeType: string; base64: string } | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    return { mimeType: contentType, base64: bytes.toString("base64") };
  } catch (error) {
    console.warn("[storefront] page image failed:", error);
    return null;
  }
}

/**
 * qrfy QR codes are a wrapper, not a menu format: the same link can carry a
 * gallery of menu posters, a structured payload, or just a redirect. Each ends
 * up on the branch that can actually read it.
 */
async function adaptQrfy(uri: string): Promise<StorefrontResult> {
  let payload: Record<string, unknown>;
  try {
    const response = await fetch(`https://qrfy.io/api/qr/uri/${uri}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 404) {
      throw new MenuSourceError("That QR menu doesn't exist any more.", 404);
    }
    if (!response.ok) {
      throw new MenuSourceError(`That QR menu couldn't be opened (${response.status}).`, 502);
    }
    payload = asRecord(await response.json());
  } catch (error) {
    if (error instanceof MenuSourceError) throw error;
    console.error("[storefront] qrfy fetch failed:", error);
    throw new MenuSourceError("Couldn't reach that QR menu. Try again in a moment.", 502);
  }

  if (payload.accessPassword === true) {
    throw new MenuSourceError("That QR menu is password protected, so it can't be scanned.", 422);
  }

  const data = asRecord(payload.data);
  const label = text(payload.name) || text(data.title) || uri;

  const files = asArray(data.images)
    .map((image) => text(typeof image === "string" ? image : asRecord(image).file))
    .filter(Boolean)
    .slice(0, MAX_QRFY_IMAGES);

  if (files.length > 0) {
    const pages = await Promise.all(
      files.map((file) => fetchImage(`${QRFY_IMAGE_BASE}${encodeURIComponent(file)}`)),
    );

    const documents: { mimeType: string; base64: string }[] = [];
    let total = 0;
    for (const page of pages) {
      if (!page) continue;
      total += page.base64.length;
      if (total > MAX_QRFY_TOTAL_BYTES) break;
      documents.push(page);
    }

    if (documents.length === 0) {
      throw new MenuSourceError("That QR menu's pages couldn't be downloaded.", 502);
    }
    return { kind: "documents", label, documents };
  }

  // A QR that is only a redirect — scan whatever it actually points at.
  const target = text(data.url) || text(payload.url);
  if (/^https?:\/\//i.test(target)) return { kind: "follow", url: target };

  // Anything else: hand the platform's own payload to the model.
  const json = JSON.stringify(data);
  if (json.length > 40) return { kind: "text", label, text: json };

  throw new MenuSourceError(
    "That QR code doesn't hold a menu we can read. Upload the menu file instead.",
    422,
  );
}


/** Item names on POS-backed menus arrive numbered: "2.Chicken Noodle Soup". */
const LEADING_ITEM_NUMBER = /^\d{1,3}\s*[.)\-]\s*(?=[^\d\s])/;

/** Cookies a site hands out, as a lookup. */
function readCookies(response: Response): Map<string, string> {
  const jar = new Map<string, string>();
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];

  for (const cookie of raw) {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  return jar;
}

/** Omega Software menus — `https://menu.omegasoftware.ca/<slug>`. */
function omegaSlug(url: URL): string | null {
  if (!/(^|\.)omegasoftware\.ca$/i.test(url.hostname)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;

  // The app reads its own id off the URL the same way: everything before the
  // first "-", which is where it hangs table numbers and survey codes.
  const slug = last.split("-")[0];
  return SLUG.test(slug) ? slug : null;
}

/**
 * Omega Software runs an AngularJS front end over a Laravel back end: the page
 * is an empty template and the menu arrives from a POST that is CSRF-guarded.
 *
 * So we do exactly what the page's own code does — load it for the session and
 * `XSRF-TOKEN` cookie, then send that token back in the `X-XSRF-TOKEN` header.
 * Without the header the endpoint answers 500 with no explanation, which is
 * what made this platform look unreadable.
 */
async function adaptOmega(origin: string, slug: string): Promise<StorefrontResult> {
  let jar: Map<string, string>;
  try {
    const page = await fetch(`${origin}/${slug}`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    jar = readCookies(page);
    await page.body?.cancel();
  } catch (error) {
    console.error("[storefront] omega page fetch failed:", error);
    throw new MenuSourceError("Couldn't open that menu. Try again in a moment.", 502);
  }

  const token = jar.get("XSRF-TOKEN");
  if (!token) {
    throw new MenuSourceError("That menu didn't let us in. Upload the menu file instead.", 502);
  }

  const cookieHeader = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");

  let payload: Record<string, unknown>;
  try {
    const response = await fetch(`${origin}/getRestaurantMenu`, {
      method: "POST",
      headers: {
        "User-Agent": BROWSER_UA,
        "Content-Type": "application/json;charset=utf-8",
        Accept: "application/json, text/plain, */*",
        // Laravel accepts the encrypted cookie value here; Angular sends it
        // url-decoded, and so must we.
        "X-XSRF-TOKEN": decodeURIComponent(token),
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader,
        Referer: `${origin}/${slug}`,
      },
      body: JSON.stringify({ customerid: slug, has_table: 0 }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new MenuSourceError(
        `That menu couldn't be read (${response.status}). Upload the menu file instead.`,
        502,
      );
    }
    payload = asRecord(await response.json());
  } catch (error) {
    if (error instanceof MenuSourceError) throw error;
    console.error("[storefront] omega menu fetch failed:", error);
    throw new MenuSourceError("Couldn't reach that menu. Try again in a moment.", 502);
  }

  const images: string[] = [];
  const imageRefs = new Map<string, number>();

  const registerImage = (raw: unknown): number | undefined => {
    const href = text(raw);
    if (!/^https:\/\//i.test(href)) return undefined;

    const existing = imageRefs.get(href);
    if (existing) return existing;

    images.push(href);
    imageRefs.set(href, images.length);
    return images.length;
  };

  const arabic = ARABIC.test(JSON.stringify(payload.menu ?? ""));

  const categories = asArray(payload.menu).map((rawSection) => {
    const section = asRecord(rawSection);
    const groups = asArray(section.groups).map((group) => asRecord(group));

    const items = groups.flatMap((group) =>
      asArray(group.items).flatMap((rawItem) => {
        const item = asRecord(rawItem);
        // `A*` fields are the second language slot; either can be the empty one.
        const name = (text(item.ITEMNAME) || text(item.AITEMNAME)).replace(
          LEADING_ITEM_NUMBER,
          "",
        );
        if (!name) return [];

        const description =
          text(item.ITEMDESCRIPTION) || text(item.AITEMDESCRIPTION) || undefined;
        const imageRef = registerImage(item.PIC);
        const sizes = asArray(item.sizes).map((size) => asRecord(size));

        if (sizes.length > 1) {
          return sizes.map((size) => {
            const label = sizeLabel(
              text(size.SIZENAME) || text(size.NAME) || text(size.DESCRIPTION),
              arabic,
            );
            return {
              name: label ? `${name} - ${label}` : name,
              description,
              price: Number(size.PRICE) || 0,
              imageRef,
              isAvailable: true,
            };
          });
        }

        return [
          {
            name,
            description,
            price: Number(item.PRICE) || Number(sizes[0]?.PRICE) || 0,
            imageRef,
            isAvailable: true,
          },
        ];
      }),
    );

    const name =
      text(section.DESCRIPTION) ||
      text(section.ADESCRIPTION) ||
      text(groups[0]?.GROUPNAME) ||
      "";

    return { name, items };
  });

  const withItems = categories.filter((category) => category.items.length > 0);
  if (withItems.length === 0) {
    throw new MenuSourceError("That menu has no dishes in it yet.", 422);
  }

  const branch = asRecord(payload.branch);
  const label = text(branch.BARANCHNAME) || text(branch.OTHERNAME) || slug;

  return { kind: "menu", label, data: { categories: withItems }, images };
}

/* ── MoviYum ──────────────────────────────────────────────────────────────────
   `https://<store>.moviyum.com`. A Vue app that renders the menu client-side,
   so fetching the page yields markup with no dishes in it — the operator was
   told to screenshot the site and upload that instead. It doesn't need OCR at
   all: the same JSON its own frontend reads is public, and one request to
   `/api/v1/categories` returns every category with its products nested inside,
   prices, descriptions and photos included.
--------------------------------------------------------------------------- */

const MOVIYUM_SUFFIX = ".moviyum.com";

function moviyumOrigin(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!host.endsWith(MOVIYUM_SUFFIX)) return null;

  // The bare domain and `www` are the platform's own site, not a storefront.
  const store = host.slice(0, -MOVIYUM_SUFFIX.length);
  if (!store || store === "www" || !SLUG.test(store)) return null;

  return `https://${host}`;
}

/**
 * The store's own name, for the "Source:" line. Best-effort: it lives in the
 * `appConfig` blob the page inlines, and the menu import is worth doing with or
 * without it.
 */
async function moviyumStoreName(origin: string): Promise<string> {
  try {
    const response = await fetch(origin, {
      headers: { "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      return "";
    }

    const html = (await response.text()).slice(0, 200_000);
    const configured = /\bappName:\s*"([^"]{1,120})"/.exec(html);
    if (configured) return configured[1].trim();

    const titled = /<title>([^<]{1,160})<\/title>/i.exec(html);
    return titled ? titled[1].replace(/\s*by\s+MoviYum\s*$/i, "").trim() : "";
  } catch {
    return "";
  }
}

async function adaptMoviyum(origin: string): Promise<AdaptedMenu> {
  const payload = asRecord(await getJson(`${origin}/api/v1/categories`));
  const rawCategories = asArray(payload.data);

  if (rawCategories.length === 0) {
    throw new MenuSourceError("That store's menu is empty.", 422);
  }

  const images: string[] = [];
  const imageRefs = new Map<string, number>();

  const registerImage = (path: string): number | undefined => {
    const clean = text(path);
    if (!clean) return undefined;

    let href: string;
    try {
      // Uploads come through absolute, but some filenames carry spaces —
      // `new URL` percent-encodes them so the fetch doesn't 404.
      href = new URL(clean, origin).href;
    } catch {
      return undefined;
    }

    const existing = imageRefs.get(href);
    if (existing) return existing;

    images.push(href);
    imageRefs.set(href, images.length);
    return images.length;
  };

  type Item = AdaptedMenu["data"]["categories"][number]["items"][number];
  const grouped = new Map<string, Item[]>();

  for (const rawCategory of rawCategories) {
    const category = asRecord(rawCategory);
    const categoryName = text(category.name);
    if (!categoryName) continue;

    // A category can be split into sub-categories the storefront renders as
    // headings; flattened into "Category - Sub" so neither name is lost.
    const subNames = new Map<string, string>();
    for (const rawSub of asArray(category.sub_category)) {
      const sub = asRecord(rawSub);
      const subName = text(sub.name);
      if (subName) subNames.set(String(sub.id), subName);
    }

    for (const rawProduct of asArray(category.products)) {
      const product = asRecord(rawProduct);
      const name = text(product.name);
      if (!name) continue;

      // A discounted dish imports at what a customer actually pays.
      const listed = Number(product.price);
      const special = Number(product.special_price);
      const price =
        product.has_discount && Number.isFinite(special) && special > 0
          ? special
          : Number.isFinite(listed)
            ? listed
            : 0;

      const item: Item = {
        name,
        description: text(product.description) || undefined,
        price,
        imageRef: registerImage(text(product.image)),
        // `status` is 0 for a dish the store has switched off.
        isAvailable: Number(product.status) !== 0,
      };

      const subName = subNames.get(String(product.sub_category_id)) ?? "";
      const key = subName ? `${categoryName} - ${subName}` : categoryName;
      const bucket = grouped.get(key);
      if (bucket) bucket.push(item);
      else grouped.set(key, [item]);
    }
  }

  const categories = [...grouped].map(([name, items]) => ({ name, items }));

  if (categories.length === 0) {
    throw new MenuSourceError("That store's menu has no dishes in it yet.", 422);
  }

  const label = await moviyumStoreName(origin);
  return {
    label: label || new URL(origin).hostname,
    data: { categories },
    images,
  };
}

/**
 * Import a menu straight from its platform, when the link points at one we
 * know. Returns null for every other link, which then goes through the
 * fetch-and-let-the-model-read-it path.
 */
export async function tryStorefrontMenu(rawUrl: string): Promise<StorefrontResult | null> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const slug = storecSlug(url);
  if (slug) return { kind: "menu", ...(await adaptStorec(slug)) };

  const uri = qrfyUri(url);
  if (uri) return adaptQrfy(uri);

  const omega = omegaSlug(url);
  if (omega) return adaptOmega(url.origin, omega);

  const moviyum = moviyumOrigin(url);
  if (moviyum) return { kind: "menu", ...(await adaptMoviyum(moviyum)) };

  return null;
}
