"use client";

import React, { useState } from "react";
import { Link2, Loader2, MapPin } from "lucide-react";
import { isShortMapsLink, parseLatLng } from "../../../lib/mapsUrl";
import { useI18n } from "../../../lib/i18n";
import { FIELD_CLASS, LABEL_CLASS } from "./FormControls";

/**
 * Paste a Google Maps link, get the restaurant's coordinates.
 *
 * The operator has the place open in Maps; what the form wants is a latitude.
 * A shared link already holds it, so it is read out here rather than being
 * copied across by hand — which is where a digit goes missing and a merchant
 * ends up in the sea.
 *
 * Full links are parsed in the browser. The Maps app's own share sheet gives a
 * `maps.app.goo.gl` short link that carries nothing until it is followed, and
 * a browser cannot read that redirect cross-origin, so those take one trip
 * through `/api/resolve-place`.
 *
 * Nothing here is required: the latitude and longitude fields stay editable,
 * and the map pin still moves by hand.
 */

interface MapsLinkFieldProps {
  /** Called with the coordinates once a link resolves. */
  onResolved: (position: { lat: number; lng: number }) => void;
  idPrefix: string;
  disabled?: boolean;
}

export default function MapsLinkField({
  onResolved,
  idPrefix,
  disabled,
}: MapsLinkFieldProps) {
  const { t } = useI18n();
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const apply = (lat: number, lng: number, viewportOnly: boolean) => {
    onResolved({ lat, lng });
    setError(null);
    // Worth saying out loud: a viewport reading is where the map was centred,
    // which is close to the place but not the place.
    setNote(
      viewportOnly
        ? t("rest.maps_from_viewport", { lat: lat.toFixed(6), lng: lng.toFixed(6) })
        : t("rest.maps_filled", { lat: lat.toFixed(6), lng: lng.toFixed(6) }),
    );
  };

  const handleUse = async () => {
    const value = link.trim();
    if (!value || status === "working") return;

    setError(null);
    setNote(null);

    const direct = parseLatLng(value);
    if (direct) {
      apply(direct.lat, direct.lng, direct.source === "viewport");
      return;
    }

    if (!isShortMapsLink(value)) {
      setError(t("rest.maps_no_coords"));
      return;
    }

    setStatus("working");
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch("/api/resolve-place", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: value }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || t("rest.maps_no_coords"));
        return;
      }
      apply(payload.lat, payload.lng, payload.source === "viewport");
    } catch {
      setError(t("rest.maps_link_failed"));
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="md:col-span-2 space-y-1.5">
      <label htmlFor={`${idPrefix}-maps-link`} className={LABEL_CLASS}>
        {t("rest.maps_link")}
      </label>

      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-maps-link`}
          type="url"
          inputMode="url"
          dir="ltr"
          placeholder={t("rest.maps_link_placeholder")}
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setError(null);
            setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleUse();
            }
          }}
          disabled={disabled || status === "working"}
          className={`${FIELD_CLASS} flex-1 min-w-0`}
        />

        <button
          type="button"
          onClick={handleUse}
          disabled={disabled || status === "working" || !link.trim()}
          className="shrink-0 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          {status === "working" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Link2 className="w-3.5 h-3.5" />
          )}
          {t("rest.maps_use_link")}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-[11px] font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : note ? (
        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" />
          {note}
        </p>
      ) : (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {t("rest.maps_link_hint")}
        </p>
      )}
    </div>
  );
}
