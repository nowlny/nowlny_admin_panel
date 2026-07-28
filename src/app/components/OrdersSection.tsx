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
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  ordersService,
  ListOrdersParams,
  OrderItemResponse,
  OrderResponse,
  OrderStatus,
  PaymentStatus,
} from "../../services/orders";
import { formatMoney, formatDate, formatTime, shortId } from "../../lib/format";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import StatusPill, { statusLabel } from "./ui/StatusPill";
import {
  EmptyState,
  ErrorState,
  ErrorBanner,
  Skeleton,
  TableSkeleton,
} from "./ui/States";

import { useI18n, type MessageKey } from "../../lib/i18n";
// ─── Helpers ─────────────────────────────────────────────────────────────────

const LIVE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "out_for_delivery",
];

const DONE_STATUSES: OrderStatus[] = ["delivered", "cancelled", "rejected"];

/**
 * The status dropdown is scoped to the tab you are on. It used to list every
 * status on both tabs, which let you sit on the Live board filtered to
 * "Delivered" and stare at an empty screen.
 */
const LIVE_STATUS_OPTIONS: { key: MessageKey; value: OrderStatus | "" }[] = [
  { key: "orders.all_live", value: "" },
  { key: "status.pending", value: "pending" },
  { key: "status.confirmed", value: "confirmed" },
  { key: "status.out_for_delivery", value: "out_for_delivery" },
];

const ARCHIVE_STATUS_OPTIONS: { key: MessageKey; value: OrderStatus | "" }[] = [
  { key: "orders.all_archived", value: "" },
  { key: "status.delivered", value: "delivered" },
  { key: "status.cancelled", value: "cancelled" },
  { key: "status.rejected", value: "rejected" },
];

const PAYMENT_STATUS_OPTIONS: { key: MessageKey; value: PaymentStatus | "" }[] = [
  { key: "orders.all_payments", value: "" },
  { key: "status.pending", value: "pending" },
  { key: "status.paid", value: "paid" },
  { key: "status.failed", value: "failed" },
  // The API's `paymentStatus` enum is pending|paid|failed — a "Refunded"
  // filter always returned a 400 from the list endpoint.
];

/** `NWL-2024-00001` is the operator-facing identity; the UUID is internal. */
function orderRef(order: OrderResponse): string {
  const raw =
    typeof order.orderNumber === "string" ? order.orderNumber.trim() : "";
  if (raw) return /^\d+$/.test(raw) ? `#${raw}` : raw;
  return `#${shortId(order.id)}`;
}

/**
 * Orders are priced in the merchant's own currency (LBP for most of the
 * platform). `formatMoney` was called without one everywhere, so a 750,000 LBP
 * order rendered as a bare "750,000.00" with no unit at all.
 */
function orderCurrency(order?: OrderResponse | null): string | undefined {
  return order?.currency?.code ?? order?.currencyCode ?? undefined;
}

function customerName(order: OrderResponse): string {
  return (
    order.customer?.name ||
    order.customer?.firstName ||
    order.customerName ||
    ""
  ).trim();
}

function restaurantName(order: OrderResponse): string {
  return (order.restaurant?.name || order.restaurantName || "").trim();
}

function newestFirst(a: OrderResponse, b: OrderResponse): number {
  return (
    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );
}

function formatAgo(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrdersSectionProps {
  searchQuery: string;
  restaurantId?: string;
  isOwnerView?: boolean;
}

/** The list and detail endpoints disagree on the per-line price field names. */
type OrderItemLike = OrderItemResponse & {
  unitPrice?: number;
  subtotal?: number;
};

const KANBAN_LANES: {
  key: MessageKey;
  statuses: OrderStatus[];
  color: string;
}[] = [
  { key: "orders.lane_incoming", statuses: ["pending"], color: "border-amber-400" },
  { key: "orders.lane_confirmed", statuses: ["confirmed"], color: "border-sky-500" },
  {
    key: "orders.lane_out",
    statuses: ["out_for_delivery"],
    color: "border-blue-500",
  },
];

const PAGE_SIZE = 20;
const POLL_MS = 30_000;
/** How long a freshly-arrived order keeps its highlight ring. */
const NEW_ORDER_HIGHLIGHT_MS = 60_000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersSection({
  searchQuery,
  restaurantId,
  isOwnerView = false,
}: OrdersSectionProps) {
  const { t } = useI18n();
  const confirm = useConfirm();

  // View mode
  const [activeSubTab, setActiveSubTab] = useState<"live" | "archive">("live");
  const [selectedMobileLane, setSelectedMobileLane] = useState(0);

  // API state
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Sync health
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "">("");
  const [showFilters, setShowFilters] = useState(false);

  // Detail drawer
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  /** Monotonic id so a slow response can never repaint the board over a newer one. */
  const requestSeq = useRef(0);
  /** Pending order ids from the previous poll, keyed by the query they came from. */
  const seenPendingRef = useRef<{ key: string; ids: Set<string> } | null>(null);

  const statusOptions =
    activeSubTab === "live" ? LIVE_STATUS_OPTIONS : ARCHIVE_STATUS_OPTIONS;

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const listOrders = useCallback(
    (params: ListOrdersParams) =>
      isOwnerView
        ? ordersService.getMyRestaurantOrders(params)
        : ordersService.getOrders({
            ...params,
            restaurantId: restaurantId || undefined,
          }),
    [isOwnerView, restaurantId],
  );

  /**
   * The board used to request a single mixed-status page of 20 and split live
   * vs. archived in the browser — so with 20 live orders on page one the
   * Archived tab rendered "No orders found" next to a "231 total orders" header.
   *
   * The API filters by exactly one status (`FindOrdersQueryDto.status` is a
   * single enum), so a tab covering three statuses is three parallel requests.
   * Each status is its own paged stream: the tab has as many pages as its
   * longest stream, every order stays reachable, and none is duplicated.
   */
  const fetchOrders = useCallback(
    async (silent = false) => {
      const requestId = ++requestSeq.current;
      const tabStatuses =
        activeSubTab === "live" ? LIVE_STATUSES : DONE_STATUSES;
      const statuses =
        statusFilter && tabStatuses.includes(statusFilter)
          ? [statusFilter]
          : tabStatuses;

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const responses = await Promise.all(
          statuses.map((status) =>
            listOrders({
              status,
              paymentStatus: paymentFilter || undefined,
              page,
              limit: PAGE_SIZE,
            }),
          ),
        );
        if (requestId !== requestSeq.current) return;

        const merged = responses
          .flatMap((r) => r.data ?? [])
          .sort(newestFirst);
        const totalCount = responses.reduce((n, r) => n + (r.total ?? 0), 0);
        const pages = Math.max(
          1,
          ...responses.map((r) => Math.ceil((r.total ?? 0) / PAGE_SIZE)),
        );

        // New-order signal: only meaningful when the query itself is unchanged.
        const key = `${activeSubTab}|${statusFilter}|${paymentFilter}|${page}`;
        const pendingIds = new Set(
          merged.filter((o) => o.status === "pending").map((o) => o.id),
        );
        const previous = seenPendingRef.current;
        if (previous && previous.key === key) {
          const fresh = [...pendingIds].filter((id) => !previous.ids.has(id));
          if (fresh.length > 0) {
            toast.success(t("orders.new_orders", { count: fresh.length }));
            setNewOrderIds((prev) => [...prev, ...fresh]);
            setTimeout(
              () =>
                setNewOrderIds((prev) =>
                  prev.filter((id) => !fresh.includes(id)),
                ),
              NEW_ORDER_HIGHLIGHT_MS,
            );
          }
        }
        seenPendingRef.current = { key, ids: pendingIds };

        setOrders(merged);
        setTotal(totalCount);
        setTotalPages(pages);
        if (activeSubTab === "live" && !statusFilter && !paymentFilter) {
          setLiveCount(totalCount);
        }
        setLastSyncAt(Date.now());
        setNowTs(Date.now());
        setPollError(null);
        setError(null);
      } catch (err: unknown) {
        if (requestId !== requestSeq.current) return;
        const msg =
          err instanceof Error ? err.message : t("orders.fetch_failed");
        if (silent) {
          // A background refresh must never blank the dispatch board, but the
          // operator has to know the numbers on screen have stopped updating.
          setPollError(msg);
        } else {
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (!silent && requestId === requestSeq.current) setLoading(false);
      }
    },
    [activeSubTab, statusFilter, paymentFilter, page, listOrders],
  );

  // Initial + tab/filter/page changes.
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /**
   * The tab badge must stay honest while you're on the Archived tab. When the
   * Live tab is unfiltered its own `total` already is the live count, so we
   * only pay for the extra (limit-1) count requests when it isn't derivable.
   */
  const fetchLiveCount = useCallback(async () => {
    try {
      const responses = await Promise.all(
        LIVE_STATUSES.map((status) =>
          listOrders({ status, page: 1, limit: 1 }),
        ),
      );
      setLiveCount(responses.reduce((n, r) => n + (r.total ?? 0), 0));
    } catch {
      // Hide the badge rather than show a stale number. The main fetch above
      // surfaces the outage itself.
      setLiveCount(null);
    }
  }, [listOrders]);

  useEffect(() => {
    if (activeSubTab === "live" && !statusFilter && !paymentFilter) return;
    fetchLiveCount();
  }, [activeSubTab, statusFilter, paymentFilter, fetchLiveCount]);

  // Polling reads the latest fetcher through a ref so that changing a filter
  // no longer tears down and restarts the interval.
  const fetchRef = useRef(fetchOrders);
  useEffect(() => {
    fetchRef.current = fetchOrders;
  }, [fetchOrders]);

  useEffect(() => {
    if (activeSubTab !== "live") return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      timer = setInterval(() => fetchRef.current(true), POLL_MS);
    };
    const onVisibilityChange = () => {
      // Don't poll a tab nobody is looking at; catch up the moment it returns.
      if (document.hidden) {
        stop();
      } else {
        fetchRef.current(true);
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeSubTab]);

  // Ticks the "Updated Xs ago" label. Starts null (and is first written by a
  // successful fetch) so the server render has nothing time-dependent in it.
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const displayOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      orderRef(o).toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      customerName(o).toLowerCase().includes(q) ||
      restaurantName(o).toLowerCase().includes(q)
    );
  });

  const hasFilters = Boolean(statusFilter || paymentFilter);
  const syncedLabel =
    lastSyncAt && nowTs ? formatAgo(lastSyncAt, nowTs) : null;

  const switchTab = (tab: "live" | "archive") => {
    if (tab === activeSubTab) return;
    const allowed = tab === "live" ? LIVE_STATUSES : DONE_STATUSES;
    setActiveSubTab(tab);
    setPage(1);
    setStatusFilter((prev) => (prev && allowed.includes(prev) ? prev : ""));
  };

  const clearFilters = () => {
    setStatusFilter("");
    setPaymentFilter("");
    setPage(1);
  };

  // ─── Order detail ─────────────────────────────────────────────────────────

  const openOrder = async (order: OrderResponse) => {
    setSelectedOrder(order);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const full = isOwnerView
        ? await ordersService.getMyRestaurantOrderById(order.id)
        : await ordersService.getOrderById(order.id);
      setSelectedOrder(full);
    } catch (err: unknown) {
      // The list row is still shown, so this is a banner rather than a wipe.
      setDetailError(
        err instanceof Error
          ? err.message
          : t("orders.detail_failed"),
      );
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
      let updated: OrderResponse;
      if (isOwnerView) {
        /*
         * Owner transitions each have their own endpoint under
         * `/orders/me/{id}/…`. The old code posted to
         * `/orders/restaurant/me/{id}/accept|reject|status`, none of which
         * exist, so every button on the merchant board 404'd.
         */
        if (nextStatus === "confirmed") {
          await ordersService.acceptMyOrder(order.id);
          updated = { ...order, status: "confirmed" as OrderStatus };
        } else if (nextStatus === "rejected") {
          await ordersService.rejectMyOrder(order.id);
          updated = { ...order, status: "rejected" as OrderStatus };
        } else if (nextStatus === "out_for_delivery") {
          await ordersService.sendMyOrderOutForDelivery(order.id);
          updated = { ...order, status: "out_for_delivery" as OrderStatus };
        } else {
          // Merchants cannot mark an order delivered or cancelled — the driver
          // and the customer own those transitions.
          throw new Error(
            `A restaurant cannot move an order to "${nextStatus}" — that step belongs to the driver or the customer.`,
          );
        }
      } else {
        updated = await ordersService.updateOrder(order.id, {
          status: nextStatus,
          ...(nextPayment ? { paymentStatus: nextPayment } : {}),
        });
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      if (selectedOrder?.id === order.id) setSelectedOrder(updated);
      toast.success(
        t("orders.status_changed", {
          ref: orderRef(order),
          status: statusLabel(nextStatus, t),
        }),
      );
      // The order may have just left this tab's status set; resync quietly.
      fetchOrders(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t("orders.update_failed");
      toast.error(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const orderSummary = (order: OrderResponse) => (
    <>
      <span className="font-semibold text-zinc-900 dark:text-white">
        {orderRef(order)}
      </span>{" "}
      — {restaurantName(order) || "unknown restaurant"} for{" "}
      {customerName(order) || "an unnamed customer"}, total{" "}
      <span className="font-semibold text-zinc-900 dark:text-white">
        {formatMoney(order.total, orderCurrency(order))}
      </span>
      .
    </>
  );

  const handleCancel = async (order: OrderResponse) => {
    const ok = await confirm({
      title: t("orders.cancel_title"),
      description: <>{orderSummary(order)} The customer will not receive it.</>,
      confirmLabel: t("orders.cancel_cta"),
      cancelLabel: t("orders.keep"),
      variant: "danger",
    });
    if (!ok) return;
    await handleUpdateStatus(order, "cancelled");
  };

  const handleReject = async (order: OrderResponse) => {
    const ok = await confirm({
      title: t("orders.reject_title"),
      description: (
        <>{orderSummary(order)} The restaurant will not prepare it.</>
      ),
      confirmLabel: t("orders.reject_cta"),
      cancelLabel: t("orders.keep"),
      variant: "danger",
    });
    if (!ok) return;
    await handleUpdateStatus(order, "rejected");
  };

  /**
   * Marking an order delivered as an admin also writes `paymentStatus: "paid"`.
   * That is correct for cash-on-delivery — handing the food over *is* the
   * moment the money is collected — but it was happening silently and can't be
   * undone from this screen, so the dialog now spells it out.
   */
  const handleMarkDelivered = async (order: OrderResponse) => {
    const recordsPayment = !isOwnerView && order.paymentStatus !== "paid";
    const ok = await confirm({
      title: recordsPayment
        ? t("orders.deliver_pay_title")
        : t("orders.deliver_title"),
      description: (
        <>
          {orderSummary(order)}
          {recordsPayment && (
            <>
              {" "}
              This also records{" "}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {formatMoney(order.total, orderCurrency(order))}
              </span>{" "}
              as collected
              {order.paymentMethod ? ` (${order.paymentMethod})` : ""}. Payment
              status cannot be reverted from this screen.
            </>
          )}
        </>
      ),
      confirmLabel: recordsPayment
        ? t("orders.deliver_pay_cta")
        : t("orders.deliver_cta"),
    });
    if (!ok) return;
    await handleUpdateStatus(
      order,
      "delivered",
      recordsPayment ? "paid" : undefined,
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const showBoard = !loading && !(error && orders.length === 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top controls bar ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Sub-tab toggle */}
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
            <button
              id="orders-tab-live"
              onClick={() => switchTab("live")}
              aria-pressed={activeSubTab === "live"}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                activeSubTab === "live"
                  ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${
                  pollError
                    ? "bg-amber-500"
                    : liveCount
                      ? "bg-red-500 animate-pulse"
                      : "bg-zinc-400"
                }`}
              />
              {t("orders.live_room")}
              {liveCount !== null && (
                <span className="bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 py-0.5 text-[9px] rounded-full font-black">
                  {liveCount}
                </span>
              )}
            </button>
            <button
              id="orders-tab-archive"
              onClick={() => switchTab("archive")}
              aria-pressed={activeSubTab === "archive"}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                activeSubTab === "archive"
                  ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              {t("orders.archive")}
            </button>
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {loading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t("common.loading")}
                </span>
              ) : (
                <>
                  {total} {activeSubTab === "live" ? "live" : "archived"} orders
                  {syncedLabel && !pollError && (
                    <span className="text-zinc-400 dark:text-zinc-500 font-medium">
                      {" "}
                      · Updated {syncedLabel}
                    </span>
                  )}
                </>
              )}
            </span>

            <button
              id="orders-filter-toggle"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-lg border transition-all ${
                showFilters || hasFilters
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-orange-500/50"
              }`}
            >
              <Filter className="w-3 h-3" />
              {t("orders.filters")}
              {hasFilters && (
                <span className="bg-white/20 rounded-full px-1.5 text-[8px] font-black">
                  {[statusFilter, paymentFilter].filter(Boolean).length}
                </span>
              )}
            </button>

            <button
              id="orders-refresh"
              onClick={() => fetchOrders()}
              disabled={loading}
              aria-label={t("orders.refresh_aria")}
              title={t("orders.refresh")}
              className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-orange-500 hover:border-orange-500/50 transition-all disabled:opacity-40"
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
              <label
                htmlFor="orders-filter-status"
                className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {t("orders.order_status")}
              </label>
              <select
                id="orders-filter-status"
                value={statusFilter}
                onChange={(e) => {
                  // Page is reset here rather than in an effect: the effect
                  // version fired a second request for the stale page first.
                  setStatusFilter(e.target.value as OrderStatus | "");
                  setPage(1);
                }}
                className="text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500 min-w-[190px]"
              >
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.key)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="orders-filter-payment"
                className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {t("orders.payment_status")}
              </label>
              <select
                id="orders-filter-payment"
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value as PaymentStatus | "");
                  setPage(1);
                }}
                className="text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500 min-w-[160px]"
              >
                {PAYMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.key)}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button
                id="orders-filter-clear"
                onClick={clearFilters}
                className="self-end text-[10px] font-bold text-red-500 hover:text-red-600 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
              >
                {t("orders.clear_filters")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Background refresh failure ── */}
      {pollError && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold break-words">
              {t("orders.paused")}
              {syncedLabel ? ` · last synced ${syncedLabel}` : ""} — {pollError}
            </span>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="text-xs font-bold underline hover:no-underline shrink-0 self-start sm:self-auto"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* ── Foreground failure with content already on screen ── */}
      {error && orders.length > 0 && (
        <ErrorBanner message={error} onRetry={() => fetchOrders()} />
      )}

      {/* ── Loading skeleton (shown for every load, not just the first) ── */}
      {loading &&
        (activeSubTab === "live" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
            <TableSkeleton rows={8} />
          </div>
        ))}

      {/* ── Hard failure with nothing to show ── */}
      {!loading && error && orders.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <ErrorState message={error} onRetry={() => fetchOrders()} />
        </div>
      )}

      {/* ── Empty state ── */}
      {showBoard && displayOrders.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <EmptyState
            icon={ShoppingBag}
            title={t("orders.none_title")}
            hint={
              hasFilters || searchQuery
                ? t("orders.none_filtered")
                : activeSubTab === "live"
                  ? t("orders.none_live")
                  : t("orders.none_archived")
            }
            action={
              hasFilters ? (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-orange-500 dark:hover:bg-orange-500 dark:hover:text-white transition-colors"
                >
                  {t("orders.clear_filters_short")}
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {/* ── LIVE: Kanban board ── */}
      {showBoard && activeSubTab === "live" && displayOrders.length > 0 && (
        <div className="space-y-4">
          {/* Mobile lane switcher */}
          <div className="flex lg:hidden items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-zinc-100 dark:border-zinc-800">
            {KANBAN_LANES.map((lane, idx) => {
              const count = displayOrders.filter((o) =>
                lane.statuses.includes(o.status),
              ).length;
              return (
                <button
                  key={lane.key}
                  onClick={() => setSelectedMobileLane(idx)}
                  aria-pressed={selectedMobileLane === idx}
                  className={`text-[10px] font-bold px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 border shrink-0 ${
                    selectedMobileLane === idx
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                      : "bg-white border-zinc-200 text-zinc-500 dark:bg-zinc-950 dark:border-zinc-800"
                  }`}
                >
                  {t(lane.key)}
                  <span
                    className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                      selectedMobileLane === idx
                        ? "bg-white/20 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kanban grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {KANBAN_LANES.map((lane, idx) => {
              const colOrders = displayOrders.filter((o) =>
                lane.statuses.includes(o.status),
              );
              return (
                <div
                  key={lane.key}
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
                      {t(lane.key)}
                    </span>
                    <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-black rounded text-zinc-600 dark:text-zinc-300">
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pe-1">
                    {colOrders.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-[10px] italic border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                        {t("orders.empty_lane")}
                      </div>
                    ) : (
                      colOrders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => openOrder(order)}
                          aria-label={`Open order ${orderRef(order)}`}
                          className={`w-full text-start bg-white dark:bg-zinc-900 border p-4 rounded-xl shadow-sm hover:border-orange-500/30 hover:shadow transition-all duration-200 space-y-3 ${
                            newOrderIds.includes(order.id)
                              ? "border-orange-500 ring-2 ring-orange-500/30"
                              : "border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          {/* Header: order number and total */}
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-black text-zinc-950 dark:text-white truncate">
                              {orderRef(order)}
                            </span>
                            <span className="text-[10px] font-black text-orange-500 shrink-0">
                              {formatMoney(order.total, orderCurrency(order))}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            {order.restaurant?.logo ? (
                              <img
                                src={order.restaurant.logo}
                                alt={`${restaurantName(order) || t("orders.restaurant_alt")} logo`}
                                className="w-8 h-8 rounded-lg object-contain shadow-sm border border-zinc-200 dark:border-zinc-700 shrink-0 bg-white p-0.5"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                                <Store className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {restaurantName(order) ||
                                  t("orders.unknown_restaurant")}
                              </p>
                              {(customerName(order) || order.customerId) && (
                                <p className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1 mt-0.5 font-medium">
                                  <User className="w-3 h-3" />{" "}
                                  {customerName(order) ||
                                    shortId(order.customerId)}
                                </p>
                              )}
                            </div>
                          </div>
                          {order.items && order.items.length > 0 && (
                            <div className="space-y-1.5 mt-2 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                              {order.items
                                .slice(0, 3)
                                .map((item, i) => (
                                  <div
                                    key={i}
                                    className="text-[10px] leading-tight"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                        <span className="text-orange-500 font-bold me-1">
                                          {item.quantity}x
                                        </span>
                                        {item.name ?? item.menuItemId}
                                      </span>
                                    </div>
                                    {item.notes && (
                                      <div className="text-[8px] text-zinc-500 dark:text-zinc-400 mt-0.5 whitespace-pre-wrap ps-2.5 border-s-2 border-zinc-200 dark:border-zinc-700 line-clamp-3">
                                        {item.notes}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              {order.items.length > 3 && (
                                <div className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 text-center pt-1 border-t border-zinc-100 dark:border-zinc-800">
                                  + {order.items.length - 3} more items
                                </div>
                              )}
                            </div>
                          )}
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-2 text-[9px] text-zinc-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(order.createdAt)}
                            </span>
                            <StatusPill status={order.status} />
                          </div>
                        </button>
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
      {showBoard && activeSubTab === "archive" && displayOrders.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 uppercase text-[9px] font-bold tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="p-4 font-black">{t("orders.col_order")}</th>
                  <th className="p-4 font-black">{t("orders.col_restaurant")}</th>
                  <th className="p-4 font-black">{t("orders.col_customer")}</th>
                  <th className="p-4 font-black">{t("orders.col_total")}</th>
                  <th className="p-4 font-black">{t("orders.col_payment")}</th>
                  <th className="p-4 font-black">{t("common.status")}</th>
                  <th className="p-4 font-black">{t("orders.col_date")}</th>
                  <th className="p-4 font-black text-end">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {displayOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="p-4 font-black text-zinc-900 dark:text-white whitespace-nowrap">
                      {orderRef(order)}
                    </td>
                    <td className="p-4 font-bold text-zinc-700 dark:text-zinc-300">
                      {restaurantName(order) || "—"}
                    </td>
                    <td className="p-4 text-zinc-600 dark:text-zinc-400">
                      {customerName(order) || "—"}
                    </td>
                    <td className="p-4 font-black text-zinc-950 dark:text-white">
                      {formatMoney(order.total, orderCurrency(order))}
                    </td>
                    <td className="p-4">
                      <StatusPill status={order.paymentStatus} />
                    </td>
                    <td className="p-4">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="p-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="p-4 text-end">
                      <button
                        onClick={() => openOrder(order)}
                        className="text-orange-500 font-bold hover:underline px-2 py-1"
                      >
                        {t("orders.inspect")}
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
      {totalPages > 1 && showBoard && (
        <nav
          aria-label={t("orders.pages_aria")}
          className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-5 py-3 rounded-2xl shadow-sm"
        >
          <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages} · {total}{" "}
            {activeSubTab === "live" ? "live" : "archived"} orders
          </span>
          <div className="flex items-center gap-1.5">
            <button
              id="orders-prev-page"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label={t("orders.prev_page")}
              className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
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
                  aria-label={`Page ${pageNum}`}
                  aria-current={pageNum === page ? "page" : undefined}
                  className={`min-w-[38px] h-[38px] rounded-lg text-[10px] font-black transition-all border ${
                    pageNum === page
                      ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-orange-400 hover:text-orange-500"
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
              aria-label={t("orders.next_page")}
              className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </nav>
      )}

      {/* ── Detail drawer ── */}
      <Modal
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        maxWidth="max-w-2xl"
        title={
          selectedOrder
            ? `${orderRef(selectedOrder)} · ${restaurantName(selectedOrder) || t("orders.detail_fallback")}`
            : ""
        }
        description={
          selectedOrder
            ? `Placed ${formatDate(selectedOrder.createdAt)} at ${formatTime(selectedOrder.createdAt)}`
            : undefined
        }
        icon={
          selectedOrder?.restaurant?.logo ? (
            <img
              src={selectedOrder.restaurant.logo}
              alt={`${restaurantName(selectedOrder)} logo`}
              className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm object-contain bg-white p-1 shrink-0"
            />
          ) : (
            <span className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl border border-orange-500/20 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </span>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            {detailError && <ErrorBanner message={detailError} />}

            {detailLoading && (
              <div className="flex items-center justify-center gap-2 py-4 text-zinc-500 dark:text-zinc-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("orders.loading_detail")}
              </div>
            )}

            {/* Status banner + workflow controls */}
            <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  {t("orders.current_status")}
                </p>
                <StatusPill status={selectedOrder.status} />
              </div>
              <WorkflowControls
                order={selectedOrder}
                busy={updatingId === selectedOrder.id}
                isOwnerView={isOwnerView}
                onConfirm={() => handleUpdateStatus(selectedOrder, "confirmed")}
                onDispatch={() =>
                  handleUpdateStatus(selectedOrder, "out_for_delivery")
                }
                onDeliver={() => handleMarkDelivered(selectedOrder)}
                onReject={() => handleReject(selectedOrder)}
                onCancel={() => handleCancel(selectedOrder)}
              />
            </div>

            {/* Items breakdown */}
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  {t("orders.basket")}
                </h4>
                <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                  {(selectedOrder.items as OrderItemLike[]).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 flex justify-between items-start text-xs bg-white dark:bg-zinc-900 gap-4"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                          <span className="text-orange-500 font-black me-2">
                            {item.quantity}x
                          </span>
                          {item.name ?? item.menuItemId}
                        </p>
                        {(item.unitPrice != null || item.price != null) && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                            {t("orders.unit", {
                              price: formatMoney(
                                item.unitPrice ?? item.price,
                                orderCurrency(selectedOrder),
                              ),
                            })}
                          </p>
                        )}
                        {item.notes && (
                          <div className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                            {item.notes}
                          </div>
                        )}
                      </div>
                      <span className="font-extrabold text-zinc-900 dark:text-white shrink-0 mt-0.5">
                        {item.subtotal != null
                          ? formatMoney(item.subtotal, orderCurrency(selectedOrder))
                          : item.unitPrice != null || item.price != null
                            ? formatMoney(
                                Number(item.unitPrice ?? item.price) *
                                  (item.quantity || 1),
                                orderCurrency(selectedOrder),
                              )
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
                  {t("orders.invoice")}
                </h4>
                <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 text-xs space-y-2.5 text-zinc-600 dark:text-zinc-400">
                  {selectedOrder.subtotal != null && (
                    <div className="flex justify-between">
                      <span>{t("orders.subtotal")}</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatMoney(selectedOrder.subtotal, orderCurrency(selectedOrder))}
                      </span>
                    </div>
                  )}
                  {selectedOrder.deliveryFee != null && (
                    <div className="flex justify-between">
                      <span>{t("common.delivery_fee")}</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatMoney(selectedOrder.deliveryFee, orderCurrency(selectedOrder))}
                      </span>
                    </div>
                  )}
                  {selectedOrder.serviceFee != null && (
                    <div className="flex justify-between">
                      <span>{t("orders.service_fee")}</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatMoney(selectedOrder.serviceFee, orderCurrency(selectedOrder))}
                      </span>
                    </div>
                  )}
                  {selectedOrder.discount != null &&
                    selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-red-600 dark:text-red-400 font-semibold">
                        <span>{t("orders.discount")}</span>
                        <span>-{formatMoney(selectedOrder.discount, orderCurrency(selectedOrder))}</span>
                      </div>
                    )}
                  <div className="flex justify-between pt-2.5 border-t border-zinc-200 dark:border-zinc-700 text-sm font-black text-zinc-900 dark:text-white">
                    <span>{t("orders.total")}</span>
                    <span className="text-orange-500">
                      {formatMoney(selectedOrder.total, orderCurrency(selectedOrder))}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] pt-1">
                    <span>{t("orders.payment_method")}</span>
                    <span className="font-bold capitalize">
                      {selectedOrder.paymentMethod ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] gap-2">
                    <span>{t("orders.payment_status")}</span>
                    <StatusPill status={selectedOrder.paymentStatus} />
                  </div>
                  <div className="flex justify-between items-center text-[10px] gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <span>{t("orders.order_id")}</span>
                    <span className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400 break-all text-end">
                      {selectedOrder.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  {t("orders.participants")}
                </h4>
                <div className="space-y-2.5">
                  {customerName(selectedOrder) && (
                    <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                      <User className="w-5 h-5 text-orange-500 shrink-0" />
                      <div>
                        <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                          {customerName(selectedOrder)}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {t("orders.customer")}
                        </p>
                      </div>
                    </div>
                  )}
                  {restaurantName(selectedOrder) && (
                    <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                      <Store className="w-5 h-5 text-orange-500 shrink-0" />
                      <div>
                        <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                          {restaurantName(selectedOrder)}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {t("orders.restaurant_partner")}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                    <Bike className="w-5 h-5 text-orange-500 shrink-0" />
                    <div>
                      <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                        {selectedOrder.driverName ??
t("orders.awaiting_dispatch")}
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {selectedOrder.driverId
                          ? t("orders.tracking_active")
                          : t("orders.no_rider")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            {selectedOrder.deliveryAddress && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  {t("orders.delivery_details")}
                </h4>
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex gap-3">
                    <MapPin className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-zinc-800 dark:text-zinc-200">
                      {selectedOrder.deliveryAddress.nickname && (
                        <p className="font-bold text-zinc-900 dark:text-white capitalize mb-1">
                          {selectedOrder.deliveryAddress.nickname}
                        </p>
                      )}
                      <p className="leading-relaxed">
                        {[
                          selectedOrder.deliveryAddress.street &&
                            `Street: ${selectedOrder.deliveryAddress.street}`,
                          selectedOrder.deliveryAddress.building &&
                            `Bldg: ${selectedOrder.deliveryAddress.building}`,
                          selectedOrder.deliveryAddress.floor &&
                            `Floor: ${selectedOrder.deliveryAddress.floor}`,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {selectedOrder.deliveryAddress.city && (
                        <p>{selectedOrder.deliveryAddress.city}</p>
                      )}
                      {selectedOrder.deliveryAddress.deliveryInstructions && (
                        <p className="mt-2 p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded border border-orange-500/20 italic">
                          {t("orders.note")} &ldquo;
                          {selectedOrder.deliveryAddress.deliveryInstructions}
                          &rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedOrder.deliveryAddress.latitude &&
                    selectedOrder.deliveryAddress.longitude && (
                      <div className="mt-2 w-full h-48 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 relative shadow-inner">
                        <iframe
                          title={`Map of the delivery address for ${orderRef(selectedOrder)}`}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://maps.google.com/maps?q=${selectedOrder.deliveryAddress.latitude},${selectedOrder.deliveryAddress.longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                        />
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Customer notes */}
            {selectedOrder.customerNotes && (
              <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {t("orders.customer_note")}
                </p>
                <p>{selectedOrder.customerNotes}</p>
              </div>
            )}

            {/* Timeline */}
            {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
              <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-5">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  {t("orders.timeline")}
                </h4>
                <div className="space-y-4 relative before:absolute before:start-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-800">
                  {selectedOrder.timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                      <div className="w-6 h-6 rounded-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0 z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">
                          {statusLabel(event.status)}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {formatDate(event.timestamp)}{" "}
                          {formatTime(event.timestamp)}
                        </p>
                        {event.note && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/20 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 mt-1.5 leading-relaxed">
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
        )}
      </Modal>
    </div>
  );
}

// ─── Workflow buttons ────────────────────────────────────────────────────────

/**
 * Declared at module scope: defining it inside the parent's render gave it a
 * new identity on every keystroke, so React unmounted and remounted the whole
 * control strip (and its focus) each time.
 */
/**
 * A restaurant owner and an admin do not have the same powers over an order.
 * The API gives owners accept / reject / out-for-delivery and nothing else —
 * "Mark Delivered" and "Cancel Order" belong to the driver and the customer.
 * Rendering them for owners offered two buttons that could only ever fail.
 */
function WorkflowControls({
  order,
  busy,
  isOwnerView,
  onConfirm,
  onDispatch,
  onDeliver,
  onReject,
  onCancel,
}: {
  order: OrderResponse;
  busy: boolean;
  isOwnerView: boolean;
  onConfirm: () => void;
  onDispatch: () => void;
  onDeliver: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();

  if (busy)
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 font-bold">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("orders.updating")}
      </span>
    );

  return (
    <div className="flex gap-2 flex-wrap">
      {order.status === "pending" && (
        <>
          <button
            onClick={onConfirm}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
          >
            <Check className="w-3.5 h-3.5" /> {t("orders.confirm_order")}
          </button>
          <button
            onClick={onReject}
            className="bg-zinc-100 hover:bg-red-500 hover:text-white text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold text-[10px] px-3.5 py-2 rounded-lg transition-all"
          >
            {t("orders.reject")}
          </button>
        </>
      )}

      {order.status === "confirmed" && (
        <button
          onClick={onDispatch}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
        >
          <Bike className="w-3.5 h-3.5" /> {t("orders.dispatch_rider")}
        </button>
      )}

      {order.status === "out_for_delivery" && !isOwnerView && (
        <button
          onClick={onDeliver}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg flex items-center gap-1 transition-all"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> {t("orders.mark_delivered")}
        </button>
      )}

      {/* Cancel fallback for any active order that isn't done */}
      {!isOwnerView &&
        !DONE_STATUSES.includes(order.status) &&
        order.status !== "pending" && (
          <button
            onClick={onCancel}
            className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-red-500 font-bold ps-2 border-s border-zinc-200 dark:border-zinc-800 transition-colors"
          >
            {t("orders.cancel_order")}
          </button>
        )}

      {isOwnerView && order.status === "out_for_delivery" && (
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
          {t("orders.driver_confirms")}
        </span>
      )}
    </div>
  );
}
