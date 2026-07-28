/**
 * Shared display formatters.
 *
 * Before this existed, money was formatted four different ways across the app
 * (`$${n.toFixed(2)}` with no separators, `toLocaleString("en-US")`,
 * `toFixed(0)`, and raw), raw database enums such as `out_for_delivery` were
 * printed straight to operators, and `undefined` values leaked as strings like
 * "N/A Minutes" or a lone "$".
 */

const EM_DASH = "—";

/* ---------------------------------------------------------------------------
   Active display locale.

   Dates were pinned to `en-GB` so the server and client render identical
   strings (a mismatch is a hydration error). That still holds — the locale
   only ever changes in the browser, after hydration, when the operator picks
   a language.

   Arabic uses the `-u-nu-latn` extension so month and day names localise but
   digits stay Western. An ops panel showing order totals in Arabic-Indic
   numerals next to IDs and phone numbers in Latin ones is harder to scan, not
   easier.
--------------------------------------------------------------------------- */

const LOCALE_TAGS = {
  en: "en-GB",
  ar: "ar-u-nu-latn",
} as const;

let activeLocale: "en" | "ar" = "en";

export function setFormatterLocale(locale: "en" | "ar") {
  activeLocale = locale;
}

const tag = () => LOCALE_TAGS[activeLocale];

/** Formats money with the record's own currency. Falls back to a plain number. */
export function formatMoney(
  value: unknown,
  currencyCode?: string | null,
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return EM_DASH;

  if (currencyCode) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
      }).format(n);
    } catch {
      // Unknown / non-ISO code — fall through to the symbol-less form.
    }
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Exchange rates need far more precision than the default 3 fraction digits. */
export function formatRate(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return EM_DASH;
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function formatRating(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return EM_DASH;
  return n.toFixed(1);
}

/**
 * Fixed locale and timezone so the server-rendered string matches the client's
 * and React doesn't report a hydration mismatch. Several components called
 * `toLocaleString()` during render, which resolves differently on the server.
 */
export function formatDate(value: unknown): string {
  if (!value) return EM_DASH;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return new Intl.DateTimeFormat(tag(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Beirut",
  }).format(d);
}

export function formatDateTime(value: unknown): string {
  if (!value) return EM_DASH;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return new Intl.DateTimeFormat(tag(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Beirut",
  }).format(d);
}

export function formatTime(value: unknown): string {
  if (!value) return EM_DASH;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return new Intl.DateTimeFormat(tag(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Beirut",
  }).format(d);
}

/** `out_for_delivery` -> `Out for delivery`, `super_admin` -> `Super admin`. */
export function humanizeEnum(value?: string | null): string {
  if (!value) return EM_DASH;
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * The API returns `address` as a flat string on some endpoints and as an
 * `{ city, street, building }` object on others. Rendering the object form
 * directly threw "Objects are not valid as a React child" and crashed the page;
 * calling `.toLowerCase()` on it threw while typing in the search box.
 */
export function formatAddress(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);

  const a = value as Record<string, unknown>;
  return [a.building, a.street, a.city]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(", ");
}

/** Safe lowercase for search filters over possibly-object fields. */
export function searchable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return String(value);
  return formatAddress(value).toLowerCase();
}

/** Renders a value or an em dash — never `undefined`, `null` or `NaN`. */
export function orDash(value: unknown, suffix = ""): string {
  if (value === null || value === undefined || value === "") return EM_DASH;
  if (typeof value === "number" && !Number.isFinite(value)) return EM_DASH;
  return `${value}${suffix}`;
}

/** Shortens a UUID for display while keeping it recognisable. */
export function shortId(id?: string | null): string {
  if (!id) return EM_DASH;
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
