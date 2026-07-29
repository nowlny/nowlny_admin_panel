"use client";

import React, { useState, useEffect } from "react";
import { Bell, CheckCircle, Inbox, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { notificationsService, AppNotification } from "../../services/notifications";
import { EmptyState, ErrorState, Skeleton } from "./ui/States";
import { formatDateTime } from "../../lib/format";
import { useI18n } from "../../lib/i18n";

/**
 * Renders `first … current-2 … current+2 … last` instead of one button per
 * page. With 4,000 notifications the old `Array.from({length: totalPages})`
 * emitted 200 buttons into an unscrollable flex row and pushed Previous/Next
 * off the screen.
 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  const wanted = new Set<number>([1, total, current - 2, current - 1, current, current + 1, current + 2]);
  const pages = Array.from(wanted)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  pages.forEach((page, i) => {
    if (i > 0 && page - pages[i - 1] > 1) out.push("gap");
    out.push(page);
  });
  return out;
}

export default function NotificationsSection() {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsService.getNotifications(currentPage, itemsPerPage);
      setNotifications(data.data || []);
      setTotalItems(data.total || 0);
      setError(null);
    } catch (err: any) {
      // A failed fetch used to fall through to the "No notifications found"
      // empty state, making an outage look like an empty inbox.
      console.error("Failed to fetch notifications:", err);
      setError(err?.message || t("notifications.load_error"));
      setNotifications([]);
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
    } catch (err: any) {
      console.error("Failed to mark as read", err);
      toast.error(err?.message || t("notifications.mark_one_failed"));
      fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    const snapshot = notifications;
    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsService.markAllAsRead();
      toast.success(t("notifications.all_read"));
    } catch (err: any) {
      console.error("Failed to mark all as read", err);
      setNotifications(snapshot);
      toast.error(err?.message || t("notifications.mark_all_failed"));
      fetchNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {t("nav.notifications")}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {t("notifications.page_subtitle")}
          </p>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          disabled={isMarkingAll || !hasUnread}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all self-stretch sm:self-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMarkingAll ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          )}
          {t("notifications.mark_all_cta")}
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex gap-4"
              >
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-2.5 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchNotifications} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t("notifications.none_title")}
            hint={t("notifications.none_hint")}
          />
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
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
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
                    {/* formatDateTime pins locale + timezone (no hydration
                        mismatch) and returns an em dash for unparseable dates
                        instead of the literal string "Invalid Date". */}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                      {formatDateTime(notif.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
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
                        {t("notifications.mark_one")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <nav
            aria-label={t("notifications.pagination")}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {t("notifications.showing_range", {
                from: (currentPage - 1) * itemsPerPage + 1,
                to: Math.min(currentPage * itemsPerPage, totalItems),
                total: totalItems,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {t("common.previous")}
              </button>
              <div className="flex items-center gap-1">
                {pageWindow(currentPage, totalPages).map((page, i) =>
                  page === "gap" ? (
                    <span
                      key={`gap-${i}`}
                      aria-hidden="true"
                      className="w-5 text-center text-xs font-bold text-zinc-400 dark:text-zinc-600"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? "page" : undefined}
                      className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
                        currentPage === page
                          ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {t("common.next")}
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
