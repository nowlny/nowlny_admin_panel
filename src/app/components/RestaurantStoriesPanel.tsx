"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Images, Plus, Trash2, Pencil, Loader2, Play } from "lucide-react";
import toast from "react-hot-toast";
import {
  restaurantsService,
  Story,
  StoryPayload,
} from "../../services/restaurants";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";

/**
 * Story management for a merchant.
 *
 * The panel could previously only *watch* stories through the viewer modal —
 * `POST/PATCH/DELETE /api/v1/restaurants/admin/{restaurantId}/stories` were
 * never wired up, so an admin who needed to pull an inappropriate story had to
 * ask the merchant to do it.
 */

interface RestaurantStoriesPanelProps {
  restaurantId: string;
  restaurantName: string;
}

const FIELD_CLASS =
  "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors";
const LABEL_CLASS =
  "block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5";

const EMPTY_FORM = { imageUrl: "", videoUrl: "", caption: "" };

export default function RestaurantStoriesPanel({
  restaurantId,
  restaurantName,
}: RestaurantStoriesPanelProps) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Story | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStories(await restaurantsService.getStories(restaurantId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("stories.load_failed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setIsCreating(true);
  };

  const openEdit = (story: Story) => {
    setForm({
      imageUrl: story.imageUrl ?? "",
      videoUrl: story.videoUrl ?? "",
      caption: story.caption ?? "",
    });
    setIsCreating(false);
    setEditing(story);
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl.trim() && !form.videoUrl.trim()) {
      toast.error(t("stories.needs_media"));
      return;
    }

    const payload: StoryPayload = {
      ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
      ...(form.videoUrl.trim() ? { videoUrl: form.videoUrl.trim() } : {}),
      ...(form.caption.trim() ? { caption: form.caption.trim() } : {}),
    };

    setIsSubmitting(true);
    try {
      if (editing) {
        await restaurantsService.updateStoryForRestaurant(
          restaurantId,
          editing.id,
          payload,
        );
        toast.success(t("stories.updated"));
      } else {
        await restaurantsService.createStoryForRestaurant(
          restaurantId,
          payload,
        );
        toast.success(t("stories.created"));
      }
      closeModal();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("stories.save_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (story: Story) => {
    const ok = await confirm({
      title: t("stories.delete_title"),
      description: t("stories.delete_body", { name: restaurantName }),
      confirmLabel: t("stories.delete_cta"),
      variant: "danger",
    });
    if (!ok) return;

    setDeletingId(story.id);
    try {
      await restaurantsService.deleteStoryForRestaurant(restaurantId, story.id);
      toast.success(t("stories.deleted"));
      setStories((prev) => prev.filter((s) => s.id !== story.id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("stories.delete_failed"),
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Images className="w-4 h-4 text-orange-500" />
            {t("stories.title")}
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            {t("stories.subtitle")}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="text-xs font-bold px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> {t("stories.add")}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : stories.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <EmptyState
            icon={Images}
            title={t("stories.empty_title")}
            hint={t("stories.empty_hint")}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stories.map((story) => (
            <div
              key={story.id}
              className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 group"
            >
              <div className="aspect-[9/16] relative">
                {story.videoUrl ? (
                  <>
                    <video
                      src={story.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      poster={story.imageUrl ?? undefined}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 start-2 bg-black/60 text-white rounded-full p-1.5">
                      <Play className="w-3 h-3" />
                    </span>
                  </>
                ) : story.imageUrl ? (
                  <img
                    src={story.imageUrl}
                    alt={story.caption ?? "Story"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-[10px] font-bold uppercase text-zinc-400">
                    {t("stories.no_media")}
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                  {story.caption && (
                    <p className="text-[11px] text-white font-semibold line-clamp-2">
                      {story.caption}
                    </p>
                  )}
                  <p className="text-[9px] text-white/70 mt-1">
                    {story.expiresAt
                      ? t("stories.expires", { date: formatDateTime(story.expiresAt) })
                      : formatDateTime(story.createdAt)}
                  </p>
                </div>
              </div>

              <div className="absolute top-2 end-2 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(story)}
                  aria-label={t("stories.edit_aria")}
                  className="p-2 rounded-lg bg-black/60 text-white hover:bg-blue-500 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(story)}
                  disabled={deletingId === story.id}
                  aria-label={t("stories.delete_aria")}
                  className="p-2 rounded-lg bg-black/60 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {deletingId === story.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreating || !!editing}
        onClose={closeModal}
        title={editing ? t("stories.edit_title") : t("stories.add_title")}
        description={restaurantName}
        maxWidth="max-w-md"
        dismissable={!isSubmitting}
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="story-form"
              disabled={isSubmitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? t("common.save_changes") : t("stories.publish")}
            </button>
          </>
        }
      >
        <form id="story-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="story-image" className={LABEL_CLASS}>
              {t("common.image_url")}
            </label>
            <input
              id="story-image"
              type="url"
              placeholder="https://"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="story-video" className={LABEL_CLASS}>
              {t("common.video_url")}
            </label>
            <input
              id="story-video"
              type="url"
              placeholder="https://"
              value={form.videoUrl}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              className={FIELD_CLASS}
            />
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5">
              {t("stories.media_hint")}
            </p>
          </div>
          <div>
            <label htmlFor="story-caption" className={LABEL_CLASS}>
              {t("common.caption")}
            </label>
            <textarea
              id="story-caption"
              rows={2}
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              className={FIELD_CLASS}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
