"use client";

import React from "react";
import { Languages } from "lucide-react";
import { useI18n, LOCALES } from "../../../lib/i18n";
import { runCrossFadeTransition } from "../../../lib/theme";

/**
 * Compact segmented language switch, for surfaces that render outside the app
 * shell — the login screen most importantly, where an Arabic operator would
 * otherwise have no way to switch before signing in.
 */
export default function LanguageToggle({
  className = "",
}: {
  className?: string;
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("header.language")}
      className={`inline-flex items-center gap-1 p-1 rounded-xl border border-zinc-800 bg-zinc-900/70 backdrop-blur ${className}`}
    >
      <Languages className="w-3.5 h-3.5 text-zinc-500 mx-1.5" aria-hidden="true" />
      {LOCALES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={locale === option.value}
          onClick={() => {
            if (option.value === locale) return;
            runCrossFadeTransition(() => setLocale(option.value));
          }}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
            locale === option.value
              ? "bg-orange-500 text-white shadow-sm"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {option.nativeLabel}
        </button>
      ))}
    </div>
  );
}
