"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingBag,
  Clock,
  MapPin,
  User,
  Store,
  Bike,
  CheckCircle2,
  Play,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react";
import {
  ordersService,
  OrderResponse,
  OrderStatus,
  PaymentStatus,
} from "../../services/orders";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ORDER_STATUS_OPTIONS: { label: string; value: OrderStatus | "" }[] = [
  { label: "All Statuses", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Out for Delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Rejected", value: "rejected" },
];

const PAYMENT_STATUS_OPTIONS: { label: string; value: PaymentStatus | "" }[] = [
  { label: "All Payments", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
];

const LIVE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "out_for_delivery",
];

const DONE_STATUSES: OrderStatus[] = ["delivered", "cancelled", "rejected"];

function statusColor(s: OrderStatus | string): string {
  switch (s) {
    case "pending":
      return "bg-amber-500/10 text-amber-600";
    case "confirmed":
      return "bg-sky-500/10 text-sky-600";
    case "out_for_delivery":
      return "bg-blue-500/10 text-blue-600";
    case "delivered":
      return "bg-emerald-500/10 text-emerald-600";
    case "cancelled":
    case "rejected":
      return "bg-red-500/10 text-red-500";
    default:
      return "bg-zinc-500/10 text-zinc-500";
  }
}

function paymentColor(s: PaymentStatus | string): string {
  switch (s) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-500";
    case "failed":
      return "bg-red-500/10 text-red-500";
    case "refunded":
      return "bg-pink-500/10 text-pink-500";
    default:
      return "bg-amber-500/10 text-amber-600";
  }
}

function fmtCurrency(n?: number) {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrdersSectionProps {
  searchQuery: string;
}

const KANBAN_LANES: {
  title: string;
  statuses: OrderStatus[];
  color: string;
  dotColor: string;
}[] = [
  {
    title: "Incoming",
    statuses: ["pending"],
    color: "border-amber-400",
    dotColor: "bg-amber-400",
  },
  {
    title: "Confirmed",
    statuses: ["confirmed"],
    color: "border-sky-500",
    dotColor: "bg-sky-500",
  },
  {
    title: "Out for Delivery",
    statuses: ["out_for_delivery"],
    color: "border-blue-500",
    dotColor: "bg-blue-500",
  },
  {
    title: "Done",
    statuses: ["delivered", "cancelled", "rejected"],
    color: "border-zinc-300",
    dotColor: "bg-zinc-400",
  },
];

const PAGE_SIZE = 20;

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersSection({ searchQuery }: OrdersSectionProps) {
  // View mode
  const [activeSubTab, setActiveSubTab] = useState<"live" | "archive">("live");
  const [selectedMobileLane, setSelectedMobileLane] = useState(0);

  // API state
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "">("");
  const [showFilters, setShowFilters] = useState(false);

  // Detail drawer
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await ordersService.getOrders({
          status: statusFilter || undefined,
          paymentStatus: paymentFilter || undefined,
          page,
          limit: PAGE_SIZE,
        });
        setOrders(res.data ?? []);
        setTotal(res.total ?? 0);
      } catch (err: unknown) {
        if (!silent) {
          const msg =
            err instanceof Error ? err.message : "Failed to fetch orders.";
          setError(msg);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [statusFilter, paymentFilter, page],
  );

  // Initial + filter/page changes
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Live polling every 30 s on the Live tab
  useEffect(() => {
    if (activeSubTab === "live") {
      pollingRef.current = setInterval(() => fetchOrders(true), 30_000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeSubTab, fetchOrders]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, paymentFilter]);

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.id?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.restaurantName?.toLowerCase().includes(q)
    );
  });

  const liveOrders = filteredOrders.filter((o) =>
    LIVE_STATUSES.includes(o.status),
  );
  const archiveOrders = filteredOrders.filter((o) =>
    DONE_STATUSES.includes(o.status),
  );
  const displayOrders = activeSubTab === "live" ? liveOrders : archiveOrders;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ─── Order detail ─────────────────────────────────────────────────────────

  const openOrder = async (order: OrderResponse) => {
    setSelectedOrder(order);
    setDetailLoading(true);
    try {
      const full = await ordersService.getOrderById(order.id);
      setSelectedOrder(full);
    } catch {
      // use list-level data as fallback
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Status update ────────────────────────────────────────────────────────

  const handleUpdateStatus = async (
    order: OrderResponse,
    nextStatus: OrderStatus,
    nextPayment?: PaymentStatus,
  ) => {
    setUpdatingId(order.id);
    try {
      const updated = await ordersService.updateOrder(order.id, {
        status: nextStatus,
        ...(nextPayment ? { paymentStatus: nextPayment } : {}),
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      if (selectedOrder?.id === order.id) setSelectedOrder(updated);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Update failed. Please retry.";
      alert(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = async (order: OrderResponse) => {
    if (!confirm(`Cancel order ${order.id}?`)) return;
    await handleUpdateStatus(order, "cancelled");
  };

  const handleReject = async (order: OrderResponse) => {
    if (!confirm(`Reject order ${order.id}?`)) return;
    await handleUpdateStatus(order, "rejected");
  };

  // ─── Workflow buttons ─────────────────────────────────────────────────────

  const WorkflowControls = ({ order }: { order: OrderResponse }) => {
    const busy = updatingId === order.id;

    if (busy)
      return (
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
        </span>
      );

    return (
      <div className="flex gap-2 flex-wrap">
        {order.status === "pending" && (
          <>
            <button
              onClick={() => handleUpdateStatus(order, "confirmed")}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
            >
              <Check className="w-3.5 h-3.5" /> Confirm Order
            </button>
            <button
              onClick={() => handleReject(order)}
              className="bg-zinc-100 hover:bg-red-500 hover:text-white text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold text-[10px] px-3.5 py-2 rounded-lg transition-all"
            >
              Reject
            </button>
          </>
        )}

        {order.status === "confirmed" && (
          <button
            onClick={() => handleUpdateStatus(order, "out_for_delivery")}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
          >
            <Bike className="w-3.5 h-3.5" /> Dispatch Rider
          </button>
        )}

        {order.status === "out_for_delivery" && (
          <button
            onClick={() => handleUpdateStatus(order, "delivered", "paid")}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
          </button>
        )}

        {/* Cancel fallback for any active order that isn't done */}
        {!DONE_STATUSES.includes(order.status) &&
          order.status !== "pending" && (
            <button
              onClick={() => handleCancel(order)}
              className="text-[10px] text-zinc-400 hover:text-red-500 font-bold pl-2 border-l border-zinc-200 dark:border-zinc-800 transition-colors"
            >
              Cancel Order
            </button>
          )}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top controls bar ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Sub-tab toggle */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
            <button
              id="orders-tab-live"
              onClick={() => setActiveSubTab("live")}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                activeSubTab === "live"
                  ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30"
                  : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Live Dispatch Room
              <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 text-[9px] rounded-full font-black">
                {liveOrders.length}
              </span>
            </button>
            <button
              id="orders-tab-archive"
              onClick={() => setActiveSubTab("archive")}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSubTab === "archive"
                  ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30"
                  : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              Archived History
            </button>
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400">
              {loading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </span>
              ) : (
                `${total} total orders`
              )}
            </span>

            <button
              id="orders-filter-toggle"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-lg border transition-all ${
                showFilters || statusFilter || paymentFilter
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-orange-500/50"
              }`}
            >
              <Filter className="w-3 h-3" />
              Filters
              {(statusFilter || paymentFilter) && (
                <span className="bg-white/20 rounded-full px-1.5 text-[8px] font-black">
                  {[statusFilter, paymentFilter].filter(Boolean).length}
                </span>
              )}
            </button>

            <button
              id="orders-refresh"
              onClick={() => fetchOrders()}
              disabled={loading}
              title="Refresh"
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-orange-500 hover:border-orange-500/50 transition-all disabled:opacity-40"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 animate-in fade-in duration-150">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">
                Order Status
              </label>
              <select
                id="orders-filter-status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as OrderStatus | "")
                }
                className="text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500 min-w-[170px]"
              >
                {ORDER_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">
                Payment Status
              </label>
              <select
                id="orders-filter-payment"
                value={paymentFilter}
                onChange={(e) =>
                  setPaymentFilter(e.target.value as PaymentStatus | "")
                }
                className="text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500 min-w-[160px]"
              >
                {PAYMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {(statusFilter || paymentFilter) && (
              <button
                id="orders-filter-clear"
                onClick={() => {
                  setStatusFilter("");
                  setPaymentFilter("");
                }}
                className="self-end text-[10px] font-bold text-red-500 hover:text-red-600 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Error state ── */}
      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-4 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-600 dark:text-red-400">
              API Error
            </p>
            <p className="text-[10px] text-red-500/80 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="ml-auto text-[10px] font-bold text-red-500 hover:text-red-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && orders.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && displayOrders.length === 0 && !error && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <ShoppingBag className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            No orders found
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {statusFilter || paymentFilter
              ? "Try adjusting your filters."
              : activeSubTab === "live"
                ? "Ready for incoming transactions…"
                : "No completed orders yet."}
          </p>
        </div>
      )}

      {/* ── LIVE: Kanban board ── */}
      {!loading && activeSubTab === "live" && liveOrders.length > 0 && (
        <div className="space-y-4">
          {/* Mobile lane switcher */}
          <div className="flex lg:hidden items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-zinc-100 dark:border-zinc-800">
            {KANBAN_LANES.map((lane, idx) => {
              const count = liveOrders.filter((o) =>
                lane.statuses.includes(o.status),
              ).length;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedMobileLane(idx)}
                  className={`text-[10px] font-bold px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 border shrink-0 ${
                    selectedMobileLane === idx
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                      : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-950 dark:border-zinc-800"
                  }`}
                >
                  {lane.title}
                  <span
                    className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                      selectedMobileLane === idx
                        ? "bg-white/20 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kanban grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {KANBAN_LANES.map((lane, idx) => {
              const colOrders = liveOrders.filter((o) =>
                lane.statuses.includes(o.status),
              );
              return (
                <div
                  key={idx}
                  className={`flex flex-col space-y-4 ${
                    selectedMobileLane === idx
                      ? "flex animate-in fade-in duration-150"
                      : "hidden lg:flex"
                  }`}
                >
                  {/* Column header */}
                  <div
                    className={`p-3 border-b-2 ${lane.color} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex justify-between items-center shadow-sm`}
                  >
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {lane.title}
                    </span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-black rounded text-zinc-500">
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    {colOrders.length === 0 ? (
                      <div className="p-8 text-center text-zinc-400 text-[10px] italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                        Empty Lane
                      </div>
                    ) : (
                      colOrders.map((order) => (
                        <div
                          key={order.id}
                          onClick={() => openOrder(order)}
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm hover:border-orange-500/30 hover:shadow transition-all duration-200 cursor-pointer space-y-3"
                        >
                          {/* Header: ID and total */}
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-black text-zinc-950 dark:text-white truncate">
                              {order.id}
                            </span>
                            <span className="text-[10px] font-black text-orange-500 shrink-0">
                              {fmtCurrency(order.total)}
                            </span>
                          </div>
                          {/* Order number */}
                          <p className="text-xs text-zinc-500 truncate">
                            #{order.orderNumber}
                          </p>
                          {/* Restaurant & Customer info */}
                          <div className="space-y-1">
                            {(order.restaurant?.name ||
                              order.restaurantName) && (
                              <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span className="truncate">
                                  {String(
                                    order.restaurant?.name ||
                                      order.restaurantName,
                                  )}
                                </span>
                              </p>
                            )}
                            {(order.customer?.name ||
                              order.customerName ||
                              order.customer?.id) && (
                              <p className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                  {String(
                                    order.customer?.name ||
                                      order.customerName ||
                                      order.customer?.id?.slice(0, 8),
                                  )}
                                </span>
                              </p>
                            )}
                          </div>
                          {order.items && order.items.length > 0 && (
                            <p className="text-[9px] text-zinc-500">
                              {order.items.length} item
                              {order.items.length > 1 ? "s" : ""}:{" "}
                              {order.items
                                .slice(0, 2)
                                .map((i) => i.name)
                                .join(", ")}
                              {order.items.length > 2 ? ", …" : ""}
                            </p>
                          )}
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-[9px] text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fmtTime(order.createdAt)}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${statusColor(order.status)}`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ARCHIVE: Table ── */}
      {!loading && activeSubTab === "archive" && archiveOrders.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 uppercase text-[9px] font-bold tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="p-4 font-black">Order ID</th>
                  <th className="p-4 font-black">Restaurant</th>
                  <th className="p-4 font-black">Customer</th>
                  <th className="p-4 font-black">Total</th>
                  <th className="p-4 font-black">Payment</th>
                  <th className="p-4 font-black">Status</th>
                  <th className="p-4 font-black">Date</th>
                  <th className="p-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {archiveOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="p-4 font-black text-zinc-900 dark:text-white">
                      {order.id}
                    </td>
                    <td className="p-4 font-bold text-zinc-700 dark:text-zinc-300">
                      {order.restaurantName ?? "—"}
                    </td>
                    <td className="p-4 text-zinc-500 dark:text-zinc-400">
                      {order.customerName ?? "—"}
                    </td>
                    <td className="p-4 font-black text-zinc-950 dark:text-white">
                      {fmtCurrency(order.total)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide ${paymentColor(order.paymentStatus)}`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide ${statusColor(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400">
                      {fmtDate(order.createdAt)}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openOrder(order)}
                        className="text-orange-500 font-bold hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-5 py-3 rounded-2xl shadow-sm">
          <span className="text-[10px] font-semibold text-zinc-400">
            Page {page} of {totalPages} · {total} orders
          </span>
          <div className="flex items-center gap-1.5">
            <button
              id="orders-prev-page"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const pageNum =
                totalPages <= 5
                  ? i + 1
                  : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`min-w-[30px] h-[30px] rounded-lg text-[10px] font-black transition-all border ${
                    pageNum === page
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-orange-400 hover:text-orange-500"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              id="orders-next-page"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Detail Drawer ── */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
            {/* Drawer header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40 shrink-0">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    Order Detail
                    <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded font-black">
                      {selectedOrder.id}
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    Placed {fmtDate(selectedOrder.createdAt)} at{" "}
                    {fmtTime(selectedOrder.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {detailLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-zinc-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading full details…
                </div>
              )}

              {/* Status banner + workflow controls */}
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                    Current Status
                  </p>
                  <p
                    className={`text-xs font-black mt-0.5 flex items-center gap-1.5 ${statusColor(selectedOrder.status).split(" ")[1]}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />
                    <span className="capitalize">{selectedOrder.status}</span>
                  </p>
                </div>
                <WorkflowControls order={selectedOrder} />
              </div>

              {/* Items breakdown */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Basket Breakdown
                  </h4>
                  <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                    {selectedOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 flex justify-between items-center text-xs bg-white dark:bg-zinc-900"
                      >
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">
                            {item.name ?? item.menuItemId}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Qty: {item.quantity}
                            {item.price != null &&
                              ` · Unit: ${fmtCurrency(item.price)}`}
                            {item.notes && ` · Note: ${item.notes}`}
                          </p>
                        </div>
                        <span className="font-extrabold text-zinc-900 dark:text-white">
                          {item.price != null
                            ? fmtCurrency(item.price * item.quantity)
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Billing + Participants */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Billing */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Billing Invoice
                  </h4>
                  <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 text-xs space-y-2.5 text-zinc-500 dark:text-zinc-400">
                    {selectedOrder.subtotal != null && (
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {fmtCurrency(selectedOrder.subtotal)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.deliveryFee != null && (
                      <div className="flex justify-between">
                        <span>Delivery Fee</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {fmtCurrency(selectedOrder.deliveryFee)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.serviceFee != null && (
                      <div className="flex justify-between">
                        <span>Service Fee</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {fmtCurrency(selectedOrder.serviceFee)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.discount != null &&
                      selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-red-500 font-semibold">
                          <span>Discount</span>
                          <span>-{fmtCurrency(selectedOrder.discount)}</span>
                        </div>
                      )}
                    <div className="flex justify-between pt-2.5 border-t border-zinc-200 dark:border-zinc-700 text-sm font-black text-zinc-900 dark:text-white">
                      <span>Total</span>
                      <span className="text-orange-500">
                        {fmtCurrency(selectedOrder.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] pt-1">
                      <span>Payment Method</span>
                      <span className="font-bold capitalize">
                        {selectedOrder.paymentMethod ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>Payment Status</span>
                      <span
                        className={`font-black capitalize px-1.5 py-0.5 rounded-full ${paymentColor(selectedOrder.paymentStatus)}`}
                      >
                        {selectedOrder.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Participants
                  </h4>
                  <div className="space-y-2.5">
                    {selectedOrder.customerName && (
                      <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                        <User className="w-5 h-5 text-orange-500 shrink-0" />
                        <div>
                          <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                            {selectedOrder.customerName}
                          </p>
                          <p className="text-[10px] text-zinc-400">Customer</p>
                        </div>
                      </div>
                    )}
                    {selectedOrder.restaurantName && (
                      <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                        <Store className="w-5 h-5 text-orange-500 shrink-0" />
                        <div>
                          <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                            {selectedOrder.restaurantName}
                          </p>
                          <p className="text-[10px] text-zinc-400">
                            Restaurant partner
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                      <Bike className="w-5 h-5 text-orange-500 shrink-0" />
                      <div>
                        <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                          {selectedOrder.driverName ??
                            "Awaiting dispatch assignment"}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          {selectedOrder.driverId
                            ? "On-trip tracking active"
                            : "No rider assigned yet"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer notes */}
              {selectedOrder.customerNotes && (
                <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400">
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Customer Note
                  </p>
                  <p>{selectedOrder.customerNotes}</p>
                </div>
              )}

              {/* Timeline */}
              {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
                <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-5">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Order Timeline
                  </h4>
                  <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-800">
                    {selectedOrder.timeline.map((event, idx) => (
                      <div key={idx} className="flex gap-4 relative">
                        <div className="w-6 h-6 rounded-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0 z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900 dark:text-white capitalize">
                            {event.status}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </p>
                          {event.note && (
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/20 p-2 rounded-lg border border-zinc-100 mt-1.5 leading-relaxed">
                              {event.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
