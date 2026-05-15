import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import syriaBoundary from "@/data/syria-boundary.json";

// Fix default marker icon (re-applied — safe even if LocationPicker also did it)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Branded colored DivIcon (uses Tailwind color tokens via inline style)
export function brandIcon(color: string = "hsl(28, 100%, 50%)", size: number = 28) {
  return L.divIcon({
    className: "sila-marker",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    "><div style="
      width:${size / 2.5}px;height:${size / 2.5}px;border-radius:50%;
      background:white;transform:rotate(45deg);
    "></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

export interface SilaMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  popup?: React.ReactNode;
  onClick?: () => void;
}

interface SilaMapProps {
  markers?: SilaMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string | number;
  fitToMarkers?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  restrictToSyria?: boolean;
}

function FitBounds({ markers }: { markers: SilaMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [markers, map]);
  return null;
}

// Syria bounding box (SW, NE) — used to lock the viewport
const SYRIA_BOUNDS: L.LatLngBoundsExpression = [
  [32.2, 35.5],
  [37.4, 42.5],
];

/** Build an inverted polygon: world rectangle minus Syria — used as a dimming mask. */
function buildSyriaMask(): GeoJSON.Feature {
  const world: number[][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const geom = (syriaBoundary as any).geometry;
  // Collect Syria outer rings, reversed (hole winding)
  const holes: number[][][] = [];
  if (geom.type === "Polygon") {
    holes.push([...geom.coordinates[0]].reverse());
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) holes.push([...poly[0]].reverse());
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
  };
}

const SYRIA_MASK = buildSyriaMask();

function ClickCapture({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, onMapClick]);
  return null;
}

/**
 * Unified Sila map wrapper. Defaults centered on Syria.
 * Read-only by default — pass onMapClick to capture clicks.
 */
export function SilaMap({
  markers = [],
  center = [34.8, 38.9], // Syria center
  zoom = 7,
  height = 480,
  fitToMarkers = true,
  onMapClick,
  className = "",
  restrictToSyria = false,
}: SilaMapProps) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-border shadow-lg ${className}`}
      style={{ height, isolation: "isolate", zIndex: 0 }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        {...(restrictToSyria
          ? {
              maxBounds: SYRIA_BOUNDS,
              maxBoundsViscosity: 1.0,
              minZoom: 7,
              maxZoom: 13,
              worldCopyJump: false,
            }
          : {})}
      >
        {restrictToSyria ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {restrictToSyria && (
          <>
            {/* Dimming mask over neighboring countries */}
            <GeoJSON
              data={SYRIA_MASK as any}
              style={{
                fillColor: "hsl(220, 30%, 8%)",
                fillOpacity: 0.78,
                color: "transparent",
                weight: 0,
                interactive: false,
              }}
            />
            {/* Brand-orange Syria outline */}
            <GeoJSON
              data={syriaBoundary as any}
              style={{
                color: "hsl(28, 100%, 50%)",
                weight: 2,
                opacity: 1,
                fillOpacity: 0,
                interactive: false,
                className: "sila-syria-outline",
              }}
            />
          </>
        )}
        {fitToMarkers && !restrictToSyria && markers.length > 0 && <FitBounds markers={markers} />}
        {onMapClick && <ClickCapture onMapClick={onMapClick} />}
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={brandIcon(m.color)}
            eventHandlers={m.onClick ? { click: m.onClick } : undefined}
          >
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default SilaMap;