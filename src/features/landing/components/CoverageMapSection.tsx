import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SilaMarker } from "@/shared/components/maps/SilaMap";
import { Card } from "@/components/ui/card";
import { Building2, MapPin } from "lucide-react";

const SilaMap = lazy(() =>
  import("@/shared/components/maps/SilaMap").then((m) => ({ default: m.SilaMap }))
);

interface BranchRow {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  courier_id: string;
}

export function CoverageMapSection() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [courierNames, setCourierNames] = useState<Record<string, string>>({});
  const [mapVisible, setMapVisible] = useState(false);
  const mapHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapHostRef.current || mapVisible) return;
    const el = mapHostRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMapVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mapVisible]);

  useEffect(() => {
    (async () => {
      const { data: br } = await supabase
        .from("courier_branches_public")
        .select("id, name, lat, lng, courier_id");
      const { data: co } = await supabase
        .from("couriers_public")
        .select("id, name");
      setBranches((br || []) as BranchRow[]);
      setCourierNames(Object.fromEntries((co || []).map((c: any) => [c.id, c.name])));
    })();
  }, []);

  const ACCENT = "hsl(199, 89%, 48%)";  // info blue

  const branchMarkers: SilaMarker[] = branches
    .filter((b) => b.lat != null && b.lng != null)
    .map((b) => ({
      id: `br-${b.id}`,
      lat: b.lat as number,
      lng: b.lng as number,
      color: ACCENT,
      popup: (
        <div className="text-right space-y-1 min-w-[140px]">
          <p className="font-bold text-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {b.name}</p>
          <p className="text-xs text-muted-foreground">{courierNames[b.courier_id] || "شركة شحن"}</p>
        </div>
      ),
    }));

  const all = [...branchMarkers];

  return (
    <section className="py-20 bg-gradient-to-b from-background to-card/30" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            <MapPin className="h-3.5 w-3.5" /> تغطية ذكية
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            شبكتنا تنمو في كل حي
          </h2>
          <p className="text-muted-foreground">
            نظام التوجيه الذكي يربط كل تاجر بأقرب فرع شحن حسب موقعه الجغرافي — توصيل أسرع وكلفة أقل.
          </p>
        </div>

        <Card className="p-3 bg-card/60 backdrop-blur border-border">
          <div ref={mapHostRef} style={{ minHeight: 500 }}>
            {mapVisible ? (
              <Suspense
                fallback={
                  <div
                    className="rounded-xl bg-muted/40 animate-pulse"
                    style={{ height: 500 }}
                  />
                }
              >
                <SilaMap markers={all} height={500} />
              </Suspense>
            ) : (
              <div
                className="rounded-xl bg-muted/40"
                style={{ height: 500 }}
                aria-hidden
              />
            )}
          </div>
          <div className="flex items-center justify-center gap-6 mt-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: ACCENT }} />
              <span className="text-foreground">فروع شحن ({branchMarkers.length})</span>
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
}

export default CoverageMapSection;