"use client";

import React, { useMemo } from "react";
import {
  DollarSign,
  ShoppingBag,
  Star,
  TrendingUp,
  Clock,
  Check,
  Play,
  ChevronRight,
  TrendingDown,
  Percent,
  Layers,
  ArrowRight,
  ChefHat
} from "lucide-react";
import { Restaurant, Order, loadDb } from "../data/mockData";
import { formatMoney, formatRating, formatTime } from "../../lib/format";
import StatusPill from "./ui/StatusPill";

interface RestaurantOverviewProps {
  restaurant: Restaurant;
  db: ReturnType<typeof loadDb>;
  setActiveTab: (tab: string) => void;
  onUpdateOrder: (updatedOrder: Order) => void;
}

/* Sales chart geometry, in the SVG's own 700x200 user space. */
const CHART_WIDTH = 700;
const CHART_TOP = 20;
const CHART_BOTTOM = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Locale and timezone are pinned exactly as in src/lib/format.ts so the server
 * and the client bucket orders into the same days — otherwise the chart would
 * differ between the two renders and React would report a hydration mismatch.
 */
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Beirut",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Beirut",
  day: "2-digit",
  month: "short",
});

export default function RestaurantOverviewSection({
  restaurant,
  db,
  setActiveTab,
  onUpdateOrder
}: RestaurantOverviewProps) {
  const { orders } = db;

  // Filter orders related to this restaurant
  const storeOrders = orders.filter(o => o.restaurantId === restaurant.id);
  const completedOrders = storeOrders.filter(o => o.status === "Delivered");
  const pendingOrders = storeOrders.filter(o => o.status === "Pending");
  const activePrepOrders = storeOrders.filter(o => ["Accepted", "Preparing"].includes(o.status));

  // Revenue computations
  const grossRevenue = storeOrders
    .filter(o => o.status !== "Cancelled")
    .reduce((sum, o) => sum + o.subtotal, 0);

  const platformCommissionRate = db.settings?.commissionRate || 15;
  const platformCommission = grossRevenue * (platformCommissionRate / 100);
  const netEarnings = grossRevenue - platformCommission;

  // Average order value
  const activeOrdersCount = storeOrders.filter(o => o.status !== "Cancelled").length;
  const averageOrderValue = activeOrdersCount > 0 ? grossRevenue / activeOrdersCount : 0;

  // Best selling items simulation
  const itemCounts: { [name: string]: { count: number; sales: number } } = {};
  storeOrders.forEach(order => {
    if (order.status !== "Cancelled") {
      order.items.forEach(item => {
        if (!itemCounts[item.name]) {
          itemCounts[item.name] = { count: 0, sales: 0 };
        }
        itemCounts[item.name].count += item.quantity;
        itemCounts[item.name].sales += item.price * item.quantity;
      });
    }
  });

  const bestSellers = Object.entries(itemCounts)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  /**
   * Real 7-day sales trend. This chart used to be a hardcoded SVG path with
   * fixed axis labels sitting next to genuinely computed figures, so a merchant
   * had no way to tell which numbers were real. Everything below is derived
   * from the store's own order timestamps.
   */
  const salesTrend = useMemo(() => {
    const now = Date.now();
    const weekStart = now - 7 * DAY_MS;
    const priorWeekStart = now - 14 * DAY_MS;

    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now - (6 - i) * DAY_MS);
      return {
        key: dayKeyFormatter.format(date),
        label: i === 6 ? "Today" : dayLabelFormatter.format(date),
        value: 0,
      };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));

    let priorWeekTotal = 0;

    orders.forEach((order) => {
      if (order.restaurantId !== restaurant.id || order.status === "Cancelled") return;
      const timestamp = new Date(order.createdAt).getTime();
      if (!Number.isFinite(timestamp)) return;

      const bucket = byKey.get(dayKeyFormatter.format(timestamp));
      if (bucket) {
        bucket.value += order.subtotal;
      } else if (timestamp >= priorWeekStart && timestamp < weekStart) {
        priorWeekTotal += order.subtotal;
      }
    });

    const weekTotal = days.reduce((sum, d) => sum + d.value, 0);
    const peak = days.reduce((max, d) => Math.max(max, d.value), 0);

    const points = days.map((day, i) => ({
      ...day,
      x: (i * CHART_WIDTH) / (days.length - 1),
      y:
        peak > 0
          ? CHART_BOTTOM - (day.value / peak) * (CHART_BOTTOM - CHART_TOP)
          : CHART_BOTTOM,
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");

    return {
      points,
      peak,
      weekTotal,
      priorWeekTotal,
      linePath,
      areaPath: `${linePath} L${CHART_WIDTH},${CHART_BOTTOM} L0,${CHART_BOTTOM} Z`,
      // Only a real prior week gives a meaningful delta; otherwise show nothing.
      deltaPct:
        priorWeekTotal > 0
          ? ((weekTotal - priorWeekTotal) / priorWeekTotal) * 100
          : null,
    };
  }, [orders, restaurant.id]);

  const trendUp = (salesTrend.deltaPct ?? 0) >= 0;

  // Action methods to progress order state
  const handleProgressOrder = (order: Order, nextStatus: Order['status']) => {
    const timestamp = new Date().toISOString();
    
    const timelineEntry = {
      status: nextStatus,
      timestamp,
      note: nextStatus === 'Accepted' ? 'Merchant accepted the order. Sending to kitchen.' :
            nextStatus === 'Preparing' ? 'Chef is preparing your gourmet meals.' :
            nextStatus === 'OutForDelivery' ? `Dispatched out with courier.` :
            'Administrative status override.'
    };

    let updated: Order = {
      ...order,
      status: nextStatus,
      timeline: [...order.timeline, timelineEntry]
    };

    onUpdateOrder(updated);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Welcome & Quick Overview Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
            Merchant Partner Panel
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            Welcome Back, {restaurant.name}! {restaurant.logo}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitor store orders, tweak your gourmet menu, and view payouts analytics.</p>
        </div>

        {/* Real platform status — this used to hardcode "Store Open & Live". */}
        <StatusPill status={restaurant.status} className="px-3 py-1.5 text-xs" />
      </div>

      {/* METRICS CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Earnings Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4 hover:border-orange-500/20 transition-all duration-200">
          <div className="flex justify-between items-start">
            <span className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl">
              <DollarSign className="w-5 h-5" />
            </span>
            {/* Rendered only when a prior 7-day window actually has sales. */}
            {salesTrend.deltaPct !== null && (
              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                  trendUp
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/15"
                    : "text-red-500 bg-red-500/10 border-red-500/15"
                }`}
              >
                {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {trendUp ? "+" : ""}{salesTrend.deltaPct.toFixed(0)}% vs prior 7 days
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Gross Sales Revenue</p>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1">${formatMoney(grossRevenue)}</h3>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold border-t border-zinc-100 dark:border-zinc-850 pt-2">
              <Percent className="w-3.5 h-3.5 text-zinc-400" />
              <span>Net payout: </span>
              <span className="text-orange-500 font-extrabold">${formatMoney(netEarnings)}</span>
            </div>
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4 hover:border-orange-500/20 transition-all duration-200">
          <div className="flex justify-between items-start">
            <span className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 border border-orange-500/15 px-2 py-0.5 rounded">
              {pendingOrders.length} New Orders
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Sales Volume</p>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1">{storeOrders.length} Orders</h3>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold border-t border-zinc-100 dark:border-zinc-850 pt-2">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Avg ticket: </span>
              <span className="text-zinc-800 dark:text-zinc-300 font-extrabold">${formatMoney(averageOrderValue)}</span>
            </div>
          </div>
        </div>

        {/* Rating Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4 hover:border-orange-500/20 transition-all duration-200">
          <div className="flex justify-between items-start">
            <span className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl">
              <Star className="w-5 h-5 fill-orange-500/20" />
            </span>
            <div className="flex items-center gap-0.5 text-orange-500 font-black text-xs">
              <span>{formatRating(restaurant.rating)}</span>
              <Star className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Customer Experience</p>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1">{restaurant.reviewsCount} Reviews</h3>
            {/* Was "98% Positive Feedback" — invented. This is the stored rating. */}
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold border-t border-zinc-100 dark:border-zinc-850 pt-2">
              <Star className="w-3.5 h-3.5 text-zinc-400" />
              <span>Average rating: </span>
              <span className="text-zinc-800 dark:text-zinc-300 font-extrabold">{formatRating(restaurant.rating)} / 5</span>
            </div>
          </div>
        </div>

        {/* Commission/Payout Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4 hover:border-orange-500/20 transition-all duration-200">
          <div className="flex justify-between items-start">
            <span className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl">
              <Layers className="w-5 h-5" />
            </span>
            {/* "Next Payout: May 20" removed — no payout schedule exists in the data. */}
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Platform Commission</p>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-1">{platformCommissionRate}% Rate</h3>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold border-t border-zinc-100 dark:border-zinc-850 pt-2">
              <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
              <span>Commission paid: </span>
              <span className="text-red-500 font-extrabold">-${formatMoney(platformCommission)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* GRAPH CHART & BEST SELLERS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SVG Sales Curve Chart - Left */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Store Sales Progression</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Sales of non-cancelled orders over the last 7 days — ${formatMoney(salesTrend.weekTotal)} total.
              </p>
            </div>

            <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-orange-500" />
                <span>Sales</span>
              </div>
            </div>
          </div>

          {/* SVG chart, plotted from the buckets computed above */}
          <div className="relative h-64 w-full bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl p-4 flex flex-col justify-between border border-zinc-100 dark:border-zinc-850/80">
            {salesTrend.peak === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <TrendingUp className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-2" />
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No sales in the last 7 days</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                  The curve appears as soon as this store records its first order.
                </p>
              </div>
            ) : (
              <>
                <svg
                  viewBox={`0 0 ${CHART_WIDTH} 200`}
                  className="w-full h-full absolute inset-0 pr-16 pl-4 pt-8 pb-10 overflow-visible"
                  role="img"
                  aria-label={`Daily sales for the last 7 days, peaking at $${formatMoney(salesTrend.peak)}`}
                >
                  <defs>
                    <linearGradient id="gradientStoreSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid lines, aligned with the Y axis ticks below */}
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const y = CHART_BOTTOM - fraction * (CHART_BOTTOM - CHART_TOP);
                    return (
                      <line
                        key={fraction}
                        x1="0"
                        y1={y}
                        x2={CHART_WIDTH}
                        y2={y}
                        stroke="rgba(128,128,128,0.12)"
                        strokeWidth="1"
                      />
                    );
                  })}

                  <path d={salesTrend.areaPath} fill="url(#gradientStoreSales)" />

                  <path
                    d={salesTrend.linePath}
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="stroke-orange-500"
                  />

                  {salesTrend.points.map((point) => (
                    <circle
                      key={point.key}
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      fill="#f97316"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="drop-shadow-lg"
                    >
                      <title>{`${point.label}: $${formatMoney(point.value)}`}</title>
                    </circle>
                  ))}
                </svg>

                {/* Y axis metrics (right side overlay), scaled to the real peak */}
                <div className="absolute right-3 top-4 bottom-10 flex flex-col justify-between text-[8px] font-black text-zinc-500 dark:text-zinc-400 text-right pointer-events-none select-none">
                  {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
                    <span key={fraction}>${formatMoney(salesTrend.peak * fraction)}</span>
                  ))}
                </div>

                {/* X axis labels */}
                <div className="flex justify-between items-center mt-auto text-[8px] font-bold text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  {salesTrend.points.map((point) => (
                    <span key={point.key}>{point.label}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Best Sellers & Menu quick stats - Right */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Popular Dishes</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Best performing menu dishes in last 30 days.</p>
            </div>

            <div className="space-y-4">
              {bestSellers.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-[10px] italic border border-dashed border-zinc-200 dark:border-zinc-850 rounded-xl">
                  Waiting for sales volume...
                </div>
              ) : (
                bestSellers.map((item, idx) => (
                  <div key={idx} className="space-y-1.5 text-xs font-semibold">
                    <div className="flex justify-between text-zinc-850 dark:text-zinc-200">
                      <span>{item.name}</span>
                      <span className="font-extrabold text-orange-500">{item.count} sold</span>
                    </div>
                    {/* Progress indicator */}
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r rounded-full ${
                          idx === 0 ? "from-orange-500 to-red-500" :
                          idx === 1 ? "from-amber-400 to-orange-500" :
                          "from-yellow-400 to-amber-400"
                        }`}
                        style={{ width: `${Math.min(100, (item.count / bestSellers[0].count) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold">
                      <span>Revenue Generated</span>
                      <span>${formatMoney(item.sales)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick CTA banner */}
          <div className="mt-6 p-4 rounded-2xl bg-orange-500/[0.02] border border-orange-500/10 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-bold text-zinc-800 dark:text-zinc-200">Need to expand your menu?</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Use AI OCR to upload menus instantly.</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("restaurant_menu")}
              className="p-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors shrink-0 shadow shadow-orange-500/15"
              title="Add menu items"
              aria-label="Go to the menu editor to add items"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* DISPATCH CONTROL DESK / RECENT PENDING ORDERS */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
        
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Active Store Orders Desk</h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Accept incoming tickets, start cooking, and ready meals for pickup.</p>
          </div>

          <button
            onClick={() => setActiveTab("restaurant_orders")}
            className="text-[10px] font-black text-orange-500 hover:underline flex items-center gap-1"
          >
            <span>Live Dispatch Room</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Orders list */}
        {storeOrders.filter(o => !["Delivered", "Cancelled"].includes(o.status)).length === 0 ? (
          <div className="p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center">
            <ChefHat className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Kitchen is idle</p>
            <p className="text-[10px] text-zinc-400 mt-1">Ready and waiting for incoming customer orders...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storeOrders
              .filter(o => !["Delivered", "Cancelled"].includes(o.status))
              .map(order => (
                <div 
                  key={order.id}
                  className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-4 rounded-2xl flex flex-col justify-between gap-4 hover:border-orange-500/20 hover:shadow-sm transition-all duration-200"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-black text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                          {order.id}
                        </span>
                        {/* formatTime pins locale + timezone; a bare toLocaleTimeString() here
                            rendered differently on the server and caused a hydration mismatch. */}
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">{formatTime(order.createdAt)}</p>
                      </div>
                      <span className="font-extrabold text-orange-500 text-xs">${formatMoney(order.total)}</span>
                    </div>

                    {/* Customer & Basket items */}
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-zinc-800 dark:text-zinc-200">{order.customerName}</p>
                      <div className="text-[10px] text-zinc-400 pl-2 border-l border-zinc-200 dark:border-zinc-800 space-y-0.5">
                        {order.items.map((item, idx) => (
                          <p key={idx}>{item.quantity}x {item.name}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions based on status */}
                  <div className="pt-3 border-t border-zinc-150 dark:border-zinc-850/80 flex justify-between items-center">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      order.status === "Pending" ? "bg-amber-500/10 text-amber-500 animate-pulse" :
                      order.status === "Accepted" ? "bg-orange-500/10 text-orange-500" :
                      "bg-blue-500/10 text-blue-500"
                    }`}>{order.status}</span>

                    {order.status === "Pending" && (
                      <button
                        onClick={() => handleProgressOrder(order, "Accepted")}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </button>
                    )}

                    {order.status === "Accepted" && (
                      <button
                        onClick={() => handleProgressOrder(order, "Preparing")}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Play className="w-3.5 h-3.5" /> Start Cooking
                      </button>
                    )}

                    {order.status === "Preparing" && (
                      <span className="text-[10px] text-zinc-400 font-semibold italic flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 animate-spin text-orange-500" />
                        In Kitchen Prep...
                      </span>
                    )}

                    {order.status === "OutForDelivery" && (
                      <span className="text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
                        🏍️ Courier is delivering
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

    </div>
  );
}
