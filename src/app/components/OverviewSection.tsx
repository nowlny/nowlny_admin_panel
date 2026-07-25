"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Store,
  ShoppingBag,
  CheckCircle2,
  Bike,
  ArrowRight,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { ordersService, OrderStatus } from "../../services/orders";
import {
  restaurantsService,
  RestaurantResponse,
  RestaurantSubmission,
} from "../../services/restaurants";
import { formatAddress, humanizeEnum } from "../../lib/format";
import { EmptyState, ErrorState, ErrorBanner, Skeleton } from "./ui/States";
import { useConfirm } from "./ui/ConfirmDialog";

/**
 * Every figure on this dashboard used to come from `loadDb()` — a localStorage
 * fixture seeded with invented merchants and invented money. The page then
 * described itself as "real-time operations". The revenue sparkline, the
 * month-over-month deltas and the cuisine-share counts were hardcoded literals.
 *
 * Everything below is now read from the API, and any panel that could not be
 * sourced from an endpoint (GMV, platform net earnings, the monthly revenue
 * trend) was deleted rather than faked — there is no aggregate/analytics
 * endpoint exposed through `src/services`.
 */

const LIVE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "out_for_delivery",
];

interface OverviewProps {
  /** @deprecated localStorage fixtures — no longer read. Kept so page.tsx typechecks. */
  db?: unknown;
  setActiveTab: (tab: string) => void;
  /** @deprecated only mutated localStorage; approval now calls the API directly. */
  onApproveRestaurant?: (id: string) => void;
}

interface OrderCounts {
  total: number;
  delivered: number;
  live: number;
  byStatus: Record<string, number>;
}

/** The submissions endpoint returns either a paginated envelope or a bare array. */
function normaliseSubmissions(payload: unknown): RestaurantSubmission[] {
  if (Array.isArray(payload)) return payload as RestaurantSubmission[];
  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as RestaurantSubmission[];
  }
  return [];
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function OverviewSection({
  setActiveTab,
}: OverviewProps) {
  const confirm = useConfirm();

  // Platform counters
  const [counts, setCounts] = useState<OrderCounts | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantResponse[] | null>(
    null,
  );
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Merchant verification queue
  const [submissions, setSubmissions] = useState<RestaurantSubmission[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      // `limit: 1` — we only need the server's `total` for each slice, not rows.
      const [all, pending, confirmed, outForDelivery, delivered, rests] =
        await Promise.all([
          ordersService.getOrders({ page: 1, limit: 1 }),
          ordersService.getOrders({ status: "pending", page: 1, limit: 1 }),
          ordersService.getOrders({ status: "confirmed", page: 1, limit: 1 }),
          ordersService.getOrders({
            status: "out_for_delivery",
            page: 1,
            limit: 1,
          }),
          ordersService.getOrders({ status: "delivered", page: 1, limit: 1 }),
          restaurantsService.getRestaurants(),
        ]);

      const byStatus: Record<string, number> = {
        pending: pending.total ?? 0,
        confirmed: confirmed.total ?? 0,
        out_for_delivery: outForDelivery.total ?? 0,
      };

      setCounts({
        total: all.total ?? 0,
        delivered: delivered.total ?? 0,
        live: LIVE_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0),
        byStatus,
      });
      setRestaurants(Array.isArray(rests) ? rests : []);
    } catch (err: unknown) {
      setStatsError(errorMessage(err, "Could not load platform figures."));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await restaurantsService.getSubmissions({
        status: "pending",
        page: 1,
        limit: 5,
      });
      setSubmissions(normaliseSubmissions(res));
    } catch (err: unknown) {
      setQueueError(
        errorMessage(err, "Could not load the merchant verification queue."),
      );
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchQueue();
  }, [fetchStats, fetchQueue]);

  // ─── Approve a merchant application ───────────────────────────────────────

  /**
   * This used to call `onApproveRestaurant()`, which only flipped a field in
   * localStorage: the admin saw the row disappear and nothing ever reached the
   * backend. It now hits the real review endpoint and refetches.
   */
  const handleApprove = async (submission: RestaurantSubmission) => {
    const ok = await confirm({
      title: `Approve “${submission.name}”?`,
      description:
        "The merchant goes live on the customer apps immediately and can start receiving orders.",
      confirmLabel: "Approve merchant",
    });
    if (!ok) return;

    setApprovingId(submission.id);
    try {
      await restaurantsService.reviewSubmission(submission.id, {
        decision: "approve",
      });
      toast.success(`${submission.name} approved.`);
      await Promise.all([fetchQueue(), fetchStats()]);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Approval failed. Please retry."));
    } finally {
      setApprovingId(null);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const activeMerchants = (restaurants ?? []).filter(
    (r) => (r.status ?? "").toLowerCase() === "active",
  ).length;

  // Real counts, grouped from the merchant list. This is *merchants* per
  // cuisine — the panel that used to sit here claimed to show orders per
  // cuisine and was a hardcoded array.
  const cuisineBreakdown = (() => {
    const list = restaurants ?? [];
    if (list.length === 0) return [];
    const tally = new Map<string, number>();
    for (const r of list) {
      const key = (r.cuisineType || "").trim() || "uncategorised";
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    // The API models cuisine as a `categories[]` relation; `cuisineType` is
    // only populated on some endpoints. If nothing carries one, a single
    // "Uncategorised 100%" bar is noise, not insight — hide the panel.
    if (tally.size === 1 && tally.has("uncategorised")) return [];
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name: humanizeEnum(name),
        count,
        share: Math.round((count / list.length) * 100),
      }));
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl p-6 border border-zinc-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-orange-500/10 to-transparent pointer-events-none" />
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white tracking-tight">
            Nowlny Delivery Hub Portal
          </h3>
          <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
            Review pending merchant applications, work the live dispatch board
            and inspect customer orders.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab("orders")}
            className="flex items-center gap-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white px-4 py-2.5 rounded-lg shadow-lg shadow-orange-500/20"
          >
            <span>Live Order Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {statsError && !counts ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <ErrorState message={statsError} onRetry={fetchStats} />
        </div>
      ) : statsLoading && !counts ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4"
            >
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {statsError && (
            <ErrorBanner message={statsError} onRetry={fetchStats} />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Total Orders"
              value={(counts?.total ?? 0).toLocaleString("en-US")}
              icon={<ShoppingBag className="w-5 h-5" />}
              accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              footer={
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  All orders ever placed on the platform
                </span>
              }
            />

            <StatCard
              label="Live Orders"
              value={(counts?.live ?? 0).toLocaleString("en-US")}
              icon={<Bike className="w-5 h-5" />}
              accent="bg-orange-500/10 text-orange-600 dark:text-orange-400"
              footer={
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {counts?.byStatus.pending ?? 0} pending
                  </span>
                  <span className="text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                    {counts?.byStatus.confirmed ?? 0} confirmed
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    {counts?.byStatus.out_for_delivery ?? 0} on the way
                  </span>
                </span>
              }
            />

            <StatCard
              label="Delivered"
              value={(counts?.delivered ?? 0).toLocaleString("en-US")}
              icon={<CheckCircle2 className="w-5 h-5" />}
              accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              footer={
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  Orders completed end to end
                </span>
              }
            />

            <StatCard
              label="Merchants"
              value={(restaurants?.length ?? 0).toLocaleString("en-US")}
              icon={<Store className="w-5 h-5" />}
              accent="bg-purple-500/10 text-purple-600 dark:text-purple-400"
              footer={
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  {activeMerchants} active
                </span>
              }
            />
          </div>
        </>
      )}

      {/* Merchant Verification Queue */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-500" /> Merchant Verification
            Queue
          </h4>
          {!queueLoading && !queueError && submissions.length > 0 && (
            <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
              {submissions.length} pending
            </span>
          )}
        </div>

        {queueLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : queueError ? (
          <ErrorState message={queueError} onRetry={fetchQueue} />
        ) : submissions.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No applications waiting"
            hint="New merchant applications land here as soon as they are submitted."
            action={
              <button
                onClick={() => setActiveTab("restaurants")}
                className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors inline-flex items-center gap-1"
              >
                <span>Browse all merchants</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => {
              const busy = approvingId === sub.id;
              const location = formatAddress(sub.address);
              return (
                <div
                  key={sub.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {sub.logo ? (
                      <img
                        src={sub.logo}
                        alt={`${sub.name} logo`}
                        className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-0.5 shrink-0"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 text-zinc-400" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {sub.name}
                      </h5>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        {[
                          sub.cuisineType ? humanizeEnum(sub.cuisineType) : "",
                          location,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "No details provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveTab("restaurants")}
                      className="text-[10px] font-bold bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-2.5 py-2 rounded-lg transition-all"
                    >
                      Inspect docs
                    </button>
                    <button
                      onClick={() => handleApprove(sub)}
                      disabled={busy}
                      className="text-[10px] font-bold bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-95 text-white px-2.5 py-2 rounded-lg shadow shadow-orange-500/10 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                      {busy ? "Approving…" : "Approve"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Merchants by cuisine — grouped from the live merchant list */}
      {!statsLoading && !statsError && cuisineBreakdown.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
            Merchants by Cuisine
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-6">
            Registered merchants grouped by their cuisine type
          </p>

          <div className="space-y-4">
            {cuisineBreakdown.map((cuisine) => (
              <div key={cuisine.name} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold gap-4">
                  <span className="text-zinc-800 dark:text-zinc-200 truncate">
                    {cuisine.name}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0">
                    {cuisine.count} ({cuisine.share}%)
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${cuisine.share}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <button
              onClick={() => setActiveTab("restaurants")}
              className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors inline-flex items-center gap-1"
            >
              <span>Manage all merchants</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Presentational ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
  footer,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  footer: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wide uppercase">
            {label}
          </p>
          <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-2">
            {value}
          </h4>
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${accent}`}>{icon}</div>
      </div>
      <div className="mt-4 text-xs font-bold">{footer}</div>
    </div>
  );
}
