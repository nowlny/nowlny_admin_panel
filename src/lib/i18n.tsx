"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { setFormatterLocale } from "./format";
import { en, type MessageKey } from "./locales/en";
import { ar } from "./locales/ar";

/* ---------------------------------------------------------------------------
   English / Arabic localisation.

   Arabic is written right-to-left, so switching language also flips the
   document direction — `dir="rtl"` on <html>. Tailwind's logical `rtl:` /
   `ltr:` variants key off that attribute, which is how the sidebar, the search
   affordances and the dropdowns mirror themselves without duplicated markup.

   Keys are flat and namespaced by surface (`nav.`, `header.`, `common.`) so a
   missing translation is obvious in review rather than silently falling back.
--------------------------------------------------------------------------- */

export type Locale = "en" | "ar";

export const LOCALES: { value: Locale; label: string; nativeLabel: string }[] = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "ar", label: "Arabic", nativeLabel: "العربية" },
];

export const STORAGE_KEY = "nowlny_locale";

// Strings live in ./locales — see en.ts for the canonical key list.

export type { MessageKey };

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, ar };

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Vars,
): string {
  const template = DICTIONARIES[locale][key] ?? en[key];
  // A key with no entry at all is a bug; render it rather than an empty gap so
  // it is obvious on screen instead of silently blank.
  if (template === undefined) return key;
  return interpolate(template, vars);
}

interface I18nValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** Translate a key, with optional `{name}` interpolation. */
  t: (key: MessageKey, vars?: Vars) => string;
  dir: "ltr" | "rtl";
  isRTL: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within an <I18nProvider>");
  }
  return value;
}

export const isLocale = (value: unknown): value is Locale =>
  value === "en" || value === "ar";

export const dirFor = (locale: Locale): "ltr" | "rtl" =>
  locale === "ar" ? "rtl" : "ltr";

/**
 * Applies language + direction to <html>.
 *
 * Kept separate from React so the pre-paint script in `layout.tsx` can run the
 * same logic before first paint — otherwise an Arabic operator gets a
 * left-to-right flash on every load, which is worse than the theme flash.
 */
export function applyLocaleToDocument(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = dirFor(locale);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Server-render in English; the pre-paint script has already set the real
  // language on <html>, and the first effect below syncs React to it.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* private mode / blocked storage */
    }
    if (isLocale(stored)) {
      setLocaleState(stored);
      setFormatterLocale(stored);
      applyLocaleToDocument(stored);
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setFormatterLocale(next);
    applyLocaleToDocument(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* nothing we can do; the session still switches */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      dir: dirFor(locale),
      isRTL: locale === "ar",
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
