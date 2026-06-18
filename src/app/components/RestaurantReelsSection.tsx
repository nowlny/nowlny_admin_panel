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
  Share2,
  X,
  Loader2,
} from "lucide-react";
import { reelsService, Reel } from "../../services/reels";

export default function RestaurantReelsSection() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [editingReelId, setEditingReelId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [menuItemId, setMenuItemId] = useState("");
  const [status, setStatus] = useState("active");

  const fetchReels = async () => {
    try {
      setIsLoading(true);
      const res = await reelsService.getOwnReels();
      // Depending on API response structure
      const data = Array.isArray(res) ? res : (res as any)?.data || [];
      setReels(data);
    } catch (err) {
      console.error("Failed to fetch reels:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, []);

  const handleOpenModal = (reel?: Reel) => {
    if (reel) {
      setEditingReelId(reel.id);
      setVideoUrl(reel.videoUrl || "");
      setThumbnailUrl(reel.thumbnailUrl || "");
      setCaption(reel.caption || "");
      setMenuItemId(reel.menuItemId || "");
      setStatus(reel.status || "active");
    } else {
      setEditingReelId(null);
      setVideoUrl("");
      setThumbnailUrl("");
      setCaption("");
      setMenuItemId("");
      setStatus("active");
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl || !caption || !menuItemId) {
      alert("Video URL, Caption, and Menu Item ID are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingReelId) {
        await reelsService.updateOwnReel(editingReelId, {
          videoUrl,
          thumbnailUrl,
          caption,
          menuItemId,
          status,
        });
      } else {
        await reelsService.createOwnReel({
          videoUrl,
          thumbnailUrl,
          caption,
          menuItemId,
        });
      }
      setIsModalOpen(false);
      fetchReels();
    } catch (err: any) {
      console.error("Failed to save reel:", err);
      alert(err.message || "Failed to save reel");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reel?")) return;
    try {
      await reelsService.deleteOwnReel(id);
      setReels((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error("Failed to delete reel:", err);
      alert("Failed to delete reel");
    }
  };

  if (isLoading && reels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Loading reels...</p>
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
              My Reels
            </h2>
            <p className="text-xs text-zinc-500">
              Manage your promotional vertical videos.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="text-xs font-bold px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Reel
        </button>
      </div>

      {/* Grid */}
      {reels.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <Video className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            No reels yet
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Create your first promotional video to engage customers!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {reels.map((reel) => (
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
                
                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full backdrop-blur-md ${
                      reel.status === "active"
                        ? "bg-emerald-500/80 text-white"
                        : "bg-zinc-900/80 text-white"
                    }`}
                  >
                    {reel.status}
                  </span>
                </div>

                {/* Actions Overlay */}
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenModal(reel)}
                    className="p-1.5 bg-white/90 dark:bg-zinc-900/90 hover:bg-orange-500 hover:text-white rounded-lg shadow-sm backdrop-blur-md transition-colors text-zinc-700 dark:text-zinc-300"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(reel.id)}
                    className="p-1.5 bg-white/90 dark:bg-zinc-900/90 hover:bg-red-500 hover:text-white rounded-lg shadow-sm backdrop-blur-md transition-colors text-zinc-700 dark:text-zinc-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stats Overlay at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
                  <p className="text-white text-xs font-bold line-clamp-2 leading-tight drop-shadow-md mb-2">
                    {reel.caption}
                  </p>
                  <div className="flex items-center gap-3 text-white">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{(reel as any).viewCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{(reel as any).likeCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span className="text-[10px] font-semibold">{(reel as any).commentCount || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {editingReelId ? "Edit Reel" : "Create New Reel"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
                  placeholder="Describe your reel..."
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

              {editingReelId && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              )}

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
                  ) : editingReelId ? (
                    "Save Changes"
                  ) : (
                    "Create Reel"
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
