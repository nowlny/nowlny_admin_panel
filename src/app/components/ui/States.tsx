"use client";

import React from "react";
import { AlertTriangle, RefreshCw, SearchX } from "lucide-react";
import { useI18n } from "../../../lib/i18n";

/* ---------------------------------------------------------------------------
   Empty, error and loading states.

   Across the app these three were routinely conflated: a fetch that threw was
   caught, logged to the console, and left the list as `[]` — which rendered the
   designed "no records yet" empty state. An outage was indistinguishable from
   genuine emptiness, and there was never a retry affordance. These components
   make the three cases visually distinct and give errors a way back.
--------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon = SearchX,
  title,
  hint,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <Icon className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-3" />
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
        {title}
      </h3>
      {hint && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-sm">
          {hint}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  title,
}: {
  message?: string | null;
  onRetry?: () => void;
  title?: string;
}) {
  const { t } = useI18n();
  const heading = title ?? t("states.error_title");
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center text-center py-16 px-6"
    >
      <div className="w-11 h-11 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
        {heading}
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-sm break-words">
        {message || t("states.error_body")}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-orange-500 dark:hover:bg-orange-500 dark:hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t("common.try_again")}
        </button>
      )}
    </div>
  );
}

/** Inline banner for a failure that shouldn't replace already-visible content. */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="text-xs font-semibold break-words">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-bold underline hover:no-underline shrink-0"
        >
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

/** Shimmering placeholder. `.skeleton` is defined in globals.css. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** A grid of card skeletons matching the app's dominant card footprint. */
export function CardSkeletonGrid({
  count = 6,
  className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}
