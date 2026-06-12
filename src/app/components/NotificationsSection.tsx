"use client";

import React, { useState, useEffect } from "react";
import { Bell, CheckCircle, Loader2, Inbox } from "lucide-react";
import { notificationsService, AppNotification } from "../../services/notifications";

export default function NotificationsSection() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsService.getNotifications(currentPage, itemsPerPage);
      setNotifications(data.data || []);
      setTotalItems(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentPage]);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await notificationsService.markAsRead(id);
    } catch (err) {
      console.error("Failed to mark as read", err);
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsService.markAllAsRead();
    } catch (err) {
      console.error("Failed to mark all as read", err);
      fetchNotifications();
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Notifications
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            View and manage all your system alerts and notifications.
          </p>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all self-stretch sm:self-auto justify-center"
        >
          <CheckCircle className="w-4 h-4 text-emerald-500" /> Mark All as Read
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 text-zinc-500 flex flex-col items-center">
            <Inbox className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-sm font-semibold">No notifications found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-xl border transition-colors flex gap-4 ${
                  !notif.read
                    ? "bg-orange-500/[0.03] border-orange-500/20 dark:bg-orange-500/[0.05] dark:border-orange-500/20"
                    : "bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                <div className="pt-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      !notif.read
                        ? "bg-orange-500/10 text-orange-500"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    <Bell className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p
                      className={`text-sm font-bold truncate ${
                        !notif.read
                          ? "text-zinc-900 dark:text-white"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {notif.title}
                    </p>
                    <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">
                      {formatTimestamp(notif.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {notif.body}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    {notif.type && (
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded">
                        {notif.type}
                      </span>
                    )}
                    {!notif.read && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-[11px] font-bold text-orange-500 hover:underline"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 font-medium">
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
