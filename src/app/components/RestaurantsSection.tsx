"use client";

import React, { useState, useEffect } from "react";
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
  Loader2
} from "lucide-react";
import { restaurantsService, RestaurantResponse } from "../../services/restaurants";

interface RestaurantsSectionProps {
  // Keeping the props for backward compatibility in page.tsx layout, 
  // but we will use real API data internally.
  db?: any;
  onUpdateRestaurant?: any;
  searchQuery: string;
}

export default function RestaurantsSection({
  searchQuery
}: RestaurantsSectionProps) {
  const [restaurants, setRestaurants] = useState<RestaurantResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRestId, setSelectedRestId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');
  
  // Review form states
  const [isReviewing, setIsReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchRestaurants = async () => {
    try {
      setIsLoading(true);
      const data = await restaurantsService.getRestaurants();
      setRestaurants(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch restaurants:", err);
      // Fallback dummy data if API is not yet available, to maintain UI integrity
      setRestaurants([
        {
          id: "rest-1", name: "Al Baik", email: "albaik@nowlny.com", phone: "+966112345678",
          cuisineType: "Fast Food", rating: 4.9, reviewsCount: 12000, status: "pending",
          logo: "🍗", coverImage: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80",
          address: "Olaya St, Riyadh", city: "Riyadh", latitude: 24.68, longitude: 46.72,
          deliveryFee: 5, estimatedDeliveryMinutes: 30, revenue: 0, ordersCount: 0, joinedDate: "2026-05-20"
        },
        {
          id: "rest-2", name: "Shawarma House", email: "contact@shawarma.com", phone: "+96650000000",
          cuisineType: "Middle Eastern", rating: 4.5, reviewsCount: 800, status: "active",
          logo: "🥙", coverImage: "https://images.unsplash.com/photo-1529144415895-6aaf8be872fb?w=600&auto=format&fit=crop&q=80",
          address: "Tahlia St, Riyadh", city: "Riyadh", latitude: 24.69, longitude: 46.71,
          deliveryFee: 3, estimatedDeliveryMinutes: 20, revenue: 15400, ordersCount: 420, joinedDate: "2025-11-10"
        }
      ] as any);
      setError("Could not connect to API. Showing local fallback data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const selectedRest = restaurants.find(r => r.id === selectedRestId);

  // Filter restaurants
  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.cuisineType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.address || "").toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || r.status?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (restId: string, newStatus: string) => {
    try {
      await restaurantsService.updateRestaurant(restId, { status: newStatus });
      fetchRestaurants();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleReview = async (decision: 'approve' | 'reject') => {
    if (!selectedRest) return;
    if (decision === 'reject' && !rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }

    try {
      await restaurantsService.reviewRestaurant(selectedRest.id, {
        decision,
        rejectionReason: decision === 'reject' ? rejectionReason : undefined
      });
      setIsReviewing(false);
      setRejectionReason("");
      fetchRestaurants();
    } catch (err: any) {
      alert(`Failed to review application: ${err.message}`);
    }
  };

  if (isLoading && restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Loading merchants...</p>
      </div>
    );
  }

  // Render detail view if open
  if (selectedRest) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-200">
        {/* Back Button */}
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

        {/* Restaurant Header Jumbotron */}
        <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-lg">
          <div className="h-40 relative">
            <img 
              src={selectedRest.coverImage || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"} 
              alt={selectedRest.name} 
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border uppercase tracking-wider ${
                selectedRest.status === "active" ? "bg-emerald-500/90 text-white border-emerald-400" :
                selectedRest.status === "pending" ? "bg-amber-500/90 text-black border-amber-400 animate-pulse" :
                "bg-red-500/90 text-white border-red-400"
              }`}>
                {selectedRest.status}
              </span>
            </div>
          </div>
          
          <div className="p-6 relative -mt-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-zinc-950/40">
            <div className="flex gap-4 items-end">
              {selectedRest.logo ? (
                typeof selectedRest.logo === 'string' && selectedRest.logo.length > 5 ? (
                  <img src={selectedRest.logo} alt="logo" className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl object-cover" />
                ) : (
                  <span className="text-4xl p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">{selectedRest.logo}</span>
                )
              ) : (
                <span className="text-4xl p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">🍽️</span>
              )}
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">{selectedRest.name}</h3>
                <p className="text-xs text-orange-400 font-semibold">{selectedRest.cuisineType || "No cuisine set"}</p>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {[selectedRest.address, selectedRest.city].filter(Boolean).join(", ") || "No address provided"}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {selectedRest.joinedDate || selectedRest.createdAt ? new Date((selectedRest.joinedDate || selectedRest.createdAt) as string).toLocaleDateString() : "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Admin Override Action Bar */}
            <div className="flex gap-2 shrink-0">
              {selectedRest.status === "pending" && !isReviewing && (
                <>
                  <button 
                    onClick={() => handleReview('approve')}
                    className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Approve Application
                  </button>
                  <button 
                    onClick={() => setIsReviewing(true)}
                    className="bg-zinc-800 hover:bg-red-500 hover:text-white text-zinc-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                  >
                    Reject Application
                  </button>
                </>
              )}
              {selectedRest.status === "active" && (
                <button 
                  onClick={() => handleStatusChange(selectedRest.id, 'suspended')}
                  className="bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                >
                  Suspend Merchant
                </button>
              )}
              {selectedRest.status === "suspended" && (
                <button 
                  onClick={() => handleStatusChange(selectedRest.id, 'active')}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                >
                  Activate Merchant
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Rejection Form */}
        {isReviewing && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-200">
            <h4 className="text-sm font-bold text-red-500 mb-2">Reject Merchant Application</h4>
            <p className="text-xs text-zinc-400 mb-4">Please provide a reason for rejecting this restaurant. This will be sent to their email.</p>
            <textarea 
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Missing required commercial registration document."
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
                onClick={() => handleReview('reject')}
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        )}

        {/* Info Grid (Summary Payouts + Documents Verification) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Gross Income</p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">${(selectedRest.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Total Sales Orders</p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">{selectedRest.ordersCount || 0} Orders</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Review Rating</p>
              <p className="text-lg font-black text-zinc-900 dark:text-white">{selectedRest.rating || 0} ★ <span className="text-xs font-normal text-zinc-400">({selectedRest.reviewsCount || (selectedRest as any).totalRatings || 0} votes)</span></p>
            </div>
          </div>
        </div>

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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Status Filter Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/80">
          {(['all', 'active', 'pending', 'suspended'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200 capitalize ${
                statusFilter === filter 
                  ? "bg-white dark:bg-zinc-900 text-orange-500 shadow-sm border border-zinc-200/30 dark:border-zinc-800" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              }`}
            >
              <span>{filter}</span>
              {filter === 'pending' && restaurants.filter(r => r.status?.toLowerCase() === 'pending').length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-black px-1.5 py-0.5 text-[9px] font-black rounded-full">
                  {restaurants.filter(r => r.status?.toLowerCase() === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Counter summary */}
        <span className="text-xs font-semibold text-zinc-500">
          Showing {filteredRestaurants.length} of {restaurants.length} merchants
        </span>
      </div>

      {/* Grid of Restaurant Cards */}
      {filteredRestaurants.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <Store className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No restaurants match criteria</p>
          <p className="text-xs text-zinc-400 mt-1">Try relaxing filters or updating search search terms</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((rest) => (
            <div 
              key={rest.id} 
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col cursor-pointer"
              onClick={() => setSelectedRestId(rest.id)}
            >
              {/* Banner Area */}
              <div className="h-32 relative">
                <img 
                  src={rest.coverImage || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80"} 
                  alt={rest.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300 opacity-80"
                />
                <div className="absolute top-3 right-3">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shadow border ${
                    rest.status === "active" ? "bg-emerald-500/90 text-white border-emerald-400" :
                    rest.status === "pending" ? "bg-amber-500/95 text-black border-amber-400 animate-pulse" :
                    "bg-red-500/90 text-white border-red-400"
                  }`}>
                    {rest.status}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex gap-3 items-start">
                    {rest.logo && typeof rest.logo === 'string' && rest.logo.length > 5 ? (
                      <img src={rest.logo} alt="logo" className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm object-cover" />
                    ) : (
                      <span className="text-2xl p-1.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700">{rest.logo || "🍽️"}</span>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white truncate group-hover:text-orange-500 transition-colors">{rest.name}</h4>
                      <p className="text-[10px] text-zinc-400 font-medium truncate mt-0.5">{rest.cuisineType || "No cuisine set"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-3.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{[rest.address, rest.city].filter(Boolean).join(", ") || "No address provided"}</span>
                  </div>
                </div>

                {/* mini analytics stats */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">GMV Sales</p>
                    <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5">${(rest.revenue || 0).toFixed(0)}</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">Rating</p>
                    <p className="font-extrabold text-zinc-900 dark:text-white mt-0.5 inline-flex items-center justify-center gap-0.5">
                      {rest.rating || 0} <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
