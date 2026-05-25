"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, FolderPlus, Edit } from "lucide-react";
import { menuService, MenuSection } from "../../services/menu";

interface MenuSectionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: MenuSection | null;
  onSuccess: () => void;
}

export default function MenuSectionEditorModal({
  isOpen,
  onClose,
  section,
  onSuccess,
}: MenuSectionEditorModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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
    setError("");
  }, [section, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      if (section) {
        await menuService.updateSection(section.id, {
          name,
          description,
          isActive,
        });
      } else {
        await menuService.createSection({
          name,
          description,
          sortOrder: 0,
          isActive,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
              {section ? <Edit className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
            </span>
            <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
              {section ? "Edit Category" : "Add New Category"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {error && (
            <div className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
              Category Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Starters, Main Course"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
              Description (Optional)
            </label>
            <textarea
              placeholder="A short description of this category..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-850 placeholder-zinc-400 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-200 resize-none font-sans"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
            <label htmlFor="isActive" className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Section is active</label>
          </div>

          <div className="pt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-orange-500/10 transition-all flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {section ? "Save Changes" : "Create Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
