"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Phone,
  Calendar,
  Shield,
  Trash2,
  Plus,
  Search,
  Edit,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  usersService,
  SystemUser,
  UserType,
  UserStatus,
  USER_TYPES,
  USER_STATUSES,
} from "../../services/users";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, CardSkeletonGrid } from "./ui/States";
import StatusPill, { statusLabel } from "./ui/StatusPill";
import { formatDate, shortId } from "../../lib/format";

import { useI18n } from "../../lib/i18n";
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

const PAGE_SIZE = 20;

export default function SystemUsersSection() {
  const { t } = useI18n();
  const confirm = useConfirm();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<UserType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    userType: "admin" as UserType,
    status: "active" as UserStatus,
    isActive: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // The search box feeds the API's own `search` parameter rather than
  // filtering one page in the browser.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, statusFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await usersService.getSystemUsers({
        search: debouncedSearch || undefined,
        userType: typeFilter,
        status: statusFilter,
        page,
        limit: PAGE_SIZE,
      });
      setUsers(res.data);
      setTotal(res.total);
      setTotalPages(Math.max(1, res.totalPages ?? 1));
      setLoadError(null);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      // A failed fetch used to render the "No system users found" empty state,
      // which is indistinguishable from an account list that is genuinely empty.
      setLoadError(
        err instanceof Error
          ? err.message
          : t("users.load_failed"),
      );
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, typeFilter, statusFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const closeModal = () => {
    setIsCreateModalOpen(false);
    setEditingUser(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await usersService.createSystemUser({
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        userType: formData.userType,
      });
      closeModal();
      resetForm();
      toast.success(t("users.created"));
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || t("users.create_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setIsSubmitting(true);
      await usersService.updateSystemUser(editingUser.id, {
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        userType: formData.userType,
        status: formData.status,
        isActive: formData.status === "active",
      });
      closeModal();
      resetForm();
      toast.success(t("users.updated"));
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || t("users.update_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: SystemUser) => {
    // The card falls back to "Unnamed User", so the prompt must too — it used
    // to read "delete undefined?" for any user without a full name.
    const label =
      user.fullName?.trim() || user.phoneNumber || t("users.this_user");
    const confirmed = await confirm({
      title: t("users.delete_title", { name: label }),
      description: t("users.delete_body", {
        role: statusLabel(user.userType, t).toLowerCase(),
      }),
      confirmLabel: t("users.delete_cta"),
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setDeletingId(user.id);
      await usersService.deleteSystemUser(user.id);
      toast.success(t("users.deleted"));
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || t("users.delete_failed"));
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (user: SystemUser) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      userType: user.userType as UserType,
      status: user.status as UserStatus,
      isActive: user.isActive,
    });
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      phoneNumber: "",
      userType: "admin",
      status: "active",
      isActive: true,
    });
  };

  const isDirty = editingUser
    ? formData.fullName !== editingUser.fullName ||
      formData.phoneNumber !== editingUser.phoneNumber ||
      formData.userType !== editingUser.userType ||
      formData.status !== editingUser.status
    : !!(formData.fullName || formData.phoneNumber);

  const addButton = (
    <button
      onClick={() => {
        resetForm();
        setIsCreateModalOpen(true);
      }}
      className="bg-zinc-900 hover:bg-orange-500 text-white dark:bg-zinc-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
    >
      <Plus className="w-4 h-4" /> {t("users.add")}
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header controls */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />{" "}
            {t("users.title")}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
            {t("users.subtitle")}
          </p>
        </div>

        {addButton}
      </div>

      {/* Server-side search and filters. The list endpoint supports `search`,
          `userType`, `status` and pagination — none of which the panel used, so
          it only ever showed the API's first page. */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("users.search_placeholder")}
            aria-label={t("users.search_label")}
            className={`${inputClass} ps-9`}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as UserType | "all")}
          aria-label={t("users.filter_role")}
          className={`${inputClass} md:w-52`}
        >
          <option value="all">{t("users.all_roles")}</option>
          {USER_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserStatus | "all")}
          aria-label={t("users.filter_status")}
          className={`${inputClass} md:w-40`}
        >
          <option value="all">{t("users.all_statuses")}</option>
          {USER_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        {!isLoading && !loadError && (
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
            {t("users.count", { count: total })}
          </span>
        )}
      </div>

      {/* Users List */}
      {isLoading ? (
        <CardSkeletonGrid count={6} />
      ) : loadError ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ErrorState message={loadError} onRetry={fetchUsers} />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <EmptyState
            icon={Shield}
            title={t("users.none_title")}
            hint={t("users.none_hint")}
            action={addButton}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0 w-10 h-10 bg-gradient-to-tr from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold shadow-sm border border-zinc-200 dark:border-zinc-700">
                      {(user.fullName || user.phoneNumber || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                        {user.fullName || t("users.unnamed")}
                      </h4>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold truncate mt-0.5">
                        {t("users.role_label", {
                          role: statusLabel(user.userType, t),
                        })}
                      </p>
                    </div>
                  </div>

                  <StatusPill status={user.status} className="shrink-0" />
                </div>

                <div className="mt-4 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>{user.phoneNumber}</span>
                  </div>
                  {user.nickname && (
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>
                        {t("users.nickname_label", { value: user.nickname })}
                      </span>
                    </div>
                  )}
                  {user.dateOfBirth && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>
                        {t("users.dob_label", {
                          value: formatDate(user.dateOfBirth),
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-3">
                <span
                  className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase"
                  title={user.id}
                >
                  {t("users.id_label", { id: shortId(user.id) })}
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(user)}
                    disabled={deletingId === user.id}
                    className="p-2.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title={t("common.edit")}
                    aria-label={t("users.edit_aria", {
                      name: user.fullName || user.phoneNumber,
                    })}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {/* `deletingId` also guards against a double-click firing two
                      DELETEs for the same record. */}
                  <button
                    onClick={() => handleDelete(user)}
                    disabled={deletingId === user.id}
                    className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title={t("common.delete")}
                    aria-label={t("users.delete_aria", {
                      name: user.fullName || user.phoneNumber,
                    })}
                  >
                    {deletingId === user.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !loadError && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
          >
            {t("common.previous")}
          </button>
          <span className="text-xs font-semibold text-zinc-500">
            {t("common.page_of", { page, total: totalPages })}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold disabled:opacity-50"
          >
            {t("common.next")}
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen || !!editingUser}
        onClose={closeModal}
        title={editingUser ? t("users.edit_title") : t("users.create_title")}
        description={
          editingUser
            ? t("users.edit_desc")
            : t("users.create_desc")
        }
        maxWidth="max-w-md"
        dismissable={!isSubmitting && !isDirty}
        icon={
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
        }
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
              form="system-user-form"
              disabled={isSubmitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingUser ? t("common.save_changes") : t("users.create_cta")}
            </button>
          </>
        }
      >
        <form
          id="system-user-form"
          onSubmit={editingUser ? handleUpdate : handleCreate}
          className="space-y-4"
        >
          <div>
            <label htmlFor="system-user-fullName" className={labelClass}>
              {t("users.full_name")}
              <RequiredMark />
            </label>
            <input
              id="system-user-fullName"
              required
              type="text"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className={inputClass}
              placeholder={t("users.name_placeholder")}
            />
          </div>

          <div>
            <label htmlFor="system-user-phoneNumber" className={labelClass}>
              {t("users.phone")}
              <RequiredMark />
            </label>
            <input
              id="system-user-phoneNumber"
              required
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) =>
                setFormData({ ...formData, phoneNumber: e.target.value })
              }
              className={inputClass}
              placeholder="e.g. +966501234567"
            />
          </div>

          <div>
            <label htmlFor="system-user-type" className={labelClass}>
              {t("users.user_type")}
            </label>
            {/* `super_admin` and `support` were offered here but are not in
                `CreateUserDto.userType`, so picking either returned a 400. */}
            <select
              id="system-user-type"
              value={formData.userType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  userType: e.target.value as UserType,
                })
              }
              className={inputClass}
            >
              {USER_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {statusLabel(type.value, t)}
                </option>
              ))}
            </select>
          </div>

          {editingUser && (
            <div>
              <label htmlFor="system-user-status" className={labelClass}>
                {t("users.account_status")}
              </label>
              <select
                id="system-user-status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as UserStatus,
                  })
                }
                className={inputClass}
              >
                {USER_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {statusLabel(status.value, t)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
