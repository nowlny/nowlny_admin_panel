/**
 * Cleanup for whatever the Gemini menu scanner returns.
 *
 * The model returns free-form JSON, so nothing it sends can be trusted to be
 * the right type: prices arrive as `"12.99 $"`, items arrive with no name, and
 * headings arrive with nothing under them. Everything the import writes to the
 * live menu goes through here first.
 */

/** Arabic, Persian and Urdu letters — enough to tell the script apart. */
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

export interface NormalizedItem {
  name: string;
  description?: string;
  price: number;
  /** English search phrase, used by `/api/menu-images` when there is no photo. */
  imageQuery?: string;
  image?: string;
  isAvailable: boolean;
}

function asText(value: unknown, maxChars: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Arabic menus routinely print prices in Arabic-Indic numerals (`٢٥٫٥٠`), which
 * `Number()` reads as NaN. Fold them to ASCII, mapping the Arabic decimal and
 * thousands separators onto the `.` / `,` the parser below already understands.
 */
function toAsciiDigits(text: string): string {
  return text
    .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/\u066B/g, ".")
    .replace(/\u066C/g, ",");
}

/**
 * Prices come back however they were printed: `12.99`, `"12,50 EGP"`,
 * `"$ 1,299.50"`, `"1.299,50"`. Anything unreadable becomes 0, which the
 * operator then sees as a zero-priced dish in the preview rather than a
 * silently wrong number in the live menu.
 */
function parsePrice(value: unknown): number {
  let text: string;

  if (typeof value === "number") {
    text = String(value);
  } else if (typeof value === "string") {
    text = toAsciiDigits(value).replace(/[^\d.,]/g, "");
  } else {
    return 0;
  }

  const hasComma = text.includes(",");
  const dots = (text.match(/\./g) || []).length;

  if (hasComma && dots > 0) {
    // Whichever separator comes last is the decimal one: "1,299.50" vs "1.299,50".
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (hasComma) {
    // "12,50" is a decimal comma; "1,299" is a thousands separator.
    text = /,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (dots > 1) {
    // "1.299.50" — dots used for thousands, the last one for cents.
    const cents = text.lastIndexOf(".");
    text = text.slice(0, cents).replace(/\./g, "") + text.slice(cents);
  }

  const price = Number(text);
  return Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : 0;
}

/**
 * The model is told to echo the menu's own language back, but a stray English
 * heading on an Arabic menu shouldn't mislabel the whole import — so the tag
 * is confirmed against the script the extracted text is actually written in.
 */
function detectLanguage(claimed: unknown, samples: string[]): string {
  const arabicSamples = samples.filter((sample) => ARABIC_SCRIPT.test(sample)).length;
  if (samples.length > 0 && arabicSamples / samples.length >= 0.3) return "ar";

  const tag = asText(claimed, 5).toLowerCase();
  if (/^[a-z]{2}(-[a-z]{2})?$/.test(tag)) return tag;
  return samples.length > 0 ? "en" : "";
}

/**
 * Shape whatever the model returned into the contract the client renders.
 *
 * Prices arriving as `"12.99 $"` used to reach the preview as a string and
 * blow up on `.toFixed()`, and items with no name were created as blank rows.
 */
export function normalizeParsedMenu(
  raw: unknown,
  /**
   * Photos pulled off the source page, in the order they were numbered in the
   * text handed to the model. It answers with the number rather than the URL —
   * a long CDN address comes back subtly mangled far too often.
   */
  sourceImages: string[] = [],
  /**
   * Base for image paths a page stored relatively (`menu_images/x.webp`).
   * Discovered by `menuSource`, since only the site knows where they live.
   */
  imageBase?: string,
): {
  language: string;
  categories: { name: string; items: NormalizedItem[] }[];
} {
  const root = asRecord(raw);
  const samples: string[] = [];

  const categories = asArray(root.categories)
    .map((rawCategory) => {
      const category = asRecord(rawCategory);
      const name = asText(category.name, 120);

      const items = asArray(category.items)
        .map((rawItem): NormalizedItem | null => {
          const item = asRecord(rawItem);
          const itemName = asText(item.name, 200);
          if (!itemName) return null;

          const description = asText(item.description, 600);

          // `imageRef` is a 1-based index into `sourceImages`; `image` is a URL
          // the model echoed back. https only, so an import can't downgrade the
          // storefront to mixed content.
          const referenced =
            typeof item.imageRef === "number" && Number.isInteger(item.imageRef)
              ? sourceImages[item.imageRef - 1]
              : undefined;
          const raw = referenced ?? asText(item.image, 500);
          // A relative path is only usable once it is put back on the host it
          // came from; anything else has to stand on its own.
          const image =
            raw && imageBase && !/^https?:\/\//i.test(raw)
              ? new URL(raw.replace(/^\/+/, ""), imageBase).href
              : raw;

          samples.push(itemName);
          if (description) samples.push(description);

          return {
            name: itemName,
            description: description || undefined,
            price: parsePrice(item.price),
            imageQuery: asText(item.imageQuery, 120) || undefined,
            image: /^https:\/\//.test(image) ? image : undefined,
            // The scanner has no way to know; a freshly imported dish is on sale.
            isAvailable: item.isAvailable !== false,
          };
        })
        .filter((item): item is NormalizedItem => item !== null);

      if (name) samples.push(name);
      return { name, items };
    })
    // A heading the OCR picked up with nothing under it would import as an
    // empty section the operator then has to delete by hand.
    .filter((category) => category.items.length > 0);

  const language = detectLanguage(root.language, samples);
  // A section still needs a name to be created, but that stand-in has to be
  // written in the menu's language like everything else in this payload.
  const fallbackName = language === "ar" ? "أصناف أخرى" : "Other items";

  return {
    language,
    categories: categories.map((category) => ({
      ...category,
      name: category.name || fallbackName,
    })),
  };
}
