"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Loader2,
  LayoutGrid,
  SearchX,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  restaurantCategoriesService,
  RestaurantCategory,
} from "../../services/restaurantCategories";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, TableSkeleton } from "./ui/States";

const inputClass =
  "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500";
const labelClass =
  "block text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5";

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-orange-500">
      {" "}
      *
    </span>
  );
}

/** Windowed page numbers — 40 pages of buttons used to overflow the row. */
function pageWindow(current: number, total: number, span = 5): number[] {
  const half = Math.floor(span / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function RestaurantCategoriesSection() {
  const confirm = useConfirm();

  const getImageUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_MAIN_URL ||
      "https://app.nowlny.com";
    return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const [categories, setCategories] = useState<RestaurantCategory[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<RestaurantCategory | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [icon, setIcon] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await restaurantCategoriesService.getAllCategories(
        currentPage,
        itemsPerPage,
        searchQuery,
      );
      if (data && typeof data === "object" && Array.isArray((data as any).data)) {
        setCategories((data as any).data);
        setTotalItems((data as any).total || 0);
      } else if (Array.isArray(data)) {
        setCategories(data);
        setTotalItems(data.length);
      } else {
        setCategories([]);
        setTotalItems(0);
        console.warn("API returned non-array data for categories:", data);
      }
      setLoadError(null);
    } catch (error: any) {
      console.error("Failed to fetch categories:", error);
      // Without this the list rendered the "no categories" empty state on an
      // outage, so an operator could not tell the two apart.
      setLoadError(error?.message || "Could not load restaurant categories.");
      setCategories([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCategories();
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage, searchQuery]);

  const openModal = (category?: RestaurantCategory) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setDescription(category.description || "");
      setIsActive(category.isActive);
      setIcon(category.icon || "");
    } else {
      setEditingCategory(null);
      setName("");
      setDescription("");
      setIsActive(true);
      setIcon("");
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { name, description, isActive, icon };
      if (editingCategory) {
        await restaurantCategoriesService.updateCategory(
          editingCategory.id,
          payload,
        );
      } else {
        await restaurantCategoriesService.createCategory(payload);
      }
      // Only close on success — the modal used to close inside the `try`, so a
      // failed save silently dropped the form with no message at all.
      closeModal();
      toast.success(
        editingCategory
          ? `Category "${name}" updated.`
          : `Category "${name}" created.`,
      );
      fetchCategories();
    } catch (error: any) {
      console.error("Failed to save category:", error);
      toast.error(error?.message || "Failed to save category.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category: RestaurantCategory) => {
    const confirmed = await confirm({
      title: `Delete “${category.name}”?`,
      description:
        "This permanently removes the category. Restaurants grouped under it will no longer appear in this category.",
      confirmLabel: "Delete category",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setDeletingId(category.id);
      await restaurantCategoriesService.deleteCategory(category.id);
      toast.success(`Category "${category.name}" deleted.`);
      fetchCategories();
    } catch (error: any) {
      console.error("Failed to delete category:", error);
      toast.error(error?.message || "Failed to delete category.");
    } finally {
      setDeletingId(null);
    }
  };

  const safeCategories = Array.isArray(categories) ? categories : [];
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const isSearching = !!searchQuery.trim();
  const isDirty = editingCategory
    ? name !== editingCategory.name ||
      description !== (editingCategory.description || "") ||
      icon !== (editingCategory.icon || "") ||
      isActive !== editingCategory.isActive
    : !!(name || description || icon);

  const addButton = (
    <button
      onClick={() => openModal()}
      className="bg-zinc-900 hover:bg-orange-500 text-white dark:bg-zinc-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 self-stretch sm:self-auto justify-center"
    >
      <Plus className="w-4 h-4" /> Add Category
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-orange-500" />
            Restaurant Categories
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
            Manage the categories used to group restaurants.
          </p>
        </div>
        {addButton}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        {/* This tab is not in the header's SEARCHABLE_TABS set, so the global
            search box is hidden here — this local box is the only search. */}
        <div className="flex items-center gap-2 mb-6">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="category-search" className="sr-only">
              Search categories
            </label>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              id="category-search"
              type="search"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchCategories} />
        ) : safeCategories.length === 0 ? (
          <EmptyState
            icon={isSearching ? SearchX : LayoutGrid}
            title={
              isSearching ? "No matching categories" : "No categories yet"
            }
            hint={
              isSearching
                ? `Nothing matches “${searchQuery}”. Try a different name.`
                : "Categories group restaurants in the customer app. Create the first one to get started."
            }
            action={isSearching ? undefined : addButton}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-3 px-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Icon
                  </th>
                  <th className="py-3 px-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="py-3 px-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="py-3 px-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3 px-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {safeCategories.map((category) => (
                  <tr
                    key={category.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-semibold text-zinc-900 dark:text-white">
                      {category.icon ? (
                        <img
                          src={getImageUrl(category.icon)}
                          alt=""
                          className="w-8 h-8 rounded object-cover bg-zinc-100 dark:bg-zinc-800"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="w-8 h-8 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400"
                        >
                          ?
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-zinc-900 dark:text-white">
                      {category.name}
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {category.description || "—"}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          category.isActive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(category)}
                          disabled={deletingId === category.id}
                          className="p-2.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title={`Edit ${category.name}`}
                          aria-label={`Edit ${category.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          disabled={deletingId === category.id}
                          className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title={`Delete ${category.name}`}
                          aria-label={`Delete ${category.name}`}
                        >
                          {deletingId === category.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !loadError && totalPages > 1 && (
          <nav
            aria-label="Category pages"
            className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {pageWindow(currentPage, totalPages).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    aria-label={`Page ${page}`}
                    aria-current={currentPage === page ? "page" : undefined}
                    className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
                      currentPage === page
                        ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingCategory ? "Edit Category" : "Add Category"}
        description="Categories are how customers browse restaurants in the app."
        maxWidth="max-w-md"
        dismissable={!isSubmitting && !isDirty}
        icon={
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-4 h-4" />
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 px-4 py-2.5 text-xs font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="category-form"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingCategory ? "Save Changes" : "Create"}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="category-name" className={labelClass}>
              Name
              <RequiredMark />
            </label>
            <input
              id="category-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Burgers"
            />
          </div>
          <div>
            <label htmlFor="category-description" className={labelClass}>
              Description
            </label>
            <textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Optional — shown under the category name."
            />
          </div>
          <div>
            <label htmlFor="category-icon" className={labelClass}>
              Icon URL
            </label>
            <div className="flex gap-3 items-center">
              {icon && (
                <div className="w-10 h-10 shrink-0 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                  <img
                    src={getImageUrl(icon)}
                    alt="Category icon preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <input
                id="category-icon"
                type="url"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="https://example.com/icon.svg"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex items-center">
            <label
              htmlFor="category-active"
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                id="category-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-orange-500 rounded border-zinc-300 dark:border-zinc-700"
              />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                Active
              </span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
