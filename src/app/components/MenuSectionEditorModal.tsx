"use client";

import React, { useState, useEffect, useId } from "react";
import { Loader2, FolderPlus, Edit } from "lucide-react";
import toast from "react-hot-toast";
import { menuService, MenuSection } from "../../services/menu";
import Modal from "./ui/Modal";

import { useI18n } from "../../lib/i18n";
interface MenuSectionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: MenuSection | null;
  restaurantId: string;
  onSuccess: () => void;
}

export default function MenuSectionEditorModal({
  isOpen,
  onClose,
  section,
  restaurantId,
  onSuccess,
}: MenuSectionEditorModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guards Escape / backdrop-click from discarding typing.
  const [isDirty, setIsDirty] = useState(false);

  const fieldId = useId();

  useEffect(() => {
    if (section) {
      setName(section.name);
      setDescription(section.description || "");
      setIsActive(section.isActive ?? true);
    } else {
      setName("");
      setDescription("");
      setIsActive(true);
    }
    setIsDirty(false);
  }, [section, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("menu.sec_name_required"));
      return;
    }

    setIsSubmitting(true);

    try {
      if (section) {
        await menuService.updateSection(section.id, {
          name,
          description,
          isActive,
        });
      } else {
        await menuService.createSection({
          restaurantId,
          name,
          description,
          sortOrder: 0,
          isActive,
        });
      }
      toast.success(t("menu.sec_saved"));
      setIsDirty(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || t("menu.sec_save_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissable={!isDirty && !isSubmitting}
      maxWidth="max-w-md"
      title={section ? t("menu.sec_edit") : t("menu.sec_add")}
      description={t("menu.sec_desc")}
      icon={
        <span className="p-2 bg-orange-500/10 text-orange-500 rounded-xl shrink-0">
          {section ? <Edit className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
        </span>
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold text-xs rounded-xl transition-all"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form="menu-section-form"
            disabled={isSubmitting}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-orange-500/10 transition-all flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {section ? t("common.save_changes") : t("menu.sec_create")}
          </button>
        </>
      }
    >
      <form
        id="menu-section-form"
        onSubmit={handleSubmit}
        onChange={() => setIsDirty(true)}
        className="space-y-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
      >
        <div className="space-y-1.5">
          <label
            htmlFor={`${fieldId}-name`}
            className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block"
          >
            {t("menu.sec_name_req")}
          </label>
          <input
            id={`${fieldId}-name`}
            type="text"
            required
            placeholder={t("menu.sec_name_placeholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`${fieldId}-description`}
            className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block"
          >
            {t("menu.sec_desc_opt")}
          </label>
          <textarea
            id={`${fieldId}-description`}
            placeholder={t("menu.sec_desc_placeholder")}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200 resize-none font-sans"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id={`${fieldId}-active`}
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
          />
          <label htmlFor={`${fieldId}-active`} className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            {t("menu.sec_active")}
          </label>
        </div>
      </form>
    </Modal>
  );
}
