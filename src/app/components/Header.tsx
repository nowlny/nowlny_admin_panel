"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Search, 
  Bell, 
  Settings, 
  Globe, 
  CheckCircle,
  Menu,
  Clock,
  Sparkles,
  Inbox,
  Sun,
  Moon,
  Loader2
} from "lucide-react";
import { notificationsService, AppNotification } from "../../services/notifications";
import { FCMToast } from "../../hooks/useNotifications";

interface HeaderProps {
  title: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenSidebar?: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  notificationToast?: FCMToast | null;
}

export default function Header({
  title,
  searchQuery,
  setSearchQuery,
  onOpenSidebar,
  isDarkMode,
  onToggleTheme,
  notificationToast
}: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 sm:px-8 shrink-0 dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-200">
      {/* Title & Stats */}
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Hamburger Menu Toggle on Mobile */}
        <button
          onClick={onOpenSidebar}
          className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg lg:hidden"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-sm sm:text-xl font-bold text-zinc-900 dark:text-white capitalize truncate max-w-[120px] sm:max-w-none">
          {title === "overview" ? "Dashboard Overview" : title.replace("_", " ")}
        </h2>
        
        {/* Quick System Badge */}
        <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>System Online</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="relative w-64 hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 placeholder-zinc-400 rounded-lg pl-9 pr-4 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 dark:bg-zinc-800/50 dark:border-zinc-700/80 dark:text-zinc-200"
          />
        </div>

        {/* System Time */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 px-2.5 py-1.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/50">
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Local Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
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
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-orange-500 to-red-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md shadow-orange-500/20">
                {unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/40">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">System Logs</span>
                  <span className="text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-bold">
                    {unreadCount} New
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-[10px] text-zinc-400 hover:text-orange-500 font-bold transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                {isLoadingNotifs && notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
                    <p className="text-xs text-zinc-400 font-medium">Loading alerts...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <Inbox className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                    <p className="text-xs text-zinc-400 font-medium">No alerts registered</p>
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
                              type: {notif.type}
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
                              Mark Read
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
    </header>
  );
}
