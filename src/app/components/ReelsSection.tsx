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
import { reelsService, ReelComment } from "../../services/reels";
import { restaurantsService } from "../../services/restaurants";
import { menuService } from "../../services/menu";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import { statusLabel } from "./ui/StatusPill";
import { formatDateTime, searchable } from "../../lib/format";

import { useI18n } from "../../lib/i18n";
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
  const { t } = useI18n();
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
      aria-label={
        caption ? t("reels.play_aria", { caption }) : t("reels.play_plain")
      }
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
          alt={caption || t("reels.thumbnail_alt")}
          onError={() => setThumbFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="w-full h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
          <VideoOff className="w-8 h-8 mb-2 opacity-60" />
          <span className="text-[10px] uppercase font-bold">
            {videoUrl ? t("reels.video_unavailable") : t("reels.no_media")}
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
  const { t } = useI18n();
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

  /*
   * Comment moderation. `GET /api/v1/reels/{id}/comments` and
   * `DELETE /api/v1/reels/comments/{commentId}` were never wired up, so the
   * only lever a moderator had against an abusive comment was deleting the
   * whole reel underneath it.
   */
  const [commentsForReel, setCommentsForReel] = useState<any>(null);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );

  const openComments = async (reel: any) => {
    setCommentsForReel(reel);
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      setComments(await reelsService.getComments(reel.id));
    } catch (err: any) {
      setCommentsError(err?.message || t("reels.comments_failed"));
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleDeleteComment = async (comment: ReelComment) => {
    const ok = await confirm({
      title: t("reels.delete_comment_title"),
      description: t("reels.delete_comment_body"),
      confirmLabel: t("reels.delete_comment_cta"),
      variant: "danger",
    });
    if (!ok) return;

    setDeletingCommentId(comment.id);
    try {
      await reelsService.deleteComment(comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      toast.success(t("reels.comment_deleted"));
    } catch (err: any) {
      toast.error(err?.message || t("reels.comment_delete_failed"));
    } finally {
      setDeletingCommentId(null);
    }
  };

  const fetchAllReels = async () => {
    try {
      setIsLoading(true);
      /*
       * `GET /api/v1/reels/admin/restaurants` — every merchant with its reels.
       *
       * The queue used to read `/reels/explore`, which is the customer feed:
       * engagement-ranked and **active only**. A hidden reel was therefore
       * invisible to the moderator who hid it, so it could never be reviewed
       * or published again from this screen.
       */
      const res = await reelsService.getRestaurantsWithReels({ limit: 100 });
      const flattened = res.data.flatMap((restaurant) =>
        (restaurant.reels ?? []).map((reel) => ({
          ...reel,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            logo: restaurant.logo,
          },
        })),
      );
      flattened.sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      );
      setReels(flattened);
      setError(null);
    } catch (err: any) {
      // Leaving this as `[]` rendered the "No reels found" empty state, so an
      // outage was indistinguishable from a genuinely empty platform.
      console.error("Failed to fetch all reels:", err);
      setError(err?.message || t("reels.load_failed"));
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
      .getAllRestaurants()
      .then((list) =>
        setRestaurantOptions(
          list
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
      errors.restaurantId = t("reels.invalid_restaurant");
    if (!UUID_RE.test(menuItemId.trim()))
      errors.menuItemId = t("reels.invalid_item");
    if (!videoUrl.trim()) errors.videoUrl = t("reels.video_required");
    if (!caption.trim()) errors.caption = t("reels.caption_required");

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(t("reels.fix_fields"));
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
      toast.success(t("reels.created"));
      fetchAllReels();
    } catch (err: any) {
      console.error("Failed to create reel:", err);
      toast.error(err?.message || t("reels.create_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (reel: any) => {
    const newStatus = reel.status === "active" ? "hidden" : "active";
    const hiding = newStatus === "hidden";
    const label = reel.caption?.trim() || t("reels.this_reel");

    const ok = await confirm({
      title: hiding ? t("reels.hide_title") : t("reels.publish_title"),
      description: hiding
        ? t("reels.hide_body", { label })
        : t("reels.publish_body", { label }),
      confirmLabel: hiding ? t("reels.hide_cta") : t("reels.publish_cta"),
      variant: hiding ? "danger" : "default",
    });
    if (!ok) return;

    try {
      setPendingId(reel.id);
      await reelsService.setReelStatusAsAdmin(reel.id, newStatus);
      setReels((prev) =>
        prev.map((r) => (r.id === reel.id ? { ...r, status: newStatus } : r)),
      );
      toast.success(
        hiding ? t("reels.hidden_toast") : t("reels.published_toast"),
      );
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast.error(err?.message || t("reels.status_failed"));
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (reel: any) => {
    const label = reel.caption?.trim() || t("reels.this_reel");
    const ok = await confirm({
      title: t("reels.delete_title"),
      description: t("reels.delete_body", { label }),
      confirmLabel: t("common.delete"),
      variant: "danger",
    });
    if (!ok) return;

    try {
      setPendingId(reel.id);
      await reelsService.deleteReelAsAdmin(reel.id);
      setReels((prev) => prev.filter((r) => r.id !== reel.id));
      toast.success(t("reels.deleted_toast"));
    } catch (err: any) {
      console.error("Failed to delete reel:", err);
      toast.error(err?.message || t("reels.delete_failed"));
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
              {t("reels.title")}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("reels.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              aria-label={t("reels.search_aria")}
              placeholder={t("reels.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl ps-9 pe-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-zinc-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-bold px-3 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg transition-all shadow-sm shrink-0"
          >
            {t("reels.create_admin")}
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
            title={query ? t("reels.no_match") : t("reels.none_title")}
            hint={
              query
                ? t("reels.no_match_hint")
                : t("reels.none_hint")
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
                  <div className="absolute top-3 end-3 max-w-[60%] z-10 pointer-events-none">
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
                        {reel.restaurant?.name || t("reels.unknown_store")}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 start-3 z-10 pointer-events-none">
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
                  <div className="absolute bottom-0 start-0 end-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 pointer-events-none">
                    <p className="text-white text-xs font-bold line-clamp-2 leading-tight drop-shadow-md mb-2">
                      {reel.caption || t("reels.untitled")}
                    </p>
                    <div className="flex items-center gap-3 text-white">
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        <span className="text-[10px] font-semibold">{reel.viewsCount ?? reel.viewCount ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-3 h-3" aria-hidden="true" />
                        <span className="text-[10px] font-semibold">{reel.likesCount ?? reel.likeCount ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" aria-hidden="true" />
                        <span className="text-[10px] font-semibold">{reel.commentsCount ?? reel.commentCount ?? 0}</span>
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
                    <span className="truncate">
                      {isActive ? t("reels.hide") : t("reels.publish")}
                    </span>
                  </button>
                  <button
                    onClick={() => openComments(reel)}
                    disabled={isBusy}
                    aria-label={t("reels.moderate_comments", {
                      label: reel.caption || t("reels.this_reel"),
                    })}
                    className="px-3 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                    {reel.commentsCount ?? reel.commentCount ?? 0}
                  </button>
                  <button
                    onClick={() => handleDelete(reel)}
                    disabled={isBusy}
                    aria-label={t("reels.delete_reel_aria", {
                      label: reel.caption || t("reels.this_reel"),
                    })}
                    className="px-3 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comment moderation */}
      <Modal
        isOpen={!!commentsForReel}
        onClose={() => setCommentsForReel(null)}
        title={t("reels.comments")}
        description={
          commentsForReel?.caption ||
          commentsForReel?.restaurant?.name ||
          undefined
        }
        maxWidth="max-w-lg"
      >
        {commentsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : commentsError ? (
          <ErrorState
            message={commentsError}
            onRetry={() => commentsForReel && openComments(commentsForReel)}
          />
        ) : comments.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t("reels.no_comments")}
            hint={t("reels.no_comments_hint")}
          />
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pe-1">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-start justify-between gap-3 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                    {comment.customerName ||
                      comment.customer?.fullName ||
                      comment.customer?.nickname ||
t("reels.anonymous")}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 break-words">
                    {comment.comment ?? comment.content ?? comment.text ?? ""}
                  </p>
                  {comment.createdAt && (
                    <p className="text-[10px] text-zinc-400 mt-1.5">
                      {formatDateTime(comment.createdAt)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteComment(comment)}
                  disabled={deletingCommentId === comment.id}
                  aria-label={t("reels.delete_comment_aria")}
                  className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-50"
                >
                  {deletingCommentId === comment.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Full player — the moderator has to be able to actually watch the reel
          before deciding to hide or delete it. */}
      <Modal
        isOpen={!!previewReel}
        onClose={() => setPreviewReel(null)}
        title={previewReel?.restaurant?.name || t("reels.preview_title")}
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
            {t("reels.no_video")}
          </p>
        )}
      </Modal>

      {/* Admin Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("reels.modal_title")}
        description={t("reels.modal_desc")}
        maxWidth="max-w-md"
        dismissable={false}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="admin-create-reel"
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? t("common.creating") : t("reels.create_admin")}
            </button>
          </>
        }
      >
        <form id="admin-create-reel" onSubmit={handleCreateForRestaurant} className="space-y-4">
          <div>
            <label htmlFor="reel-restaurant" className={LABEL_CLASS}>
              {t("reels.f_restaurant")}
            </label>
            {restaurantOptions.length > 0 ? (
              <select
                id="reel-restaurant"
                required
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">{t("reels.select_restaurant")}</option>
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
                placeholder={t("reels.paste_restaurant")}
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
              {t("reels.f_video")}
            </label>
            <input
              id="reel-video-url"
              type="url"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={t("reels.video_placeholder")}
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
                    ? t("reels.preview_failed")
                    : t("reels.preview_live")}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="reel-thumbnail-url" className={LABEL_CLASS}>
              {t("reels.f_thumb")}
            </label>
            <input
              id="reel-thumbnail-url"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder={t("reels.thumb_placeholder")}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="reel-caption" className={LABEL_CLASS}>
              {t("reels.f_caption")}
            </label>
            <textarea
              id="reel-caption"
              required
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("reels.caption_placeholder")}
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
              {t("reels.f_item")}
            </label>
            {menuItemOptions.length > 0 ? (
              <select
                id="reel-menu-item"
                required
                value={menuItemId}
                onChange={(e) => setMenuItemId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">{t("reels.select_item")}</option>
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
                placeholder={t("reels.paste_item")}
                aria-invalid={!!fieldErrors.menuItemId}
                aria-describedby={fieldErrors.menuItemId ? "reel-menu-item-error" : undefined}
                className={FIELD_CLASS}
              />
            )}
            {isLoadingMenuItems && (
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> {t("reels.loading_menu")}
              </p>
            )}
            {!isLoadingMenuItems &&
              menuItemOptions.length === 0 &&
              UUID_RE.test(restaurantId) && (
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1.5">
                  {t("reels.no_items_found")}
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
