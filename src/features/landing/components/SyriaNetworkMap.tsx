import { useEffect, useMemo, useRef, useState } from "react";
import syriaBoundary from "@/data/syria-boundary.json";

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

// Syria bounding box (slightly padded)
const BBOX = { minLng: 35.5, maxLng: 42.5, minLat: 32.2, maxLat: 37.5 };
const VB_W = 1000;
const VB_H = 800;

function project(lng: number, lat: number): [number, number] {
  const x = ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * VB_W;
  const y = VB_H - ((lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * VB_H;
  return [x, y];
}

function syriaPath(): string {
  const geom: any = (syriaBoundary as any).geometry;
  const rings: number[][][] =
    geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  return rings
    .map((ring) =>
      ring
        .map(([lng, lat], i) => {
          const [x, y] = project(lng, lat);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z"
    )
    .join(" ");
}

function arcPath(a: [number, number], b: [number, number]): string {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  // Perpendicular offset for curve height (always upward bow)
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  const lift = Math.min(dist * 0.3, 120);
  const cx = mx + nx * lift * (y2 < y1 ? 1 : -1) * Math.sign(dx || 1);
  const cy = my + ny * lift * (y2 < y1 ? 1 : -1) * Math.sign(dx || 1) - 30;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

interface FlyingArc {
  id: number;
  from: NetworkBranch;
  to: NetworkBranch;
  d: string;
}

export function SyriaNetworkMap({ branches, height = 500 }: Props) {
  const path = useMemo(() => syriaPath(), []);
  const projected = useMemo(
    () =>
      branches.map((b) => ({
        ...b,
        xy: project(b.lng, b.lat),
      })),
    [branches]
  );

  const [hovered, setHovered] = useState<string | null>(null);
  const [arcs, setArcs] = useState<FlyingArc[]>([]);
  const seqRef = useRef(0);

  // Spawn animated arcs periodically between random branches
  useEffect(() => {
    if (projected.length < 2) return;
    let timer: any;
    const spawn = () => {
      const i = Math.floor(Math.random() * projected.length);
      let j = Math.floor(Math.random() * projected.length);
      if (j === i) j = (j + 1) % projected.length;
      const from = projected[i];
      const to = projected[j];
      const id = ++seqRef.current;
      const arc: FlyingArc = {
        id,
        from,
        to,
        d: arcPath(from.xy, to.xy),
      };
      setArcs((a) => [...a, arc]);
      // Remove after animation completes
      setTimeout(() => {
        setArcs((a) => a.filter((x) => x.id !== id));
      }, 2600);
      timer = setTimeout(spawn, 700 + Math.random() * 900);
    };
    timer = setTimeout(spawn, 400);
    return () => clearTimeout(timer);
  }, [projected]);

  return (
    <div
      className="relative w-full"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <linearGradient id="terrain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8e0c8" />
            <stop offset="60%" stopColor="#dccfa8" />
            <stop offset="100%" stopColor="#c9b889" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Syria — natural terrain fill */}
        <path d={path} fill="url(#terrain)" filter="url(#mapShadow)" />
        {/* Subtle inner border */}
        <path
          d={path}
          fill="none"
          stroke="#8a7a52"
          strokeWidth="1.2"
          strokeLinejoin="round"
          opacity="0.7"
        />

        {/* Animated shipment arcs */}
        {arcs.map((arc) => (
          <g key={arc.id}>
            <path
              d={arc.d}
              fill="none"
              stroke="hsl(28 100% 45%)"
              strokeWidth="1.4"
              strokeOpacity="0.5"
              strokeDasharray="3 4"
            />
            <circle r="4" fill="hsl(28 100% 50%)" stroke="white" strokeWidth="1.5" filter="url(#glow)">
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
          const active = hovered === b.id;
          return (
            <g
              key={b.id}
              transform={`translate(${x},${y})`}
              onMouseEnter={() => setHovered(b.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Pulse ring */}
              <circle r="4" fill="none" stroke="hsl(28 100% 45%)" strokeWidth="2" opacity="0.8">
                <animate attributeName="r" values="4;18;4" dur="2.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0;0.8" dur="2.6s" repeatCount="indefinite" />
              </circle>
              {/* Outer halo on hover */}
              {active && (
                <circle r="14" fill="hsl(28 100% 45% / 0.3)" />
              )}
              {/* Core dot — high contrast on light terrain */}
              <circle r={active ? 6 : 4.5} fill="hsl(28 100% 45%)" stroke="white" strokeWidth="1.5" />
              <circle r="1.5" fill="white" />
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip (HTML overlay for crisp text) */}
      {hovered && (() => {
        const b = projected.find((p) => p.id === hovered);
        if (!b) return null;
        const [x, y] = b.xy;
        const leftPct = (x / VB_W) * 100;
        const topPct = (y / VB_H) * 100;
        return (
          <div
            className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full"
            style={{ left: `${leftPct}%`, top: `calc(${topPct}% - 14px)` }}
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

      {/* Legend / live indicator */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 text-xs shadow-md">
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