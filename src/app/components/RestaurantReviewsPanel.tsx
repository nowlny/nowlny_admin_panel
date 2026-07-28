"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import {
  restaurantsService,
  RestaurantRating,
  RatingDistributionBucket,
} from "../../services/restaurants";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import { useI18n, type MessageKey } from "../../lib/i18n";
import { formatDate, formatRating } from "../../lib/format";

/**
 * Customer reviews for a merchant — `GET /api/v1/restaurants/{id}/ratings`.
 * The panel had a "Review Rating" stat but no way to read the reviews behind
 * it, so a 2.1★ merchant gave an admin a number and nothing to act on.
 */

interface RestaurantReviewsPanelProps {
  restaurantId: string;
}

type SortBy = "most_recent" | "highest" | "lowest";

const SORT_OPTIONS: { value: SortBy; key: MessageKey }[] = [
  { value: "most_recent", key: "reviews.most_recent" },
  { value: "highest", key: "reviews.highest" },
  { value: "lowest", key: "reviews.lowest" },
];

const PAGE_SIZE = 10;

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${
            n <= Math.round(value)
              ? "fill-amber-500 text-amber-500"
              : "text-zinc-300 dark:text-zinc-700"
          }`}
        />
      ))}
    </span>
  );
}

export default function RestaurantReviewsPanel({
  restaurantId,
}: RestaurantReviewsPanelProps) {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<RestaurantRating[]>([]);
  const [distribution, setDistribution] = useState<Record<
    string,
    RatingDistributionBucket
  > | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("most_recent");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await restaurantsService.getRatings(restaurantId, {
        page,
        limit: PAGE_SIZE,
        sortBy,
      });
      setReviews(res.data);
      setTotal(res.total);
      setTotalPages(Math.max(1, res.totalPages ?? 1));
      setDistribution(res.distribution ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reviews.load_failed"));
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId, page, sortBy]);

  useEffect(() => {
    load();
  }, [load]);

  const average = (() => {
    if (!distribution) return null;
    let weighted = 0;
    let count = 0;
    for (const [stars, bucket] of Object.entries(distribution)) {
      weighted += Number(stars) * bucket.count;
      count += bucket.count;
    }
    return count > 0 ? weighted / count : null;
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-orange-500" />
          {t("reviews.title")}
          {!isLoading && !error && (
            <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full">
              {total}
            </span>
          )}
        </h3>
        <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
          <span className="sr-only sm:not-sr-only">{t("reviews.sort_by")}</span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortBy);
              setPage(1);
            }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {distribution && total > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row gap-6 items-center">
          <div className="text-center shrink-0">
            <p className="text-4xl font-black text-zinc-900 dark:text-white">
              {average !== null ? formatRating(average) : "—"}
            </p>
            {average !== null && (
              <Stars
                value={average}
                label={t("reviews.out_of_five", { value: formatRating(average) })}
              />
            )}
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-semibold uppercase tracking-wide">
              {t("reviews.count", { count: total })}
            </p>
          </div>
          <div className="flex-1 w-full space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const bucket = distribution[String(stars)] ?? {
                count: 0,
                percentage: 0,
              };
              return (
                <div key={stars} className="flex items-center gap-2 text-[11px]">
                  <span className="w-6 font-bold text-zinc-500 dark:text-zinc-400">
                    {stars}★
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${bucket.percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-end font-semibold text-zinc-500 dark:text-zinc-400">
                    {bucket.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <EmptyState
            icon={MessageSquare}
            title={t("reviews.empty_title")}
            hint={t("reviews.empty_hint")}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                    {review.customerName ||
                      review.customer?.fullName ||
                      review.customer?.nickname ||
t("reviews.anonymous")}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Stars
                      value={review.rating}
                      label={t("reviews.out_of_five", {
                        value: review.rating,
                      })}
                    />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                </div>
                {review.reactions &&
                  (review.reactions.likes || review.reactions.dislikes) && (
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                      {review.reactions.likes ?? 0} 👍 ·{" "}
                      {review.reactions.dislikes ?? 0} 👎
                    </span>
                  )}
              </div>
              {review.comment && (
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-2.5 leading-relaxed">
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
          >
            {t("common.previous")}
          </button>
          <span className="text-xs font-semibold text-zinc-500">
            {t("common.page_of", { page, total: totalPages })}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
          >
            {t("common.next")}
          </button>
        </div>
      )}
    </div>
  );
}
