/**
 * Reading a menu out of laid-out text, with no model involved.
 *
 * A menu is one of the most regular documents there is: a heading, then lines
 * that each end in a price. That regularity is what makes this worth doing
 * without an API key — the structure carries the meaning, and geometry the
 * PDF already has (type size, bold, the gap before a price) tells a heading
 * from a dish more reliably than prose ever could.
 *
 * Kept free of pdf.js so it can be tested as a pure function, and so the same
 * parser can read OCR output later.
 */

export interface ParsedLine {
  text: string;
  page: number;
  fontSize: number;
  bold: boolean;
}

/** One add-on a customer can tick. `price` is what it adds to the dish. */
export interface TextMenuOption {
  name: string;
  price: number;
}

export interface TextMenuItem {
  name: string;
  description?: string;
  price: number;
  /**
   * Add-ons printed for a whole section, given to every dish in it.
   *
   * Always `checkbox` and never required: a printed extras list says what may
   * be added, never that something must be.
   */
  optionGroups?: {
    name: string;
    type: "checkbox";
    isRequired: boolean;
    options: TextMenuOption[];
  }[];
}

export interface TextMenuCategory {
  name: string;
  items: TextMenuItem[];
}

export interface TextMenu {
  language: string;
  categories: TextMenuCategory[];
  /** How many lines produced a dish — the caller's confidence signal. */
  matchedLines: number;
  /** Lines that looked like menu content but carried no price. */
  unmatchedLines: number;
}

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/**
 * Currency marks that may trail a price.
 *
 * Every alternative is fenced by letter boundaries, and that is not fussiness:
 * without them `L\.?L\.?` (Lebanese pounds) matches the "ll" inside "Grill",
 * and "Mixed Grill .... 18.00" imports as a dish called "Mixed Gri".
 */
const CURRENCY_MARKS =
  "\\$|USD|US\\$|LBP|L\\.L\\.?|EGP|AED|SAR|QAR|KWD|BHD|JOD|€|£|₪|ل\\.?ل|ر\\.?س|د\\.?إ|ج\\.?م";

/** The same marks, safe to drop into a larger pattern. */
const CURRENCY_PART = `(?<![A-Za-z\\u0600-\\u06FF])(?:${CURRENCY_MARKS})(?![A-Za-z\\u0600-\\u06FF])`;

const CURRENCY = new RegExp(CURRENCY_PART, "i");

/**
 * A heading that announces add-ons rather than dishes.
 *
 * Printed menus put these at the end of a section — "EXTRAS: cheese 1.00,
 * bacon 2.00" — and read line by line they look exactly like dishes, because
 * that is what they are shaped like: a name and a price. Without this, a
 * burger menu imports "Add Cheese" as something a customer can order on its
 * own, which is then deleted by hand, one line at a time.
 *
 * Deliberately narrow. "Sides" and "Sauces" head real categories on plenty of
 * menus, and turning a section of dishes into a checkbox list is the worse
 * mistake of the two.
 *
 * The boundary is a lookahead rather than `\b`, which is defined on ASCII word
 * characters: after "إضافات" there is no word boundary at all, so `\b` would
 * match every English extras heading and no Arabic one.
 */
const EXTRAS_HEADING =
  /^(?:extras?|add[\s-]?ons?|additions?|toppings?|إضافات|الإضافات|اضافات|الاضافات)(?![\p{L}\p{N}])/iu;

/** Lines that are furniture, not food. */
const NOISE =
  /^(?:menu|قائمة|الطلبات|www\.|https?:|tel[:.]|phone|هاتف|page \d+|\d+\s*$|[-–—_.•*]+$)/i;

/** Arabic-Indic digits and separators, folded to ASCII so Number() can read them. */
function toAscii(text: string): string {
  return text
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

function toNumber(raw: string): number {
  let text = raw.replace(/\s/g, "");
  const hasComma = text.includes(",");
  const dots = (text.match(/\./g) || []).length;

  if (hasComma && dots > 0) {
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (hasComma) {
    text = /,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (dots > 1) {
    // "1.299.50" is thousands then cents; "1.250.000" is thousands twice —
    // a Lebanese menu writes a 1,250,000 LBP bottle exactly that way. The
    // group after the last dot decides: three digits is a thousands group.
    const cents = text.lastIndexOf(".");
    text =
      text.length - cents - 1 === 3
        ? text.replace(/\./g, "")
        : text.slice(0, cents).replace(/\./g, "") + text.slice(cents);
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
}

/**
 * The prices at the end of a line, and the text before them.
 *
 * Menus put the price last, whichever direction they read — an Arabic menu
 * still prints "١٢٫٥٠" at the end of the line as laid out. A line may carry
 * several, one per size.
 */
function splitPrices(line: string): { name: string; prices: number[] } | null {
  const text = toAscii(line).replace(/[.…]{2,}/g, "\t");

  // One or more numbers, each optionally wearing a currency mark, running to
  // the end of the line and separated by whitespace, tabs or slashes.
  const price = `(?:${CURRENCY_PART})?\\s*\\d[\\d.,]*\\s*(?:${CURRENCY_PART})?`;
  const trailing = text.match(
    new RegExp(`(${price}(?:[\\s\\t/|]+${price}){0,3})\\s*$`, "i"),
  );
  if (!trailing) return null;

  const name = text.slice(0, trailing.index).replace(/[\t\s]+/g, " ").trim();
  if (!name) return null;

  const prices = trailing[1]
    .split(/[\s\t/|]+/)
    .map((part) => part.replace(CURRENCY, "").trim())
    .filter((part) => /\d/.test(part))
    .map(toNumber)
    .filter((price) => price > 0);

  return prices.length > 0 ? { name, prices } : null;
}

/** Size words, for a line that prices one dish several ways. */
const SIZE_WORDS: Record<string, [string, string]> = {
  s: ["Small", "صغير"],
  m: ["Medium", "وسط"],
  l: ["Large", "كبير"],
  small: ["Small", "صغير"],
  medium: ["Medium", "وسط"],
  large: ["Large", "كبير"],
  صغير: ["Small", "صغير"],
  وسط: ["Medium", "وسط"],
  كبير: ["Large", "كبير"],
};

/** A line that is nothing but size labels — the column header above prices. */
function readSizeHeader(line: string): string[] | null {
  const parts = line
    .split(/[\s\t/|]+/)
    .map((part) => part.trim().toLowerCase().replace(/[.:]/g, ""))
    .filter(Boolean);

  if (parts.length < 2 || parts.length > 4) return null;
  if (!parts.every((part) => part in SIZE_WORDS)) return null;
  return parts;
}

function isArabic(text: string): boolean {
  return ARABIC_SCRIPT.test(text);
}

/**
 * Turn laid-out lines into a menu.
 *
 * The rules, in the order they are applied to each line:
 *  - a line ending in one or more prices is a dish;
 *  - a line with no price, set larger or bolder than the dishes around it, is
 *    a category heading;
 *  - anything else following a dish is that dish's description.
 */
export function parseMenuFromLines(lines: ParsedLine[]): TextMenu {
  const bodySize = ((): number => {
    const sizes = lines.map((line) => line.fontSize).filter((size) => size > 0);
    if (sizes.length === 0) return 0;
    const sorted = [...sizes].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  })();

  const categories: TextMenuCategory[] = [];
  let current: TextMenuCategory | null = null;
  let lastItem: TextMenuItem | null = null;
  let sizeHeader: string[] | null = null;
  let matchedLines = 0;
  let unmatchedLines = 0;

  /** The extras block being read, and the dishes it was printed under. */
  let extras: { name: string; options: TextMenuOption[]; items: TextMenuItem[] } | null =
    null;

  /**
   * Hand the extras block to its dishes and close it.
   *
   * Every dish in the section gets the same group, which is what the menu
   * says: the list was printed once, under all of them.
   */
  const closeExtras = () => {
    if (extras && extras.options.length > 0) {
      for (const item of extras.items) {
        item.optionGroups = [
          ...(item.optionGroups ?? []),
          {
            name: extras.name,
            type: "checkbox",
            isRequired: false,
            options: [...extras.options],
          },
        ];
      }
    }
    extras = null;
  };

  const samples: string[] = [];
  const openCategory = (name: string) => {
    closeExtras();
    current = { name, items: [] };
    categories.push(current);
    lastItem = null;
  };

  for (const line of lines) {
    const text = line.text.trim();
    if (!text || NOISE.test(text)) continue;

    const header = readSizeHeader(text);
    if (header) {
      sizeHeader = header;
      continue;
    }

    const priced = splitPrices(text);
    if (priced) {
      // Inside an extras block every priced line is a choice for the dishes
      // above it. The first price is the surcharge; a size grid under an
      // extras heading is not a thing menus print.
      if (extras) {
        matchedLines += 1;
        samples.push(priced.name);
        const key = priced.name.toLowerCase();
        if (!extras.options.some((option) => option.name.toLowerCase() === key)) {
          extras.options.push({ name: priced.name, price: priced.prices[0] });
        }
        continue;
      }

      if (!current) openCategory("");
      matchedLines += 1;
      samples.push(priced.name);

      const arabic = isArabic(priced.name);
      const labels =
        priced.prices.length > 1 && sizeHeader?.length === priced.prices.length
          ? sizeHeader.map((size) => SIZE_WORDS[size][arabic ? 1 : 0])
          : null;

      if (priced.prices.length === 1) {
        lastItem = { name: priced.name, price: priced.prices[0] };
        current!.items.push(lastItem);
      } else if (labels) {
        // One dish per size, the way the platform prices a dish.
        for (const [index, price] of priced.prices.entries()) {
          current!.items.push({ name: `${priced.name} - ${labels[index]}`, price });
        }
        lastItem = null;
      } else {
        // Several prices and nothing that says what they are: keep the first
        // and record the rest rather than invent sizes or drop them.
        lastItem = {
          name: priced.name,
          price: priced.prices[0],
          description: `${arabic ? "أسعار أخرى" : "Other prices"}: ${priced.prices
            .slice(1)
            .join(" / ")}`,
        };
        current!.items.push(lastItem);
      }
      continue;
    }

    // No price. A heading announces itself by being bigger or bolder than the
    // dishes, or by being short and shouting.
    const looksLikeHeading =
      text.length <= 48 &&
      (line.bold ||
        (bodySize > 0 && line.fontSize > bodySize * 1.15) ||
        (text === text.toUpperCase() && /[A-Z؀-ۿ]/.test(text)));

    if (looksLikeHeading) {
      const heading = text.replace(/[:•]+$/, "").trim();

      // With no dishes above it, an extras heading has nothing to attach to —
      // it is the menu's own section, so it is read as one.
      // `current` is only ever assigned inside `openCategory`, which the
      // compiler cannot follow — the same reason the pushes above use `!`.
      const section = current as TextMenuCategory | null;

      if (EXTRAS_HEADING.test(heading) && section && section.items.length > 0) {
        closeExtras();
        extras = { name: heading, options: [], items: section.items };
        lastItem = null;
        sizeHeader = null;
        samples.push(text);
        continue;
      }

      openCategory(heading);
      samples.push(text);
      sizeHeader = null;
      continue;
    }

    if (lastItem && text.length > 3) {
      // A wrapped description under its dish.
      lastItem.description = lastItem.description
        ? `${lastItem.description} ${text}`
        : text;
      samples.push(text);
    } else {
      unmatchedLines += 1;
    }
  }

  closeExtras();

  const arabicSamples = samples.filter(isArabic).length;
  const language =
    samples.length > 0 && arabicSamples / samples.length >= 0.3 ? "ar" : "en";
  const fallbackName = language === "ar" ? "أصناف أخرى" : "Other items";

  return {
    language,
    categories: categories
      .filter((category) => category.items.length > 0)
      .map((category) => ({ ...category, name: category.name || fallbackName })),
    matchedLines,
    unmatchedLines,
  };
}
