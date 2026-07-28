"use client";

import { useEffect, useSyncExternalStore } from "react";

const LOCALE_STORAGE_KEY = "nowlny_locale";

/** Nothing to subscribe to: the language cannot change while this page is up. */
const subscribeToLocale = () => () => {};

const readIsArabic = () => {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY) === "ar";
  } catch {
    return false; /* storage blocked — English is a safe fallback */
  }
};

/**
 * Last-resort boundary for errors thrown in the root layout itself, where the
 * route-level `error.tsx` cannot mount. It must render its own <html>/<body>
 * because the failing layout never produced them.
 *
 * `useI18n()` is unavailable here for the same reason: this component replaces
 * the root layout, so `I18nProvider` was never mounted. The two strings it
 * needs are resolved from `localStorage` directly instead — the same key the
 * pre-paint script in `layout.tsx` reads.
 *
 * TODO(WS-18): forward to Sentry once a DSN is provisioned.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Server-render in English, then adopt the stored language on hydration.
  // `useSyncExternalStore` is what keeps that off an effect: it hands React a
  // separate server snapshot, so reading storage never needs a setState pass.
  const isArabic = useSyncExternalStore(
    subscribeToLocale,
    readIsArabic,
    () => false,
  );

  useEffect(() => {
    console.error("[global-error]", error?.digest ?? "", error);
  }, [error]);

  const copy = isArabic
    ? { title: "حدث خطأ ما", retry: "حاول مجددًا" }
    : { title: "Something went wrong", retry: "Try again" };

  return (
    <html lang={isArabic ? "ar" : "en"} dir={isArabic ? "rtl" : "ltr"}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            {copy.title}
          </h2>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#FF4500",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
