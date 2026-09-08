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

/** One choice a customer can pick. `price` is what it adds to the dish. */
export interface NormalizedOption {
  name: string;
  price: number;
}

/**
 * A set of choices attached to a dish — "Replace Dough", "Add Ingredients".
 *
 * `radio` means pick exactly one, `checkbox` any number, matching what the
 * platform's own option groups mean.
 */
export interface NormalizedOptionGroup {
  name: string;
  type: "radio" | "checkbox";
  isRequired: boolean;
  options: NormalizedOption[];
}

export interface NormalizedItem {
  name: string;
  description?: string;
  price: number;
  /** English search phrase, used by `/api/menu-images` when there is no photo. */
  imageQuery?: string;
  image?: string;
  isAvailable: boolean;
  /** Left out entirely when the dish has no modifiers. */
  optionGroups?: NormalizedOptionGroup[];
}

/**
 * A dish as it comes out of the first pass, before the menu's language is
 * known.
 *
 * The ingredients are the reason this type exists: they are not a field the
 * platform has — a menu item is a name, a description and a price — so they
 * leave here as a description and as a group of things a customer can ask to
 * have left out. Naming that group needs the language, and the language is
 * only settled once every item has been read, so they are carried this far
 * and no further.
 */
interface ScannedItem extends NormalizedItem {
  ingredients?: string[];
}

/**
 * Ceilings on what one dish can carry out of a source we do not control.
 *
 * A menu with 40 groups on a dish is a payload we have misread, and creating
 * them means one API call each against the restaurant being onboarded.
 */
const MAX_GROUPS_PER_ITEM = 20;
const MAX_OPTIONS_PER_GROUP = 60;

/**
 * Past this, an "ingredients" list is a description that got split on commas.
 *
 * It is also what a customer is offered to remove, and twenty checkboxes under
 * a sandwich is not a menu.
 */
const MAX_INGREDIENTS = 12;

/** Longer than this is a sentence about the dish, not something in it. */
const MAX_INGREDIENT_CHARS = 60;

/** Separators an ingredient line uses when it arrives as one string. */
const INGREDIENT_SPLIT = /[,،؛;+·•\u2022]|\sو\s|\band\b/gi;

/** Bullets and dashes a list item is printed with. */
const INGREDIENT_BULLET = /^[\s\-–—*•·]+|[\s.،,]+$/g;

/**
 * The group that lets a customer drop an ingredient, named per language.
 *
 * The model is asked for this phrase in the menu's own language, so these are
 * only the fallback — for a menu read by an adapter, where no model was
 * involved, and for a model that left the field out.
 */
const REMOVE_LABEL: Record<string, string> = {
  ar: "إزالة المكونات",
  en: "Remove ingredients",
};

/**
 * A group that already asks what to leave out.
 *
 * A menu that prints "Without: onions, pickles" gets that group from the
 * scanner directly, and building a second one out of the same ingredients
 * would ask the customer the same question twice.
 */
const REMOVAL_GROUP = /remove|without|no onions|بدون|إزالة|احذف/i;

/**
 * What a dish is made of, however the scanner or the payload phrased it.
 *
 * Accepts the array it is asked for, the single comma-separated string a model
 * returns when it forgets, and the `[{ name }]` objects a platform's own API
 * tends to use.
 */
function normalizeIngredients(value: unknown): string[] {
  const raw =
    typeof value === "string"
      ? value.split(INGREDIENT_SPLIT)
      : asArray(value).map((entry) =>
          typeof entry === "string" ? entry : asText(asRecord(entry).name, 200),
        );

  const seen = new Set<string>();
  const ingredients: string[] = [];

  for (const entry of raw) {
    const name = asText(entry, 200).replace(INGREDIENT_BULLET, "");
    // A price that came along with the word is a modifier, not an ingredient.
    if (!name || name.length > MAX_INGREDIENT_CHARS || !/[\p{L}]/u.test(name)) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    ingredients.push(name);
    if (ingredients.length === MAX_INGREDIENTS) break;
  }

  return ingredients;
}

/**
 * An ingredient list read as a sentence, for a dish the menu describes with
 * nothing at all. Arabic joins its lists with its own comma.
 */
function describeIngredients(ingredients: string[]): string {
  if (ingredients.length < 2) return "";
  const arabic = ARABIC_SCRIPT.test(ingredients.join(" "));
  return ingredients.join(arabic ? "، " : ", ");
}

/**
 * Give a dish the group that lets a customer drop an ingredient.
 *
 * Free, never required, and never single-choice: leaving out the pickles must
 * not stop someone also leaving out the onions. One ingredient is not a
 * choice — nobody orders a coffee without coffee — so those dishes keep the
 * ingredients in their description and get no group.
 */
function finishItem({ ingredients = [], ...item }: ScannedItem, label: string): NormalizedItem {
  const groups = item.optionGroups ?? [];

  if (
    ingredients.length < 2 ||
    groups.length >= MAX_GROUPS_PER_ITEM ||
    groups.some((group) => REMOVAL_GROUP.test(group.name))
  ) {
    return item;
  }

  return {
    ...item,
    optionGroups: [
      ...groups,
      {
        name: label,
        type: "checkbox",
        isRequired: false,
        options: ingredients.map((name) => ({ name, price: 0 })),
      },
    ],
  };
}

/**
 * Shape whatever modifiers came back — from an adapter or from the model —
 * into groups the platform can create.
 *
 * A group with nothing in it is dropped rather than created empty: it would
 * reach the storefront as a heading a customer can't answer.
 */
function normalizeOptionGroups(value: unknown): NormalizedOptionGroup[] {
  return asArray(value)
    .slice(0, MAX_GROUPS_PER_ITEM)
    .map((rawGroup): NormalizedOptionGroup | null => {
      const group = asRecord(rawGroup);
      const name = asText(group.name, 120);
      if (!name) return null;

      const isRequired = group.isRequired === true;
      const seen = new Set<string>();

      const options = asArray(group.options)
        .slice(0, MAX_OPTIONS_PER_GROUP)
        .map((rawOption): NormalizedOption | null => {
          const option = asRecord(rawOption);
          const optionName = asText(option.name, 120);
          if (!optionName) return null;

          // The same choice twice would reach the storefront as two identical
          // radio buttons.
          const key = optionName.toLowerCase();
          if (seen.has(key)) return null;
          seen.add(key);

          return { name: optionName, price: parsePrice(option.price) };
        })
        .filter((option): option is NormalizedOption => option !== null);

      if (options.length === 0) return null;

      // A source that says which kind it is wins; otherwise a group the
      // customer *must* answer can only sensibly be a single choice.
      const claimed = asText(group.type, 10).toLowerCase();
      const type =
        claimed === "radio" || claimed === "checkbox"
          ? (claimed as "radio" | "checkbox")
          : isRequired
            ? "radio"
            : "checkbox";

      return { name, type, isRequired, options };
    })
    .filter((group): group is NormalizedOptionGroup => group !== null);
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
        .map((rawItem): ScannedItem | null => {
          const item = asRecord(rawItem);
          const itemName = asText(item.name, 200);
          if (!itemName) return null;

          const ingredients = normalizeIngredients(item.ingredients);
          // A dish the menu says nothing about is described by what is in it,
          // rather than reaching the storefront as a bare name.
          const description =
            asText(item.description, 600) || describeIngredients(ingredients);

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

          const optionGroups = normalizeOptionGroups(item.optionGroups);
          for (const group of optionGroups) {
            samples.push(group.name);
            for (const option of group.options) samples.push(option.name);
          }
          for (const ingredient of ingredients) samples.push(ingredient);

          return {
            name: itemName,
            description: description || undefined,
            price: parsePrice(item.price),
            imageQuery: asText(item.imageQuery, 120) || undefined,
            image: /^https:\/\//.test(image) ? image : undefined,
            // The scanner has no way to know; a freshly imported dish is on sale.
            isAvailable: item.isAvailable !== false,
            ...(optionGroups.length ? { optionGroups } : {}),
            ...(ingredients.length ? { ingredients } : {}),
          };
        })
        .filter((item): item is ScannedItem => item !== null);

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

  // "Remove ingredients" is a heading a customer reads, so it follows the same
  // language rule as everything else: the scanner is asked for the phrase in
  // the menu's own language, and only a menu read without one falls back.
  const removeLabel =
    asText(root.removeIngredientsLabel, 60) ||
    REMOVE_LABEL[language] ||
    REMOVE_LABEL.en;

  return {
    language,
    categories: categories.map((category) => ({
      ...category,
      name: category.name || fallbackName,
      items: category.items.map((item) => finishItem(item, removeLabel)),
    })),
  };
}
