"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Store,
  Star,
  MapPin,
  Calendar,
  DollarSign,
  ArrowLeft,
  Loader2,
  Clock,
  Phone,
  Globe,
  Truck,
  Coins,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  restaurantsService,
  RestaurantResponse,
  RestaurantSubmission,
  RestaurantFullResponse,
  RestaurantStatus,
  ExchangeRateRef,
} from "../../services/restaurants";
import AddRestaurantModal from "./AddRestaurantModal";
import EditRestaurantModal from "./EditRestaurantModal";
import RestaurantMenuSection from "./RestaurantMenuSection";
import RestaurantReviewsPanel from "./RestaurantReviewsPanel";
import RestaurantStoriesPanel from "./RestaurantStoriesPanel";
import OrdersSection from "./OrdersSection";
import StoriesViewerModal from "./StoriesViewerModal";
import StatusPill from "./ui/StatusPill";
import { useConfirm } from "./ui/ConfirmDialog";
import {
  CardSkeletonGrid,
  EmptyState,
  ErrorBanner,
  ErrorState,
  Skeleton,
} from "./ui/States";
import {
  formatAddress,
  formatDate,
  formatMoney,
  formatRate,
  formatRating,
  orDash,
  searchable,
} from "../../lib/format";

import { useI18n, type MessageKey } from "../../lib/i18n";
const DeliveryZoneMap = dynamic(() => import("./DeliveryZoneMapClient"), {
  ssr: false,
  // Without this the 400px map slot is a blank grey box until the leaflet
  // chunk lands, which reads as a broken panel rather than a loading one.
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

interface RestaurantsSectionProps {
  searchQuery: string;
  currentRole?: { type?: string; restaurantId?: string };
}

/** Which single mutation is in flight — one shared flag spun every button. */
type PendingAction =
  | null
  | "status"
  | "delete"
  | "feature"
  | "approve"
  | "reject";

type InnerTab =
  | "overview"
  | "profile"
  | "menu"
  | "orders"
  | "reviews"
  | "stories"
  | "delivery";

const INNER_TABS: [InnerTab, MessageKey][] = [
  ["overview", "rests.tab_overview"],
  ["profile", "rests.tab_profile"],
  ["menu", "rests.tab_menu"],
  ["orders", "rests.tab_orders"],
  ["reviews", "rests.tab_reviews"],
  ["stories", "rests.tab_stories"],
  ["delivery", "rests.tab_delivery"],
];

/**
 * Merchant filters that the API can actually answer. The old "all / active /
 * suspended" chips filtered client side over a single page of a list endpoint
 * that only ever returns *active* merchants, so "suspended" was always empty
 * and "all" was never all.
 */
type MerchantFilter = "all" | "featured" | "hasOffer" | "topRated" | "freeDelivery";

const MERCHANT_FILTERS: { value: MerchantFilter; key: MessageKey }[] = [
  { value: "all", key: "common.all" },
  { value: "featured", key: "rests.filter_featured" },
  { value: "hasOffer", key: "rests.filter_offer" },
  { value: "topRated", key: "rests.filter_top" },
  { value: "freeDelivery", key: "rests.filter_free" },
];

const APP_STATUS_FILTERS = [
  "all",
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

const PAGE_SIZE = 12;

const currencyOf = (r?: RestaurantResponse | null) =>
  r?.currency?.code ?? r?.currencyId ?? undefined;

const deliveryWindow = (r?: {
  deliveryTimeRange?: string | null;
  deliveryTimeMinMinutes?: number | null;
  deliveryTimeMaxMinutes?: number | null;
}) => {
  if (!r) return "—";
  if (r.deliveryTimeRange) return r.deliveryTimeRange;
  const { deliveryTimeMinMinutes: min, deliveryTimeMaxMinutes: max } = r;
  if (min != null && max != null) return `${min}–${max} min`;
  if (min != null) return `${min}+ min`;
  if (max != null) return `up to ${max} min`;
  return "—";
};

export default function RestaurantsSection({
  searchQuery,
  currentRole,
}: RestaurantsSectionProps) {
  const { t } = useI18n();
  const confirm = useConfirm();

  const [restaurants, setRestaurants] = useState<RestaurantResponse[]>([]);
  const [merchantTotal, setMerchantTotal] = useState(0);
  const [merchantPage, setMerchantPage] = useState(1);
  const [merchantTotalPages, setMerchantTotalPages] = useState(1);
  const [merchantFilter, setMerchantFilter] = useState<MerchantFilter>("all");

  const [submissions, setSubmissions] = useState<RestaurantSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const isBusy = pendingAction !== null;

  const [selectedRestId, setSelectedRestId] = useState<string | null>(
    currentRole?.type === "restaurant" ? (currentRole.restaurantId ?? null) : null,
  );
  const [fullSelectedRest, setFullSelectedRest] =
    useState<RestaurantFullResponse | null>(null);
  const [isFullLoading, setIsFullLoading] = useState(false);
  const [fullError, setFullError] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | null
  >(null);
  const [viewMode, setViewMode] = useState<"merchants" | "applications">(
    "merchants",
  );
  const [innerTab, setInnerTab] = useState<InnerTab>("overview");
  const [appStatus, setAppStatus] = useState<string>("pending");
  const [appPage, setAppPage] = useState(1);
  const [appTotalPages, setAppTotalPages] = useState(1);
  const [appTotalItems, setAppTotalItems] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Review form states
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Stories viewer state
  const [viewingStoriesFor, setViewingStoriesFor] =
    useState<RestaurantResponse | null>(null);

  /**
   * The search box is debounced into the API's own `name` parameter. It used to
   * filter the client-side array, so a merchant on page 3 could not be found by
   * name at all.
   */
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    setMerchantPage(1);
    setAppPage(1);
  }, [debouncedSearch, merchantFilter]);

  const fetchMerchants = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        name: debouncedSearch || undefined,
        page: merchantPage,
        limit: PAGE_SIZE,
        ...(merchantFilter === "hasOffer" ? { hasOffer: true } : {}),
        ...(merchantFilter === "topRated" ? { topRated: true } : {}),
        ...(merchantFilter === "freeDelivery" ? { freeDelivery: true } : {}),
      };
      const res =
        merchantFilter === "featured"
          ? await restaurantsService.getFeaturedRestaurants(params)
          : await restaurantsService.getRestaurants(params);

      setRestaurants(res.data);
      setMerchantTotal(res.total);
      setMerchantTotalPages(Math.max(1, res.totalPages ?? 1));
      setError(null);
    } catch (err) {
      console.error("Failed to fetch restaurants:", err);
      setError(
        err instanceof Error ? err.message : t("rests.load_merchants_failed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, merchantPage, merchantFilter]);

  const fetchSubmissions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await restaurantsService.getSubmissions({
        status: appStatus,
        page: appPage,
        limit: 20,
      });
      setSubmissions(res.data);
      setAppTotalPages(Math.max(1, res.totalPages ?? 1));
      setAppTotalItems(res.total);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
      setError(
        err instanceof Error ? err.message : t("rests.load_apps_failed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [appStatus, appPage]);

  const refetchList = useCallback(() => {
    if (viewMode === "merchants") fetchMerchants();
    else fetchSubmissions();
  }, [viewMode, fetchMerchants, fetchSubmissions]);

  useEffect(() => {
    if (viewMode === "merchants") fetchMerchants();
    else fetchSubmissions();
  }, [viewMode, fetchMerchants, fetchSubmissions]);

  /**
   * Pulls the detail payload (menu + delivery zones + fresh status). Every
   * mutation on the detail screen has to call this too, otherwise the header
   * keeps rendering the pre-mutation status and still offers "Suspend" on an
   * already-suspended merchant.
   */
  const refreshSelected = useCallback(async () => {
    if (!selectedRestId || viewMode !== "merchants") return;
    try {
      setIsFullLoading(true);
      const data = await restaurantsService.getRestaurantFull(selectedRestId);
      setFullSelectedRest(data);
      setFullError(null);
    } catch (err) {
      console.error("Failed to fetch full restaurant details:", err);
      setFullError(
        err instanceof Error
          ? err.message
          : t("rests.load_detail_failed"),
      );
    } finally {
      setIsFullLoading(false);
    }
  }, [selectedRestId, viewMode]);

  useEffect(() => {
    if (selectedRestId && viewMode === "merchants") {
      refreshSelected();
    } else {
      setFullSelectedRest(null);
      setFullError(null);
    }
  }, [selectedRestId, viewMode, refreshSelected]);

  // Ignore the detail payload while it still belongs to the previously opened
  // merchant, otherwise the new detail view renders the old merchant's data.
  const fullDetail =
    fullSelectedRest?.restaurant?.id === selectedRestId ? fullSelectedRest : null;
  const selectedRest =
    fullDetail?.restaurant || restaurants.find((r) => r.id === selectedRestId);
  const selectedSubmission = submissions.find(
    (s) => s.id === selectedSubmissionId,
  );

  // Applications have no server-side search, so this one stays client side —
  // and says so, rather than pretending to search the whole queue.
  const filteredSubmissions = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    if (!query) return submissions;
    return submissions.filter(
      (s) =>
        searchable(s.name).includes(query) ||
        searchable(s.address?.street).includes(query) ||
        searchable(s.address?.city).includes(query),
    );
  }, [submissions, debouncedSearch]);

  const isPendingTab = viewMode === "applications";
  const displayList: (RestaurantResponse | RestaurantSubmission)[] = isPendingTab
    ? filteredSubmissions
    : restaurants;

  const handleStatusChange = async (
    restId: string,
    newStatus: RestaurantStatus,
    restName?: string,
  ) => {
    const label = restName ? `“${restName}”` : t("rests.this_merchant");
    if (
      newStatus === "suspended" &&
      !(await confirm({
        title: t("rests.suspend_title", { label }),
        description: t("rests.suspend_body"),
        confirmLabel: t("rests.suspend_cta"),
        variant: "danger",
      }))
    ) {
      return;
    }

    try {
      setPendingAction("status");
      await restaurantsService.updateRestaurant(restId, { status: newStatus });
      toast.success(t("rests.status_updated"));
      refetchList();
      // Without this the header still shows the old status and keeps
      // offering "Suspend" on a merchant that was just suspended.
      await refreshSelected();
    } catch (err) {
      toast.error(
        t("rests.status_failed", {
          error: err instanceof Error ? err.message : "",
        }),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteRestaurant = async (restId: string, restName?: string) => {
    const confirmed = await confirm({
      title: t("rests.delete_title", {
        label: restName ? `“${restName}”` : t("rests.this_merchant"),
      }),
      description: t("rests.delete_body"),
      confirmLabel: t("rests.delete_cta"),
      variant: "danger",
      confirmPhrase: restName,
    });
    if (!confirmed) return;

    try {
      setPendingAction("delete");
      await restaurantsService.deleteRestaurant(restId);
      toast.success(t("rests.deleted"));
      setSelectedRestId(null);
      refetchList();
    } catch (err) {
      toast.error(
        t("rests.delete_failed", {
          error: err instanceof Error ? err.message : "",
        }),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleToggleFeatured = async (
    restId: string,
    isCurrentlyFeatured: boolean,
  ) => {
    try {
      setPendingAction("feature");
      if (isCurrentlyFeatured) {
        await restaurantsService.removeFeatured(restId);
        toast.success(t("rests.unfeatured"));
      } else {
        await restaurantsService.markAsFeatured(restId);
        toast.success(t("rests.featured"));
      }

      // Immediate feedback while the refetch is in flight.
      if (fullSelectedRest) {
        setFullSelectedRest({
          ...fullSelectedRest,
          restaurant: {
            ...fullSelectedRest.restaurant,
            isFeatured: !isCurrentlyFeatured,
          },
        });
      }

      refetchList();
      await refreshSelected();
    } catch (err) {
      toast.error(
        t("rests.feature_failed", {
          error: err instanceof Error ? err.message : "",
        }),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleReview = async (decision: "approve" | "reject") => {
    if (!selectedSubmission) return;
    if (decision === "reject" && !rejectionReason.trim()) {
      toast.error(t("rests.need_reason"));
      return;
    }

    try {
      setPendingAction(decision);
      await restaurantsService.reviewSubmission(selectedSubmission.id, {
        decision,
        rejectionReason: decision === "reject" ? rejectionReason : undefined,
      });
      toast.success(
        t("rests.reviewed", {
          decision:
            decision === "approve"
              ? t("rests.approved_word")
              : t("rests.rejected_word"),
        }),
      );
      setIsReviewing(false);
      setRejectionReason("");
      setSelectedSubmissionId(null);
      refetchList();
    } catch (err) {
      toast.error(
        t("rests.review_failed", {
          error: err instanceof Error ? err.message : "",
        }),
      );
    } finally {
      setPendingAction(null);
    }
  };

  /** Revoking an approval takes a live merchant offline — always ask first. */
  const startRejection = async () => {
    if (selectedSubmission?.status === "approved") {
      const confirmed = await confirm({
        title: t("rests.revoke_title", { name: selectedSubmission.name }),
        description: t("rests.revoke_body"),
        confirmLabel: t("rests.revoke_cta"),
        variant: "danger",
      });
      if (!confirmed) return;
    }
    setIsReviewing(true);
  };

  // A merchant landing straight on its own detail view (owner role) has no
  // list to fall back on, so gate that view on its own fetch.
  if (!isPendingTab && selectedRestId && !selectedRest) {
    if (isLoading || isFullLoading) {
      return (
        <CardSkeletonGrid
          count={3}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        />
      );
    }
    if (fullError || error) {
      return (
        <ErrorState
          message={fullError || error}
          onRetry={() => {
            fetchMerchants();
            refreshSelected();
          }}
        />
      );
    }
  }

  // ─── Application detail ────────────────────────────────────────────────────

  if (isPendingTab && selectedSubmission) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-200">
        <StickyBackBar
          label={t("rests.back_to_apps")}
          onBack={() => {
            setSelectedSubmissionId(null);
            setIsReviewing(false);
          }}
        />

        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
          <div className="h-40 relative bg-zinc-800">
            {selectedSubmission.backgroundImageUrl && (
              <img
                src={selectedSubmission.backgroundImageUrl}
                alt=""
                className="w-full h-full object-cover opacity-40"
              />
            )}
            <div className="absolute top-4 end-4 flex gap-2">
              <StatusPill
                status={selectedSubmission.status}
                className="px-3 py-1.5 text-xs shadow-lg backdrop-blur-sm"
              />
            </div>
          </div>

          <div className="p-6 relative -mt-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-950/40">
            <div className="flex gap-4 items-end">
              {selectedSubmission.logo ? (
                <img
                  src={selectedSubmission.logo}
                  alt={`${selectedSubmission.name} logo`}
                  className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl object-cover"
                />
              ) : (
                <span className="text-4xl p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
                  🍽️
                </span>
              )}
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {selectedSubmission.name}
                </h3>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {formatAddress(selectedSubmission.address) ||
t("rests.no_address")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />{" "}
                    {t("rests.submitted_on", {
                      date: formatDate(selectedSubmission.createdAt),
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              {!isReviewing && (
                <>
                  {selectedSubmission.status === "pending" && (
                    <button
                      onClick={() => handleReview("approve")}
                      disabled={isBusy}
                      className="flex items-center bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {pendingAction === "approve" && (
                        <Loader2 className="w-4 h-4 animate-spin me-2" />
                      )}
                      {t("rests.approve_app")}
                    </button>
                  )}
                  {(selectedSubmission.status === "pending" ||
                    selectedSubmission.status === "approved") && (
                    <button
                      onClick={startRejection}
                      disabled={isBusy}
                      className="bg-zinc-800 hover:bg-red-500 hover:text-white text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {selectedSubmission.status === "approved"
                        ? t("rests.revoke_reject")
                        : t("rests.reject_app")}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {isReviewing && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-200">
            <h4 className="text-sm font-bold text-red-500 mb-2">
              {t("rests.reject_heading")}
            </h4>
            <label
              htmlFor="rejection-reason"
              className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2"
            >
              {t("rests.reject_help")}
            </label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t("rests.reject_placeholder")}
              className="w-full bg-white dark:bg-zinc-950 border border-red-500/30 text-zinc-900 dark:text-zinc-200 text-sm rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-red-500 mb-4 h-24"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsReviewing(false)}
                className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-300 text-xs font-bold px-4 py-2 rounded-lg"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleReview("reject")}
                disabled={isBusy}
                className="flex items-center bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingAction === "reject" && (
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                )}
                {t("rests.confirm_rejection")}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCard
            icon={<Clock className="w-5 h-5" />}
            accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            label={t("common.delivery_window")}
            value={deliveryWindow(selectedSubmission)}
          />
          <InfoCard
            icon={<DollarSign className="w-5 h-5" />}
            accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            label={t("common.delivery_fee")}
            value={formatMoney(
              selectedSubmission.deliveryFee,
              selectedSubmission.currencyId,
            )}
          />
          <InfoCard
            icon={<Store className="w-5 h-5" />}
            accent="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            label={t("rests.categories_requested")}
            value={orDash(selectedSubmission.categoryIds?.length ?? 0)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              {t("rests.contact_location")}
            </h4>
            <div className="space-y-3 text-xs">
              <DetailRow
                icon={<Phone className="w-4 h-4" />}
                label={t("customers.phone")}
                value={selectedSubmission.phone || t("rests.not_provided")}
              />
              {selectedSubmission.website && (
                <DetailRow
                  icon={<Globe className="w-4 h-4" />}
                  label={t("common.website")}
                  value={selectedSubmission.website}
                />
              )}
              <div className="flex items-start gap-3 text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <MapPin className="w-4 h-4 text-zinc-500 dark:text-zinc-400 mt-1" />
                <div>
                  <p className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">
                    {t("rests.address_coords")}
                  </p>
                  <p className="font-bold">
                    {formatAddress(selectedSubmission.address) ||
                      t("rests.no_address_short")}
                  </p>
                  <p className="font-bold">
                    Lat: {orDash(selectedSubmission.address?.latitude)}, Lng:{" "}
                    {orDash(selectedSubmission.address?.longitude)}
                  </p>
                </div>
              </div>
              {selectedSubmission.rejectionReason && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <p className="font-semibold text-red-500 text-[10px] uppercase">
                    {t("common.rejection_reason")}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-300 mt-1">
                    {selectedSubmission.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              {t("rests.proposed_hours")}
            </h4>
            <OpeningHours entries={selectedSubmission.openingHours} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Merchant detail ───────────────────────────────────────────────────────

  if (!isPendingTab && selectedRest) {
    const currency = currencyOf(selectedRest);
    const exchangeRates: ExchangeRateRef[] =
      fullDetail?.exchangeRates ?? selectedRest.exchangeRates ?? [];

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-200">
        {currentRole?.type !== "restaurant" && (
          <StickyBackBar
            label={t("rests.back_to_registry")}
            onBack={() => {
              setSelectedRestId(null);
              setIsReviewing(false);
            }}
          />
        )}

        {/* The detail payload failed but the list copy is still on screen. */}
        {fullError && (
          <ErrorBanner message={fullError} onRetry={() => refreshSelected()} />
        )}

        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
          <div className="h-40 relative bg-zinc-800">
            {selectedRest.backgroundImageUrl && (
              <img
                src={selectedRest.backgroundImageUrl}
                alt=""
                className="w-full h-full object-cover opacity-40"
              />
            )}
            <div className="absolute top-4 end-4 flex flex-wrap gap-2 justify-end">
              <StatusPill
                status={selectedRest.status}
                className="px-3 py-1.5 text-xs shadow-lg backdrop-blur-sm"
              />
              {selectedRest.isOpen !== undefined && (
                <span
                  className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border uppercase tracking-wider ${
                    selectedRest.isOpen
                      ? "bg-emerald-500/90 text-white border-emerald-400"
                      : "bg-zinc-700/90 text-zinc-200 border-zinc-600"
                  }`}
                >
                  {selectedRest.isOpen
                    ? t("merchant.open_now")
                    : t("merchant.closed_now")}
                </span>
              )}
              {selectedRest.isFeatured && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border uppercase tracking-wider bg-purple-500/90 text-white border-purple-400 flex items-center gap-1">
  <Star className="w-3 h-3 fill-white" /> {t("rests.filter_featured")}
                </span>
              )}
            </div>
          </div>

          <div className="p-6 relative -mt-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-950/40">
            <div className="flex gap-4 items-end">
              {selectedRest.logo ? (
                selectedRest.stories && selectedRest.stories.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setViewingStoriesFor(selectedRest)}
                    aria-label={`View ${selectedRest.name} stories`}
                    className="relative w-16 h-16 rounded-2xl shadow-xl overflow-hidden bg-zinc-900 border-2 border-orange-500 hover:scale-105 cursor-pointer p-[2px] transition-transform"
                  >
                    <img
                      src={selectedRest.logo}
                      alt=""
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </button>
                ) : (
                  // Not a button: with no stories it had no action, so it was
                  // just a focus stop that did nothing.
                  <span className="relative block w-16 h-16 rounded-2xl shadow-xl overflow-hidden bg-zinc-900 border-2 border-zinc-800">
                    <img
                      src={selectedRest.logo}
                      alt={`${selectedRest.name} logo`}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </span>
                )
              ) : (
                <span className="text-4xl p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
                  🍽️
                </span>
              )}
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {selectedRest.name}
                </h3>
                <p className="text-xs text-orange-400 font-semibold">
                  {selectedRest.categories?.map((c) => c.name).join(" · ") ||
t("rests.no_categories")}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {formatAddress(selectedRest.restaurantAddress) ||
t("rests.no_address")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />{" "}
                    {t("rests.joined_on", {
                      date: formatDate(selectedRest.createdAt),
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <button
                onClick={() => setIsEditModalOpen(true)}
                disabled={isBusy}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("rests.edit_merchant")}
              </button>
              <button
                onClick={() =>
                  handleDeleteRestaurant(selectedRest.id, selectedRest.name)
                }
                disabled={isBusy}
                className="flex items-center bg-zinc-800 hover:bg-red-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingAction === "delete" && (
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                )}
                {t("common.delete")}
              </button>
              {selectedRest.status === "active" && (
                <button
                  onClick={() =>
                    handleStatusChange(
                      selectedRest.id,
                      "suspended",
                      selectedRest.name,
                    )
                  }
                  disabled={isBusy}
                  className="flex items-center bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingAction === "status" && (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  )}
                  {t("rests.suspend_cta")}
                </button>
              )}
              {(selectedRest.status === "suspended" ||
                selectedRest.status === "inactive") && (
                <button
                  onClick={() =>
                    handleStatusChange(
                      selectedRest.id,
                      "active",
                      selectedRest.name,
                    )
                  }
                  disabled={isBusy}
                  className="flex items-center bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingAction === "status" && (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  )}
                  {t("rests.make_available")}
                </button>
              )}
              {selectedRest.status === "active" && (
                <button
                  onClick={() =>
                    handleToggleFeatured(
                      selectedRest.id,
                      !!selectedRest.isFeatured,
                    )
                  }
                  disabled={isBusy}
                  className={`flex items-center active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedRest.isFeatured
                      ? "bg-zinc-700 hover:bg-zinc-800"
                      : "bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20"
                  }`}
                >
                  {pendingAction === "feature" && (
                    <Loader2 className="w-4 h-4 animate-spin me-2" />
                  )}
                  <Star
                    className={`w-4 h-4 me-1.5 ${selectedRest.isFeatured ? "opacity-50" : "fill-white"}`}
                  />
                  {selectedRest.isFeatured
                    ? t("rests.unfeature")
                    : t("rests.feature_merchant")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Internal Tabs — scrollable so the last tabs stay reachable at 375px */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4 overflow-x-auto scrollbar-none">
          {INNER_TABS.map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setInnerTab(tab)}
              aria-current={innerTab === tab ? "page" : undefined}
              className={`shrink-0 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                innerTab === tab
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/50"
              }`}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {innerTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <InfoCard
                icon={<Star className="w-5 h-5 fill-amber-500" />}
                accent="bg-amber-500/10 text-amber-500"
                label={t("rests.review_rating")}
                value={`${formatRating(selectedRest.rating)} ★`}
                hint={t("rests.ratings_hint", {
                  count: selectedRest.totalRatings ?? 0,
                })}
              />
              <InfoCard
                icon={<DollarSign className="w-5 h-5" />}
                accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                label={t("common.delivery_fee")}
                value={formatMoney(selectedRest.deliveryFee, currency)}
                hint={
                  currency ? t("rests.priced_in", { code: currency }) : undefined
                }
              />
              <InfoCard
                icon={<Clock className="w-5 h-5" />}
                accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                label={t("common.delivery_window")}
                value={deliveryWindow(selectedRest)}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-orange-500" />
                  {t("rests.fulfilment")}
                </h4>
                <dl className="space-y-2.5 text-xs">
                  <Row
                    label={t("rests.delivery_partner")}
                    value={
                      selectedRest.deliveryCompanyName ||
                      t("rests.self_delivery")
                    }
                  />
                  <Row
                    label={t("rests.auto_dispatch")}
                    value={
                      selectedRest.autoSendToDeliveryCompany
                        ? t("common.on")
                        : t("common.off")
                    }
                  />
                  <Row
                    label={t("rests.running_offer")}
                    value={
                      selectedRest.hasOffer ? t("common.yes") : t("common.no")
                    }
                  />
                  <Row
                    label={t("rests.delivery_zones")}
                    value={String(
                      fullDetail?.deliveryZones?.length ??
                        selectedRest.deliveryZones?.length ??
                        0,
                    )}
                  />
                </dl>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-orange-500" />
                  {t("rests.effective_rates")}
                </h4>
                {exchangeRates.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("rests.using_defaults")}
                  </p>
                ) : (
                  <dl className="space-y-2.5 text-xs">
                    {exchangeRates.map((rate, idx) => (
                      <Row
                        key={`${rate.fromCurrencyId}-${rate.toCurrencyId}-${idx}`}
                        label={`${rate.fromCurrencyId} → ${rate.toCurrencyId}`}
                        value={formatRate(rate.rate)}
                      />
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </div>
        )}

        {innerTab === "profile" && (
          <div className="space-y-6 animate-in fade-in duration-200 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Phone className="w-4 h-4 text-orange-500" />
                  {t("rests.contact")}
                </h4>
                <div className="space-y-3 text-sm">
                  <Field
                    label={t("common.phone")}
                    value={orDash(selectedRest.phone)}
                  />
                  {selectedRest.website && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        {t("common.website")}
                      </span>
                      <a
                        href={selectedRest.website}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-500 hover:underline break-all"
                      >
                        {selectedRest.website}
                      </a>
                    </div>
                  )}
                  {selectedRest.description && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        {t("common.description")}
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">
                        {selectedRest.description}
                      </span>
                    </div>
                  )}
                  <Field
                    label={t("common.categories")}
                    value={
                      selectedRest.categories?.map((c) => c.name).join(", ") ||
                      "—"
                    }
                  />
                  <Field
                    label={t("common.currency")}
                    value={
                      selectedRest.currency
                        ? `${selectedRest.currency.code} — ${selectedRest.currency.name ?? ""}`.trim()
                        : "—"
                    }
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  {t("rests.opening_hours")}
                </h4>
                <OpeningHours entries={selectedRest.openingHours} />
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4 md:col-span-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  {t("rests.location")}
                </h4>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-3 text-sm">
                    <Field
                      label={t("common.city")}
                      value={orDash(selectedRest.restaurantAddress?.city)}
                    />
                    <Field
                      label={t("common.address")}
                      value={
                        formatAddress(selectedRest.restaurantAddress) || "—"
                      }
                    />
                    <Field
                      label={t("rests.coordinates")}
                      value={
                        selectedRest.restaurantAddress
                          ? `${selectedRest.restaurantAddress.latitude}, ${selectedRest.restaurantAddress.longitude}`
                          : "—"
                      }
                    />
                  </div>
                  {selectedRest.restaurantAddress && (
                    <div className="w-full md:w-2/3 h-64 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-inner relative">
                      <iframe
                        title={t("rests.map_alt", { name: selectedRest.name })}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${selectedRest.restaurantAddress.latitude},${selectedRest.restaurantAddress.longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {innerTab === "menu" && (
          <div className="animate-in fade-in duration-200 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <RestaurantMenuSection restaurant={selectedRest} />
          </div>
        )}

        {innerTab === "orders" && (
          <div className="animate-in fade-in duration-200 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <OrdersSection
              searchQuery=""
              restaurantId={selectedRest.id}
              isOwnerView={currentRole?.type === "restaurant"}
            />
          </div>
        )}

        {innerTab === "reviews" && (
          <div className="animate-in fade-in duration-200 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <RestaurantReviewsPanel restaurantId={selectedRest.id} />
          </div>
        )}

        {innerTab === "stories" && (
          <div className="animate-in fade-in duration-200 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <RestaurantStoriesPanel
              restaurantId={selectedRest.id}
              restaurantName={selectedRest.name}
            />
          </div>
        )}

        {innerTab === "delivery" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Loading, failed and genuinely-empty are three different states —
                this tab used to render nothing at all for the first two. */}
            {isFullLoading && !fullDetail ? (
              <CardSkeletonGrid count={1} className="grid grid-cols-1" />
            ) : fullError ? (
              <ErrorState
                message={fullError}
                title={t("rests.zones_failed")}
                onRetry={() => refreshSelected()}
              />
            ) : fullDetail?.deliveryZones?.length ? (
              fullDetail.deliveryZones.map((zone) => (
                <div
                  key={zone.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm"
                >
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                    {zone.name}
                  </h3>
                  <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 relative z-0">
                    <DeliveryZoneMap polygon={zone.polygon} />
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <EmptyState
                  icon={MapPin}
                  title={t("rests.no_zones")}
                  hint={t("rests.no_zones_hint")}
                />
              </div>
            )}
          </div>
        )}

        <EditRestaurantModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          restaurant={selectedRest}
          onSuccess={() => {
            setIsEditModalOpen(false);
            fetchMerchants();
            // Header/profile read from the detail payload, so refresh it too.
            refreshSelected();
          }}
        />

        <StoriesViewerModal
          isOpen={!!viewingStoriesFor}
          onClose={() => setViewingStoriesFor(null)}
          restaurant={viewingStoriesFor}
        />
      </div>
    );
  }

  // ─── Registry listing ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Content is already on screen — don't replace it, just flag the failure. */}
      {error && displayList.length > 0 && (
        <ErrorBanner message={error} onRetry={refetchList} />
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
              {(
                [
                  ["merchants", "rests.registry"],
                  ["applications", "rests.applications"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    setSelectedRestId(null);
                    setSelectedSubmissionId(null);
                  }}
                  className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                    viewMode === mode
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                  }`}
                >
                  {t(label as MessageKey)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80 overflow-x-auto scrollbar-none">
              {viewMode === "merchants"
                ? MERCHANT_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setMerchantFilter(filter.value)}
                      aria-pressed={merchantFilter === filter.value}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap ${
                        merchantFilter === filter.value
                          ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                      }`}
                    >
                      {t(filter.key)}
                    </button>
                  ))
                : APP_STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setAppStatus(filter);
                        setAppPage(1);
                      }}
                      aria-pressed={appStatus === filter}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200 capitalize ${
                        appStatus === filter
                          ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-zinc-500">
              {isPendingTab
                ? t("rests.showing_apps", {
                    shown: displayList.length,
                    total: appTotalItems,
                  })
                : t("rests.showing_merchants", {
                    shown: displayList.length,
                    total: merchantTotal,
                  })}
            </span>
            {!isPendingTab && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="text-xs font-bold px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm whitespace-nowrap"
              >
                {t("rests.add")}
              </button>
            )}
          </div>
        </div>

        {debouncedSearch && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Search className="w-3 h-3" />
            {isPendingTab
              ? t("rests.filtering_page", { query: debouncedSearch })
              : t("rests.searching_all", { query: debouncedSearch })}
          </p>
        )}
      </div>

      {isLoading ? (
        <CardSkeletonGrid
          count={6}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        />
      ) : error ? (
        <ErrorState
          message={error}
          title={
            isPendingTab
              ? t("rests.load_apps_failed")
              : t("rests.load_merchants_failed")
          }
          onRetry={refetchList}
        />
      ) : displayList.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <EmptyState
            icon={Store}
            title={
              isPendingTab
                ? t("rests.none_apps")
                : t("rests.none_merchants")
            }
            hint={t("rests.none_hint")}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayList.map((item) => {
            const isSub = isPendingTab;
            const merchant = isSub ? null : (item as RestaurantResponse);
            const submission = isSub ? (item as RestaurantSubmission) : null;
            const hasStories = (merchant?.stories?.length ?? 0) > 0;
            const subtitle = isSub
              ? deliveryWindow(submission ?? undefined)
              : merchant?.categories?.map((c) => c.name).join(" · ") ||
t("rests.no_categories_short");

            return (
              <div
                key={item.id}
                className="relative bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-orange-500 transition-all duration-200 group flex flex-col"
              >
                <div className="h-32 relative bg-zinc-100 dark:bg-zinc-800">
                  {item.backgroundImageUrl && (
                    <img
                      src={item.backgroundImageUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300 opacity-80"
                    />
                  )}
                  <div className="absolute top-3 end-3 flex flex-col gap-2 items-end">
                    <StatusPill status={item.status} className="shadow" />
                    {merchant?.isFeatured && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow border bg-purple-500/90 text-white border-purple-400 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-white" /> {t("rests.filter_featured")}
                      </span>
                    )}
                    {merchant?.hasOffer && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow border bg-emerald-500/90 text-white border-emerald-400">
                        {t("rests.offer_badge")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex gap-3 items-start">
                      {item.logo ? (
                        hasStories && merchant ? (
                          <button
                            type="button"
                            aria-label={t("rests.view_stories", { name: item.name })}
                            onClick={() => setViewingStoriesFor(merchant)}
                            className="relative z-10 w-11 h-11 rounded-xl shadow-sm overflow-hidden bg-zinc-50 dark:bg-zinc-800 border-2 shrink-0 transition-transform border-orange-500 hover:scale-110 cursor-pointer p-[1.5px]"
                          >
                            <img
                              src={item.logo}
                              alt=""
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </button>
                        ) : (
                          // Not a button: with no stories it had no action, and
                          // it would nest inside the card's own control.
                          <span className="block w-11 h-11 rounded-xl shadow-sm overflow-hidden bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 shrink-0">
                            <img
                              src={item.logo}
                              alt={`${item.name} logo`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </span>
                        )
                      ) : (
                        <span className="text-2xl p-1.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 shrink-0">
                          🍽️
                        </span>
                      )}
                      <div className="min-w-0">
                        {/* The card used to be a `<div onClick>`: unreachable by
                            keyboard. The button's ::after stretches over the
                            whole card so the click target is unchanged. */}
                        <h4 className="text-sm font-bold text-zinc-950 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                          <button
                            type="button"
                            onClick={() => {
                              if (isPendingTab) {
                                setSelectedSubmissionId(item.id);
                              } else {
                                setSelectedRestId(item.id);
                                setInnerTab("overview");
                              }
                            }}
                            className="block max-w-full truncate text-start cursor-pointer after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
                          >
                            {item.name}
                          </button>
                        </h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                          {subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 mt-3.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {formatAddress(
                          isSub
                            ? submission?.address
                            : merchant?.restaurantAddress,
) || t("rests.no_address")}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2 text-center text-xs">
                    {isSub ? (
                      <>
                        <MiniStat
                          label={t("rests.applied")}
                          value={formatDate(submission?.createdAt)}
                          tone="amber"
                        />
                        <MiniStat
                          label={t("common.delivery_fee")}
                          value={formatMoney(
                            submission?.deliveryFee,
                            submission?.currencyId,
                          )}
                        />
                      </>
                    ) : (
                      <>
                        <MiniStat
                          label={t("common.delivery_fee")}
                          value={formatMoney(
                            merchant?.deliveryFee,
                            currencyOf(merchant),
                          )}
                        />
                        <MiniStat
                          label={t("rests.rating_with_count", {
                            count: merchant?.totalRatings ?? 0,
                          })}
                          value={`${formatRating(merchant?.rating)} ★`}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination — merchants are now paged too. The registry used to render
          only whatever the API put on page one and call it the whole platform. */}
      {!isLoading && !error && (
        <Pagination
          page={isPendingTab ? appPage : merchantPage}
          totalPages={isPendingTab ? appTotalPages : merchantTotalPages}
          onChange={(next) =>
            isPendingTab ? setAppPage(next) : setMerchantPage(next)
          }
        />
      )}

      <AddRestaurantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchMerchants();
        }}
      />

      <StoriesViewerModal
        isOpen={!!viewingStoriesFor}
        onClose={() => setViewingStoriesFor(null)}
        restaurant={viewingStoriesFor}
      />
    </div>
  );
}

// ─── Presentational ──────────────────────────────────────────────────────────

/**
 * The "back" control, kept in view while a merchant's detail page is scrolled.
 *
 * A detail page runs several screens deep — hours, zones, menu, reviews — and
 * the only way back to the list sat at the very top, so leaving meant
 * scrolling all the way up first.
 *
 * It sticks to the top of `<main>`, which is the scrolling element (the page
 * itself does not scroll: the shell is `h-screen` with the sidebar and header
 * fixed beside it). The negative margins pull the bar out over that element's
 * own padding so scrolled content passes *under* an opaque strip rather than
 * beside it.
 */
function StickyBackBar({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 sm:-mx-8 -mt-4 sm:-mt-8 px-4 sm:px-8 py-3 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-200/70 dark:border-zinc-800/70">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        <span>{label}</span>
      </button>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const { t } = useI18n();

  if (totalPages <= 1) return null;
  return (
    <div className="flex justify-center items-center gap-2 mt-8">
      <button
        disabled={page === 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
      >
        {t("common.previous")}
      </button>
      <span className="text-xs font-semibold text-zinc-500">
        Page {page} of {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
      >
        {t("common.next")}
      </button>
    </div>
  );
}

function InfoCard({
  icon,
  accent,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  accent: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-xl shrink-0 ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-lg font-black text-zinc-900 dark:text-white truncate">
          {value}
        </p>
        {hint && (
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{hint}</p>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber";
}) {
  return (
    <div
      className={`p-2 rounded-xl ${
        tone === "amber"
          ? "bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10"
          : "bg-zinc-50 dark:bg-zinc-800/40"
      }`}
    >
      <p
        className={`text-[9px] font-bold uppercase truncate ${
          tone === "amber"
            ? "text-amber-500"
            : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {label}
      </p>
      <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5 truncate">
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <dt className="text-zinc-500 dark:text-zinc-400 font-semibold">{label}</dt>
      <dd className="font-bold text-zinc-800 dark:text-zinc-200 text-end truncate">
        {value}
      </dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="font-semibold text-zinc-800 dark:text-zinc-200 break-words">
        {value}
      </span>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
      <span className="text-zinc-500 dark:text-zinc-400">{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">
          {label}
        </p>
        <p className="font-bold break-all">{value}</p>
      </div>
    </div>
  );
}

function OpeningHours({
  entries,
}: {
  entries?: { day: string; is24Hours: boolean; openTime?: string; closeTime?: string }[] | null;
}) {
  const { t } = useI18n();

  if (!entries || entries.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {t("rests.no_hours")}
      </p>
    );
  }
  return (
    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pe-2 custom-scrollbar">
      {entries.map((entry, idx) => (
        <div
          key={`${entry.day}-${idx}`}
          className="flex justify-between items-center text-xs border-b border-zinc-50 dark:border-zinc-800/40 pb-2"
        >
          <span className="font-bold text-zinc-700 dark:text-zinc-300 capitalize">
            {entry.day}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
              entry.is24Hours
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {entry.is24Hours
              ? t("rests.hours_24")
              : entry.openTime && entry.closeTime
                ? `${entry.openTime} - ${entry.closeTime}`
                : t("rests.closed")}
          </span>
        </div>
      ))}
    </div>
  );
}
