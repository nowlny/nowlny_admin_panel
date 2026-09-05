"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Eraser, MapPin, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "./States";
import { FIELD_CLASS, FieldError } from "./FormControls";
import { useI18n, type MessageKey } from "../../../lib/i18n";
import type { DeliveryZonePayload } from "../../../services/restaurants";
import type { LatLng } from "../RestaurantMapEditorClient";

/* ---------------------------------------------------------------------------
   Delivery-zone list + polygon map shared by the admin add/edit restaurant
   forms. A restaurant can have several named zones; one is "active" and
   drawn on the map, the rest are shown muted for context.
--------------------------------------------------------------------------- */

// Leaflet touches `window` at import time, so the map is client-only.
const RestaurantMapEditor = dynamic(
  () => import("../RestaurantMapEditorClient"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-90 w-full rounded-xl" />,
  },
);

export interface ZoneDraft {
  /** Stable React key — zones have no id until the API creates them. */
  key: string;
  name: string;
  polygon: LatLng[];
}

export interface ZoneError {
  index: number;
  message: string;
}

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

let zoneSeq = 0;
const nextKey = () => `zone-${Date.now().toString(36)}-${zoneSeq++}`;

export const newZoneDraft = (): ZoneDraft => ({
  key: nextKey(),
  name: "",
  polygon: [],
});

/** API zones → editable drafts. Coordinates may arrive as strings. */
export function zonesFromApi(
  zones:
    | { name?: string | null; polygon?: { lat: number | string; lng: number | string }[] | null }[]
    | null
    | undefined,
): ZoneDraft[] {
  return (zones ?? []).map((zone) => ({
    key: nextKey(),
    name: zone.name ?? "",
    polygon: (zone.polygon ?? [])
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
  }));
}

export const zoneLabel = (zone: ZoneDraft, index: number, t: Translate) =>
  zone.name.trim() || t("rest.zone_unnamed", { n: index + 1 });

/** The API rejects a polygon with fewer than three points. */
export function validateZones(
  zones: ZoneDraft[],
  t: Translate,
): ZoneError | null {
  for (let index = 0; index < zones.length; index += 1) {
    if (zones[index].polygon.length < 3) {
      return {
        index,
        message: t("rest.zone_too_small", {
          name: zoneLabel(zones[index], index, t),
        }),
      };
    }
  }
  return null;
}

/** `name` is required by the DTO, so a blank one falls back to "Zone n". */
export function zonesToPayload(
  zones: ZoneDraft[],
  t: Translate,
): DeliveryZonePayload[] {
  return zones.map((zone, index) => ({
    name: zoneLabel(zone, index, t),
    polygon: zone.polygon.map((p) => ({ lat: p.lat, lng: p.lng })),
  }));
}

export const zoneFieldId = (idPrefix: string, index: number) =>
  `${idPrefix}-zone-${index}`;

const ICON_BUTTON =
  "p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

interface DeliveryZonesEditorProps {
  zones: ZoneDraft[];
  onChange: (next: ZoneDraft[]) => void;
  /** The restaurant pin, shown for reference while drawing. */
  pin?: LatLng | null;
  idPrefix: string;
  error?: ZoneError | null;
  disabled?: boolean;
  /** Extra notice above the list — e.g. "still loading" or "load failed". */
  notice?: React.ReactNode;
}

export default function DeliveryZonesEditor({
  zones,
  onChange,
  pin = null,
  idPrefix,
  error,
  disabled = false,
  notice,
}: DeliveryZonesEditorProps) {
  const { t } = useI18n();
  const [selectedIndex, setActiveIndex] = useState(0);

  // The failing zone is the one the operator needs to look at. Done as a
  // render-time adjustment (React's "store information from previous
  // renders" pattern) rather than an effect, so there is no extra commit
  // with the wrong zone on the map.
  const [seenError, setSeenError] = useState<ZoneError | null | undefined>(
    error,
  );
  if (error !== seenError) {
    setSeenError(error);
    if (error && error.index < zones.length) setActiveIndex(error.index);
  }

  // Deleting the last row (or a parent replacing the list wholesale) would
  // otherwise leave the selection pointing at nothing.
  const activeIndex = Math.min(selectedIndex, Math.max(0, zones.length - 1));
  const active = zones[activeIndex];

  const updateZone = (index: number, patch: Partial<ZoneDraft>) =>
    onChange(zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)));

  const addZone = () => {
    onChange([...zones, newZoneDraft()]);
    setActiveIndex(zones.length);
  };

  const removeZone = (index: number) =>
    onChange(zones.filter((_, i) => i !== index));

  const otherPolygons = zones
    .filter((_, i) => i !== activeIndex)
    .map((zone) => zone.polygon);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("rest.map_zone_hint")}
        </p>
        <button
          type="button"
          onClick={addZone}
          disabled={disabled}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("rest.zone_add")}
        </button>
      </div>

      {notice}

      {zones.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-10 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <MapPin className="w-7 h-7 text-zinc-300 dark:text-zinc-700" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            {t("rest.zones_empty")}
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {zones.map((zone, index) => {
              const selected = index === activeIndex;
              const rowError = error?.index === index ? error.message : undefined;
              const inputId = zoneFieldId(idPrefix, index);
              return (
                <li
                  key={zone.key}
                  className={`rounded-xl border p-2 transition-colors ${
                    rowError
                      ? "border-red-500"
                      : selected
                        ? "border-orange-500 bg-orange-500/5"
                        : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`${idPrefix}-active-zone`}
                      checked={selected}
                      onChange={() => setActiveIndex(index)}
                      disabled={disabled}
                      aria-label={zoneLabel(zone, index, t)}
                      className="accent-orange-500 w-4 h-4 shrink-0"
                    />
                    <input
                      id={inputId}
                      value={zone.name}
                      disabled={disabled}
                      placeholder={t("rest.zone_name_placeholder")}
                      aria-label={t("rest.zone_name")}
                      aria-invalid={!!rowError}
                      aria-describedby={rowError ? `${inputId}-error` : undefined}
                      onFocus={() => setActiveIndex(index)}
                      onChange={(e) => updateZone(index, { name: e.target.value })}
                      className={`${FIELD_CLASS} py-1.5`}
                    />
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {t("rest.zone_points", { count: zone.polygon.length })}
                    </span>
                    <button
                      type="button"
                      title={t("rest.zone_clear")}
                      aria-label={t("rest.zone_clear")}
                      disabled={disabled || zone.polygon.length === 0}
                      onClick={() => updateZone(index, { polygon: [] })}
                      className={ICON_BUTTON}
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title={t("rest.zone_remove")}
                      aria-label={t("rest.zone_remove")}
                      disabled={disabled}
                      onClick={() => removeZone(index)}
                      className={`${ICON_BUTTON} hover:text-red-600 dark:hover:text-red-400`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <FieldError id={`${inputId}-error`} message={rowError} />
                </li>
              );
            })}
          </ul>

          {active && (
            <RestaurantMapEditor
              mode="polygon"
              pin={pin}
              polygon={active.polygon}
              onPolygonChange={(next) => updateZone(activeIndex, { polygon: next })}
              otherPolygons={otherPolygons}
              disabled={disabled}
            />
          )}
        </>
      )}
    </div>
  );
}
