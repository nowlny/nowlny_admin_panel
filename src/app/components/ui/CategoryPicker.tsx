"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import {
  restaurantCategoriesService,
  type RestaurantCategory,
} from "../../../services/restaurantCategories";
import { useI18n } from "../../../lib/i18n";
import { LABEL_CLASS } from "./FormControls";

/**
 * Which restaurant categories a merchant belongs to — "Pizza", "Burgers".
 *
 * Shared by the add and edit modals so the two cannot drift. The whole list is
 * fetched through the admin endpoint rather than the public one, because a
 * category that is switched off is still a category this restaurant may
 * already be in, and hiding it here would silently drop it on the next save.
 */

/** One page is the whole list on this platform; a second would be a surprise. */
const PAGE_LIMIT = 100;

interface CategoryPickerProps {
  /** Selected category ids. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Namespaced so both modals can render one without colliding ids. */
  idPrefix: string;
  disabled?: boolean;
}

export default function CategoryPicker({
  value,
  onChange,
  idPrefix,
  disabled,
}: CategoryPickerProps) {
  const { t } = useI18n();
  const [categories, setCategories] = useState<RestaurantCategory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  // No synchronous setState here: the initial value is already "loading", and
  // the retry button puts it back before bumping `attempt`.
  useEffect(() => {
    let cancelled = false;

    restaurantCategoriesService
      .getAllCategories({ limit: PAGE_LIMIT })
      .then((page) => {
        if (cancelled) return;
        // Active first, then alphabetical, so the usual choices are nearest.
        setCategories(
          [...page.data].sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return a.name.localeCompare(b.name);
          }),
        );
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Could not load restaurant categories:", err?.message ?? err);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const toggle = (id: string) => {
    onChange(
      value.includes(id) ? value.filter((current) => current !== id) : [...value, id],
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={LABEL_CLASS} id={`${idPrefix}-label`}>
          {t("rest.categories")}
        </span>
        {value.length > 0 && (
          <span className="text-[10px] font-bold text-orange-500">
            {t("rest.categories_selected", { count: value.length })}
          </span>
        )}
      </div>

      {status === "loading" && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 py-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t("rest.categories_loading")}
        </p>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
            {t("rest.categories_failed")}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
            className="text-[10px] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            {t("common.retry")}
          </button>
        </div>
      )}

      {status === "ready" && categories.length === 0 && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 py-1">
          {t("rest.categories_empty")}
        </p>
      )}

      {status === "ready" && categories.length > 0 && (
        <div
          role="group"
          aria-labelledby={`${idPrefix}-label`}
          className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-0.5"
        >
          {categories.map((category) => {
            const selected = value.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggle(category.id)}
                disabled={disabled}
                aria-pressed={selected}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 disabled:opacity-50 ${
                  selected
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-orange-400"
                }`}
              >
                {selected && <Check className="w-3 h-3" />}
                {category.icon && <span aria-hidden="true">{category.icon}</span>}
                <span>{category.name}</span>
                {!category.isActive && (
                  <span className="opacity-60 font-semibold">
                    ({t("rest.categories_inactive")})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
        {t("rest.categories_hint")}
      </p>
    </div>
  );
}
