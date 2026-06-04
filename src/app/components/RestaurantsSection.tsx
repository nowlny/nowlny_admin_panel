"use client";

import React, { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import {
  Store,
  Search,
  Star,
  MapPin,
  Calendar,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
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
  RestaurantFullResponse
} from "../../services/restaurants";
import AddRestaurantModal from "./AddRestaurantModal";
import EditRestaurantModal from "./EditRestaurantModal";
import RestaurantMenuSection from "./RestaurantMenuSection";
import OrdersSection from "./OrdersSection";
import StoriesViewerModal from "./StoriesViewerModal";

const DeliveryZoneMap = dynamic(() => import('./DeliveryZoneMapClient'), { ssr: false });

interface RestaurantsSectionProps {
  db?: any;
  onUpdateRestaurant?: any;
  searchQuery: string;
  currentRole?: any;
}

export default function RestaurantsSection({
  searchQuery,
  currentRole,
}: RestaurantsSectionProps) {
  const [restaurants, setRestaurants] = useState<RestaurantResponse[]>([]);
  const [submissions, setSubmissions] = useState<RestaurantSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRestId, setSelectedRestId] = useState<string | null>(
    currentRole?.type === "restaurant" ? currentRole.restaurantId : null
  );
  const [fullSelectedRest, setFullSelectedRest] = useState<RestaurantFullResponse | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<
    string | null
  >(null);
  const [viewMode, setViewMode] = useState<"merchants" | "applications">(
    "merchants",
  );
  const [innerTab, setInnerTab] = useState<"overview" | "profile" | "menu" | "orders" | "delivery">("overview");
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
  const [viewingStoriesFor, setViewingStoriesFor] = useState<RestaurantResponse | null>(null);

  const fetchMerchants = async () => {
    try {
      setIsLoading(true);
      let restsData: RestaurantResponse[] = [];
      try {
        restsData = await restaurantsService.getRestaurants();
      } catch (err) {
        console.error("Failed to fetch restaurants via API:", err);
      }
      const finalRests = Array.isArray(restsData)
        ? restsData
        : restsData && (restsData as any).data
          ? (restsData as any).data
          : [];
      setRestaurants(finalRests);
      setError(null);
    } catch (err: any) {
      console.error("General error in fetchMerchants:", err);
      setError("An unexpected error occurred while loading data.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      let subsData: any = null;
      try {
        subsData = await restaurantsService.getSubmissions({
          status: appStatus,
          page: appPage,
          limit: 20,
        });
      } catch (err) {
        console.error("Failed to fetch submissions via API:", err);
      }

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
      console.error("General error in fetchSubmissions:", err);
      setError("An unexpected error occurred while loading data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "merchants") {
      fetchMerchants();
    } else {
      fetchSubmissions();
    }
  }, [viewMode, appStatus, appPage]);

  useEffect(() => {
    if (selectedRestId && viewMode === "merchants") {
      restaurantsService.getRestaurantFull(selectedRestId)
        .then((data) => setFullSelectedRest(data))
        .catch((err) => console.error("Failed to fetch full restaurant details:", err));
    } else {
      setFullSelectedRest(null);
    }
  }, [selectedRestId, viewMode]);

  const selectedRest = fullSelectedRest?.restaurant || restaurants.find((r) => r.id === selectedRestId);
  const selectedSubmission = submissions.find(
    (s) => s.id === selectedSubmissionId,
  );

  // Filter restaurants locally (if you want local search/status for merchants)
  const filteredRestaurants = restaurants.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.cuisineType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.address || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      merchantStatus === "all" ||
      r.status?.toLowerCase() === merchantStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Filter submissions (search locally since backend doesn't have search query param yet, or assume it does)
  const filteredSubmissions = submissions.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.cuisineType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.address?.street || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (s.address?.city || "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const isPendingTab = viewMode === "applications";
  const displayList = isPendingTab ? filteredSubmissions : filteredRestaurants;

  const handleStatusChange = async (restId: string, newStatus: string) => {
    try {
      setIsSubmitting(true);
      await restaurantsService.updateRestaurant(restId, { status: newStatus });
      toast.success(`Status updated successfully!`);
      if (viewMode === "merchants") fetchMerchants();
      else fetchSubmissions();
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRestaurant = async (restId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this restaurant? This cannot be undone.",
      )
    )
      return;
    try {
      setIsSubmitting(true);
      await restaurantsService.deleteRestaurant(restId);
      toast.success(`Restaurant deleted successfully!`);
      setSelectedRestId(null);
      if (viewMode === "merchants") fetchMerchants();
      else fetchSubmissions();
    } catch (err: any) {
      toast.error(`Failed to delete restaurant: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFeatured = async (restId: string, isCurrentlyFeatured: boolean) => {
    try {
      setIsSubmitting(true);
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
          restaurant: { ...fullSelectedRest.restaurant, isFeatured: !isCurrentlyFeatured }
        });
      }
      
      if (viewMode === "merchants") fetchMerchants();
    } catch (err: any) {
      toast.error(`Failed to toggle featured status: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async (decision: "approve" | "reject") => {
    if (!selectedSubmission) return;
    if (decision === "reject" && !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    try {
      setIsSubmitting(true);
      await restaurantsService.reviewSubmission(selectedSubmission.id, {
        decision,
        rejectionReason: decision === "reject" ? rejectionReason : undefined,
      });
      toast.success(`Application ${decision}d successfully!`);
      setIsReviewing(false);
      setRejectionReason("");
      setSelectedSubmissionId(null);
      if (viewMode === "merchants") fetchMerchants();
      else fetchSubmissions();
    } catch (err: any) {
      toast.error(`Failed to review application: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && restaurants.length === 0 && submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">
          Loading merchants and submissions...
        </p>
      </div>
    );
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
                selectedSubmission.backgroundImageUrl || selectedSubmission.coverImage ||
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"
              }
              alt={selectedSubmission.name}
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border uppercase tracking-wider ${
                  selectedSubmission.status === "approved"
                    ? "bg-emerald-500/90 text-white border-emerald-400"
                    : selectedSubmission.status === "pending"
                      ? "bg-amber-500/90 text-black border-amber-400 animate-pulse"
                      : selectedSubmission.status === "rejected"
                        ? "bg-red-500/90 text-white border-red-400"
                        : "bg-zinc-500/90 text-white border-zinc-400"
                }`}
              >
                {selectedSubmission.status === "pending"
                  ? "Pending Review"
                  : selectedSubmission.status}
              </span>
            </div>
          </div>

          <div className="p-6 relative -mt-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-950/40">
            <div className="flex gap-4 items-end">
              {selectedSubmission.logo ? (
                selectedSubmission.logo.length > 5 ? (
                  <img
                    src={selectedSubmission.logo}
                    alt="logo"
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
                    {[
                      selectedSubmission.address?.street,
                      selectedSubmission.address?.building,
                      selectedSubmission.address?.city,
                    ]
                      .filter(Boolean)
                      .join(", ") || "No address provided"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Submitted{" "}
                    {selectedSubmission.createdAt
                      ? new Date(
                          selectedSubmission.createdAt,
                        ).toLocaleDateString()
                      : "N/A"}
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
                      disabled={isSubmitting}
                      className="flex items-center bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Approve Application
                    </button>
                  )}
                  {(selectedSubmission.status === "pending" || selectedSubmission.status === "approved") && (
                    <button
                      onClick={() => setIsReviewing(true)}
                      className="bg-zinc-800 hover:bg-red-500 hover:text-white text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                    >
                      {selectedSubmission.status === "approved" ? "Revoke / Reject" : "Reject Application"}
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
            <p className="text-xs text-zinc-400 mb-4">
              Please provide a reason for rejecting this restaurant. This will
              be sent to the merchant's dashboard.
            </p>
            <textarea
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
                disabled={isSubmitting}
                className="flex items-center bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
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
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                Est. Delivery Time
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                {selectedSubmission.estimatedDeliveryMinutes ?? "N/A"} Minutes
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                Delivery Fee
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                ${(selectedSubmission.deliveryFee ?? 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                Cuisine Type
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                {selectedSubmission.cuisineType}
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
                <Mail className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="font-semibold text-zinc-400 text-[10px] uppercase">
                    Email Address
                  </p>
                  <p className="font-bold">
                    {selectedSubmission.email || "Not provided"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
                <Phone className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="font-semibold text-zinc-400 text-[10px] uppercase">
                    Phone Number
                  </p>
                  <p className="font-bold">
                    {selectedSubmission.phone || "Not provided"}
                  </p>
                </div>
              </div>
              {selectedSubmission.website && (
                <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-300">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <div>
                    <p className="font-semibold text-zinc-400 text-[10px] uppercase">
                      Website URL
                    </p>
                    <p className="font-bold">{selectedSubmission.website}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <MapPin className="w-4 h-4 text-zinc-400 mt-1" />
                <div>
                  <p className="font-semibold text-zinc-400 text-[10px] uppercase">
                    Address & Coordinates
                  </p>
                  <p className="font-bold">
                    {[
                      selectedSubmission.address?.street,
                      selectedSubmission.address?.building,
                      selectedSubmission.address?.city,
                    ]
                      .filter(Boolean)
                      .join(", ") || "No address"}
                  </p>
                  <p className="font-bold">
                    Lat: {selectedSubmission.address?.latitude ?? "N/A"}, Lng:{" "}
                    {selectedSubmission.address?.longitude ?? "N/A"}
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
                <p className="text-xs text-zinc-400">
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

        {/* Restaurant Header Jumbotron */}
        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
          <div className="h-40 relative">
            <img
              src={
                selectedRest.backgroundImageUrl || selectedRest.coverImage ||
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"
              }
              alt={selectedRest.name}
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border uppercase tracking-wider ${
                  selectedRest.status === "active"
                    ? "bg-emerald-500/90 text-white border-emerald-400"
                    : selectedRest.status === "pending"
                      ? "bg-amber-500/90 text-black border-amber-400 animate-pulse"
                      : "bg-red-500/90 text-white border-red-400"
                }`}
              >
                {selectedRest.status}
              </span>
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
                  <button 
                    onClick={(e) => {
                      if (selectedRest.stories && selectedRest.stories.length > 0) {
                        e.stopPropagation();
                        setViewingStoriesFor(selectedRest);
                      }
                    }}
                    className={`relative w-16 h-16 rounded-2xl shadow-xl overflow-hidden bg-zinc-900 border-2 transition-transform ${
                      selectedRest.stories && selectedRest.stories.length > 0 
                        ? 'border-orange-500 hover:scale-105 cursor-pointer p-[2px]' 
                        : 'border-zinc-800'
                    }`}
                  >
                    <img
                      src={selectedRest.logo}
                      alt="logo"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </button>
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
                    {[selectedRest.address, selectedRest.city]
                      .filter(Boolean)
                      .join(", ") || "No address provided"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Joined{" "}
                    {selectedRest.joinedDate || selectedRest.createdAt
                      ? new Date(
                          (selectedRest.joinedDate ||
                            selectedRest.createdAt) as string,
                        ).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin Override Action Bar */}
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              <button
                onClick={() => setIsEditModalOpen(true)}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit Merchant
              </button>
              <button
                onClick={() => handleDeleteRestaurant(selectedRest.id)}
                disabled={isSubmitting}
                className="flex items-center bg-zinc-800 hover:bg-red-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Delete
              </button>
              {selectedRest.status === "active" && (
                <button
                  onClick={() =>
                    handleStatusChange(selectedRest.id, "suspended")
                  }
                  disabled={isSubmitting}
                  className="flex items-center bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Suspend Merchant
                </button>
              )}
              {selectedRest.status === "suspended" && (
                <button
                  onClick={() => handleStatusChange(selectedRest.id, "active")}
                  disabled={isSubmitting}
                  className="flex items-center bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Reactivate Merchant
                </button>
              )}
              {selectedRest.status === "active" && (
                <button
                  onClick={() => handleToggleFeatured(selectedRest.id, !!selectedRest.isFeatured)}
                  disabled={isSubmitting}
                  className={`flex items-center active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedRest.isFeatured 
                      ? "bg-zinc-700 hover:bg-zinc-800" 
                      : "bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20"
                  }`}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Star className={`w-4 h-4 mr-1.5 ${selectedRest.isFeatured ? "opacity-50" : "fill-white"}`} />
                  {selectedRest.isFeatured ? "Unfeature" : "Feature Merchant"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Internal Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <button
            onClick={() => setInnerTab("overview")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              innerTab === "overview"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/50"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setInnerTab("profile")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              innerTab === "profile"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/50"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setInnerTab("menu")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              innerTab === "menu"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/50"
            }`}
          >
            Menu Editor
          </button>
          <button
            onClick={() => setInnerTab("orders")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              innerTab === "orders"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/50"
            }`}
          >
            Live Orders
          </button>
          <button
            onClick={() => setInnerTab("delivery")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
              innerTab === "delivery"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/50"
            }`}
          >
            Delivery Zone
          </button>
        </div>

        {innerTab === "delivery" && fullSelectedRest?.deliveryZones && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {fullSelectedRest.deliveryZones.length > 0 ? (
              fullSelectedRest.deliveryZones.map((zone) => (
                <div key={zone.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">{zone.name}</h3>
                  <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 relative z-0">
                    <DeliveryZoneMap polygon={zone.polygon} />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <MapPin className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No Delivery Zones Setup</h3>
                <p className="text-zinc-500 text-sm">This restaurant hasn't configured any delivery zones yet.</p>
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
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                Gross Income
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                $
                {(selectedRest.revenue || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                Total Sales Orders
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                {selectedRest.ordersCount || 0} Orders
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                Review Rating
              </p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">
                {selectedRest.rating || 0} ★{" "}
                <span className="text-xs font-normal text-zinc-400">
                  (
                  {selectedRest.reviewsCount ||
                    (selectedRest as any).totalRatings ||
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
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Email</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedRest.email}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Phone</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedRest.phone}</span>
                  </div>
                  {selectedRest.website && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Website</span>
                      <a href={selectedRest.website} target="_blank" rel="noreferrer" className="font-semibold text-blue-500 hover:underline">
                        {selectedRest.website}
                      </a>
                    </div>
                  )}
                  {selectedRest.description && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Description</span>
                      <span className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">{selectedRest.description}</span>
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
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Cuisine Type</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize">{selectedRest.cuisineType}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Delivery Fee</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">${selectedRest.deliveryFee?.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Est. Delivery</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedRest.estimatedDeliveryMinutes} mins</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Joined Date</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {selectedRest.joinedDate ? new Date(selectedRest.joinedDate).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>

                {/* Opening Hours */}
                {selectedRest.openingHours?.entries && (
                  <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block mb-2">Opening Hours</span>
                    <div className="space-y-1.5 text-xs">
                      {selectedRest.openingHours.entries.map((entry, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="capitalize font-medium text-zinc-600 dark:text-zinc-400 w-24">{entry.day}</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {entry.is24Hours ? "24 Hours" : entry.openTime && entry.closeTime ? `${entry.openTime} - ${entry.closeTime}` : "Closed"}
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
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">City</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedRest.city}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Address</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedRest.address}</span>
                    </div>
                  </div>
                  {selectedRest.latitude && selectedRest.longitude && (
                    <div className="w-full md:w-2/3 h-64 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-inner relative">
                      <iframe
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
            <OrdersSection searchQuery="" restaurantId={selectedRest.id} />
          </div>
        )}
      </div>
    );
  }

  // Registry Listing Grid
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-4 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
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

      {/* Grid of Restaurant / Submission Cards */}
      {displayList.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <Store className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {isPendingTab
              ? "No pending submissions to review"
              : "No restaurants match criteria"}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Try relaxing filters or updating search terms
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayList.map((item) => {
            const isSub = "status" in item && isPendingTab;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col cursor-pointer"
                onClick={() => {
                  if (isPendingTab) {
                    setSelectedSubmissionId(item.id);
                  } else {
                    setSelectedRestId(item.id);
                    setInnerTab("overview");
                  }
                }}
              >
                {/* Banner Area */}
                <div className="h-32 relative">
                  <img
                    src={
                      (item as any).backgroundImageUrl || item.coverImage ||
                      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"
                    }
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300 opacity-80"
                  />
                  <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow border ${
                        item.status === "active" || item.status === "approved"
                          ? "bg-emerald-500/90 text-white border-emerald-400"
                          : item.status === "pending"
                            ? "bg-amber-500/95 text-black border-amber-400 animate-pulse"
                            : "bg-red-500/90 text-white border-red-400"
                      }`}
                    >
                      {item.status}
                    </span>
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
                    <div className="flex gap-3 items-start relative z-10">
                      {item.logo &&
                      typeof item.logo === "string" &&
                      item.logo.length > 5 ? (
                        <button 
                          onClick={(e) => {
                            if (!isSub && (item as any).stories && (item as any).stories.length > 0) {
                              e.stopPropagation();
                              setViewingStoriesFor(item as any);
                            }
                          }}
                          className={`w-11 h-11 rounded-xl shadow-sm overflow-hidden bg-zinc-50 dark:bg-zinc-800 border-2 shrink-0 transition-transform ${
                            !isSub && (item as any).stories && (item as any).stories.length > 0
                              ? 'border-orange-500 hover:scale-110 cursor-pointer p-[1.5px]'
                              : 'border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          <img
                            src={item.logo}
                            alt="logo"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </button>
                      ) : (
                        <span className="text-2xl p-1.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 shrink-0">
                          {item.logo || "🍽️"}
                        </span>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-zinc-950 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-medium truncate mt-0.5">
                          {item.cuisineType || "No cuisine set"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-3.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">
                        {isSub
                          ? [
                              (item as any).address?.street,
                              (item as any).address?.city,
                            ]
                              .filter(Boolean)
                              .join(", ") || "No address provided"
                          : [item.address, (item as any).city]
                              .filter(Boolean)
                              .join(", ") || "No address provided"}
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
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleDateString()
                              : "Today"}
                          </p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase">
                            Est. Delivery
                          </p>
                          <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5">
                            {item.estimatedDeliveryMinutes ?? "N/A"} min
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase">
                            GMV Sales
                          </p>
                          <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5">
                            ${((item as any).revenue || 0).toFixed(0)}
                          </p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase">
                            Rating
                          </p>
                          <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5 inline-flex items-center justify-center gap-0.5">
                            {(item as any).rating || 0}{" "}
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
