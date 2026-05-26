"use client";

import React, { useState, useEffect } from "react";
import Sidebar, { Role } from "./components/Sidebar";
import Header from "./components/Header";
import OverviewSection from "./components/OverviewSection";
import RestaurantsSection from "./components/RestaurantsSection";
import CustomersSection from "./components/CustomersSection";
import OrdersSection from "./components/OrdersSection";
import DriversSection from "./components/DriversSection";
import PromosSection from "./components/PromosSection";
import ReportsSection from "./components/ReportsSection";
import SettingsSection from "./components/SettingsSection";
import SystemUsersSection from "./components/SystemUsersSection";
import RestaurantCategoriesSection from "./components/RestaurantCategoriesSection";
import CurrenciesSection from "./components/CurrenciesSection";
import LoginScreen from "./components/LoginScreen";
import { useNotifications } from "../hooks/useNotifications";

// Restaurant-specific views
import RestaurantOverviewSection from "./components/RestaurantOverviewSection";
import RestaurantMenuSection from "./components/RestaurantMenuSection";
import RestaurantSettingsSection from "./components/RestaurantSettingsSection";
import RestaurantApplicationSection from "./components/RestaurantApplicationSection";
import {
  restaurantsService,
  RestaurantSubmission,
} from "../services/restaurants";

import {
  loadDb,
  saveDb,
  Restaurant,
  Customer,
  Driver,
  Order,
  PromoCode,
  SystemSettings,
  SystemNotification,
} from "./data/mockData";

export default function Home() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Stateful DB
  const [db, setDb] = useState<ReturnType<typeof loadDb> | null>(null);

  // Stats for the sidebar
  const [pendingRestaurantsCount, setPendingRestaurantsCount] = useState(0);

  // Access control role state
  const [currentRole, setCurrentRole] = useState<Role>({ type: "admin" });

  // Merchant submission state (for restaurant_owner JWT type)
  const [merchantSubmission, setMerchantSubmission] =
    useState<RestaurantSubmission | null>(null);

  // Initialize FCM notifications if authenticated
  const { fcmToken, notificationToast, setNotificationToast } = useNotifications(!!authToken);

  // Initialize theme from localStorage/system preferences on mount
  useEffect(() => {
    let darkPreference = false;
    try {
      const stored = window.localStorage.getItem("nowlny_theme");
      if (stored) {
        darkPreference = stored === "dark";
      } else {
        darkPreference = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
      }
    } catch (e) {
      darkPreference = false;
    }
    setIsDarkMode(darkPreference);
  }, []);

  // Update DOM and localstorage when theme state changes
  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
        window.localStorage.setItem("nowlny_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        window.localStorage.setItem("nowlny_theme", "light");
      }
    } catch (e) {
      // safe fallback for iframe security containers
    }
  }, [isDarkMode]);

  // Load database from localStorage on mount (hydration safety check)
  useEffect(() => {
    const loadedData = loadDb();
    setDb(loadedData);

    // Check for auth token
    const token = localStorage.getItem("token");
    if (token) {
      setAuthToken(token);
    }

    setIsHydrated(true);
  }, []);

  // JWT token decoder (zero-dependency, client-side only)
  const decodeToken = (token: string): Record<string, any> | null => {
    try {
      const payload = token.split(".")[1];
      // Pad base64 string to multiple of 4
      const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
      return JSON.parse(window.atob(padded));
    } catch {
      return null;
    }
  };

  // Fetch and refresh merchant submission status (for restaurant_owner role)
  const refetchSubmissionStatus = async () => {
    try {
      const data = await restaurantsService.getMySubmission();
      setMerchantSubmission(data);
      // If approved and has a linked restaurantId, switch to store dashboard
      if (data.status === "approved" && data.restaurantId) {
        setCurrentRole({ type: "restaurant", restaurantId: data.restaurantId });
        handleTabChange("restaurants");
      }
    } catch (err: any) {
      // 404 means no submission yet – expected state for new owners
      if (!err?.message?.includes("404")) {
        console.error("Failed to fetch submission status:", err);
      }
      setMerchantSubmission(null);
    }
  };

  // Decode JWT and determine role / initial tab whenever the token changes
  useEffect(() => {
    if (!authToken) return;

    const decoded = decodeToken(authToken);
    if (!decoded) return;

    if (decoded.userType === "restaurant_owner") {
      // Keep role as restaurant_owner and fetch their submission
      setCurrentRole({ type: "restaurant_owner" });
      handleTabChange("restaurant_application");
      refetchSubmissionStatus();
    } else {
      // Default: treat as admin
      setCurrentRole({ type: "admin" });
      handleTabChange("overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // Fetch pending count from API for the sidebar
  useEffect(() => {
    // Only verify admin if there's a token and role is admin
    if (authToken && currentRole.type === "admin") {
      restaurantsService
        .getSubmissions({ status: "pending", limit: 1 })
        .then((subs: any) => {
          if (subs && typeof subs.total === "number") {
            setPendingRestaurantsCount(subs.total);
          } else if (
            subs &&
            typeof subs === "object" &&
            Array.isArray(subs.data)
          ) {
            setPendingRestaurantsCount(
              subs.data.filter((s: any) => s.status === "pending").length,
            );
          } else if (Array.isArray(subs)) {
            setPendingRestaurantsCount(
              subs.filter((s) => s.status === "pending").length,
            );
          } else {
            console.warn(
              "Expected valid response from getSubmissions but got:",
              subs,
            );
            setPendingRestaurantsCount(0);
          }
        })
        .catch((err) => {
          console.warn("Sidebar count fetch failed (ignoring):", err.message);
          setPendingRestaurantsCount(0);
        });
    }
  }, [currentRole.type, activeTab, authToken]);

  // Sync tab state with URL hash to support browser back button
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setActiveTab(hash);
      } else {
        setActiveTab(
          currentRole.type === "admin"
            ? "overview"
            : currentRole.type === "restaurant_owner"
              ? "restaurant_application"
              : "restaurant_overview",
        );
      }
    };

    onHashChange(); // Trigger on mount

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [currentRole.type]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Sync to localStorage on React state changes
  const updateDb = (newDb: ReturnType<typeof loadDb>) => {
    setDb(newDb);
    saveDb(newDb);
  };

  if (!isHydrated || !db) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center animate-pulse shadow-lg shadow-orange-500/20">
          <span className="text-white font-black text-xl">N</span>
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">
            NOWLNY DELIVERIES
          </h2>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">
            Booting administrative interface...
          </p>
        </div>
      </div>
    );
  }

  if (!authToken) {
    return <LoginScreen onLoginSuccess={setAuthToken} />;
  }

  // Orders badge: live count is managed inside OrdersSection via the API
  const pendingOrdersCount = 0;

  // Stats for the sidebar are now updated via useEffect at the top level
  const pendingDriversCount = db.drivers.filter(
    (d) => d.verificationStatus === "Pending",
  ).length;

  // Global Actions handlers
  const handleUpdateRestaurant = (updatedRest: Restaurant) => {
    const nextRestaurants = db.restaurants.map((r) =>
      r.id === updatedRest.id ? updatedRest : r,
    );
    updateDb({ ...db, restaurants: nextRestaurants });
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    const nextCustomers = db.customers.map((c) =>
      c.id === updatedCust.id ? updatedCust : c,
    );
    updateDb({ ...db, customers: nextCustomers });
  };

  const handleUpdateDriver = (updatedDriver: Driver) => {
    const nextDrivers = db.drivers.map((d) =>
      d.id === updatedDriver.id ? updatedDriver : d,
    );
    updateDb({ ...db, drivers: nextDrivers });
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    const nextOrders = db.orders.map((o) =>
      o.id === updatedOrder.id ? updatedOrder : o,
    );
    updateDb({ ...db, orders: nextOrders });
  };

  const handleUpdatePromos = (nextPromos: PromoCode[]) => {
    updateDb({ ...db, promos: nextPromos });
  };

  const handleUpdateSettings = (nextSettings: SystemSettings) => {
    updateDb({ ...db, settings: nextSettings });
  };

  // Notification methods
  const handleMarkNotificationRead = (notifId: string) => {
    const nextNotifs = db.notifications.map((n) =>
      n.id === notifId ? { ...n, read: true } : n,
    );
    updateDb({ ...db, notifications: nextNotifs });
  };

  const handleClearAllNotifications = () => {
    updateDb({ ...db, notifications: [] });
  };

  const handleSendNotification = (
    title: string,
    body: string,
    recipient: "all" | "customers" | "restaurants" | "drivers",
  ) => {
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      title,
      body,
      recipientType: recipient,
      timestamp: new Date().toISOString(),
      read: false,
    };

    const nextNotifs = [newNotif, ...db.notifications];
    updateDb({ ...db, notifications: nextNotifs });
  };

  // Fast-track Overview Approvals
  const handleApproveRestaurantFromOverview = (restId: string) => {
    const target = db.restaurants.find((r) => r.id === restId);
    if (target) {
      handleUpdateRestaurant({ ...target, status: "Active" });
      handleSendNotification(
        "Restaurant Approved",
        `Merchant ${target.name} has been approved by the platform team and is now live.`,
        "restaurants",
      );
    }
  };

  const handleApproveDriverFromOverview = (driverId: string) => {
    const target = db.drivers.find((d) => d.id === driverId);
    if (target) {
      handleUpdateDriver({
        ...target,
        verificationStatus: "Verified",
        status: "Offline",
      });
      handleSendNotification(
        "Rider Approved",
        `Rider ${target.name} has passed vehicle verification and can now login.`,
        "drivers",
      );
    }
  };

  // Role Switching trigger
  const handleRoleChange = (nextRole: Role) => {
    setCurrentRole(nextRole);
    if (nextRole.type === "admin") {
      handleTabChange("overview");
    } else {
      handleTabChange("restaurant_overview");
    }
  };

  // Section Routing
  const renderActiveSection = () => {
    // Check if store scope impersonation is active
    const currentRest =
      currentRole.type === "restaurant"
        ? db.restaurants.find((r) => r.id === currentRole.restaurantId)
        : null;

    switch (activeTab) {
      // Root Administrator Tabs
      case "overview":
        return (
          <OverviewSection
            db={db}
            setActiveTab={handleTabChange}
            onApproveRestaurant={handleApproveRestaurantFromOverview}
            onApproveDriver={handleApproveDriverFromOverview}
          />
        );
      case "restaurants":
        return (
          <RestaurantsSection
            db={db}
            onUpdateRestaurant={handleUpdateRestaurant}
            searchQuery={searchQuery}
            currentRole={currentRole}
          />
        );
      case "restaurant_categories":
        return <RestaurantCategoriesSection />;
      case "customers":
        return <CustomersSection db={db} searchQuery={searchQuery} />;
      case "orders":
        return <OrdersSection searchQuery={searchQuery} />;
      case "drivers":
        return (
          <DriversSection
            db={db}
            onUpdateDriver={handleUpdateDriver}
            searchQuery={searchQuery}
          />
        );
      case "promos":
        return (
          <PromosSection
            db={db}
            onUpdatePromos={handleUpdatePromos}
            searchQuery={searchQuery}
          />
        );
      case "reports":
        return <ReportsSection db={db} searchQuery={searchQuery} />;
      case "system_users":
        return <SystemUsersSection />;
      case "currencies":
        return <CurrenciesSection searchQuery={searchQuery} />;
      case "settings":
        return (
          <SettingsSection
            db={db}
            onUpdateSettings={handleUpdateSettings}
            onSendNotification={handleSendNotification}
          />
        );


      // Restaurant Owner (applicant) portal
      case "restaurant_application":
        return (
          <RestaurantApplicationSection
            initialSubmission={merchantSubmission}
            onRefreshSubmissionStatus={refetchSubmissionStatus}
          />
        );

      default:
        return <div className="p-8 text-xs font-bold">Routing Error</div>;
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black font-sans overflow-hidden text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Sidebar Panel */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          handleTabChange(tab);
          setSearchQuery(""); // Reset search query when changing screens
        }}
        pendingOrdersCount={pendingOrdersCount}
        pendingRestaurantsCount={pendingRestaurantsCount}
        pendingDriversCount={pendingDriversCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRole={currentRole}
        onChangeRole={handleRoleChange}
        restaurants={db.restaurants}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Universal Operations Header */}
        <Header
          title={activeTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          notifications={db.notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onClearAllNotifications={handleClearAllNotifications}
          onOpenSidebar={() => setSidebarOpen(true)}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        />

        {/* Scrollable Section Space */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="max-w-7xl mx-auto">{renderActiveSection()}</div>
        </main>
      </div>

      {/* FCM Notification Toast */}
      {notificationToast && (
        <div className="fixed top-6 right-6 z-[9999] bg-white dark:bg-zinc-900 border border-orange-500/30 dark:border-orange-500/30 shadow-2xl shadow-orange-500/10 rounded-2xl p-4 w-80 animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {notificationToast.icon ? (
                <img src={notificationToast.icon} alt="icon" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                  {notificationToast.title}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                  {notificationToast.body}
                </span>
              </div>
            </div>
            <button
              onClick={() => setNotificationToast(null)}
              className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg shrink-0 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
