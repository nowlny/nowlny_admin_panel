"use client";

import { useEffect } from "react";

import { useI18n } from "../lib/i18n";
/**
 * Route-level error boundary (Next.js App Router).
 *
 * Without this, an uncaught render error blanks the page and nothing is
 * reported — the operator sees a white screen and you learn nothing. It also
 * gives a recovery path (`reset`) that does not require a full reload.
 *
 * TODO(WS-18): forward `error` to Sentry here once a DSN is provisioned.
 * The console.error below is the interim signal.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    // `digest` is the server-side correlation id for this crash.
    console.error("[error-boundary]", error?.digest ?? "", error);
  }, [error]);

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h2 style={styles.title}>{t("error.title")}</h2>
        <p style={styles.body}>
          The page failed to load. You can retry, or reload if it keeps
          happening.
        </p>
        {error?.digest ? (
          <p style={styles.digest}>Reference: {error.digest}</p>
        ) : null}
        <button onClick={reset} style={styles.button}>
          {t("error.retry")}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "60vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: { maxWidth: 420, textAlign: "center" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  body: { opacity: 0.7, marginBottom: 16, lineHeight: 1.5 },
  digest: { opacity: 0.5, fontSize: 12, marginBottom: 16 },
  button: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#FF4500",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
};
