"use client";

import { MapContainer, TileLayer, Polygon, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icons if we ever need them
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

interface DeliveryZoneMapProps {
  polygon: { lat: number; lng: number }[];
}

export default function DeliveryZoneMapClient({ polygon }: DeliveryZoneMapProps) {
  if (!polygon || polygon.length === 0) return null;

  const positions = polygon.map(p => [p.lat, p.lng] as [number, number]);

  const centerLat = polygon.reduce((acc, p) => acc + p.lat, 0) / polygon.length;
  const centerLng = polygon.reduce((acc, p) => acc + p.lng, 0) / polygon.length;

  return (
    <MapContainer 
      center={[centerLat, centerLng]} 
      zoom={14} 
      style={{ height: '100%', width: '100%', zIndex: 10 }}
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
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
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
        pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.2, weight: 3 }} 
        positions={positions} 
      />
    </MapContainer>
  );
}
