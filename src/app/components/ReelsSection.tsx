"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Trash2,
  Video,
  VideoOff,
  Eye,
  EyeOff,
  Heart,
  MessageSquare,
  Search,
  Play,
  Loader2,
  Store,
} from "lucide-react";
import toast from "react-hot-toast";
import { reelsService } from "../../services/reels";
import { restaurantsService } from "../../services/restaurants";
import { menuService } from "../../services/menu";
import { apiClient } from "../../services/apiClient";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import { statusLabel } from "./ui/StatusPill";
import { searchable } from "../../lib/format";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const FIELD_CLASS =
  "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50";
const LABEL_CLASS =
  "block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5";

interface MenuItemOption {
  id: string;
  name: string;
  section: string;
}

/**
 * The moderation card used to render only `thumbnailUrl`, so an admin was asked
 * to hide or delete content they could not actually watch — and with no
 * thumbnail they got a "No Thumbnail" placeholder and zero signal. This renders
 * the real video: `preload="metadata"` yields a first frame even when the
 * thumbnail is missing, hover/focus scrubs a muted preview, and clicking opens
 * the full player.
 */
function ReelMedia({
  videoUrl,
  thumbnailUrl,
  caption,
  onOpen,
}: {
  videoUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const startPreview = () => {
    videoRef.current?.play().catch(() => {
      /* hover preview is best-effort */
    });
  };
  const stopPreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  const showVideo = !!videoUrl && !videoFailed;
  const showThumb = !showVideo && !!thumbnailUrl && !thumbFailed;

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      aria-label={caption ? `Play reel: ${caption}` : "Play reel"}
      className="absolute inset-0 w-full h-full group/media cursor-pointer"
    >
      {showVideo ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : showThumb ? (
        <img
          src={thumbnailUrl}
          alt={caption || "Reel thumbnail"}
          onError={() => setThumbFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="w-full h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
          <VideoOff className="w-8 h-8 mb-2 opacity-60" />
          <span className="text-[10px] uppercase font-bold">
            {videoUrl ? "Video unavailable" : "No media"}
          </span>
        </span>
      )}

      <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover/media:opacity-100 group-focus/media:opacity-100 transition-opacity">
        <span className="bg-white/90 text-zinc-900 rounded-full p-2.5 shadow-lg flex">
          <Play className="w-4 h-4 fill-current" />
        </span>
      </span>
    </button>
  );
}

export default function ReelsSection() {
  const confirm = useConfirm();

  const [reels, setReels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [previewReel, setPreviewReel] = useState<any | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [menuItemId, setMenuItemId] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Pickers — so the operator no longer has to hand-paste raw UUIDs.
  const [restaurantOptions, setRestaurantOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [menuItemOptions, setMenuItemOptions] = useState<MenuItemOption[]>([]);
  const [isLoadingMenuItems, setIsLoadingMenuItems] = useState(false);

  // Debounced so the browser doesn't fire a request on every keystroke.
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);

  const fetchAllReels = async () => {
    try {
      setIsLoading(true);
      // Assuming GET /api/v1/reels/explore returns reels across the platform,
      // or we use a specific admin endpoint. Using explore for now to list them.
      const res = await apiClient<any>("/api/v1/reels/explore?limit=100", { method: "GET" });
      const data = Array.isArray(res) ? res : res?.data || [];
      setReels(data);
      setError(null);
    } catch (err: any) {
      // Leaving this as `[]` rendered the "No reels found" empty state, so an
      // outage was indistinguishable from a genuinely empty platform.
      console.error("Failed to fetch all reels:", err);
      setError(err?.message || "Couldn't load platform reels.");
      setReels([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReels();
  }, []);

  useEffect(() => {
    if (!isModalOpen || restaurantOptions.length > 0) return;
    restaurantsService
      .getRestaurants()
      .then((list) =>
        setRestaurantOptions(
          (list || [])
            .map((r) => ({ id: r.id, name: r.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
      // Falling back to the raw UUID field is better than blocking the form.
      .catch(() => setRestaurantOptions([]));
  }, [isModalOpen, restaurantOptions.length]);

  useEffect(() => {
    setMenuItemId("");
    if (!isModalOpen || !UUID_RE.test(restaurantId)) {
      setMenuItemOptions([]);
      return;
    }

    let cancelled = false;
    setIsLoadingMenuItems(true);
    (async () => {
      try {
        const sections = await menuService.getSectionsByRestaurant(restaurantId);
        const grouped = await Promise.all(
          (sections || []).map(async (section) => {
            const items = await menuService
              .getItemsBySection(section.id)
              .catch(() => []);
            return (items || []).map((item) => ({
              id: item.id,
              name: item.name,
              section: section.name,
            }));
          }),
        );
        if (!cancelled) setMenuItemOptions(grouped.flat());
      } catch {
        if (!cancelled) setMenuItemOptions([]);
      } finally {
        if (!cancelled) setIsLoadingMenuItems(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, isModalOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setPreviewUrl(videoUrl.trim()), 500);
    return () => clearTimeout(timer);
  }, [videoUrl]);

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewUrl]);

  const menuItemsBySection = useMemo(() => {
    const map = new Map<string, MenuItemOption[]>();
    menuItemOptions.forEach((item) => {
      const bucket = map.get(item.section) ?? [];
      bucket.push(item);
      map.set(item.section, bucket);
    });
    return Array.from(map.entries());
  }, [menuItemOptions]);

  const resetForm = () => {
    setVideoUrl("");
    setThumbnailUrl("");
    setCaption("");
    setMenuItemId("");
    setRestaurantId("");
    setFieldErrors({});
  };

  const handleCreateForRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!UUID_RE.test(restaurantId.trim()))
      errors.restaurantId = "Enter a valid restaurant UUID.";
    if (!UUID_RE.test(menuItemId.trim()))
      errors.menuItemId = "Enter a valid menu item UUID.";
    if (!videoUrl.trim()) errors.videoUrl = "A video URL is required.";
    if (!caption.trim()) errors.caption = "A caption is required.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      await reelsService.createReelForRestaurant(restaurantId.trim(), {
        videoUrl: videoUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        caption: caption.trim(),
        menuItemId: menuItemId.trim(),
      });
      setIsModalOpen(false);
      resetForm();
      toast.success("Reel created.");
      fetchAllReels();
    } catch (err: any) {
      console.error("Failed to create reel:", err);
      toast.error(err?.message || "Failed to create reel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (reel: any) => {
    const newStatus = reel.status === "active" ? "hidden" : "active";
    const hiding = newStatus === "hidden";
    const label = reel.caption?.trim() || "this reel";

    const ok = await confirm({
      title: hiding ? "Hide this reel?" : "Publish this reel?",
      description: hiding
        ? `“${label}” will stop appearing in the customer feed. You can publish it again at any time.`
        : `“${label}” will appear in the customer feed again.`,
      confirmLabel: hiding ? "Hide reel" : "Publish reel",
      variant: hiding ? "danger" : "default",
    });
    if (!ok) return;

    try {
      setPendingId(reel.id);
      await reelsService.setReelStatusAsAdmin(reel.id, newStatus);
      setReels((prev) =>
        prev.map((r) => (r.id === reel.id ? { ...r, status: newStatus } : r)),
      );
      toast.success(hiding ? "Reel hidden." : "Reel published.");
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast.error(err?.message || "Failed to update the reel status.");
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (reel: any) => {
    const label = reel.caption?.trim() || "this reel";
    const ok = await confirm({
      title: "Delete this reel?",
      description: `“${label}” will be permanently removed from the platform along with its views, likes and comments. This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      setPendingId(reel.id);
      await reelsService.deleteReelAsAdmin(reel.id);
      setReels((prev) => prev.filter((r) => r.id !== reel.id));
      toast.success("Reel deleted.");
    } catch (err: any) {
      console.error("Failed to delete reel:", err);
      toast.error(err?.message || "Failed to delete reel.");
    } finally {
      setPendingId(null);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredReels = query
    ? reels.filter(
        (r) =>
          // `searchable` tolerates missing/non-string fields — `r.id.includes()`
          // threw and blanked the grid for any record without an id.
          searchable(r?.caption).includes(query) ||
          searchable(r?.restaurant?.name).includes(query) ||
          searchable(r?.id).includes(query),
      )
    : reels;

  const gridClass =
    "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6";
  const panelClass =
    "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header — stays mounted while loading so the search query and the
          Create button aren't ripped out from under the operator. */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <Sparkles className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Platform Reels Moderation
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage and moderate all reels across restaurants.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              aria-label="Search reels"
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
      {isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${panelClass} overflow-hidden`}>
              <Skeleton className="w-full aspect-[9/16] rounded-none" />
              <div className="p-3 flex items-center gap-2">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={panelClass}>
          <ErrorState message={error} onRetry={fetchAllReels} />
        </div>
      ) : filteredReels.length === 0 ? (
        <div className={panelClass}>
          <EmptyState
            icon={Video}
            title={query ? "No reels match your search" : "No reels yet"}
            hint={
              query
                ? "Try a different caption, restaurant name or reel ID."
                : "Reels published by restaurants will show up here for moderation."
            }
          />
        </div>
      ) : (
        <div className={gridClass}>
          {filteredReels.map((reel) => {
            const isActive = reel.status === "active";
            const isBusy = pendingId === reel.id;

            return (
              <div
                key={reel.id}
                className={`${panelClass} overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col`}
              >
                {/* Media Area */}
                <div className="aspect-[9/16] bg-zinc-100 dark:bg-zinc-800 relative">
                  <ReelMedia
                    videoUrl={reel.videoUrl}
                    thumbnailUrl={reel.thumbnailUrl}
                    caption={reel.caption}
                    onOpen={() => setPreviewReel(reel)}
                  />

                  {/* Store Badge */}
                  <div className="absolute top-3 right-3 max-w-[60%] z-10 pointer-events-none">
                    <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-2 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm truncate">
                      {reel.restaurant?.logo ? (
                        <img
                          src={reel.restaurant.logo}
                          alt=""
                          className="w-4 h-4 rounded-full shrink-0 object-cover"
                        />
                      ) : (
                        <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      )}
                      <span className="text-[9px] font-bold text-zinc-900 dark:text-white truncate">
                        {reel.restaurant?.name || "Unknown Store"}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3 z-10 pointer-events-none">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full backdrop-blur-md ${
                        isActive
                          ? "bg-emerald-500/80 text-white"
                          : "bg-red-500/80 text-white"
                      }`}
                    >
                      {statusLabel(reel.status)}
                    </span>
                  </div>

                  {/* Stats Overlay at Bottom */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 pointer-events-none">
                    <p className="text-white text-xs font-bold line-clamp-2 leading-tight drop-shadow-md mb-2">
                      {reel.caption || "Untitled reel"}
                    </p>
                    <div className="flex items-center gap-3 text-white">
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        <span className="text-[10px] font-semibold">{reel.viewCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-3 h-3" aria-hidden="true" />
                        <span className="text-[10px] font-semibold">{reel.likeCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" aria-hidden="true" />
                        <span className="text-[10px] font-semibold">{reel.commentCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions — a persistent row, not a hover-only overlay. The
                    overlay was invisible and unreachable on touch and keyboard,
                    which made this whole moderation screen read-only. */}
                <div className="p-3 flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => handleToggleStatus(reel)}
                    disabled={isBusy}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isActive ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span className="truncate">{isActive ? "Hide" : "Publish"}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(reel)}
                    disabled={isBusy}
                    className="px-3 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full player — the moderator has to be able to actually watch the reel
          before deciding to hide or delete it. */}
      <Modal
        isOpen={!!previewReel}
        onClose={() => setPreviewReel(null)}
        title={previewReel?.restaurant?.name || "Reel preview"}
        description={previewReel?.caption || undefined}
        maxWidth="max-w-sm"
      >
        {previewReel?.videoUrl ? (
          <video
            key={previewReel.videoUrl}
            src={previewReel.videoUrl}
            poster={previewReel.thumbnailUrl || undefined}
            controls
            autoPlay
            playsInline
            className="w-full aspect-[9/16] bg-black rounded-xl object-contain"
          />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 text-center">
            This reel has no video URL attached.
          </p>
        )}
      </Modal>

      {/* Admin Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Reel for Restaurant"
        description="Publishes a reel on behalf of a restaurant."
        maxWidth="max-w-md"
        dismissable={false}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="admin-create-reel"
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Creating…" : "Create as Admin"}
            </button>
          </>
        }
      >
        <form id="admin-create-reel" onSubmit={handleCreateForRestaurant} className="space-y-4">
          <div>
            <label htmlFor="reel-restaurant" className={LABEL_CLASS}>
              Restaurant *
            </label>
            {restaurantOptions.length > 0 ? (
              <select
                id="reel-restaurant"
                required
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Select a restaurant…</option>
                {restaurantOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="reel-restaurant"
                type="text"
                required
                pattern={UUID_PATTERN}
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                placeholder="Paste UUID of the restaurant"
                aria-invalid={!!fieldErrors.restaurantId}
                aria-describedby={fieldErrors.restaurantId ? "reel-restaurant-error" : undefined}
                className={FIELD_CLASS}
              />
            )}
            {fieldErrors.restaurantId && (
              <p id="reel-restaurant-error" className="text-[11px] font-semibold text-red-500 mt-1.5">
                {fieldErrors.restaurantId}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reel-video-url" className={LABEL_CLASS}>
              Video URL (MP4) *
            </label>
            <input
              id="reel-video-url"
              type="url"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://cdn.example.com/video.mp4"
              aria-invalid={!!fieldErrors.videoUrl}
              className={FIELD_CLASS}
            />
            {fieldErrors.videoUrl && (
              <p className="text-[11px] font-semibold text-red-500 mt-1.5">
                {fieldErrors.videoUrl}
              </p>
            )}
            {/* There is no upload endpoint, so the operator has to paste a
                hosted URL — at least let them see what they pasted. */}
            {/^https?:\/\/\S+/i.test(previewUrl) && (
              <div className="mt-3 flex items-start gap-3">
                <video
                  key={previewUrl}
                  src={previewUrl}
                  poster={thumbnailUrl.trim() || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setPreviewFailed(true)}
                  onLoadedMetadata={() => setPreviewFailed(false)}
                  className="w-28 aspect-[9/16] shrink-0 bg-black rounded-xl object-contain"
                />
                <p
                  className={`text-[11px] font-medium leading-relaxed ${
                    previewFailed
                      ? "text-red-500"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {previewFailed
                    ? "This URL didn't load. Check the address and that the file is publicly reachable."
                    : "Live preview of the pasted URL."}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="reel-thumbnail-url" className={LABEL_CLASS}>
              Thumbnail URL (Optional)
            </label>
            <input
              id="reel-thumbnail-url"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://cdn.example.com/thumb.jpg"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="reel-caption" className={LABEL_CLASS}>
              Caption *
            </label>
            <textarea
              id="reel-caption"
              required
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe the reel..."
              aria-invalid={!!fieldErrors.caption}
              className={`${FIELD_CLASS} resize-none`}
            />
            {fieldErrors.caption && (
              <p className="text-[11px] font-semibold text-red-500 mt-1.5">
                {fieldErrors.caption}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reel-menu-item" className={LABEL_CLASS}>
              Menu Item *
            </label>
            {menuItemOptions.length > 0 ? (
              <select
                id="reel-menu-item"
                required
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Select a menu item…</option>
                {menuItemsBySection.map(([section, items]) => (
                  <optgroup key={section} label={section}>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <input
                id="reel-menu-item"
                type="text"
                required
                pattern={UUID_PATTERN}
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                placeholder="Paste UUID of the menu item"
                aria-invalid={!!fieldErrors.menuItemId}
                aria-describedby={fieldErrors.menuItemId ? "reel-menu-item-error" : undefined}
                className={FIELD_CLASS}
              />
            )}
            {isLoadingMenuItems && (
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading this restaurant&apos;s menu…
              </p>
            )}
            {!isLoadingMenuItems &&
              menuItemOptions.length === 0 &&
              UUID_RE.test(restaurantId) && (
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1.5">
                  No menu items found for this restaurant — paste the ID manually.
                </p>
              )}
            {fieldErrors.menuItemId && (
              <p id="reel-menu-item-error" className="text-[11px] font-semibold text-red-500 mt-1.5">
                {fieldErrors.menuItemId}
              </p>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
