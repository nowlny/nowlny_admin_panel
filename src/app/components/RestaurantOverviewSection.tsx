"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  DollarSign,
  ShoppingBag,
  Star,
  Users,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  ordersService,
  RestaurantStatistics,
  StatisticsPeriod,
} from "../../services/orders";
import {
  restaurantsService,
  RestaurantResponse,
} from "../../services/restaurants";
import StatusPill from "./ui/StatusPill";
import { ErrorState, Skeleton } from "./ui/States";
import { formatMoney, formatRating } from "../../lib/format";

import { useI18n, type MessageKey } from "../../lib/i18n";
/**
 * The merchant's own dashboard.
 *
 * Every figure here used to be computed in the browser from `loadDb()` — a
 * localStorage fixture of invented orders — and the component was not reachable
 * from any route, so it shipped as dead code carrying fake revenue. It now
 * reads `GET /api/v1/orders/restaurant/me/statistics`, which returns exactly
 * these numbers and had no caller anywhere in the app.
 */

interface RestaurantOverviewProps {
  setActiveTab: (tab: string) => void;
}

const PERIODS: { value: StatisticsPeriod; key: MessageKey }[] = [
  { value: "today", key: "merchant.period_today" },
  { value: "week", key: "merchant.period_week" },
  { value: "month", key: "merchant.period_month" },
  { value: "year", key: "merchant.period_year" },
  { value: "all", key: "merchant.period_all" },
];

export default function RestaurantOverviewSection({
  setActiveTab,
}: RestaurantOverviewProps) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<StatisticsPeriod>("week");
  const [stats, setStats] = useState<RestaurantStatistics | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statistics, profile] = await Promise.all([
        ordersService.getMyRestaurantStatistics(period),
        // A merchant whose application is still pending has no profile yet;
        // the statistics are the point of this screen, so don't fail on it.
        restaurantsService.getMyRestaurant().catch(() => null),
      ]);
      setStats(statistics);
      setRestaurant(profile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("merchant.load_failed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const currency =
    stats?.currency?.code ??
    restaurant?.currency?.code ??
    restaurant?.currencyId ??
    undefined;

  const weekly = stats?.weeklyPerformance ?? [];
  const peakRevenue = Math.max(1, ...weekly.map((d) => d.revenue ?? 0));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Merchant banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl p-6 border border-zinc-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="flex items-center gap-4 min-w-0">
          {restaurant?.logo ? (
            <img
              src={restaurant.logo}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover border-2 border-zinc-700 shrink-0"
            />
          ) : (
            <span className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-2xl shrink-0">
              🍽️
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-white tracking-tight truncate">
              {restaurant?.name ?? t("merchant.my_restaurant")}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {restaurant?.status && <StatusPill status={restaurant.status} />}
              {restaurant?.isOpen !== undefined && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                    restaurant.isOpen
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-700/40 text-zinc-300 border-zinc-600"
                  }`}
                >
                  {restaurant.isOpen
                    ? t("merchant.open_now")
                    : t("merchant.closed_now")}
                </span>
              )}
              {restaurant?.deliveryTimeRange && (
                <span className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {restaurant.deliveryTimeRange}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setActiveTab("restaurants")}
          className="flex items-center gap-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white px-4 py-2.5 rounded-lg shadow-lg shadow-orange-500/20 shrink-0"
        >
          <span>{t("merchant.open_board")}</span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80 overflow-x-auto scrollbar-none w-full md:w-fit">
        {PERIODS.map((option) => (
          <button
            key={option.value}
            onClick={() => setPeriod(option.value)}
            aria-pressed={period === option.value}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              period === option.value
                ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
            }`}
          >
            {t(option.key)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label={t("merchant.orders")}
              value={(stats?.totalOrders ?? 0).toLocaleString("en-US")}
              icon={<ShoppingBag className="w-5 h-5" />}
              accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            />
            <StatCard
              label={t("merchant.revenue")}
              value={formatMoney(stats?.totalRevenue, currency)}
              icon={<DollarSign className="w-5 h-5" />}
              accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label={t("merchant.new_customers")}
              value={(stats?.newCustomers ?? 0).toLocaleString("en-US")}
              icon={<Users className="w-5 h-5" />}
              accent="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            />
            <StatCard
              label={t("common.rating")}
              value={`${formatRating(stats?.avgRating)} ★`}
              icon={<Star className="w-5 h-5 fill-amber-500" />}
              accent="bg-amber-500/10 text-amber-500"
              footer={t("merchant.ratings_count", {
                count: stats?.totalRatings ?? 0,
              })}
            />
          </div>

          {weekly.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
                {t("merchant.daily_title")}
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-6">
                {t("merchant.daily_subtitle")}
              </p>

              <div className="flex items-end gap-2 h-44">
                {weekly.map((day) => {
                  const height = Math.round(
                    ((day.revenue ?? 0) / peakRevenue) * 100,
                  );
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-2 min-w-0"
                    >
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full bg-orange-500/80 hover:bg-orange-500 rounded-t-lg transition-all duration-300 min-h-[2px]"
                          style={{ height: `${height}%` }}
                          title={t("merchant.daily_tooltip", {
                            day: day.day,
                            orders: day.orders,
                            revenue: formatMoney(day.revenue, currency),
                          })}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase truncate w-full text-center">
                        {day.day?.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
  footer?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wide uppercase">
            {label}
          </p>
          <h4 className="text-2xl font-black text-zinc-900 dark:text-white mt-2 truncate">
            {value}
          </h4>
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${accent}`}>{icon}</div>
      </div>
      {footer && (
        <p className="mt-4 text-xs font-bold text-zinc-500 dark:text-zinc-400">
          {footer}
        </p>
      )}
    </div>
  );
}
