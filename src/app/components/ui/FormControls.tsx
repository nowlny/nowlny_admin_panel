"use client";

import React from "react";
import { useI18n } from "../../../lib/i18n";

/* ---------------------------------------------------------------------------
   Small form primitives shared by the restaurant add/edit modals: the input
   and label classes, the required-asterisk, inline field errors and the tab
   strip that splits a long form into panels.
--------------------------------------------------------------------------- */

export const FIELD_CLASS =
  "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors aria-[invalid=true]:border-red-500";
export const LABEL_CLASS = "text-xs font-semibold text-zinc-700 dark:text-zinc-300";

/** Red asterisk that isn't announced twice — the input carries `aria-required`. */
export function Req() {
  return (
    <span aria-hidden="true" className="text-red-500 ms-0.5">
      *
    </span>
  );
}

export function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="text-[11px] font-semibold text-red-600 dark:text-red-400"
    >
      {message}
    </p>
  );
}

export interface FormTab<T extends string> {
  id: T;
  label: string;
  /** Shows a red dot so an error on a hidden panel is not invisible. */
  hasError?: boolean;
}

interface FormTabsProps<T extends string> {
  tabs: FormTab<T>[];
  active: T;
  onChange: (next: T) => void;
  idPrefix: string;
}

export const formTabId = (idPrefix: string, tab: string) =>
  `${idPrefix}-tab-${tab}`;
export const formPanelId = (idPrefix: string, tab: string) =>
  `${idPrefix}-panel-${tab}`;

/**
 * Tab strip for a modal form. Panels are conditionally rendered by the
 * caller, so the browser's own `required` checks never see hidden fields —
 * forms using this validate by hand on submit and jump to the failing tab.
 */
export function FormTabs<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
}: FormTabsProps<T>) {
  const { t } = useI18n();
  return (
    <div
      role="tablist"
      className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 -mx-1 px-1 overflow-x-auto"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={formTabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={formPanelId(idPrefix, tab.id)}
            onClick={() => onChange(tab.id)}
            className={`relative px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              selected
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
            {tab.hasError && (
              <span
                role="img"
                aria-label={t("rest.tab_has_errors")}
                className="absolute top-1.5 -end-0.5 w-1.5 h-1.5 rounded-full bg-red-500"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
