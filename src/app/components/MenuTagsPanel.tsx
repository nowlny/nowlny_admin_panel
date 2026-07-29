"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Loader2, Tags } from "lucide-react";
import toast from "react-hot-toast";
import { menuService, MenuTag } from "../../services/menu";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import { useI18n } from "../../lib/i18n";

/**
 * Predefined menu-item tags — `/api/v1/menu/tags`.
 *
 * `POST/PATCH/DELETE` here are admin-only and had no surface in the panel at
 * all. Merchants pick tags from this list when editing an item (the item DTO
 * takes `tagIds`), so with nothing to pick from the tag field on every menu
 * item was permanently empty.
 */

const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500";
const labelClass =
  "block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5";

export default function MenuTagsPanel() {
  const { t } = useI18n();
  const confirm = useConfirm();

  const [tags, setTags] = useState<MenuTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuTag | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTags(await menuService.getTags());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tags.load_failed"));
      setTags([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = (tag?: MenuTag) => {
    setEditing(tag ?? null);
    setName(tag?.name ?? "");
    setIcon(tag?.icon ?? "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("tags.needs_name"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        ...(icon.trim() ? { icon: icon.trim() } : {}),
      };
      if (editing) {
        await menuService.updateTag(editing.id, payload);
        toast.success(t("tags.updated", { name: payload.name }));
      } else {
        await menuService.createTag(payload);
        toast.success(t("tags.created", { name: payload.name }));
      }
      closeModal();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("tags.save_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (tag: MenuTag) => {
    const ok = await confirm({
      title: t("tags.delete_title", { name: tag.name }),
      description: t("tags.delete_body"),
      confirmLabel: t("tags.delete_cta"),
      variant: "danger",
    });
    if (!ok) return;

    setDeletingId(tag.id);
    try {
      await menuService.deleteTag(tag.id);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
      toast.success(t("tags.deleted", { name: tag.name }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("tags.delete_failed"),
      );
    } finally {
      setDeletingId(null);
    }
  };

  const addButton = (
    <button
      onClick={() => openModal()}
      className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm"
    >
      <Plus className="w-4 h-4" /> {t("tags.add")}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Tags className="w-5 h-5 text-orange-500" /> {t("tags.title")}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
            {t("tags.subtitle")}
          </p>
        </div>
        {addButton}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : tags.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <EmptyState
            icon={Tags}
            title={t("tags.empty_title")}
            hint={t("tags.empty_hint")}
            action={addButton}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                  {tag.icon ? (
                    tag.icon.startsWith("http") ? (
                      <img
                        src={tag.icon}
                        alt=""
                        className="w-6 h-6 object-contain"
                      />
                    ) : (
                      <span className="text-lg">{tag.icon}</span>
                    )
                  ) : (
                    <Tags className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {tag.name}
                </p>
              </div>

              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => openModal(tag)}
                  disabled={deletingId === tag.id}
                  aria-label={`${t("common.edit")} ${tag.name}`}
                  className="p-2.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(tag)}
                  disabled={deletingId === tag.id}
                  aria-label={`${t("common.delete")} ${tag.name}`}
                  className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingId === tag.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
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
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editing ? t("tags.edit_title") : t("tags.add_title")}
        description={t("tags.modal_desc")}
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
              form="menu-tag-form"
              disabled={isSubmitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editing ? t("common.save_changes") : t("tags.create")}
            </button>
          </>
        }
      >
        <form id="menu-tag-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="menu-tag-name" className={labelClass}>
              {t("common.name")}
              <span aria-hidden="true" className="text-orange-500">
                {" "}
                *
              </span>
            </label>
            <input
              id="menu-tag-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("tags.name_placeholder")}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="menu-tag-icon" className={labelClass}>
              {t("tags.icon")}
            </label>
            <input
              id="menu-tag-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder={t("tags.icon_hint")}
              className={inputClass}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
