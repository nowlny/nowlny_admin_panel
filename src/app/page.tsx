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
import LoginScreen from "./components/LoginScreen";

// Restaurant-specific views
import RestaurantOverviewSection from "./components/RestaurantOverviewSection";
import RestaurantMenuSection from "./components/RestaurantMenuSection";
import RestaurantSettingsSection from "./components/RestaurantSettingsSection";

import { 
  loadDb, 
  saveDb, 
  Restaurant, 
  Customer, 
  Driver, 
  Order, 
  PromoCode, 
  SystemSettings, 
  SystemNotification 
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

  // Access control role state
  const [currentRole, setCurrentRole] = useState<Role>({ type: "admin" });

  // Initialize theme from localStorage/system preferences on mount
  useEffect(() => {
    let darkPreference = false;
    try {
      const stored = window.localStorage.getItem("nowlny_theme");
      if (stored) {
        darkPreference = stored === "dark";
      } else {
        darkPreference = window.matchMedia("(prefers-color-scheme: dark)").matches;
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

  // Sync tab state with URL hash to support browser back button
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setActiveTab(hash);
      } else {
        setActiveTab(currentRole.type === "admin" ? "overview" : "restaurant_overview");
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
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">NOWLNY DELIVERIES</h2>
          <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">Booting administrative interface...</p>
        </div>
      </div>
    );
  }

  if (!authToken) {
    return <LoginScreen onLoginSuccess={setAuthToken} />;
  }

  // Count pending cues for Sidebar badges
  const pendingOrdersCount = currentRole.type === 'restaurant'
    ? db.orders.filter(o => o.status === "Pending" && o.restaurantId === currentRole.restaurantId).length
    : db.orders.filter(o => o.status === "Pending").length;

  const pendingRestaurantsCount = db.restaurants.filter(r => r.status === "Pending").length;
  const pendingDriversCount = db.drivers.filter(d => d.verificationStatus === "Pending").length;

  // Global Actions handlers
  const handleUpdateRestaurant = (updatedRest: Restaurant) => {
    const nextRestaurants = db.restaurants.map(r => r.id === updatedRest.id ? updatedRest : r);
    updateDb({ ...db, restaurants: nextRestaurants });
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    const nextCustomers = db.customers.map(c => c.id === updatedCust.id ? updatedCust : c);
    updateDb({ ...db, customers: nextCustomers });
  };

  const handleUpdateDriver = (updatedDriver: Driver) => {
    const nextDrivers = db.drivers.map(d => d.id === updatedDriver.id ? updatedDriver : d);
    updateDb({ ...db, drivers: nextDrivers });
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    const nextOrders = db.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
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
    const nextNotifs = db.notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
    updateDb({ ...db, notifications: nextNotifs });
  };

  const handleClearAllNotifications = () => {
    updateDb({ ...db, notifications: [] });
  };

  const handleSendNotification = (
    title: string, 
    body: string, 
    recipient: 'all' | 'customers' | 'restaurants' | 'drivers'
  ) => {
    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      title,
      body,
      recipientType: recipient,
      timestamp: new Date().toISOString(),
      read: false
    };

    const nextNotifs = [newNotif, ...db.notifications];
    updateDb({ ...db, notifications: nextNotifs });
  };

  // Fast-track Overview Approvals
  const handleApproveRestaurantFromOverview = (restId: string) => {
    const target = db.restaurants.find(r => r.id === restId);
    if (target) {
      handleUpdateRestaurant({ ...target, status: "Active" });
      handleSendNotification(
        "Restaurant Approved",
        `Merchant ${target.name} has been approved by the platform team and is now live.`,
        "restaurants"
      );
    }
  };

  const handleApproveDriverFromOverview = (driverId: string) => {
    const target = db.drivers.find(d => d.id === driverId);
    if (target) {
      handleUpdateDriver({ ...target, verificationStatus: "Verified", status: "Offline" });
      handleSendNotification(
        "Rider Approved",
        `Rider ${target.name} has passed vehicle verification and can now login.`,
        "drivers"
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
    const currentRest = currentRole.type === 'restaurant'
      ? db.restaurants.find(r => r.id === currentRole.restaurantId)
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
          />
        );
      case "customers":
        return (
          <CustomersSection 
            db={db} 
            onUpdateCustomer={handleUpdateCustomer}
            searchQuery={searchQuery}
          />
        );
      case "orders":
        return (
          <OrdersSection 
            db={db} 
            onUpdateOrder={handleUpdateOrder}
            searchQuery={searchQuery}
          />
        );
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
        return (
          <ReportsSection 
            db={db} 
            searchQuery={searchQuery}
          />
        );
      case "system_users":
        return <SystemUsersSection />;
      case "settings":
        return (
          <SettingsSection 
            db={db} 
            onUpdateSettings={handleUpdateSettings}
            onSendNotification={handleSendNotification}
          />
        );

      // Restaurant Partner Impersonated Tabs
      case "restaurant_overview":
        return currentRest ? (
          <RestaurantOverviewSection 
            restaurant={currentRest}
            db={db}
            setActiveTab={handleTabChange}
            onUpdateOrder={handleUpdateOrder}
          />
        ) : (
          <div className="p-8 text-xs font-bold text-red-500">Impersonation Error: Restaurant not found</div>
        );

      case "restaurant_menu":
        return currentRest ? (
          <RestaurantMenuSection 
            restaurant={currentRest}
            onUpdateRestaurant={handleUpdateRestaurant}
          />
        ) : (
          <div className="p-8 text-xs font-bold text-red-500">Impersonation Error: Restaurant not found</div>
        );

      case "restaurant_orders":
        if (currentRest) {
          // Impersonate database with filtered context
          const storeDb = {
            ...db,
            orders: db.orders.filter(o => o.restaurantId === currentRest.id)
          };
          return (
            <OrdersSection 
              db={storeDb} 
              onUpdateOrder={handleUpdateOrder}
              searchQuery={searchQuery}
            />
          );
        }
        return <div className="p-8 text-xs font-bold text-red-500">Impersonation Error</div>;

      case "restaurant_reports":
        if (currentRest) {
          // Impersonate database for sales reports
          const storeDb = {
            ...db,
            orders: db.orders.filter(o => o.restaurantId === currentRest.id),
            restaurants: db.restaurants.filter(r => r.id === currentRest.id)
          };
          return (
            <ReportsSection 
              db={storeDb} 
              searchQuery={searchQuery}
            />
          );
        }
        return <div className="p-8 text-xs font-bold text-red-500">Impersonation Error</div>;

      case "restaurant_settings":
        return currentRest ? (
          <RestaurantSettingsSection 
            restaurant={currentRest}
            onUpdateRestaurant={handleUpdateRestaurant}
          />
        ) : (
          <div className="p-8 text-xs font-bold text-red-500">Impersonation Error: Restaurant not found</div>
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
          <div className="max-w-7xl mx-auto">
            {renderActiveSection()}
          </div>
        </main>
      </div>
    </div>
  );
}
