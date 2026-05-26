"use client";

import { useEffect, useState } from "react";
import { fetchToken, onMessageListener } from "../lib/firebase";
import { usersService } from "../services/users";

export interface FCMToast {
  id: string;
  title: string;
  body: string;
  icon?: string;
}

export function useNotifications(isAuthenticated: boolean) {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<FCMToast | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const requestPermissionAndToken = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          console.log("Notification permission granted.");
          const token = await fetchToken();
          if (token) {
            setFcmToken(token);
            // Send token to backend
            await usersService.updateFCMToken(token);
            console.log("=========================================");
            console.log("FCM Token successfully generated!");
            console.log(token);
            console.log("Copy this token and use Firebase Console to send a test message.");
            console.log("=========================================");
          } else {
            console.warn("Failed to generate FCM token.");
          }
        } else {
          console.log("Notification permission denied.");
        }
      } catch (err) {
        console.error("Error setting up notifications:", err);
      }
    };

    requestPermissionAndToken();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!fcmToken) return;

    // Set up foreground listener
    let active = true;
    const setupListener = async () => {
      try {
        while (active) {
          const payload: any = await onMessageListener();
          if (!active) break;
          // You can show a custom toast here
          // For now, we'll just log and use standard browser notification if supported
          console.log("Received foreground message:", payload);
          if (payload?.notification) {
            new Notification(payload.notification.title || "New Notification", {
              body: payload.notification.body,
              icon: payload.notification.image || "/icon.png",
            });
            
            setNotificationToast({
              id: Date.now().toString(),
              title: payload.notification.title || "New Notification",
              body: payload.notification.body || "",
              icon: payload.notification.image,
            });

            // Auto-hide toast after 5 seconds
            setTimeout(() => {
              setNotificationToast(null);
            }, 5000);
          }
        }
      } catch (e) {
        console.error("Error in onMessageListener", e);
      }
    };

    setupListener();

    return () => {
      active = false;
    };
  }, [fcmToken]);

  return { fcmToken, notificationToast, setNotificationToast };
}
