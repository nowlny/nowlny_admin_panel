"use client";

import React, { useEffect } from "react";
import { LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { PlacedRestaurant } from "../../lib/restaurantLocations";
import type { RestaurantResponse } from "../../services/restaurants";

/* ---------------------------------------------------------------------------
   Every merchant on one map.

   Read-only, unlike `RestaurantMapEditorClient` which places a single pin: this
   answers "where is the platform" and "which of these is in the wrong place"
   at a glance, neither of which a paginated table can show.

   Must be loaded with `next/dynamic` + `ssr: false` — Leaflet touches `window`
   at import time.
--------------------------------------------------------------------------- */

/**
 * Markers are drawn as inline SVG in a `divIcon`.
 *
 * Leaflet's stock marker needs its PNGs resolved to URLs, and the usual
 * `import icon from "leaflet/dist/images/marker-icon.png"` patch yields no
 * usable `.src` in this app — every `<Marker>` then throws "iconUrl not set in
 * Icon options" and takes the tab down. An SVG needs no asset pipeline, and it
 * lets the pin carry the merchant's state in its colour.
 */
const COLOURS: Record<string, string> = {
  active: "#f97316",
  inactive: "#71717a",
  pending: "#eab308",
  rejected: "#ef4444",
  suspended: "#ef4444",
};

const SUSPECT_COLOUR = "#dc2626";

function makePin(colour: string, ring: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [26, 36],
    iconAnchor: [13, 35],
    popupAnchor: [0, -32],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 30 42" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))"><path d="M15 1C7.3 1 1 7.3 1 15c0 9.6 11.2 22.6 13.3 25a1 1 0 0 0 1.4 0C17.8 37.6 29 24.6 29 15 29 7.3 22.7 1 15 1z" fill="${colour}" stroke="${
      ring ? "#fecaca" : "#fff"
    }" stroke-width="${ring ? 3 : 2}"/><circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`,
  });
}

/** Frames the map on the merchants, and re-frames it when the list changes. */
function FitToRestaurants({
  bounds,
  center,
}: {
  bounds: [[number, number], [number, number]] | null;
  center: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) {
      map.setView(center, 12);
      return;
    }
    const [southWest, northEast] = bounds;
    // A single merchant has zero-area bounds; `fitBounds` on that zooms to the
    // maximum, which lands the operator on one rooftop.
    if (southWest[0] === northEast[0] && southWest[1] === northEast[1]) {
      map.setView(southWest, 15);
      return;
    }
    map.fitBounds([southWest, northEast], { padding: [40, 40], maxZoom: 16 });
  }, [map, bounds, center]);

  return null;
}

/**
 * Every icon the map can need, built once when this module loads.
 *
 * Both dimensions are small and known — five statuses, suspect or not — so a
 * lookup beats a cache that has to be mutated while React renders. (Module
 * scope is safe here: the file is only ever loaded client-side, via
 * `next/dynamic` with `ssr: false`.)
 */
const ICONS: Record<string, L.DivIcon> = Object.fromEntries(
  Object.entries(COLOURS).flatMap(([status, colour]) => [
    [`${status}-false`, makePin(colour, false)],
    [`${status}-true`, makePin(SUSPECT_COLOUR, true)],
  ]),
);

function iconFor(status: string | undefined, suspect: boolean): L.DivIcon {
  return (
    ICONS[`${status ?? "active"}-${suspect}`] ??
    ICONS[`active-${suspect}`]
  );
}

interface RestaurantsMapClientProps {
  placed: PlacedRestaurant<RestaurantResponse>[];
  bounds: [[number, number], [number, number]] | null;
  center: [number, number];
  onOpen: (id: string) => void;
  /** Labels, so this file needs no i18n context of its own. */
  labels: { open: string; suspect: string };
}

export default function RestaurantsMapClient({
  placed,
  bounds,
  center,
  onOpen,
  labels,
}: RestaurantsMapClientProps) {
  return (
    <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <FitToRestaurants bounds={bounds} center={center} />

      {placed.map((entry) => (
        <Marker
          key={entry.restaurant.id}
          position={[entry.lat, entry.lng]}
          icon={iconFor(entry.restaurant.status, entry.suspect)}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong style={{ display: "block", marginBottom: 2 }} dir="auto">
                {entry.restaurant.name}
              </strong>
              <span style={{ color: "#71717a", fontSize: 11 }}>
                {entry.lat.toFixed(5)}, {entry.lng.toFixed(5)}
              </span>
              {entry.suspect && (
                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    color: "#dc2626",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {labels.suspect}
                </span>
              )}
              <button
                type="button"
                onClick={() => onOpen(entry.restaurant.id)}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "#f97316",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {labels.open}
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
