"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Store,
  Star,
  MapPin,
  Calendar,
  DollarSign,
  ShoppingBag,
  ArrowLeft,
  Loader2,
  Clock,
  Mail,
  Phone,
  FileText,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  restaurantsService,
  RestaurantResponse,
  RestaurantSubmission,
  RestaurantFullResponse,
} from "../../services/restaurants";
import AddRestaurantModal from "./AddRestaurantModal";
import EditRestaurantModal from "./EditRestaurantModal";
import RestaurantMenuSection from "./RestaurantMenuSection";
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
  formatRating,
  orDash,
  searchable,
} from "../../lib/format";

const DeliveryZoneMap = dynamic(() => import("./DeliveryZoneMapClient"), {
  ssr: false,
  // Without this the 400px map slot is a blank grey box until the leaflet
  // chunk lands, which reads as a broken panel rather than a loading one.
  loading: () => <Skeleton className="h-full w-full rounded-xl" />,
});

interface RestaurantsSectionProps {
  db?: any;
  onUpdateRestaurant?: any;
  searchQuery: string;
  currentRole?: any;
}

/** Which single mutation is in flight — one shared flag spun every button. */
type PendingAction =
  | null
  | "status"
  | "delete"
  | "feature"
  | "approve"
  | "reject";

export default function RestaurantsSection({
  searchQuery,
  currentRole,
}: RestaurantsSectionProps) {
  const confirm = useConfirm();

  const [restaurants, setRestaurants] = useState<RestaurantResponse[]>([]);
  const [submissions, setSubmissions] = useState<RestaurantSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const isBusy = pendingAction !== null;

  const [selectedRestId, setSelectedRestId] = useState<string | null>(
    currentRole?.type === "restaurant" ? currentRole.restaurantId : null,
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
  const [innerTab, setInnerTab] = useState<
    "overview" | "profile" | "menu" | "orders" | "delivery"
  >("overview");
  const [merchantStatus, setMerchantStatus] = useState<
    "all" | "active" | "suspended"
  >("all");
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

  /*
   * Both fetchers used to swallow the API failure in an inner catch, log it,
   * and then fall through to `setError(null)` — so a 500 rendered the "no
   * merchants match criteria" empty state and the admin concluded there were
   * zero merchants. The error must reach the outer catch.
   */
  const fetchMerchants = async () => {
    try {
      setIsLoading(true);
      const restsData = await restaurantsService.getRestaurants();
      const finalRests = Array.isArray(restsData)
        ? restsData
        : restsData && (restsData as any).data
          ? (restsData as any).data
          : [];
      setRestaurants(finalRests);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch restaurants:", err);
      setError(err?.message || "Couldn't load merchants.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      const subsData: any = await restaurantsService.getSubmissions({
        status: appStatus,
        page: appPage,
        limit: 20,
      });

      if (subsData && subsData.data) {
        setSubmissions(subsData.data);
        setAppTotalPages(
          subsData.totalPages || Math.ceil((subsData.total || 0) / 20) || 1,
        );
        setAppTotalItems(subsData.total || 0);
      } else if (Array.isArray(subsData)) {
        setSubmissions(subsData);
        setAppTotalPages(1);
        setAppTotalItems(subsData.length);
      } else {
        setSubmissions([]);
        setAppTotalPages(1);
        setAppTotalItems(0);
      }
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch submissions:", err);
      setError(err?.message || "Couldn't load applications.");
    } finally {
      setIsLoading(false);
    }
  };

  const refetchList = () => {
    if (viewMode === "merchants") fetchMerchants();
    else fetchSubmissions();
  };

  useEffect(() => {
    if (viewMode === "merchants") {
      fetchMerchants();
    } else {
      fetchSubmissions();
    }
  }, [viewMode, appStatus, appPage]);

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
    } catch (err: any) {
      console.error("Failed to fetch full restaurant details:", err);
      setFullError(err?.message || "Couldn't load this merchant's details.");
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
    fullSelectedRest?.restaurant?.id === selectedRestId
      ? fullSelectedRest
      : null;
  const selectedRest =
    fullDetail?.restaurant || restaurants.find((r) => r.id === selectedRestId);
  const selectedSubmission = submissions.find(
    (s) => s.id === selectedSubmissionId,
  );

  const query = searchQuery.toLowerCase();

  // Filter restaurants locally (if you want local search/status for merchants)
  const filteredRestaurants = restaurants.filter((r) => {
    // `address` comes back as an object on some endpoints; `.toLowerCase()`
    // on it threw and blanked the whole list mid-keystroke.
    const matchesSearch =
      searchable(r.name).includes(query) ||
      searchable(r.cuisineType).includes(query) ||
      searchable(r.address).includes(query);

    const matchesStatus =
      merchantStatus === "all" ||
      r.status?.toLowerCase() === merchantStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Filter submissions (search locally since backend doesn't have search query param yet, or assume it does)
  const filteredSubmissions = submissions.filter((s) => {
    const matchesSearch =
      searchable(s.name).includes(query) ||
      searchable(s.cuisineType).includes(query) ||
      searchable(s.address?.street).includes(query) ||
      searchable(s.address?.city).includes(query);

    return matchesSearch;
  });

  const isPendingTab = viewMode === "applications";
  const displayList = isPendingTab ? filteredSubmissions : filteredRestaurants;

  const handleStatusChange = async (
    restId: string,
    newStatus: string,
    restName?: string,
  ) => {
    const label = restName ? `“${restName}”` : "this merchant";
    if (
      newStatus === "suspended" &&
      !(await confirm({
        title: `Suspend ${label}?`,
        description:
          "The merchant is hidden from customers and stops receiving orders until you make it available again.",
        confirmLabel: "Suspend merchant",
        variant: "danger",
      }))
    ) {
      return;
    }

    try {
      setPendingAction("status");
      await restaurantsService.updateRestaurant(restId, { status: newStatus });
      toast.success(`Status updated successfully!`);
      refetchList();
      // Without this the header still shows the old status and keeps
      // offering "Suspend" on a merchant that was just suspended.
      await refreshSelected();
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteRestaurant = async (restId: string, restName?: string) => {
    const confirmed = await confirm({
      title: `Delete ${restName ? `“${restName}”` : "this merchant"}?`,
      description:
        "This permanently removes the merchant along with its menu, stories and delivery zones. It cannot be undone.",
      confirmLabel: "Delete merchant",
      variant: "danger",
      confirmPhrase: restName,
    });
    if (!confirmed) return;

    try {
      setPendingAction("delete");
      await restaurantsService.deleteRestaurant(restId);
      toast.success(`Restaurant deleted successfully!`);
      setSelectedRestId(null);
      refetchList();
    } catch (err: any) {
      toast.error(`Failed to delete restaurant: ${err.message}`);
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
        toast.success(`Restaurant unfeatured successfully!`);
      } else {
        await restaurantsService.markAsFeatured(restId);
        toast.success(`Restaurant featured successfully!`);
      }

      // Update selected restaurant state directly for immediate feedback
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
    } catch (err: any) {
      toast.error(`Failed to toggle featured status: ${err.message}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleReview = async (decision: "approve" | "reject") => {
    if (!selectedSubmission) return;
    if (decision === "reject" && !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    try {
      setPendingAction(decision);
      await restaurantsService.reviewSubmission(selectedSubmission.id, {
        decision,
        rejectionReason: decision === "reject" ? rejectionReason : undefined,
      });
      toast.success(`Application ${decision}d successfully!`);
      setIsReviewing(false);
      setRejectionReason("");
      setSelectedSubmissionId(null);
      refetchList();
    } catch (err: any) {
      toast.error(`Failed to review application: ${err.message}`);
    } finally {
      setPendingAction(null);
    }
  };

  /** Revoking an approval takes a live merchant offline — always ask first. */
  const startRejection = async () => {
    if (selectedSubmission?.status === "approved") {
      const confirmed = await confirm({
        title: `Revoke approval for “${selectedSubmission.name}”?`,
        description:
          "The application goes back to rejected and the merchant loses access. You'll be asked for a reason next.",
        confirmLabel: "Revoke approval",
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

  // Render detail view if a submission is selected
  if (isPendingTab && selectedSubmission) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-200">
        {/* Back Button */}
        <button
          onClick={() => {
            setSelectedSubmissionId(null);
            setIsReviewing(false);
          }}
          className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Submissions Registry</span>
        </button>

        {/* Restaurant Header Jumbotron */}
        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
          <div className="h-40 relative">
            <img
              src={
                selectedSubmission.backgroundImageUrl ||
                selectedSubmission.coverImage ||
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"
              }
              alt={selectedSubmission.name}
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <StatusPill
                status={selectedSubmission.status}
                className="px-3 py-1.5 text-xs shadow-lg backdrop-blur-sm"
              />
            </div>
          </div>

          <div className="p-6 relative -mt-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-950/40">
            <div className="flex gap-4 items-end">
              {selectedSubmission.logo ? (
                selectedSubmission.logo.length > 5 ? (
                  <img
                    src={selectedSubmission.logo}
                    alt={`${selectedSubmission.name} logo`}
                    className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl object-cover"
                  />
                ) : (
                  <span className="text-4xl p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
                    {selectedSubmission.logo}
                  </span>
                )
              ) : (
                <span className="text-4xl p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
                  🍽️
                </span>
              )}
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {selectedSubmission.name}
                </h3>
                <p className="text-xs text-orange-400 font-semibold">
                  {selectedSubmission.cuisineType || "No cuisine set"}
                </p>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />{" "}
                    {formatAddress(selectedSubmission.address) ||
                      "No address provided"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Submitted{" "}
                    {formatDate(selectedSubmission.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin Override Action Bar */}
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
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      )}
                      Approve Application
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
                        ? "Revoke / Reject"
                        : "Reject Application"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rejection Form */}
        {isReviewing && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-200">
            <h4 className="text-sm font-bold text-red-500 mb-2">
              Reject Merchant Application
            </h4>
            <label
              htmlFor="rejection-reason"
              className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2"
            >
              Please provide a reason for rejecting this restaurant. This will
              be sent to the merchant's dashboard.
            </label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Logo image URL is invalid, or cuisine selection is unsupported."
              className="w-full bg-zinc-950 border border-red-500/30 text-zinc-200 text-sm rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-red-500 mb-4 h-24"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsReviewing(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview("reject")}
                disabled={isBusy}
                className="flex items-center bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingAction === "reject" && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Confirm Rejection
              </button>
            </div>
          </div>
        )}

        {/* Info Grid & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Est. Delivery Time
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                {orDash(selectedSubmission.estimatedDeliveryMinutes, " Minutes")}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Delivery Fee
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                {formatMoney(selectedSubmission.deliveryFee, "USD")}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                Cuisine Type
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                {orDash(selectedSubmission.cuisineType)}
              </p>
            </div>
          </div>
        </div>

        {/* Extended Details card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              Contact & Location Information
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
                <Mail className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <div>
                  <p className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">
                    Email Address
                  </p>
                  <p className="font-bold">
                    {selectedSubmission.email || "Not provided"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
                <Phone className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <div>
                  <p className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">
                    Phone Number
                  </p>
                  <p className="font-bold">
                    {selectedSubmission.phone || "Not provided"}
                  </p>
                </div>
              </div>
              {selectedSubmission.website && (
                <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
                  <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  <div>
                    <p className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">
                      Website URL
                    </p>
                    <p className="font-bold">{selectedSubmission.website}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <MapPin className="w-4 h-4 text-zinc-500 dark:text-zinc-400 mt-1" />
                <div>
                  <p className="font-semibold text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">
                    Address & Coordinates
                  </p>
                  <p className="font-bold">
                    {formatAddress(selectedSubmission.address) || "No address"}
                  </p>
                  <p className="font-bold">
                    Lat: {orDash(selectedSubmission.address?.latitude)}, Lng:{" "}
                    {orDash(selectedSubmission.address?.longitude)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-3">
              Proposed Opening Hours
            </h4>
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {selectedSubmission.openingHours &&
              selectedSubmission.openingHours.length > 0 ? (
                selectedSubmission.openingHours.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-xs border-b border-zinc-50 dark:border-zinc-800/40 pb-2"
                  >
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
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
                        ? "24 Hours Open"
                        : `${entry.openTime} - ${entry.closeTime}`}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No custom opening hours submitted. Standard settings apply.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render detail view if a restaurant is selected
  if (!isPendingTab && selectedRest) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-200">
        {/* Back Button */}
        {currentRole?.type !== "restaurant" && (
          <button
            onClick={() => {
              setSelectedRestId(null);
              setIsReviewing(false);
            }}
            className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Restaurant Registry</span>
          </button>
        )}

        {/* The detail payload failed but the list copy is still on screen. */}
        {fullError && (
          <ErrorBanner message={fullError} onRetry={() => refreshSelected()} />
        )}

        {/* Restaurant Header Jumbotron */}
        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
          <div className="h-40 relative">
            <img
              src={
                selectedRest.backgroundImageUrl ||
                selectedRest.coverImage ||
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"
              }
              alt={selectedRest.name}
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              {/* Shared mapping — the local one had no `approved` branch, so
                  approved merchants rendered with the red "error" pill. */}
              <StatusPill
                status={selectedRest.status}
                className="px-3 py-1.5 text-xs shadow-lg backdrop-blur-sm"
              />
              {selectedRest.isFeatured && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border uppercase tracking-wider bg-purple-500/90 text-white border-purple-400 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white" /> Featured
                </span>
              )}
            </div>
          </div>

          <div className="p-6 relative -mt-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-950/40">
            <div className="flex gap-4 items-end">
              {selectedRest.logo ? (
                selectedRest.logo.length > 5 ? (
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
                    // Was a button that did nothing when the merchant had no
                    // stories — a focus stop with no action.
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
                    {selectedRest.logo}
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
                  {selectedRest.cuisineType || "No cuisine set"}
                </p>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />{" "}
                    {/* `address` is an object on some endpoints — joining it
                        raw printed "[object Object], Amman". */}
                    {[formatAddress(selectedRest.address), selectedRest.city]
                      .filter(Boolean)
                      .join(", ") || "No address provided"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Joined{" "}
                    {formatDate(
                      selectedRest.joinedDate || selectedRest.createdAt,
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin Override Action Bar */}
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <button
                onClick={() => setIsEditModalOpen(true)}
                disabled={isBusy}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit Merchant
              </button>
              <button
                onClick={() =>
                  handleDeleteRestaurant(selectedRest.id, selectedRest.name)
                }
                disabled={isBusy}
                className="flex items-center bg-zinc-800 hover:bg-red-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingAction === "delete" && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Delete
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
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Suspend Merchant
                </button>
              )}
              {selectedRest.status === "suspended" && (
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
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Make Available
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
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  <Star
                    className={`w-4 h-4 mr-1.5 ${selectedRest.isFeatured ? "opacity-50" : "fill-white"}`}
                  />
                  {selectedRest.isFeatured ? "Unfeature" : "Feature Merchant"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Internal Tabs — scrollable so the last tabs stay reachable at 375px */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4 overflow-x-auto scrollbar-none">
          {(
            [
              ["overview", "Overview"],
              ["profile", "Profile"],
              ["menu", "Menu Editor"],
              ["orders", "Live Orders"],
              ["delivery", "Delivery Zone"],
            ] as const
          ).map(([tab, label]) => (
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
              {label}
            </button>
          ))}
        </div>

        {innerTab === "delivery" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* This tab used to be gated on `fullSelectedRest?.deliveryZones`
                alone, so it rendered nothing at all while loading or on error. */}
            {isFullLoading && !fullDetail ? (
              <CardSkeletonGrid count={1} className="grid grid-cols-1" />
            ) : fullError ? (
              <ErrorState
                message={fullError}
                title="Couldn't load delivery zones"
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
                  title="No delivery zones set up"
                  hint="This restaurant hasn't configured any delivery zones yet."
                />
              </div>
            )}
          </div>
        )}

        {innerTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Info Grid (Summary Payouts + Documents Verification) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Gross Income
                  </p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">
                    {formatMoney(selectedRest.revenue, "USD")}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Total Sales Orders
                  </p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">
                    {orDash(selectedRest.ordersCount ?? 0, " Orders")}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                  <Star className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Review Rating
                  </p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">
                    {formatRating(selectedRest.rating)} ★{" "}
                    <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      (
                      {selectedRest.reviewsCount ??
                        (selectedRest as any).totalRatings ??
                        0}{" "}
                      votes)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {innerTab === "profile" && (
          <div className="space-y-6 animate-in fade-in duration-200 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-orange-500" />
                  Contact Information
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Email
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {orDash(selectedRest.email)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Phone
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {orDash(selectedRest.phone)}
                    </span>
                  </div>
                  {selectedRest.website && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        Website
                      </span>
                      <a
                        href={selectedRest.website}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-500 hover:underline"
                      >
                        {selectedRest.website}
                      </a>
                    </div>
                  )}
                  {selectedRest.description && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        Description
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">
                        {selectedRest.description}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Operations Info */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-500" />
                  Operations
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Cuisine Type
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
                      {orDash(selectedRest.cuisineType)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Delivery Fee
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatMoney(selectedRest.deliveryFee, "USD")}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Est. Delivery
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {orDash(selectedRest.estimatedDeliveryMinutes, " mins")}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Joined Date
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatDate(selectedRest.joinedDate)}
                    </span>
                  </div>
                </div>

                {/* Opening Hours */}
                {selectedRest.openingHours?.entries && (
                  <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block mb-2">
                      Opening Hours
                    </span>
                    <div className="space-y-1.5 text-xs">
                      {selectedRest.openingHours.entries.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center"
                        >
                          <span className="capitalize font-medium text-zinc-600 dark:text-zinc-400 w-24">
                            {entry.day}
                          </span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {entry.is24Hours
                              ? "24 Hours"
                              : entry.openTime && entry.closeTime
                                ? `${entry.openTime} - ${entry.closeTime}`
                                : "Closed"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4 md:col-span-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  Location
                </h4>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-3 text-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        City
                      </span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {orDash(selectedRest.city)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        Address
                      </span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatAddress(selectedRest.address) || "—"}
                      </span>
                    </div>
                  </div>
                  {selectedRest.latitude && selectedRest.longitude && (
                    <div className="w-full md:w-2/3 h-64 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-inner relative">
                      <iframe
                        title={`Map showing the location of ${selectedRest.name}`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${selectedRest.latitude},${selectedRest.longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
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
            <RestaurantMenuSection
              restaurant={selectedRest as any}
              onUpdateRestaurant={() => fetchMerchants()}
            />
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

        {/* Edit Restaurant Modal */}
        <EditRestaurantModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          restaurant={selectedRest || null}
          onSuccess={() => {
            setIsEditModalOpen(false);
            fetchMerchants();
            // Header/profile read from the detail payload, so refresh it too.
            refreshSelected();
          }}
        />

        {/* Stories Viewer Modal */}
        <StoriesViewerModal
          isOpen={!!viewingStoriesFor}
          onClose={() => setViewingStoriesFor(null)}
          restaurant={viewingStoriesFor}
        />
      </div>
    );
  }

  // Registry Listing Grid
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Content is already on screen — don't replace it, just flag the failure. */}
      {error && displayList.length > 0 && (
        <ErrorBanner message={error} onRetry={refetchList} />
      )}

      {/* Search & Tabs Filter Row */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
              <button
                onClick={() => {
                  setViewMode("merchants");
                  setSelectedRestId(null);
                  setSelectedSubmissionId(null);
                }}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === "merchants"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                Merchants Registry
              </button>
              <button
                onClick={() => {
                  setViewMode("applications");
                  setSelectedRestId(null);
                  setSelectedSubmissionId(null);
                }}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 ${
                  viewMode === "applications"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                }`}
              >
                Applications
              </button>
            </div>

            {/* Dynamic Filters based on view mode */}
            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
              {viewMode === "merchants"
                ? (["all", "active", "suspended"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setMerchantStatus(filter)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200 capitalize ${
                        merchantStatus === filter
                          ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                      }`}
                    >
                      {filter}
                    </button>
                  ))
                : (
                    [
                      "all",
                      "pending",
                      "approved",
                      "rejected",
                      "cancelled",
                    ] as const
                  ).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setAppStatus(filter);
                        setAppPage(1);
                      }}
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

          {/* Counter summary & Actions */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-zinc-500">
              Showing {displayList.length} of{" "}
              {isPendingTab ? appTotalItems : restaurants.length}{" "}
              {isPendingTab ? "applications" : "merchants"}
            </span>
            {!isPendingTab && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="text-xs font-bold px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm"
              >
                Add Restaurant
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Restaurant / Submission Cards.
          Loading, failed and genuinely-empty are three different states: the
          old code showed "No restaurants match criteria" for all three. */}
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
              ? "Couldn't load applications"
              : "Couldn't load merchants"
          }
          onRetry={refetchList}
        />
      ) : displayList.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <EmptyState
            icon={Store}
            title={
              isPendingTab
                ? "No pending submissions to review"
                : "No restaurants match criteria"
            }
            hint="Try relaxing filters or updating search terms"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayList.map((item) => {
            const isSub = "status" in item && isPendingTab;
            const hasStories =
              !isSub && ((item as any).stories?.length ?? 0) > 0;

            return (
              <div
                key={item.id}
                className="relative bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-orange-500 transition-all duration-200 group flex flex-col"
              >
                {/* Banner Area */}
                <div className="h-32 relative">
                  <img
                    src={
                      (item as any).backgroundImageUrl ||
                      item.coverImage ||
                      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"
                    }
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300 opacity-80"
                  />
                  <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                    <StatusPill status={item.status} className="shadow" />
                    {(item as any).isFeatured && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow border bg-purple-500/90 text-white border-purple-400 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-white" /> Featured
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex gap-3 items-start">
                      {item.logo &&
                      typeof item.logo === "string" &&
                      item.logo.length > 5 ? (
                        hasStories ? (
                          <button
                            type="button"
                            aria-label={`View ${item.name} stories`}
                            onClick={() => setViewingStoriesFor(item as any)}
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
                          {item.logo || "🍽️"}
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
                            className="block max-w-full truncate text-left cursor-pointer after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
                          >
                            {item.name}
                          </button>
                        </h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                          {item.cuisineType || "No cuisine set"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 mt-3.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {(isSub
                          ? formatAddress((item as any).address)
                          : [formatAddress(item.address), (item as any).city]
                              .filter(Boolean)
                              .join(", ")) || "No address provided"}
                      </span>
                    </div>
                  </div>

                  {/* mini stats */}
                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2 text-center text-xs">
                    {isSub ? (
                      <>
                        <div className="bg-amber-500/5 dark:bg-amber-500/10 p-2 rounded-xl border border-amber-500/10">
                          <p className="text-[9px] font-bold text-amber-500 uppercase">
                            Apply Date
                          </p>
                          <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5">
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                          <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                            Est. Delivery
                          </p>
                          <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5">
                            {orDash(item.estimatedDeliveryMinutes, " min")}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                          <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                            GMV Sales
                          </p>
                          <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5">
                            {formatMoney((item as any).revenue, "USD")}
                          </p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                          <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">
                            Rating
                          </p>
                          <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5 inline-flex items-center justify-center gap-0.5">
                            {formatRating((item as any).rating)}{" "}
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "applications" &&
        appTotalPages > 1 &&
        displayList.length > 0 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              disabled={appPage === 1}
              onClick={() => setAppPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs font-semibold text-zinc-500">
              Page {appPage} of {appTotalPages}
            </span>
            <button
              disabled={appPage === appTotalPages}
              onClick={() => setAppPage((p) => Math.min(appTotalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

      {/* Add Restaurant Modal */}
      <AddRestaurantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchMerchants();
        }}
      />

      {/* Edit Restaurant Modal */}
      <EditRestaurantModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        restaurant={selectedRest || null}
        onSuccess={() => {
          setIsEditModalOpen(false);
          fetchMerchants();
          refreshSelected();
        }}
      />
      {/* Stories Viewer Modal */}
      <StoriesViewerModal
        isOpen={!!viewingStoriesFor}
        onClose={() => setViewingStoriesFor(null)}
        restaurant={viewingStoriesFor}
      />
    </div>
  );
}
