"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Sidebar, { Role, tabLabel } from "../components/Sidebar";
import Header from "../components/Header";
import OverviewSection from "../components/OverviewSection";
import RestaurantsSection from "../components/RestaurantsSection";
import CustomersSection from "../components/CustomersSection";
import OrdersSection from "../components/OrdersSection";
import SystemUsersSection from "../components/SystemUsersSection";
import RestaurantCategoriesSection from "../components/RestaurantCategoriesSection";
import MenuTagsPanel from "../components/MenuTagsPanel";
import CurrenciesSection from "../components/CurrenciesSection";
import NotificationsSection from "../components/NotificationsSection";
import SmsGatewaySection from "../components/SmsGatewaySection";
import LoginScreen from "../components/LoginScreen";
import DeliveryCompaniesSection from "../components/DeliveryCompaniesSection";
import { useNotifications } from "../../hooks/useNotifications";

// Restaurant-specific views
import RestaurantApplicationSection from "../components/RestaurantApplicationSection";
import AppVersionSection from "../components/AppVersionSection";
import {
  restaurantsService,
  RestaurantSubmission,
} from "../../services/restaurants";
import { usersService, SystemUser } from "../../services/users";
import { ordersService } from "../../services/orders";
import RestaurantOverviewSection from "../components/RestaurantOverviewSection";
import RestaurantReelsSection from "../components/RestaurantReelsSection";
import ReelsSection from "../components/ReelsSection";
import { EmptyState } from "../components/ui/States";
import { Compass } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { applyThemeClass, THEME_STORAGE_KEY } from "../../lib/theme";

/**
 * Sections that actually consume the global `searchQuery` prop. On every other
 * tab the header's search box was a dead control that silently did nothing.
 */
const SEARCHABLE_TABS = new Set([
  "restaurants",
  "delivery_companies",
  "customers",
  "orders",
  "currencies",
]);

export default function Home() {
  const pathname = usePathname();
  const { t } = useI18n();

  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Stats for the sidebar
  const [pendingRestaurantsCount, setPendingRestaurantsCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Access control role state
  const [currentRole, setCurrentRole] = useState<Role>({ type: "admin" });

  // The signed-in operator. The sidebar used to hardcode "Hassan Al-Sabeh /
  // Root Administrator" for every admin, so nobody could tell which account
  // they were acting as.
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);

  // `currentRole` starts at `admin`, so anything keyed only on it would fire
  // admin-only requests before the token has been decoded — 403s for every
  // non-admin. Admin-scoped fetches wait for this flag instead.
  const [isRoleResolved, setIsRoleResolved] = useState(false);

  // Merchant submission state (for restaurant_owner JWT type)
  const [merchantSubmission, setMerchantSubmission] =
    useState<RestaurantSubmission | null>(null);

  // Initialize FCM notifications if authenticated
  const {
    notificationToast,
    setNotificationToast,
    permission: pushPermission,
    requestPermission: requestPushPermission,
    isRequesting: isRequestingPush,
  } = useNotifications(!!authToken);

  // Adopt whatever the pre-paint script in layout.tsx already put on <html>,
  // so React state and the DOM agree from the first render.
  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  /**
   * Flip the palette. The class on <html> is set alongside React state so the
   * DOM and the component agree in the same frame — the swap is instant, with
   * no transition of any kind.
   */
  const handleToggleTheme = useCallback(() => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    applyThemeClass(next);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // safe fallback for iframe security containers
    }
  }, [isDarkMode]);

  // Pick up an existing session on mount.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setAuthToken(token);
    setIsHydrated(true);
  }, []);

  /**
   * `apiClient` raises this once a refresh has definitively failed. Without it
   * the panel sat on a dead session firing 401s until the operator reloaded.
   */
  useEffect(() => {
    const onExpired = () => {
      setAuthToken(null);
      setIsRoleResolved(false);
      setCurrentUser(null);
      import("react-hot-toast").then((toast) =>
        toast.default.error("Your session expired. Please sign in again."),
      );
    };
    window.addEventListener("nowlny:session-expired", onExpired);
    return () => window.removeEventListener("nowlny:session-expired", onExpired);
  }, []);

  // JWT token decoder (zero-dependency, client-side only).
  //
  // JWTs are base64URL-encoded: the alphabet uses `-` and `_` where standard
  // base64 uses `+` and `/`. `window.atob` rejects those two characters, so
  // the previous version threw for any token whose payload happened to contain
  // one — intermittently, depending on the bytes. A null result then made the
  // role-resolution effect bail out early while `currentRole` was still at its
  // default of `admin`, so the panel issued admin-only requests for whoever
  // was signed in and the API answered 403.
  const decodeToken = (token: string): Record<string, unknown> | null => {
    try {
      const segment = token.split(".")[1];
      if (!segment) return null;
      const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      // Decode as UTF-8 so non-ASCII names in the payload survive.
      const json = decodeURIComponent(
        window
          .atob(padded)
          .split("")
          .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join(""),
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  /**
   * Switch section.
   *
   * This used to call `router.push("/" + tab)`. Every tab is a different value
   * of the `[[...tab]]` catch-all, and the App Router keys a route segment by
   * its parameter — so changing it unmounted and remounted this entire
   * component. `isHydrated` went back to false (the "Booting administrative
   * interface" splash flashed up), the decoded role was thrown away, and every
   * effect re-ran, refetching the sidebar counters and the whole section. A
   * sidebar click cost a full app boot.
   *
   * The active tab is client state; the URL only has to mirror it so links and
   * refreshes keep working. `history.pushState` updates the address bar
   * without asking the router to navigate anywhere.
   */
  const handleTabChange = useCallback(
    (tab: string, { replace = false }: { replace?: boolean } = {}) => {
      setActiveTab(tab);
      if (typeof window === "undefined") return;
      if (window.location.pathname === `/${tab}`) return;
      // `replace` is for the landing redirect (`/` → `/overview`), so Back
      // leaves the panel instead of bouncing between the two.
      if (replace) window.history.replaceState(null, "", `/${tab}`);
      else window.history.pushState(null, "", `/${tab}`);
    },
    [],
  );

  // Fetch and refresh merchant submission status (for restaurant_owner role)
  const refetchSubmissionStatus = useCallback(async () => {
    try {
      // `/restaurants/me/submission` answers with a paginated list, newest
      // first — reading `.status` off the envelope gave `undefined` and left
      // every owner staring at the "apply now" screen.
      const data = await restaurantsService.getLatestSubmission();
      setMerchantSubmission(data);
      // If approved and linked to a restaurant, switch to the store dashboard.
      if (data?.status === "approved" && data.restaurantId) {
        setCurrentRole({ type: "restaurant", restaurantId: data.restaurantId });
        handleTabChange("restaurants");
      }
    } catch (err) {
      console.warn(
        "Failed to fetch submission status:",
        err instanceof Error ? err.message : err,
      );
      setMerchantSubmission(null);
    }
  }, [handleTabChange]);

  const rejectSession = (message: string) => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setAuthToken(null);
    setIsRoleResolved(false);
    import("react-hot-toast").then((toast) => toast.default.error(message));
  };

  // Decode JWT and determine role / initial tab whenever the token changes
  useEffect(() => {
    if (!authToken) return;

    const decoded = decodeToken(authToken);
    if (!decoded) {
      // Previously this returned early, leaving `currentRole` at its default
      // of `admin` with the token still stored — the panel then rendered the
      // admin UI and every admin-only request 403'd, with nothing explaining
      // why. An undecodable token is a dead session; say so and sign out.
      rejectSession("Your session is invalid. Please sign in again.");
      return;
    }

    const currentHash = pathname === "/" ? "" : pathname.replace("/", "");
    const userType = decoded.userType as string | undefined;

    if (userType === "restaurant_owner") {
      // Keep role as restaurant_owner and fetch their submission
      setCurrentRole({ type: "restaurant_owner" });
      setIsRoleResolved(true);
      handleTabChange(currentHash || "restaurant_application", {
        replace: !currentHash,
      });
      refetchSubmissionStatus();
    } else if (userType === "admin" || userType === "super_admin") {
      setCurrentRole({ type: "admin" });
      setIsRoleResolved(true);
      handleTabChange(currentHash || "overview", { replace: !currentHash });
    } else {
      // Reject unauthorized users (e.g. customers, drivers). Naming the actual
      // role turns "why am I locked out?" into a one-line answer.
      rejectSession(
        userType
          ? `This account is registered as "${userType}". Admin or Restaurant Owner access is required for the admin panel.`
          : "This account has no role assigned. Admin or Restaurant Owner access is required.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // Load the signed-in operator's profile for the sidebar identity block.
  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      return;
    }
    let cancelled = false;
    usersService
      .getMe()
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch((err) => {
        // Non-fatal: the sidebar falls back to a neutral label.
        console.warn("Could not load current user:", err?.message);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Keep the browser tab title in sync with the active section.
  useEffect(() => {
    if (!activeTab) return;
    document.title = `${tabLabel(activeTab, t)} · Nowlny Admin`;
  }, [activeTab, t]);

  // Pending-application badge for the sidebar.
  useEffect(() => {
    if (!authToken || !isRoleResolved || currentRole.type !== "admin") return;

    let cancelled = false;
    restaurantsService
      .getSubmissions({ status: "pending", limit: 1 })
      .then((res) => {
        if (!cancelled) setPendingRestaurantsCount(res.total);
      })
      .catch((err) => {
        console.warn("Sidebar count fetch failed (ignoring):", err?.message);
        if (!cancelled) setPendingRestaurantsCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentRole.type, activeTab, authToken, isRoleResolved]);

  // Keep the sidebar's "Live Orders" badge honest. It was previously
  // hardcoded to 0, so the badge never appeared no matter how many orders
  // were waiting — the one number an operator most needs at a glance.
  useEffect(() => {
    if (!authToken || !isRoleResolved || currentRole.type !== "admin") return;

    let cancelled = false;
    const loadPendingOrders = () => {
      ordersService
        .getOrders({ status: "pending", limit: 1 })
        .then((res) => {
          if (!cancelled && typeof res?.total === "number") {
            setPendingOrdersCount(res.total);
          }
        })
        .catch((err) =>
          console.warn("Pending order count unavailable:", err?.message),
        );
    };

    loadPendingOrders();
    const id = setInterval(loadPendingOrders, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authToken, currentRole.type, isRoleResolved]);

  /**
   * Back / forward support.
   *
   * `history.pushState` is picked up by the App Router, so `usePathname`
   * reflects our own URL writes as well as the browser's, and a popstate lands
   * here. Setting the tab we are already on is a no-op re-render, not a
   * remount — which is the whole point of driving the URL this way.
   */
  useEffect(() => {
    const tab = pathname === "/" ? "" : pathname.replace("/", "");
    if (tab) {
      setActiveTab(tab);
    } else {
      setActiveTab(
        currentRole.type === "admin"
          ? "overview"
          : currentRole.type === "restaurant_owner"
            ? "restaurant_application"
            : "restaurants",
      );
    }
  }, [pathname, currentRole.type]);

  if (!isHydrated) {
    return (
      // The boot screen was hardcoded to `bg-zinc-950`, so every light-mode
      // user got a full-screen dark flash on each load.
      <div className="fixed inset-0 bg-white dark:bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center animate-pulse shadow-lg shadow-orange-500/20">
          <span className="text-white font-black text-xl">N</span>
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-widest">
            {t("boot.brand")}
          </h2>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-widest">
            {t("boot.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (!authToken) {
    return <LoginScreen onLoginSuccess={setAuthToken} />;
  }

  /** Where "back to safety" goes for the signed-in role. */
  const homeTab =
    currentRole.type === "admin"
      ? "overview"
      : currentRole.type === "restaurant_owner"
        ? "restaurant_application"
        : "restaurant_overview";

  // Section Routing
  const renderActiveSection = () => {
    switch (activeTab) {
      // Root Administrator Tabs
      case "overview":
        return <OverviewSection setActiveTab={handleTabChange} />;
      case "restaurants":
        return (
          <RestaurantsSection
            searchQuery={searchQuery}
            currentRole={currentRole}
          />
        );
      case "restaurant_categories":
        return <RestaurantCategoriesSection />;
      case "menu_tags":
        return <MenuTagsPanel />;
      case "delivery_companies":
        return <DeliveryCompaniesSection searchQuery={searchQuery} />;
      case "customers":
        return <CustomersSection searchQuery={searchQuery} />;
      case "orders":
        return <OrdersSection searchQuery={searchQuery} />;
      case "system_users":
        return <SystemUsersSection />;
      case "currencies":
        return <CurrenciesSection searchQuery={searchQuery} />;
      case "notifications":
        return <NotificationsSection />;
      case "sms_gateway":
        return <SmsGatewaySection />;
      case "app_version":
        return <AppVersionSection />;
      case "reels":
        return <ReelsSection />;

      // Merchant portal
      case "restaurant_overview":
        return <RestaurantOverviewSection setActiveTab={handleTabChange} />;

      // Restaurant Owner (applicant) portal
      case "restaurant_application":
        return (
          <RestaurantApplicationSection
            initialSubmission={merchantSubmission}
            onRefreshSubmissionStatus={refetchSubmissionStatus}
          />
        );
      case "restaurant_reels":
        return <RestaurantReelsSection />;

      default:
        /*
         * An unknown path used to render the bare text "Routing Error" with no
         * way back — reachable from any typo in the address bar, and from
         * `/restaurant_overview`, which the role switcher itself linked to.
         */
        return (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <EmptyState
              icon={Compass}
              title={t("route.not_found_title")}
              hint={t("route.not_found_body", { tab: activeTab })}
              action={
                <button
                  onClick={() => handleTabChange(homeTab)}
                  className="text-xs font-bold px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm"
                >
                  {t("route.go_to", { tab: tabLabel(homeTab, t) })}
                </button>
              }
            />
          </div>
        );
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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRole={currentRole}
        currentUser={currentUser}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Universal Operations Header */}
        <Header
          title={activeTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenSidebar={() => setSidebarOpen(true)}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          notificationToast={notificationToast}
          searchEnabled={SEARCHABLE_TABS.has(activeTab)}
          pushPermission={pushPermission}
          onEnablePush={requestPushPermission}
          isRequestingPush={isRequestingPush}
        />

        {/* Scrollable Section Space */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="max-w-7xl mx-auto">{renderActiveSection()}</div>
        </main>
      </div>

      {/* FCM Notification Toast */}
      {notificationToast && (
        <div className="fixed top-6 end-6 z-[9999] bg-white dark:bg-zinc-900 border border-orange-500/30 dark:border-orange-500/30 shadow-2xl shadow-orange-500/10 rounded-2xl p-4 w-80 animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {notificationToast.icon ? (
                <img
                  src={notificationToast.icon}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
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
              aria-label={t("page.dismiss_notification")}
              className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg shrink-0 transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
