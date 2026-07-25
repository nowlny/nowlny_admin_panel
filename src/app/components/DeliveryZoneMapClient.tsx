"use client";

import { MapContainer, TileLayer, Polygon, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPinOff } from "lucide-react";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Marker icons ship inside the `leaflet` package — bundling them instead of
// hot-linking cdnjs keeps the map working offline and behind a strict CSP, and
// stops a third party from seeing every map view.
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x.src,
    iconUrl: markerIcon.src,
    shadowUrl: markerShadow.src,
  });
}

interface DeliveryZoneMapProps {
  polygon: { lat: number; lng: number }[];
}

export default function DeliveryZoneMapClient({
  polygon,
}: DeliveryZoneMapProps) {
  // Returning null left a blank slot with no explanation of why.
  if (!polygon || polygon.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-center px-6 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
        <MapPinOff className="w-7 h-7 text-zinc-300 dark:text-zinc-700" />
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
          No delivery zone defined
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs">
          Draw a coverage polygon for this company to see it plotted here.
        </p>
      </div>
    );
  }

  const positions = polygon.map((p) => [p.lat, p.lng] as [number, number]);

  const centerLat = polygon.reduce((acc, p) => acc + p.lat, 0) / polygon.length;
  const centerLng = polygon.reduce((acc, p) => acc + p.lng, 0) / polygon.length;

  return (
    // OSM tiles are blazing white inside a `dark:bg-zinc-950` panel. Inverting
    // and rotating the hue of just the tile images produces a serviceable dark
    // basemap without swapping to a keyed tile provider. Controls, attribution
    // and the orange polygon overlay are left untouched.
    <div className="h-full w-full dark:[&_.leaflet-tile]:invert dark:[&_.leaflet-tile]:hue-rotate-180 dark:[&_.leaflet-tile]:brightness-95 dark:[&_.leaflet-container]:bg-zinc-900">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={14}
        style={{ height: "100%", width: "100%", zIndex: 10 }}
        scrollWheelZoom={false}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Default (Street)">
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
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <Polygon
          pathOptions={{
            color: "#f97316",
            fillColor: "#f97316",
            fillOpacity: 0.2,
            weight: 3,
          }}
          positions={positions}
        />
      </MapContainer>
    </div>
  );
}
