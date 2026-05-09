import { MapPin, Navigation, Truck } from "lucide-react";

interface Props {
  city?: string | null;
  isLive?: boolean;
  courierName?: string | null;
}

/**
 * Modern map UI placeholder. Renders a stylised grid + animated courier pin
 * to communicate "live tracking" without integrating a real map provider.
 */
export function MapPlaceholder({ city, isLive, courierName }: Props) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted/40 via-background to-muted/20 h-56 sm:h-64">
      {/* grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* route line */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 240">
        <path
          d="M40 200 C 120 180, 160 80, 240 90 S 360 60, 380 40"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeDasharray="6 6"
          strokeLinecap="round"
          className="opacity-70"
        />
      </svg>
      {/* origin pin */}
      <div className="absolute bottom-8 right-6 flex flex-col items-center gap-1">
        <div className="h-8 w-8 rounded-full bg-muted border-2 border-border flex items-center justify-center shadow">
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-[10px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded">
          المستودع
        </span>
      </div>
      {/* courier pin */}
      <div className="absolute top-8 left-6 flex flex-col items-center gap-1">
        <div className="relative">
          {isLive && (
            <span className="absolute inset-0 -m-1 rounded-full bg-primary/40 animate-ping" aria-hidden />
          )}
          <div className="relative h-10 w-10 rounded-full bg-primary text-primary-foreground border-2 border-background flex items-center justify-center shadow-lg">
            <Truck className="h-5 w-5" />
          </div>
        </div>
        <span className="text-[10px] font-semibold text-foreground bg-background/90 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap max-w-[140px] truncate">
          {courierName || "المندوب"}
        </span>
      </div>
      {/* status chip */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm border border-border rounded-full px-2.5 py-1 text-[11px] shadow-sm">
        <Navigation className="h-3 w-3 text-primary" />
        <span className="text-foreground">{city || "—"}</span>
        {isLive && (
          <span className="flex items-center gap-1 mr-1 pr-2 border-r border-border">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success/70 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-success font-semibold">مباشر</span>
          </span>
        )}
      </div>
      {/* footer disclaimer */}
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/80">
        خريطة توضيحية — الموقع التقريبي للمندوب
      </div>
    </div>
  );
}