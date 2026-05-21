"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Phone,
  Calendar,
  Shield,
  Trash2,
  Plus,
  Edit,
  AlertCircle,
  X,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import {
  usersService,
  SystemUser,
  SystemUserCreate,
  SystemUserUpdate,
} from "../../services/users";

export default function SystemUsersSection() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await usersService.getSystemUsers();
      const finalUsers = Array.isArray(data) ? data : (data && (data as any).data ? (data as any).data : []);
      setUsers(finalUsers);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      setError("Could not connect to API to fetch system users.");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await usersService.createSystemUser({
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        userType: formData.userType,
      });
      setIsCreateModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      alert(`Failed to create user: ${err.message}`);
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
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      alert(`Failed to update user: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${name}? This action cannot be undone.`,
      )
    )
      return;
    try {
      await usersService.deleteSystemUser(id);
      fetchUsers();
    } catch (err: any) {
      alert(`Failed to delete user: ${err.message}`);
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

  if (isLoading && users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-orange-500" />
        <p className="text-sm font-semibold">Loading system users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header controls */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" /> System Users
            Control
          </h2>
          <p className="text-[11px] text-zinc-500 font-semibold mt-1">
            Manage administrators, support staff, and system access.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="bg-zinc-900 hover:bg-orange-500 text-white dark:bg-zinc-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Users List */}
      {users.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl flex flex-col items-center justify-center">
          <Shield className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            No system users found
          </p>
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
                      {(user.fullName || user.phoneNumber || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                        {user.fullName || "Unnamed User"}
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-semibold truncate mt-0.5">
                        Role: {user.userType}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      user.status === "active"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-red-500/10 text-red-500 border-red-500/20"
                    }`}
                  >
                    {user.status}
                  </span>
                </div>

                <div className="mt-4 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
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
                      <span>DOB: {user.dateOfBirth}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center gap-3">
                <span className="text-[9px] font-bold text-zinc-400 uppercase">
                  ID: {user.id.substring(0, 8)}...
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(user)}
                    className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Edit User"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id, user.fullName)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete User"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(isCreateModalOpen || editingUser) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-500" />
                {editingUser ? "Edit System User" : "Create System User"}
              </h3>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingUser(null);
                }}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={editingUser ? handleUpdate : handleCreate}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  Phone Number
                </label>
                <input
                  required
                  type="text"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. +966501234567"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                  User Type
                </label>
                <select
                  value={formData.userType}
                  onChange={(e) =>
                    setFormData({ ...formData, userType: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="support">Support</option>
                </select>
              </div>

              {editingUser && (
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
                    Account Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingUser
                      ? "Save Changes"
                      : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
