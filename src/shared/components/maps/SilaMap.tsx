import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, Polyline, CircleMarker } from "react-leaflet";
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

/**
 * Pin-shaped colored SVG marker. Used for branches (red/orange/grey) and the
 * customer / district pin (blue). Crisp at any zoom — no raster icons.
 */
export function brandIcon(color: string = "#ef4444", size: number = 32) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 44">
      <defs>
        <filter id="s" x="-30%" y="-20%" width="160%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path filter="url(#s)" d="M16 1 C7.7 1 1 7.7 1 16 c0 11 15 27 15 27 s15-16 15-27 C31 7.7 24.3 1 16 1 z"
            fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="16" cy="16" r="5.5" fill="#ffffff"/>
    </svg>`;
  return L.divIcon({
    className: "sila-marker",
    html: svg,
    iconSize: [size, size * 1.375],
    iconAnchor: [size / 2, size * 1.375],
    popupAnchor: [0, -size * 1.2],
  });
}

// Convenience presets
export const MARKER_COLORS = {
  branch: "#dc2626",          // red — courier branches
  branchInactive: "#9ca3af",  // grey — inactive branches
  customer: "#2563eb",        // blue — customer / district
  warehouse: "#f97316",       // orange — merchant warehouse
} as const;

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
  /** Tile style — defaults to CartoDB Positron for a clean SaaS look. */
  tileStyle?: "positron" | "positron-dark" | "osm";
  /** Customer (or selected district) location — rendered as a blue pin. */
  customerLocation?: { lat: number; lng: number; label?: string };
  /** Branch id to draw a dashed line to from the customer location. */
  nearestBranchId?: string;
  /** Edit mode — show a draggable pin for capturing precise coordinates. */
  editMode?: boolean;
  editPosition?: { lat: number; lng: number };
  onPositionChange?: (lat: number, lng: number) => void;
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

/** Haversine distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const TILE_URLS = {
  positron: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  "positron-dark": {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

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
  tileStyle = "positron",
  customerLocation,
  nearestBranchId,
  editMode = false,
  editPosition,
  onPositionChange,
}: SilaMapProps) {
  const tile = TILE_URLS[tileStyle];

  // Resolve nearest branch coordinates for the connecting polyline
  const lineEnds = useMemo(() => {
    if (!customerLocation || !nearestBranchId) return null;
    const target = markers.find(m => m.id === nearestBranchId);
    if (!target) return null;
    return {
      from: [customerLocation.lat, customerLocation.lng] as [number, number],
      to: [target.lat, target.lng] as [number, number],
      km: distanceKm(customerLocation, { lat: target.lat, lng: target.lng }),
    };
  }, [customerLocation, nearestBranchId, markers]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-border shadow-lg ${className}`}
      style={{
        height,
        isolation: "isolate",
        zIndex: 0,
        ...(restrictToSyria
          ? {
              background:
                "radial-gradient(ellipse at 50% 45%, hsl(28 100% 50% / 0.10) 0%, hsl(220 40% 8%) 55%, hsl(220 45% 5%) 100%)",
            }
          : {}),
      }}
    >
      {restrictToSyria && (
        <style>{`
          .sila-syria-fill path {
            filter: drop-shadow(0 0 18px hsl(28 100% 55% / 0.55))
                    drop-shadow(0 0 42px hsl(28 100% 50% / 0.35));
          }
          .sila-syria-outline path {
            filter: drop-shadow(0 0 6px hsl(28 100% 60% / 0.9));
          }
          .leaflet-container.sila-clean {
            background: transparent !important;
            cursor: default;
          }
          .leaflet-container.sila-clean .leaflet-control-attribution,
          .leaflet-container.sila-clean .leaflet-control-zoom { display: none; }
        `}</style>
      )}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={!restrictToSyria}
        dragging={!restrictToSyria}
        doubleClickZoom={!restrictToSyria}
        zoomControl={!restrictToSyria}
        touchZoom={!restrictToSyria}
        boxZoom={!restrictToSyria}
        keyboard={!restrictToSyria}
        attributionControl={!restrictToSyria}
        className={restrictToSyria ? "sila-clean" : ""}
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
        {!restrictToSyria && (
          <TileLayer
            attribution={tile.attribution}
            url={tile.url}
            subdomains={tileStyle === "osm" ? "abc" : "abcd"}
          />
        )}
        {restrictToSyria && (
          <>
            {/* Glowing Syria fill (under everything) */}
            <GeoJSON
              data={syriaBoundary as any}
              pathOptions={{
                className: "sila-syria-fill",
                fillColor: "hsl(28, 100%, 50%)",
                fillOpacity: 0.18,
                color: "transparent",
                weight: 0,
                interactive: false,
              }}
            />
            {/* Solid mask hiding everything outside Syria */}
            <GeoJSON
              data={SYRIA_MASK as any}
              pathOptions={{
                fillColor: "hsl(220 45% 5%)",
                fillOpacity: 1,
                color: "transparent",
                weight: 0,
                interactive: false,
              }}
            />
            {/* Glowing brand-orange outline */}
            <GeoJSON
              data={syriaBoundary as any}
              pathOptions={{
                className: "sila-syria-outline",
                color: "hsl(28, 100%, 50%)",
                weight: 2,
                opacity: 1,
                fillOpacity: 0,
                interactive: false,
              }}
            />
          </>
        )}
        {fitToMarkers && !restrictToSyria && markers.length > 0 && <FitBounds markers={markers} />}
        {(onMapClick || (editMode && onPositionChange)) && (
          <ClickCapture onMapClick={(lat, lng) => {
            if (editMode && onPositionChange) onPositionChange(lat, lng);
            if (onMapClick) onMapClick(lat, lng);
          }} />
        )}

        {/* Customer / selected district pin */}
        {customerLocation && (
          <Marker
            position={[customerLocation.lat, customerLocation.lng]}
            icon={brandIcon(MARKER_COLORS.customer)}
          >
            {customerLocation.label && <Popup>{customerLocation.label}</Popup>}
          </Marker>
        )}

        {/* Distance line: customer → nearest branch */}
        {lineEnds && (
          <>
            <Polyline
              positions={[lineEnds.from, lineEnds.to]}
              pathOptions={{ color: MARKER_COLORS.customer, weight: 3, opacity: 0.7, dashArray: "8 6" }}
            />
            <CircleMarker
              center={[
                (lineEnds.from[0] + lineEnds.to[0]) / 2,
                (lineEnds.from[1] + lineEnds.to[1]) / 2,
              ]}
              radius={0}
              pathOptions={{ opacity: 0, fillOpacity: 0 }}
            >
              <Popup>
                <div className="text-right text-xs font-medium">
                  المسافة: {lineEnds.km.toFixed(1)} كم
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Edit-mode draggable pin */}
        {editMode && editPosition && (
          <Marker
            position={[editPosition.lat, editPosition.lng]}
            icon={brandIcon(MARKER_COLORS.warehouse, 36)}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onPositionChange?.(lat, lng);
              },
            }}
          >
            <Popup>
              <div className="text-right text-xs space-y-1">
                <p className="font-bold">اسحب الدبوس لتحديد الموقع بدقة</p>
                <p dir="ltr" className="text-zinc-500">
                  {editPosition.lat.toFixed(5)}, {editPosition.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

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