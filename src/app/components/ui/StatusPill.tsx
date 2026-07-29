"use client";

import React from "react";
import { humanizeEnum } from "../../../lib/format";
import { useI18n, type MessageKey } from "../../../lib/i18n";

/**
 * One canonical status → colour + label mapping.
 *
 * The app had at least five competing mappings. In the worst case an
 * `approved` merchant rendered with a *red* pill in the detail view (no
 * `approved` branch, so it fell through to the error colour) while the same
 * record rendered green on its card. Colour was also the only status signal,
 * which fails for colour-blind users — hence the label always renders too.
 */

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  warning:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  neutral:
    "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20",
};

/** Backend enums, from the NestJS entities. */
const STATUS_TONES: Record<string, Tone> = {
  // Restaurant / submission / delivery company
  active: "success",
  approved: "success",
  accepted: "success",
  pending: "warning",
  inactive: "neutral",
  cancelled: "neutral",
  hidden: "neutral",
  deleted: "neutral",
  rejected: "danger",
  suspended: "danger",

  // Orders
  confirmed: "info",
  out_for_delivery: "info",
  driver_assigned: "info",
  picked_up: "info",
  delivered: "success",

  // Payments
  paid: "success",
  failed: "danger",
};

/**
 * Statuses that have a translation. Anything outside this set falls back to
 * `humanizeEnum`, so a new backend enum still renders readably rather than
 * printing a raw key.
 */
const TRANSLATED_STATUSES = new Set([
  "active",
  "inactive",
  "pending",
  "approved",
  "accepted",
  "rejected",
  "suspended",
  "cancelled",
  "deleted",
  "hidden",
  "confirmed",
  "out_for_delivery",
  "delivered",
  "paid",
  "failed",
  "queued",
  "sent_to_device",
  "driver_assigned",
  "picked_up",
  "ready_for_pickup",
  "super_admin",
  "admin",
  "restaurant_owner",
  "delivery_company",
  "driver",
  "customer",
]);

const STATUS_LABELS: Record<string, string> = {
  out_for_delivery: "Out for delivery",
  driver_assigned: "Driver assigned",
  picked_up: "Picked up",
  ready_for_pickup: "Ready for pickup",
  super_admin: "Super admin",
  restaurant_owner: "Restaurant owner",
  delivery_company: "Delivery company",
};

export function statusTone(status?: string | null): Tone {
  if (!status) return "neutral";
  return STATUS_TONES[status.toLowerCase()] ?? "neutral";
}

/**
 * `t` is optional so non-component callers keep working; when supplied the
 * label is localised.
 */
export function statusLabel(
  status?: string | null,
  t?: (key: MessageKey) => string,
): string {
  if (!status) return t ? t("status.unknown") : "Unknown";
  const key = status.toLowerCase();
  if (t && TRANSLATED_STATUSES.has(key)) {
    return t(`status.${key}` as MessageKey);
  }
  return STATUS_LABELS[key] ?? humanizeEnum(status);
}

export default function StatusPill({
  status,
  className = "",
}: {
  status?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`w-1.5 h-1.5 rounded-full ${
          tone === "success"
            ? "bg-emerald-500"
            : tone === "warning"
              ? "bg-amber-500"
              : tone === "danger"
                ? "bg-red-500"
                : tone === "info"
                  ? "bg-sky-500"
                  : "bg-zinc-400"
        }`}
      />
      {statusLabel(status, t)}
    </span>
  );
}
