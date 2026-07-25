"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Video,
  VideoOff,
  Eye,
  Heart,
  MessageSquare,
  Play,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { reelsService, Reel } from "../../services/reels";
import { restaurantsService } from "../../services/restaurants";
import { menuService } from "../../services/menu";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import { statusLabel } from "./ui/StatusPill";

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
 * Renders the actual video instead of only `thumbnailUrl`. `preload="metadata"`
 * gives a real first frame when no thumbnail was uploaded, hover/focus plays a
 * muted preview, and clicking opens the full player.
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

export default function RestaurantReelsSection() {
  const confirm = useConfirm();

  const [reels, setReels] = useState<Reel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [previewReel, setPreviewReel] = useState<Reel | null>(null);

  // Form State
  const [editingReelId, setEditingReelId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [menuItemId, setMenuItemId] = useState("");
  const [status, setStatus] = useState("active");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Menu item picker — beats hand-pasting a raw UUID.
  const [menuItemOptions, setMenuItemOptions] = useState<MenuItemOption[]>([]);
  const [isLoadingMenuItems, setIsLoadingMenuItems] = useState(false);

  // Debounced so the browser doesn't request a new video on every keystroke.
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);

  const fetchReels = async () => {
    try {
      setIsLoading(true);
      const res = await reelsService.getOwnReels();
      // Depending on API response structure
      const data = Array.isArray(res) ? res : (res as any)?.data || [];
      setReels(data);
      setError(null);
    } catch (err: any) {
      // Leaving this as `[]` rendered the "No reels yet" empty state, so an
      // outage looked exactly like having published nothing.
      console.error("Failed to fetch reels:", err);
      setError(err?.message || "Couldn't load your reels.");
      setReels([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, []);

  useEffect(() => {
    if (!isModalOpen || menuItemOptions.length > 0) return;

    let cancelled = false;
    setIsLoadingMenuItems(true);
    (async () => {
      try {
        const restaurant = await restaurantsService.getMyRestaurant();
        const sections = await menuService.getSectionsByRestaurant(restaurant.id);
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
        // Fall back to the raw UUID field rather than blocking the form.
        if (!cancelled) setMenuItemOptions([]);
      } finally {
        if (!cancelled) setIsLoadingMenuItems(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isModalOpen, menuItemOptions.length]);

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

  const handleOpenModal = (reel?: Reel) => {
    setFieldErrors({});
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

    const errors: Record<string, string> = {};
    if (!videoUrl.trim()) errors.videoUrl = "A video URL is required.";
    if (!caption.trim()) errors.caption = "A caption is required.";
    if (!UUID_RE.test(menuItemId.trim()))
      errors.menuItemId = "Select a menu item, or paste a valid menu item UUID.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingReelId) {
        await reelsService.updateOwnReel(editingReelId, {
          videoUrl: videoUrl.trim(),
          thumbnailUrl: thumbnailUrl.trim(),
          caption: caption.trim(),
          menuItemId: menuItemId.trim(),
          status,
        });
      } else {
        await reelsService.createOwnReel({
          videoUrl: videoUrl.trim(),
          thumbnailUrl: thumbnailUrl.trim(),
          caption: caption.trim(),
          menuItemId: menuItemId.trim(),
        });
      }
      setIsModalOpen(false);
      toast.success(editingReelId ? "Reel updated." : "Reel created.");
      fetchReels();
    } catch (err: any) {
      console.error("Failed to save reel:", err);
      toast.error(err?.message || "Failed to save reel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (reel: Reel) => {
    const label = reel.caption?.trim() || "this reel";
    const ok = await confirm({
      title: "Delete this reel?",
      description: `“${label}” will be permanently removed, along with its views, likes and comments. This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      setPendingId(reel.id);
      await reelsService.deleteOwnReel(reel.id);
      setReels((prev) => prev.filter((r) => r.id !== reel.id));
      toast.success("Reel deleted.");
    } catch (err: any) {
      console.error("Failed to delete reel:", err);
      toast.error(err?.message || "Failed to delete reel.");
    } finally {
      setPendingId(null);
    }
  };

  const gridClass =
    "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6";
  const panelClass =
    "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header — stays mounted while loading so the Add Reel button never
          disappears mid-refetch. */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <Sparkles className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              My Reels
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage your promotional vertical videos.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="text-xs font-bold px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add Reel
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${panelClass} overflow-hidden`}>
              <Skeleton className="w-full aspect-[9/16] rounded-none" />
              <div className="p-3 flex items-center gap-2">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={panelClass}>
          <ErrorState message={error} onRetry={fetchReels} />
        </div>
      ) : reels.length === 0 ? (
        <div className={panelClass}>
          <EmptyState
            icon={Video}
            title="No reels yet"
            hint="Create your first promotional video to engage customers."
            action={
              <button
                onClick={() => handleOpenModal()}
                className="text-xs font-bold px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> Add Reel
              </button>
            }
          />
        </div>
      ) : (
        <div className={gridClass}>
          {reels.map((reel) => {
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

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3 z-10 pointer-events-none">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full backdrop-blur-md ${
                        reel.status === "active"
                          ? "bg-emerald-500/80 text-white"
                          : "bg-zinc-900/80 text-white"
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
                        <span className="text-[10px] font-semibold">{(reel as any).viewCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-3 h-3" aria-hidden="true" />
                        <span className="text-[10px] font-semibold">{(reel as any).likeCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" aria-hidden="true" />
                        <span className="text-[10px] font-semibold">{(reel as any).commentCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions — a persistent row. As a hover-only overlay these
                    were permanently invisible on touch and unreachable by
                    keyboard, which made the section read-only. */}
                <div className="p-3 flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => handleOpenModal(reel)}
                    disabled={isBusy}
                    aria-label={`Edit reel${reel.caption ? `: ${reel.caption}` : ""}`}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(reel)}
                    disabled={isBusy}
                    aria-label={`Delete reel${reel.caption ? `: ${reel.caption}` : ""}`}
                    className="p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white dark:text-red-400 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full player */}
      <Modal
        isOpen={!!previewReel}
        onClose={() => setPreviewReel(null)}
        title="Reel preview"
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReelId ? "Edit Reel" : "Create New Reel"}
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
              form="own-reel-form"
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting
                ? "Saving…"
                : editingReelId
                  ? "Save Changes"
                  : "Create Reel"}
            </button>
          </>
        }
      >
        <form id="own-reel-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="own-reel-video-url" className={LABEL_CLASS}>
              Video URL (MP4) *
            </label>
            <input
              id="own-reel-video-url"
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
            {/* There is no upload endpoint, so the URL has to be pasted — at
                least show what was pasted before it's submitted. */}
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
            <label htmlFor="own-reel-thumbnail-url" className={LABEL_CLASS}>
              Thumbnail URL (Optional)
            </label>
            <input
              id="own-reel-thumbnail-url"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://cdn.example.com/thumb.jpg"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="own-reel-caption" className={LABEL_CLASS}>
              Caption *
            </label>
            <textarea
              id="own-reel-caption"
              required
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe your reel..."
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
            <label htmlFor="own-reel-menu-item" className={LABEL_CLASS}>
              Menu Item *
            </label>
            {menuItemOptions.length > 0 ? (
              <select
                id="own-reel-menu-item"
                required
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Select a menu item…</option>
                {/* Keep an existing reel's item selectable even if it is no
                    longer in the live menu, so editing doesn't silently blank it. */}
                {menuItemId && !menuItemOptions.some((i) => i.id === menuItemId) && (
                  <option value={menuItemId}>
                    Current item ({menuItemId.slice(0, 8)}…)
                  </option>
                )}
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
                id="own-reel-menu-item"
                type="text"
                required
                pattern={UUID_PATTERN}
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                placeholder="Paste UUID of the menu item"
                aria-invalid={!!fieldErrors.menuItemId}
                aria-describedby={fieldErrors.menuItemId ? "own-reel-menu-item-error" : undefined}
                className={FIELD_CLASS}
              />
            )}
            {isLoadingMenuItems && (
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading your menu…
              </p>
            )}
            {fieldErrors.menuItemId && (
              <p id="own-reel-menu-item-error" className="text-[11px] font-semibold text-red-500 mt-1.5">
                {fieldErrors.menuItemId}
              </p>
            )}
          </div>

          {editingReelId && (
            <div>
              <label htmlFor="own-reel-status" className={LABEL_CLASS}>
                Status
              </label>
              <select
                id="own-reel-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`${FIELD_CLASS} appearance-none`}
              >
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
