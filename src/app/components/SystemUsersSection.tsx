"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Phone,
  Calendar,
  Shield,
  Trash2,
  Plus,
  Edit,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { usersService, SystemUser } from "../../services/users";
import Modal from "./ui/Modal";
import { useConfirm } from "./ui/ConfirmDialog";
import { EmptyState, ErrorState, CardSkeletonGrid } from "./ui/States";
import StatusPill, { statusLabel } from "./ui/StatusPill";
import { formatDate, shortId } from "../../lib/format";

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

export default function SystemUsersSection() {
  const confirm = useConfirm();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    userType: "admin",
    status: "active",
    isActive: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await usersService.getSystemUsers();
      const finalUsers = Array.isArray(data)
        ? data
        : data && (data as any).data
          ? (data as any).data
          : [];
      setUsers(finalUsers);
      setLoadError(null);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      // A failed fetch used to render the "No system users found" empty state,
      // which is indistinguishable from an account list that is genuinely empty.
      setLoadError(
        err?.message || "Could not connect to the API to fetch system users.",
      );
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
      toast.success("User created successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user.");
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
      toast.success("User updated successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: SystemUser) => {
    // The card falls back to "Unnamed User", so the prompt must too — it used
    // to read "delete undefined?" for any user without a full name.
    const label = user.fullName?.trim() || user.phoneNumber || "this user";
    const confirmed = await confirm({
      title: `Delete ${label}?`,
      description: `This permanently removes the ${statusLabel(
        user.userType,
      ).toLowerCase()} account and revokes its access to the admin panel.`,
      confirmLabel: "Delete user",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setDeletingId(user.id);
      await usersService.deleteSystemUser(user.id);
      toast.success("User deleted successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user.");
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (user: SystemUser) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      userType: user.userType,
      status: user.status,
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
      <Plus className="w-4 h-4" /> Add User
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header controls */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" /> System Users
            Control
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
            Manage administrators, support staff, and system access.
          </p>
        </div>

        {addButton}
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
            title="No system users found"
            hint="Add an administrator, support agent or super admin to give them access to this panel."
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
                        {user.fullName || "Unnamed User"}
                      </h4>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold truncate mt-0.5">
                        Role: {statusLabel(user.userType)}
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
                      <span>Nickname: {user.nickname}</span>
                    </div>
                  )}
                  {user.dateOfBirth && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>DOB: {formatDate(user.dateOfBirth)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-3">
                <span
                  className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase"
                  title={user.id}
                >
                  ID: {shortId(user.id)}
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(user)}
                    disabled={deletingId === user.id}
                    className="p-2.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Edit User"
                    aria-label={`Edit ${user.fullName || user.phoneNumber}`}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {/* `deletingId` also guards against a double-click firing two
                      DELETEs for the same record. */}
                  <button
                    onClick={() => handleDelete(user)}
                    disabled={deletingId === user.id}
                    className="p-2.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete User"
                    aria-label={`Delete ${user.fullName || user.phoneNumber}`}
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen || !!editingUser}
        onClose={closeModal}
        title={editingUser ? "Edit System User" : "Create System User"}
        description={
          editingUser
            ? "Changes take effect the next time this user signs in."
            : "The user signs in with this phone number."
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
              Cancel
            </button>
            <button
              type="submit"
              form="system-user-form"
              disabled={isSubmitting}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingUser ? "Save Changes" : "Create User"}
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
              Full Name
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
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label htmlFor="system-user-phoneNumber" className={labelClass}>
              Phone Number
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
              User Type
            </label>
            <select
              id="system-user-type"
              value={formData.userType}
              onChange={(e) =>
                setFormData({ ...formData, userType: e.target.value })
              }
              className={inputClass}
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
              <option value="support">Support</option>
            </select>
          </div>

          {editingUser && (
            <div>
              <label htmlFor="system-user-status" className={labelClass}>
                Account Status
              </label>
              <select
                id="system-user-status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
