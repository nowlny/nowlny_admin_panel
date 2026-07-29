"use client";

import React from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  Users,
  LogOut,
  Sparkles,
  Users2,
  Coins,
  Bell,
  Smartphone,
  Truck,
  Tags,
  MessageSquare,
} from "lucide-react";
import { SystemUser } from "../../services/users";
import { authService } from "../../services/auth";
import { useConfirm } from "./ui/ConfirmDialog";
import { statusLabel } from "./ui/StatusPill";
import { useI18n, type MessageKey } from "../../lib/i18n";

export interface Role {
  type: "admin" | "restaurant" | "restaurant_owner";
  restaurantId?: string;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingOrdersCount: number;
  pendingRestaurantsCount: number;
  isOpen?: boolean;
  onClose?: () => void;
  currentRole: Role;
  currentUser: SystemUser | null;
}

/**
 * Single source of truth for tab titles.
 *
 * The header previously derived its title with `tab.replace("_", " ")`, which
 * replaces only the first underscore and produced lowercase text that didn't
 * match the sidebar — the nav said "Store Categories" while the header said
 * "restaurant categories".
 *
 * Titles are now translation keys rather than literals, so the sidebar and the
 * header stay in step in both languages from one table.
 */
export const TAB_KEYS = [
  "overview",
  "orders",
  "restaurants",
  "restaurant_categories",
  "menu_tags",
  "delivery_companies",
  "reels",
  "customers",
  "currencies",
  "system_users",
  "notifications",
  "sms_gateway",
  "app_version",
  "restaurant_application",
  "restaurant_reels",
  "restaurant_overview",
] as const;

const TAB_KEY_SET = new Set<string>(TAB_KEYS);

/**
 * `t` is passed in rather than pulled from context so this stays a plain
 * function — it is called from render paths that aren't components.
 */
export function tabLabel(
  tab: string,
  t?: (key: MessageKey) => string,
): string {
  if (t && TAB_KEY_SET.has(tab)) {
    return t(`nav.${tab}` as MessageKey);
  }
  return tab
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Initials for the avatar, e.g. "Hassan Al-Sabeh" -> "HA". */
function initialsOf(name?: string | null): string {
  if (!name) return "··";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  pendingOrdersCount,
  pendingRestaurantsCount,
  isOpen,
  onClose,
  currentRole,
  currentUser,
}: SidebarProps) {
  const confirm = useConfirm();
  const { t, isRTL } = useI18n();

  // Decide menu items based on role
  const getMenuItems = () => {
    if (currentRole.type === "admin") {
      return [
        {
          id: "overview",
          label: t("nav.overview_short"),
          icon: LayoutDashboard,
        },
        {
          id: "orders",
          label: t("nav.orders"),
          icon: ShoppingBag,
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
          badgeColor: "bg-red-500 text-white animate-pulse",
        },
        {
          id: "restaurants",
          label: t("nav.restaurants"),
          icon: Store,
          badge:
            pendingRestaurantsCount > 0 ? pendingRestaurantsCount : undefined,
          badgeColor: "bg-amber-500 text-black",
        },
        {
          id: "restaurant_categories",
          label: t("nav.restaurant_categories"),
          icon: Store,
        },
        { id: "menu_tags", label: t("nav.menu_tags"), icon: Tags },
        {
          id: "delivery_companies",
          label: t("nav.delivery_companies"),
          icon: Truck,
        },
        { id: "reels", label: t("nav.reels"), icon: Sparkles },
        { id: "customers", label: t("nav.customers"), icon: Users },
        { id: "currencies", label: t("nav.currencies"), icon: Coins },
        { id: "system_users", label: t("nav.system_users"), icon: Users2 },
        { id: "notifications", label: t("nav.notifications"), icon: Bell },
        { id: "sms_gateway", label: t("nav.sms_gateway"), icon: MessageSquare },
        { id: "app_version", label: t("nav.app_version"), icon: Smartphone },
      ];
    } else if (currentRole.type === "restaurant_owner") {
      return [
        {
          id: "restaurant_application",
          label: t("nav.restaurant_application"),
          icon: Store,
        },
      ];
    } else {
      return [
        {
          id: "restaurant_overview",
          label: t("nav.restaurant_overview"),
          icon: LayoutDashboard,
        },
        { id: "restaurants", label: t("nav.my_store"), icon: Store },
        { id: "restaurant_reels", label: t("nav.restaurant_reels"), icon: Sparkles },
      ];
    }
  };

  const menuItems = getMenuItems();

  /*
   * Which way the closed drawer hides.
   *
   * This used to set a base negative translate alongside its direction-variant
   * counterpart — two competing classes for the same property, resolved by
   * stylesheet order rather than intent. Tailwind emits direction variants
   * *after* the `lg` breakpoint and wraps them in `:where()` (specificity 0),
   * so on a desktop screen in Arabic the closed-state class beat the `lg`
   * reset and pushed the permanently-visible sidebar a full width off the
   * trailing edge. English escaped it only because the plain negative
   * translate happens to sort earlier than `lg`.
   *
   * Picking one class at runtime removes the conflict entirely, and scoping it
   * to `max-lg` means the desktop sidebar can never be transformed at all.
   */
  const offCanvasClass = isRTL
    ? "max-lg:translate-x-full"
    : "max-lg:-translate-x-full";

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          onClick={onClose}
        />
      )}

      {/* `start-0` / `border-e` are logical, so in Arabic the drawer docks to
          the right edge and the mobile slide-in comes from that side too. */}
      <aside
        className={`
        fixed inset-y-0 start-0 z-50 w-64 bg-zinc-950 text-zinc-300 flex flex-col h-full border-e border-zinc-800 shrink-0
        transition-transform duration-300 ease-out transform lg:static lg:h-full lg:z-auto
        ${isOpen ? "translate-x-0" : offCanvasClass}
      `}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="text-white font-black text-xl tracking-wider">
              N
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1">
              NOWLNY
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-black border uppercase ${
                  currentRole.type === "admin"
                    ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    : currentRole.type === "restaurant_owner"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                }`}
              >
                {currentRole.type === "admin"
                  ? t("sidebar.role.admin")
                  : currentRole.type === "restaurant_owner"
                    ? t("sidebar.role.owner")
                    : t("sidebar.role.store")}
              </span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-semibold tracking-widest uppercase">
              {currentRole.type === "admin"
                ? t("sidebar.subtitle.admin")
                : currentRole.type === "restaurant_owner"
                  ? t("sidebar.subtitle.owner")
                  : t("sidebar.subtitle.store")}
            </p>
          </div>
        </div>

        {/* ROLE IMPERSONATOR DROP-DOWN REMOVED AS REQUESTED */}
        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[10px] font-bold text-zinc-600 tracking-wider uppercase mb-2">
            {t("nav.main_menu")}
          </p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-gradient-to-r from-orange-500/10 to-red-500/5 text-orange-400 border-s-2 border-orange-500 ps-2.5"
                    : "hover:bg-zinc-900/60 hover:text-white border-s-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors duration-200 ${
                      isActive
                        ? "text-orange-400"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Identity Section */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center gap-3 px-2 py-1.5">
            {/* The identity block used to look the merchant up in a
                localStorage fixture, so a real signed-in owner rendered as
                "Store" with no name. It reads the API profile now. */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 font-bold shadow text-xs uppercase shrink-0">
              {initialsOf(currentUser?.fullName)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.fullName ??
                  currentUser?.phoneNumber ??
                  t("sidebar.signed_in")}
              </p>
              <p className="text-[10px] text-zinc-500 truncate font-semibold">
                {currentUser?.userType
                  ? statusLabel(currentUser.userType, t)
                  : currentRole.type === "restaurant"
                    ? t("sidebar.merchant_partner")
                    : currentRole.type === "restaurant_owner"
                      ? t("sidebar.pending_registration")
                      : t("sidebar.administrator")}
              </p>
            </div>

            <button
              className="text-zinc-500 hover:text-red-400 transition-colors p-2 hover:bg-zinc-800 rounded-lg shrink-0"
              title={t("sidebar.logout")}
              aria-label={t("sidebar.logout")}
              onClick={async () => {
                const ok = await confirm({
                  title: t("sidebar.logout_confirm_title"),
                  description: t("sidebar.logout_confirm_body"),
                  confirmLabel: t("sidebar.logout"),
                  variant: "danger",
                });
                // authService.logout() also tells the server and clears the
                // refresh token — the old inline handler dropped only `token`,
                // leaving `refreshToken` behind in localStorage.
                if (ok) await authService.logout();
              }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
