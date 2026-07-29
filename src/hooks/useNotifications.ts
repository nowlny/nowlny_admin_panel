"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchToken, onMessageListener } from "../lib/firebase";
import { usersService } from "../services/users";

export interface FCMToast {
  id: string;
  title: string;
  body: string;
  icon?: string;
}

export type PushPermission = "unsupported" | NotificationPermission;

function currentPermission(): PushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function useNotifications(isAuthenticated: boolean) {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<FCMToast | null>(
    null,
  );
  // Lazily read the real permission. On the server this resolves to
  // "unsupported" and no consumer of this hook renders before hydration.
  const [permission, setPermission] =
    useState<PushPermission>(currentPermission);
  const [isRequesting, setIsRequesting] = useState(false);

  const registerToken = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return null;
    setFcmToken(token);
    try {
      await usersService.registerDeviceToken({ token });
    } catch (err) {
      console.warn("Could not register device token with the server:", err);
    }
    return token;
  }, []);

  /**
   * Must be called from a user gesture.
   *
   * Previously the hook called `Notification.requestPermission()` the instant
   * the user authenticated — the browser prompt appeared before the dashboard
   * had even painted, with no explanation of what it was for. Browsers treat a
   * dismissal as a permanent block, so one reflexive click disabled order
   * alerts forever, and the `denied` branch only logged to the console so the
   * UI never said push was off.
   */
  const requestPermission = useCallback(async () => {
    if (currentPermission() === "unsupported") return "unsupported" as const;

    setIsRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") await registerToken();
      return result;
    } catch (err) {
      console.error("Error requesting notification permission:", err);
      return Notification.permission;
    } finally {
      setIsRequesting(false);
    }
  }, [registerToken]);

  // If permission was already granted on a previous visit, silently refresh the
  // device token — no prompt is shown in that case.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentPermission() !== "granted") return;
    registerToken().catch((err) =>
      console.warn("Could not refresh device token:", err),
    );
  }, [isAuthenticated, registerToken]);

  useEffect(() => {
    if (!fcmToken) return;

    let active = true;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const setupListener = async () => {
      try {
        while (active) {
          const payload = (await onMessageListener()) as {
            notification?: { title?: string; body?: string; image?: string };
          };
          if (!active) break;
          if (!payload?.notification) continue;

          // Only the in-app toast is shown. Previously this ALSO constructed a
          // native `new Notification(...)`, so a single push produced two
          // simultaneous alerts for the same message.
          setNotificationToast({
            id: `${Date.now()}`,
            title: payload.notification.title || "New Notification",
            body: payload.notification.body || "",
            icon: payload.notification.image,
          });

          clearTimeout(hideTimer);
          hideTimer = setTimeout(() => setNotificationToast(null), 6000);
        }
      } catch (e) {
        console.error("Error in onMessageListener", e);
      }
    };

    setupListener();

    return () => {
      active = false;
      clearTimeout(hideTimer);
    };
  }, [fcmToken]);

  return {
    fcmToken,
    notificationToast,
    setNotificationToast,
    permission,
    requestPermission,
    isRequesting,
  };
}
