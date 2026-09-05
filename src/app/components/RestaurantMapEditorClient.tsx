"use client";

import React, { useEffect, useMemo, useRef } from "react";
import {
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/* ---------------------------------------------------------------------------
   Editable Leaflet map for the restaurant forms.

   `DeliveryZoneMapClient` only *shows* a polygon; this one lets the operator
   place the restaurant pin (`mode="pin"`) or draw a delivery-zone polygon
   (`mode="polygon"`) — the same gestures the merchant app offers, so an
   admin-created restaurant can be set up completely instead of shipping with
   coordinates typed by hand and no coverage at all.

   Must be loaded with `next/dynamic` + `ssr: false`: Leaflet touches `window`
   at import time.
--------------------------------------------------------------------------- */

export type LatLng = { lat: number; lng: number };

const ACCENT = "#f97316";
const MUTED = "#71717a";

/**
 * The restaurant pin, drawn inline.
 *
 * Leaflet's stock marker needs its PNGs resolved to URLs, and the usual
 * `import icon from "leaflet/dist/images/marker-icon.png"` patch does not
 * yield a usable `.src` here — every `<Marker>` then threw "iconUrl not set
 * in Icon options" and took the whole tab down to the error boundary. An SVG
 * in a `divIcon` needs no asset pipeline at all.
 */
const pinIcon = L.divIcon({
  className: "",
  iconSize: [30, 42],
  iconAnchor: [15, 41],
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))"><path d="M15 1C7.3 1 1 7.3 1 15c0 9.6 11.2 22.6 13.3 25a1 1 0 0 0 1.4 0C17.8 37.6 29 24.6 29 15 29 7.3 22.7 1 15 1z" fill="${ACCENT}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`,
});

/** Beirut — the fallback centre when there is nothing else to aim the map at. */
const DEFAULT_CENTER: [number, number] = [33.8938, 35.5018];
const DEFAULT_ZOOM = 12;
const PIN_ZOOM = 15;

const NO_POINTS: LatLng[] = [];
const NO_POLYGONS: LatLng[][] = [];

/**
 * Vertex handle. The default Leaflet pin is a 25×41 teardrop whose tip marks
 * the point, which reads badly when a dozen of them outline a polygon — a
 * small centred dot sits exactly on the coordinate it represents.
 */
const vertexIcon = L.divIcon({
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${ACCENT};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
});

const toPositions = (points: LatLng[]) =>
  points.map((p) => [p.lat, p.lng] as [number, number]);

/**
 * Fits the view once, on mount. Re-fitting after every click would yank the
 * map out from under the cursor, so the next click lands somewhere the
 * operator did not aim at.
 */
function InitialView({
  positions,
  pin,
}: {
  positions: [number, number][];
  pin: LatLng | null;
}) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (positions.length >= 2) {
      map.fitBounds(L.latLngBounds(positions), { padding: [24, 24] });
    } else if (positions.length === 1) {
      map.setView(positions[0], PIN_ZOOM);
    } else if (pin) {
      map.setView([pin.lat, pin.lng], PIN_ZOOM);
    }
  }, [map, positions, pin]);
  return null;
}

/** Keeps an externally-moved pin (typed coordinates) in view. */
function FollowPin({ pin }: { pin: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (!pin) return;
    const target = L.latLng(pin.lat, pin.lng);
    if (!map.getBounds().contains(target)) map.panTo(target);
  }, [map, pin]);
  return null;
}

/**
 * Leaflet measures its container once, at creation. Inside a modal that is
 * still animating open — or a tab panel that has just been shown — that
 * measurement is stale and tiles render in the wrong place until the window
 * is resized. Re-measure when the container actually changes size.
 */
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const timer = window.setTimeout(() => map.invalidateSize(), 250);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (point: LatLng) => void }) {
  useMapEvents({
    click: (event) => onClick({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

export interface RestaurantMapEditorProps {
  mode: "pin" | "polygon";
  /** The restaurant's own location. Draggable in `pin` mode. */
  pin?: LatLng | null;
  onPinChange?: (next: LatLng) => void;
  /** The polygon being edited (`polygon` mode). */
  polygon?: LatLng[];
  onPolygonChange?: (next: LatLng[]) => void;
  /** Other zones, drawn muted for context and not editable. */
  otherPolygons?: LatLng[][];
  disabled?: boolean;
  /** Height class for the map slot. */
  className?: string;
}

export default function RestaurantMapEditorClient({
  mode,
  pin = null,
  onPinChange,
  polygon = NO_POINTS,
  onPolygonChange,
  otherPolygons = NO_POLYGONS,
  disabled = false,
  className = "h-90",
}: RestaurantMapEditorProps) {
  const positions = useMemo(() => toPositions(polygon), [polygon]);
  const editable = !disabled;

  const initialCenter: [number, number] =
    positions[0] ?? (pin ? [pin.lat, pin.lng] : DEFAULT_CENTER);

  const handleClick = (point: LatLng) => {
    if (!editable) return;
    if (mode === "pin") onPinChange?.(point);
    else onPolygonChange?.([...polygon, point]);
  };

  const replaceAt = (index: number, next: LatLng) =>
    onPolygonChange?.(polygon.map((p, i) => (i === index ? next : p)));

  const removeAt = (index: number) =>
    onPolygonChange?.(polygon.filter((_, i) => i !== index));

  return (
    // OSM tiles are blazing white inside a dark panel. Inverting and rotating
    // the hue of just the tile images produces a serviceable dark basemap;
    // controls and the orange overlay are left untouched.
    <div
      className={`w-full ${className} rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 relative z-0 dark:[&_.leaflet-tile]:invert dark:[&_.leaflet-tile]:hue-rotate-180 dark:[&_.leaflet-tile]:brightness-95 dark:[&_.leaflet-container]:bg-zinc-900 ${
        editable ? "[&_.leaflet-container]:cursor-crosshair" : ""
      }`}
    >
      <MapContainer
        center={initialCenter}
        zoom={pin || positions.length ? PIN_ZOOM : DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {otherPolygons.map((other, index) =>
          other.length >= 3 ? (
            <Polygon
              key={`other-${index}`}
              positions={toPositions(other)}
              interactive={false}
              pathOptions={{
                color: MUTED,
                fillColor: MUTED,
                fillOpacity: 0.12,
                weight: 2,
                dashArray: "4 4",
              }}
            />
          ) : null,
        )}

        {mode === "polygon" &&
          (positions.length >= 3 ? (
            <Polygon
              positions={positions}
              interactive={false}
              pathOptions={{
                color: ACCENT,
                fillColor: ACCENT,
                fillOpacity: 0.2,
                weight: 3,
              }}
            />
          ) : (
            // Two points is not a shape yet, but the operator still needs to
            // see the line they are building.
            positions.length === 2 && (
              <Polyline
                positions={positions}
                interactive={false}
                pathOptions={{ color: ACCENT, weight: 3, dashArray: "6 6" }}
              />
            )
          ))}

        {pin && (
          <Marker
            position={[pin.lat, pin.lng]}
            icon={pinIcon}
            draggable={editable && mode === "pin"}
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng();
                onPinChange?.({ lat, lng });
              },
            }}
          />
        )}

        {mode === "polygon" &&
          polygon.map((point, index) => (
            <Marker
              key={`${index}-${point.lat}-${point.lng}`}
              position={[point.lat, point.lng]}
              icon={vertexIcon}
              draggable={editable}
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  replaceAt(index, { lat, lng });
                },
                // Right-click removes. A left-click would fight the drag
                // gesture and delete corners the operator meant to move.
                contextmenu: (event) => {
                  if (!editable) return;
                  // Otherwise the browser menu opens over the map right after
                  // the corner disappears.
                  L.DomEvent.preventDefault(event.originalEvent);
                  removeAt(index);
                },
              }}
            />
          ))}

        <ClickHandler onClick={handleClick} />
        <InitialView positions={positions} pin={pin} />
        {mode === "pin" && <FollowPin pin={pin} />}
        <ResizeWatcher />
      </MapContainer>
    </div>
  );
}
