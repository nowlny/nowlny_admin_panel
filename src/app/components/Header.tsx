"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Bell,
  Menu,
  Clock,
  Inbox,
  Sun,
  Moon,
  Loader2,
  Languages,
  Check,
} from "lucide-react";
import { notificationsService, AppNotification } from "../../services/notifications";
import { FCMToast } from "../../hooks/useNotifications";
import { tabLabel } from "./Sidebar";
import { formatTime } from "../../lib/format";
import { useI18n, LOCALES, type Locale } from "../../lib/i18n";
import { runCrossFadeTransition } from "../../lib/theme";

interface HeaderProps {
  title: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenSidebar?: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  notificationToast?: FCMToast | null;
  /** Sections that don't filter by the global query hide the search box. */
  searchEnabled?: boolean;
  pushPermission?: "unsupported" | NotificationPermission;
  onEnablePush?: () => void;
  isRequestingPush?: boolean;
}

export default function Header({
  title,
  searchQuery,
  setSearchQuery,
  onOpenSidebar,
  isDarkMode,
  onToggleTheme,
  notificationToast,
  searchEnabled = true,
  pushPermission = "default",
  onEnablePush,
  isRequestingPush = false,
}: HeaderProps) {
  const { t, locale, setLocale } = useI18n();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // The clock was rendered once from `new Date()` during render, so it froze at
  // page-load time while being labelled "Local Time". Tick it every 30s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
      if (langRef.current && !langRef.current.contains(target)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    setIsLoadingNotifs(true);
    try {
      const data = await notificationsService.getNotifications(1, 20);
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setIsLoadingNotifs(false);
    }
  };

  useEffect(() => {
    // Only load notifications if we have an auth token in local storage (meaning we are logged in)
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      loadNotifications();
    }
  }, []);

  // Reload when a new push notification toast appears
  useEffect(() => {
    if (notificationToast) {
      loadNotifications();
    }
  }, [notificationToast]);

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    try {
      await notificationsService.markAsRead(id);
    } catch (err) {
      console.error("Failed to mark as read", err);
      // Rollback on fail
      loadNotifications();
    }
  };

  const handleClearAll = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    
    try {
      await notificationsService.markAllAsRead();
    } catch (err) {
      console.error("Failed to mark all as read", err);
      loadNotifications();
    }
    setIsOpen(false);
  };

  /**
   * Switching to Arabic re-lays the entire page out end-to-left. Without a
   * cross-fade every element teleports to its mirrored position in one frame.
   */
  const handleLocaleChange = (next: Locale) => {
    setLangOpen(false);
    if (next === locale) return;
    runCrossFadeTransition(() => setLocale(next));
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <header className="relative h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 sm:px-8 shrink-0 dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-200">
      {/* Title & Stats */}
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Hamburger Menu Toggle on Mobile */}
        <button
          onClick={onOpenSidebar}
          className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg lg:hidden"
          title={t("header.toggle_nav")}
          aria-label={t("header.toggle_nav")}
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-sm sm:text-xl font-bold text-zinc-900 dark:text-white truncate max-w-[120px] sm:max-w-none">
          {tabLabel(title, t)}
        </h2>

        {/* Quick System Badge */}
        <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{t("header.system_online")}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Search Bar */}
        {searchEnabled && (
          <>
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <label htmlFor="global-search" className="sr-only">
                {t("header.search_label")}
              </label>
              <input
                id="global-search"
                type="search"
                placeholder={t("header.search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 placeholder-zinc-400 rounded-lg ps-9 pe-4 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 dark:bg-zinc-800/50 dark:border-zinc-700/80 dark:text-zinc-200"
              />
            </div>

            {/* Mobile users previously had no search at all — the box was
                `hidden sm:block`. This exposes it behind a toggle. */}
            <button
              onClick={() => setMobileSearchOpen((v) => !v)}
              className="sm:hidden p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all border border-zinc-200 dark:border-zinc-700"
              aria-label={t("header.search_label")}
              aria-expanded={mobileSearchOpen}
            >
              <Search className="w-4 h-4" />
            </button>
          </>
        )}

        {/* System Time */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 px-2.5 py-1.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span suppressHydrationWarning>
            {t("header.timezone")}: {formatTime(now)}
          </span>
        </div>

        {/* Language switcher */}
        <div className="relative shrink-0" ref={langRef}>
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 shrink-0"
            title={t("header.language")}
            aria-label={t("header.language")}
            aria-haspopup="menu"
            aria-expanded={langOpen}
          >
            <Languages className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">
              {locale}
            </span>
          </button>

          {langOpen && (
            <div
              role="menu"
              className="absolute end-0 mt-2 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              {LOCALES.map((option) => (
                <button
                  key={option.value}
                  role="menuitemradio"
                  aria-checked={locale === option.value}
                  onClick={() => handleLocaleChange(option.value)}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold transition-colors ${
                    locale === option.value
                      ? "text-orange-500 bg-orange-500/5"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span>{option.nativeLabel}</span>
                  {locale === option.value && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle. The palette swaps instantly — no wipe, no fade. */}
        <button
          onClick={onToggleTheme}
          className="relative p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden"
          title={
            isDarkMode
              ? t("header.switch_to_light")
              : t("header.switch_to_dark")
          }
          aria-label={
            isDarkMode
              ? t("header.switch_to_light")
              : t("header.switch_to_dark")
          }
        >
          {/* Only the icon for the palette you'd switch *to* is rendered, and
              it swaps with the theme rather than animating between the two. */}
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          )}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all relative border border-zinc-200 dark:border-zinc-700"
            aria-label={t("header.notifications")}
            aria-expanded={isOpen}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -end-1.5 bg-gradient-to-r from-orange-500 to-red-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md shadow-orange-500/20">
                {unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="absolute end-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Push-permission state is surfaced here instead of prompting
                  unannounced the moment the operator signs in. */}
              {pushPermission === "default" && onEnablePush && (
                <div className="p-3.5 bg-orange-500/[0.06] border-b border-orange-500/20 flex items-start gap-2.5">
                  <Bell className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">
                      {t("header.enable_alerts_title")}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      {t("header.enable_alerts_body")}
                    </p>
                    <button
                      onClick={onEnablePush}
                      disabled={isRequestingPush}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      {isRequestingPush && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      {t("header.enable_alerts_cta")}
                    </button>
                  </div>
                </div>
              )}
              {pushPermission === "denied" && (
                <div className="p-3.5 bg-zinc-500/[0.06] border-b border-zinc-200 dark:border-zinc-800">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      {t("header.alerts_blocked")}
                    </span>{" "}
                    {t("header.alerts_blocked_body")}
                  </p>
                </div>
              )}

              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">
                    {t("header.system_logs")}
                  </span>
                  <span className="text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-bold">
                    {t("header.new_count", { count: unreadCount })}
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[10px] text-zinc-400 hover:text-orange-500 font-bold transition-colors"
                  >
                    {t("header.clear_all")}
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                {isLoadingNotifs && notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
                    <p className="text-xs text-zinc-400 font-medium">
                      {t("header.loading_alerts")}
                    </p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <Inbox className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                    <p className="text-xs text-zinc-400 font-medium">
                      {t("header.no_alerts")}
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors flex gap-2.5 ${
                        !notif.read ? "bg-orange-500/[0.02]" : ""
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        !notif.read ? "bg-orange-500 animate-ping" : "bg-zinc-300 dark:bg-zinc-700"
                      }`} />
                      <div className="flex-1 min-w-0" onClick={() => !notif.read && handleMarkAsRead(notif.id)}>
                        <div className="flex justify-between items-start gap-1">
                          <p className={`text-xs font-bold truncate ${
                            !notif.read ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
                          }`}>
                            {notif.title}
                          </p>
                          <span className="text-[9px] text-zinc-400 shrink-0 font-medium">{formatTimestamp(notif.timestamp)}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.body}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {notif.type && (
                            <span className="text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded capitalize">
                              {t("header.type")}: {notif.type}
                            </span>
                          )}
                          {!notif.read && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notif.id);
                              }}
                              className="text-[9px] font-bold text-orange-500 hover:underline"
                            >
                              {t("header.mark_read")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search drawer */}
      {searchEnabled && mobileSearchOpen && (
        <div className="sm:hidden absolute top-full inset-x-0 z-40 p-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <label htmlFor="global-search-mobile" className="sr-only">
              {t("header.search_label")}
            </label>
            <input
              id="global-search-mobile"
              type="search"
              autoFocus
              placeholder={t("header.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 placeholder-zinc-400 rounded-lg ps-9 pe-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 dark:bg-zinc-800/50 dark:border-zinc-700/80 dark:text-zinc-200"
            />
          </div>
        </div>
      )}
    </header>
  );
}
