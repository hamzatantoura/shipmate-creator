import { useEffect, useMemo, useRef, useState } from "react";
import provincesData from "@/data/syria-provinces.json";

export interface NetworkBranch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  courier?: string;
}

interface Props {
  branches: NetworkBranch[];
  height?: number;
}

// Syria bounding box
const BBOX = { minLng: 35.5, maxLng: 42.5, minLat: 32.2, maxLat: 37.5 };
const VB_W = 1000;
const VB_H = 800;

function project(lng: number, lat: number): [number, number] {
  const x = ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * VB_W;
  const y = VB_H - ((lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * VB_H;
  return [x, y];
}

function ringToPath(ring: number[][]): string {
  return (
    ring
      .map(([lng, lat], i) => {
        const [x, y] = project(lng, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

function geomToPath(geom: any): string {
  if (geom.type === "Polygon") {
    return geom.coordinates.map(ringToPath).join(" ");
  }
  // MultiPolygon
  return geom.coordinates
    .map((poly: number[][][]) => poly.map(ringToPath).join(" "))
    .join(" ");
}

function centroid(geom: any): [number, number] {
  // Use centroid of largest ring (good enough for label placement)
  let pts: number[][] = [];
  if (geom.type === "Polygon") {
    pts = geom.coordinates[0];
  } else if (geom.type === "MultiPolygon") {
    let best: number[][] = geom.coordinates[0][0];
    for (const poly of geom.coordinates) {
      if (poly[0].length > best.length) best = poly[0];
    }
    pts = best;
  }
  let sx = 0,
    sy = 0;
  for (const [lng, lat] of pts) {
    sx += lng;
    sy += lat;
  }
  return project(sx / pts.length, sy / pts.length);
}

interface Province {
  name: string;
  d: string;
  labelXY: [number, number];
}

function arcPath(a: [number, number], b: [number, number]): string {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const lift = Math.min(dist * 0.25, 100);
  const cx = mx + (-dy / (dist || 1)) * lift;
  const cy = my + (dx / (dist || 1)) * lift - 20;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

interface FlyingArc {
  id: number;
  d: string;
}

export function SyriaNetworkMap({ branches, height = 500 }: Props) {
  const provinces: Province[] = useMemo(() => {
    return (provincesData as any).features.map((f: any) => ({
      name: f.properties.name as string,
      d: geomToPath(f.geometry),
      labelXY: centroid(f.geometry),
    }));
  }, []);

  // Major Syrian cities for coverage reference
  const cities = useMemo(
    () => [
      { name: "دمشق", lat: 33.5138, lng: 36.2765, capital: true },
      { name: "حلب", lat: 36.2021, lng: 37.1343 },
      { name: "حمص", lat: 34.7308, lng: 36.7090 },
      { name: "حماة", lat: 35.1318, lng: 36.7578 },
      { name: "اللاذقية", lat: 35.5317, lng: 35.7915 },
      { name: "طرطوس", lat: 34.8959, lng: 35.8867 },
      { name: "دير الزور", lat: 35.3333, lng: 40.1500 },
      { name: "الرقة", lat: 35.9500, lng: 39.0167 },
      { name: "الحسكة", lat: 36.5024, lng: 40.7477 },
      { name: "إدلب", lat: 35.9306, lng: 36.6339 },
      { name: "درعا", lat: 32.6189, lng: 36.1021 },
      { name: "السويداء", lat: 32.7094, lng: 36.5694 },
      { name: "القنيطرة", lat: 33.1256, lng: 35.8244 },
      { name: "منبج", lat: 36.5283, lng: 37.9550 },
    ],
    []
  );

  const cityPts = useMemo(
    () => cities.map((c) => ({ ...c, xy: project(c.lng, c.lat) })),
    [cities]
  );

  const projected = useMemo(
    () =>
      branches.map((b) => ({
        ...b,
        xy: project(b.lng, b.lat),
      })),
    [branches]
  );

  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null);
  const [arcs, setArcs] = useState<FlyingArc[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    if (projected.length < 2) return;
    let timer: any;
    const spawn = () => {
      const i = Math.floor(Math.random() * projected.length);
      let j = Math.floor(Math.random() * projected.length);
      if (j === i) j = (j + 1) % projected.length;
      const id = ++seqRef.current;
      const arc: FlyingArc = {
        id,
        d: arcPath(projected[i].xy, projected[j].xy),
      };
      setArcs((a) => [...a, arc]);
      setTimeout(() => setArcs((a) => a.filter((x) => x.id !== id)), 2600);
      timer = setTimeout(spawn, 700 + Math.random() * 900);
    };
    timer = setTimeout(spawn, 400);
    return () => clearTimeout(timer);
  }, [projected]);

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          {/* Sea hatching pattern */}
          <pattern
            id="seaPattern"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="14" height="14" fill="#cfe4f2" />
            <line x1="0" y1="0" x2="0" y2="14" stroke="#a9cde2" strokeWidth="0.6" />
          </pattern>
          <filter id="dot" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Sea background (Mediterranean to the west) */}
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#seaPattern)" />

        {/* Land halo behind Syria */}
        {provinces.map((p, i) => (
          <path
            key={`halo-${i}`}
            d={p.d}
            fill="#e8d9b0"
            stroke="#000"
            strokeOpacity="0"
          />
        ))}

        {/* Provinces */}
        {provinces.map((p, i) => {
          const active = hoveredProvince === p.name;
          return (
            <path
              key={p.name + i}
              d={p.d}
              fill={active ? "#f3e6c0" : "#ede1bd"}
              stroke="#9b8455"
              strokeWidth="0.9"
              strokeLinejoin="round"
              style={{ cursor: "pointer", transition: "fill 0.2s" }}
              onMouseEnter={() => setHoveredProvince(p.name)}
              onMouseLeave={() => setHoveredProvince(null)}
            />
          );
        })}

        {/* External thick border for Syria */}
        {provinces.map((p, i) => (
          <path
            key={`outer-${i}`}
            d={p.d}
            fill="none"
            stroke="#5a4a2e"
            strokeWidth="0.5"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}

        {/* Province labels */}
        {provinces.map((p) => {
          const [x, y] = p.labelXY;
          return (
            <g key={`lbl-${p.name}`} pointerEvents="none">
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Readex Pro, system-ui, sans-serif"
                fontSize="13"
                fontWeight="600"
                fill="#3d2f1a"
                stroke="#fff8e1"
                strokeWidth="3"
                paintOrder="stroke"
                style={{ direction: "rtl" }}
              >
                {p.name}
              </text>
            </g>
          );
        })}

        {/* Major cities (coverage landmarks) */}
        {cityPts.map((c) => {
          const [x, y] = c.xy;
          return (
            <g key={`city-${c.name}`} pointerEvents="none">
              {c.capital ? (
                <>
                  <circle cx={x} cy={y} r="7" fill="#b1390f" stroke="#fff" strokeWidth="1.8" />
                  <circle cx={x} cy={y} r="2.4" fill="#fff" />
                </>
              ) : (
                <circle cx={x} cy={y} r="3.4" fill="#7a4a1a" stroke="#fff8e1" strokeWidth="1.2" />
              )}
              <text
                x={x + (c.capital ? 10 : 6)}
                y={y - 7}
                fontFamily="Readex Pro, system-ui, sans-serif"
                fontSize={c.capital ? 13 : 11}
                fontWeight={c.capital ? 700 : 600}
                fill="#2a1d08"
                stroke="#fff8e1"
                strokeWidth="3"
                paintOrder="stroke"
                style={{ direction: "rtl" }}
              >
                {c.name}
              </text>
            </g>
          );
        })}

        {/* Animated shipment arcs */}
        {arcs.map((arc) => (
          <g key={arc.id}>
            <path
              d={arc.d}
              fill="none"
              stroke="hsl(28 100% 45%)"
              strokeWidth="1.4"
              strokeOpacity="0.55"
              strokeDasharray="3 4"
            />
            <circle r="4.5" fill="hsl(28 100% 50%)" stroke="white" strokeWidth="1.5">
              <animateMotion dur="2.4s" repeatCount="1" path={arc.d} />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.1;0.9;1"
                dur="2.4s"
                repeatCount="1"
              />
            </circle>
          </g>
        ))}

        {/* Branches */}
        {projected.map((b) => {
          const [x, y] = b.xy;
          const active = hoveredBranch === b.id;
          return (
            <g
              key={b.id}
              transform={`translate(${x},${y})`}
              onMouseEnter={() => setHoveredBranch(b.id)}
              onMouseLeave={() => setHoveredBranch(null)}
              style={{ cursor: "pointer" }}
            >
              <circle
                r="4"
                fill="none"
                stroke="hsl(28 100% 45%)"
                strokeWidth="2"
                opacity="0.85"
              >
                <animate attributeName="r" values="4;16;4" dur="2.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0;0.9" dur="2.6s" repeatCount="indefinite" />
              </circle>
              {active && <circle r="13" fill="hsl(28 100% 45% / 0.3)" />}
              <circle
                r={active ? 6 : 4.5}
                fill="hsl(28 100% 45%)"
                stroke="white"
                strokeWidth="1.8"
                filter="url(#dot)"
              />
              <circle r="1.6" fill="white" />
            </g>
          );
        })}
      </svg>

      {/* Branch tooltip */}
      {hoveredBranch && (() => {
        const b = projected.find((p) => p.id === hoveredBranch);
        if (!b) return null;
        const [x, y] = b.xy;
        return (
          <div
            className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(x / VB_W) * 100}%`,
              top: `calc(${(y / VB_H) * 100}% - 14px)`,
            }}
          >
            <div className="bg-card/95 backdrop-blur-sm border border-primary/40 rounded-lg px-3 py-2 shadow-xl min-w-[140px] text-right">
              <p className="text-sm font-bold text-foreground">{b.name}</p>
              {b.courier && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{b.courier}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Live legend */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-xs shadow-md">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="text-foreground/80">شبكة حية · {branches.length} فرع</span>
      </div>
    </div>
  );
}

export default SyriaNetworkMap;