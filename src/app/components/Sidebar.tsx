"use client";

import React from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  Users,
  Bike,
  Ticket,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Users2,
} from "lucide-react";
import { Restaurant } from "../data/mockData";

export interface Role {
  type: "admin" | "restaurant" | "restaurant_owner";
  restaurantId?: string;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingOrdersCount: number;
  pendingRestaurantsCount: number;
  pendingDriversCount: number;
  isOpen?: boolean;
  onClose?: () => void;
  currentRole: Role;
  onChangeRole: (role: Role) => void;
  restaurants: Restaurant[];
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  pendingOrdersCount,
  pendingRestaurantsCount,
  pendingDriversCount,
  isOpen,
  onClose,
  currentRole,
  onChangeRole,
  restaurants,
}: SidebarProps) {
  // Decide menu items based on role
  const getMenuItems = () => {
    if (currentRole.type === "admin") {
      return [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        {
          id: "orders",
          label: "Live Orders",
          icon: ShoppingBag,
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
          badgeColor: "bg-red-500 text-white animate-pulse",
        },
        {
          id: "restaurants",
          label: "Restaurants",
          icon: Store,
          badge:
            pendingRestaurantsCount > 0 ? pendingRestaurantsCount : undefined,
          badgeColor: "bg-amber-500 text-black",
        },
        {
          id: "restaurant_categories",
          label: "Store Categories",
          icon: Store,
        },
        { id: "customers", label: "Customers", icon: Users },
        {
          id: "drivers",
          label: "Drivers Fleet",
          icon: Bike,
          badge: pendingDriversCount > 0 ? pendingDriversCount : undefined,
          badgeColor: "bg-blue-500 text-white",
        },
        { id: "promos", label: "Promo & Offers", icon: Ticket },
        { id: "reports", label: "Financials & Reports", icon: BarChart3 },
        { id: "system_users", label: "System Users", icon: Users2 },
        { id: "settings", label: "System Settings", icon: Settings },
      ];
    } else if (currentRole.type === "restaurant_owner") {
      return [
        { id: "restaurant_application", label: "Apply & Status", icon: Store },
      ];
    } else {
      return [
        {
          id: "restaurants",
          label: "My Dashboard",
          icon: LayoutDashboard,
        },
      ];
    }
  };

  const menuItems = getMenuItems();
  const activeRestaurant =
    currentRole.type === "restaurant"
      ? restaurants.find((r) => r.id === currentRole.restaurantId)
      : null;

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          onClick={onClose}
        />
      )}

      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 text-zinc-300 flex flex-col h-full border-r border-zinc-800 shrink-0
        transition-transform duration-300 ease-out transform lg:translate-x-0 lg:static lg:h-full lg:z-auto
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
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
                  ? "Admin"
                  : currentRole.type === "restaurant_owner"
                    ? "Owner"
                    : "Store"}
              </span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-semibold tracking-widest uppercase">
              {currentRole.type === "admin"
                ? "Operations Portal"
                : currentRole.type === "restaurant_owner"
                  ? "Partner Applicant"
                  : "Merchant Hub"}
            </p>
          </div>
        </div>

        {/* ROLE IMPERSONATOR DROP-DOWN REMOVED AS REQUESTED */}
        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          <p className="px-3 text-[10px] font-bold text-zinc-600 tracking-wider uppercase mb-2">
            Main Menu
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
                    ? "bg-gradient-to-r from-orange-500/10 to-red-500/5 text-orange-400 border-l-2 border-orange-500 pl-2.5"
                    : "hover:bg-zinc-900/60 hover:text-white border-l-2 border-transparent"
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
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 font-bold shadow text-xs uppercase shrink-0">
              {currentRole.type === "admin"
                ? "HA"
                : currentRole.type === "restaurant_owner"
                  ? "OW"
                  : activeRestaurant?.logo || "ST"}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentRole.type === "admin"
                  ? "Hassan Al-Sabeh"
                  : currentRole.type === "restaurant_owner"
                    ? "Store Applicant"
                    : activeRestaurant?.name}
              </p>
              <p className="text-[10px] text-zinc-500 truncate font-semibold">
                {currentRole.type === "admin"
                  ? "Root Administrator"
                  : currentRole.type === "restaurant_owner"
                    ? "Pending Registration"
                    : `${activeRestaurant?.cuisine.split(",")[0]} Partner`}
              </p>
            </div>

            <button
              className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 hover:bg-zinc-800 rounded-lg shrink-0"
              title="Logout"
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to log out of the admin panel?",
                  )
                ) {
                  localStorage.removeItem("token");
                  window.location.reload();
                }
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
