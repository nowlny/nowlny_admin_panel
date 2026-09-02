import { MenuSourceError } from "./menuSource";

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

/** These payloads are a few hundred KB at most. */
const MAX_JSON_BYTES = 8 * 1024 * 1024;

/** Slugs are path segments on a host we hard-code, so keep them boring. */
const SLUG = /^[a-z0-9][a-z0-9._-]{0,80}$/i;

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
      }[];
    }[];
  };
  images: string[];
}

async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
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

async function adaptStorec(slug: string): Promise<AdaptedMenu> {
  const payload = asRecord(await getJson(`https://storec.app/api/menu/categories/${slug}`));
  const rawCategories = asArray(asRecord(payload.menu).categories);

  if (rawCategories.length === 0) {
    throw new MenuSourceError("That store's menu is empty.", 422);
  }

  const images: string[] = [];
  const imageRefs = new Map<string, number>();

  /** Uploads are stored as paths relative to the site root. */
  const registerImage = (path: string): number | undefined => {
    const clean = text(path);
    if (!clean) return undefined;

    const href = new URL(clean, "https://storec.app/").href;
    const existing = imageRefs.get(href);
    if (existing) return existing;

    images.push(href);
    imageRefs.set(href, images.length);
    return images.length;
  };

  const arabic = ARABIC.test(
    rawCategories.map((category) => text(asRecord(category).title)).join(""),
  );

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

  const details = asRecord(
    await getJson(`https://storec.app/api/storeDetails/${slug}`).catch(() => ({})),
  );

  return { label: text(details.name) || slug, data: { categories }, images };
}

/**
 * Import a menu straight from its platform, when the link points at one we
 * know. Returns null for every other link, which then goes through the
 * fetch-and-let-the-model-read-it path.
 */
export async function tryStorefrontMenu(rawUrl: string): Promise<AdaptedMenu | null> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const slug = storecSlug(url);
  if (slug) return adaptStorec(slug);

  return null;
}
