"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Video,
  Eye,
  Heart,
  MessageSquare,
  Search,
  X,
  Loader2,
  Store,
} from "lucide-react";
import { reelsService, Reel } from "../../services/reels";
import { apiClient } from "../../services/apiClient";

export default function ReelsSection() {
  const [reels, setReels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [menuItemId, setMenuItemId] = useState("");
  const [restaurantId, setRestaurantId] = useState("");

  const fetchAllReels = async () => {
    try {
      setIsLoading(true);
      // Assuming GET /api/v1/reels/explore returns reels across the platform, 
      // or we use a specific admin endpoint. Using explore for now to list them.
      const res = await apiClient<any>("/api/v1/reels/explore?limit=100", { method: "GET" });
      const data = Array.isArray(res) ? res : res?.data || [];
      setReels(data);
    } catch (err) {
      console.error("Failed to fetch all reels:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReels();
  }, []);

  const handleCreateForRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl || !caption || !menuItemId || !restaurantId) {
      alert("Restaurant ID, Video URL, Caption, and Menu Item ID are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await reelsService.createReelForRestaurant(restaurantId, {
        videoUrl,
        thumbnailUrl,
        caption,
        menuItemId,
      });
      setIsModalOpen(false);
      
      // Reset form
      setVideoUrl("");
      setThumbnailUrl("");
      setCaption("");
      setMenuItemId("");
      setRestaurantId("");
      
      fetchAllReels();
    } catch (err: any) {
      console.error("Failed to create reel:", err);
      alert(err.message || "Failed to create reel");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (reel: any) => {
    const newStatus = reel.status === "active" ? "hidden" : "active";
    if (!confirm(`Are you sure you want to mark this reel as ${newStatus}?`)) return;
    try {
      await reelsService.setReelStatusAsAdmin(reel.id, newStatus);
      setReels(prev => prev.map(r => r.id === reel.id ? { ...r, status: newStatus } : r));
    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this reel?")) return;
    try {
      await reelsService.deleteReelAsAdmin(id);
      setReels((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error("Failed to delete reel:", err);
      alert("Failed to delete reel");
    }
  };

  const filteredReels = reels.filter(r => 
    r.caption?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.restaurant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.includes(searchQuery)
  );

  if (isLoading && reels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Loading platform reels...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <Sparkles className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Platform Reels Moderation
            </h2>
            <p className="text-xs text-zinc-500">
              Manage and moderate all reels across restaurants.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search reels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-zinc-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-bold px-3 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg transition-all shadow-sm shrink-0"
          >
            Create as Admin
          </button>
        </div>
      </div>

      {/* Grid */}
      {filteredReels.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <Video className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            No reels found
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            There are no reels matching your criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredReels.map((reel) => (
            <div
              key={reel.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col relative group"
            >
              {/* Thumbnail Area */}
              <div className="aspect-[9/16] bg-zinc-100 dark:bg-zinc-800 relative">
                {reel.thumbnailUrl ? (
                  <img
                    src={reel.thumbnailUrl}
                    alt={reel.caption}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                    <Video className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-[10px] uppercase font-bold">
                      No Thumbnail
                    </span>
                  </div>
                )}
                
                {/* Store Badge */}
                <div className="absolute top-3 right-3 max-w-[60%]">
                  <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-2 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm truncate">
                    {reel.restaurant?.logo ? (
                       <img src={reel.restaurant.logo} className="w-4 h-4 rounded-full shrink-0" />
                    ) : (
                       <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    )}
                    <span className="text-[9px] font-bold text-zinc-900 dark:text-white truncate">
                      {reel.restaurant?.name || "Unknown Store"}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full backdrop-blur-md ${
                      reel.status === "active"
                        ? "bg-emerald-500/80 text-white"
                        : "bg-red-500/80 text-white"
                    }`}
                  >
                    {reel.status || 'unknown'}
                  </span>
                </div>

                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                  <button
                    onClick={() => handleToggleStatus(reel)}
                    className="px-4 py-2 bg-white text-zinc-900 font-bold text-xs rounded-lg shadow-sm hover:scale-105 transition-transform"
                  >
                    {reel.status === 'active' ? 'Hide Reel' : 'Activate Reel'}
                  </button>
                  <button
                    onClick={() => handleDelete(reel.id)}
                    className="px-4 py-2 bg-red-500 text-white font-bold text-xs rounded-lg shadow-sm hover:scale-105 transition-transform flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>

                {/* Stats Overlay at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 pointer-events-none">
                  <p className="text-white text-xs font-bold line-clamp-2 leading-tight drop-shadow-md mb-2">
                    {reel.caption}
                  </p>
                  <div className="flex items-center gap-3 text-white">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{reel.viewCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{reel.likeCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{reel.commentCount || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Create Reel for Restaurant
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateForRestaurant} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">
                  Restaurant ID *
                </label>
                <input
                  type="text"
                  required
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  placeholder="Paste UUID of the restaurant"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">
                  Video URL (MP4) *
                </label>
                <input
                  type="url"
                  required
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://cdn.example.com/video.mp4"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">
                  Thumbnail URL (Optional)
                </label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://cdn.example.com/thumb.jpg"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">
                  Caption *
                </label>
                <textarea
                  required
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe the reel..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">
                  Menu Item ID *
                </label>
                <input
                  type="text"
                  required
                  value={menuItemId}
                  onChange={(e) => setMenuItemId(e.target.value)}
                  placeholder="Paste UUID of the menu item"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Create as Admin"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
