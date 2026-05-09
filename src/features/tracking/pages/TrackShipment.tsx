import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Search, Package, MapPin, Truck, ArrowRight,
  PackagePlus, PackageCheck, Warehouse, Bike, CheckCircle2, RotateCcw, type LucideIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useEffect } from "react";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

const STATUS_AR: Record<string, string> = {
  new: "جديد",
  pending: "قيد الانتظار",
  picked_up: "تم الاستلام من التاجر",
  processing: "قيد المعالجة",
  assigned: "تم تعيين مندوب",
  pending_pickup: "بانتظار الاستلام",
  at_warehouse: "في المستودع",
  in_transit_intercity: "جاري الشحن بين المحافظات",
  with_distributor: "مع مندوب التوزيع",
  out_for_delivery: "خرج للتوصيل",
  in_transit: "قيد التوصيل",
  delivered: "تم التسليم ✓",
  returned: "مرتجع",
  cancelled: "ملغاة",
  failed: "فشل التسليم",
};

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

const statusColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-primary/20 text-primary border-primary/30";
    case "returned": case "failed": case "cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
    case "out_for_delivery": case "assigned": case "in_transit": case "in_transit_intercity": case "with_distributor":
      return "bg-info/20 text-info border-info/30";
    default: return "bg-warning/20 text-warning border-warning/30";
  }
};

interface StatusLog { id: string; new_status: string; old_status: string | null; created_at: string; changed_by_role: string | null; }
interface CarrierInfo { name_ar: string; }

/** Canonical journey milestones (Sila Standard). */
interface Milestone {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Status values that satisfy this milestone. */
  matches: string[];
}

const JOURNEY: Milestone[] = [
  { key: "created", label: "تم إنشاء الطلب", icon: PackagePlus, matches: ["pending", "new"] },
  { key: "picked_up", label: "تم الاستلام من التاجر", icon: PackageCheck, matches: ["picked_up", "processing"] },
  { key: "in_transit", label: "قيد الشحن", icon: Warehouse, matches: ["at_warehouse", "in_transit_intercity", "shipped"] },
  { key: "out_for_delivery", label: "خرج للتوصيل", icon: Bike, matches: ["with_distributor", "out_for_delivery", "in_transit"] },
  { key: "completed", label: "تم التسليم", icon: CheckCircle2, matches: ["delivered"] },
];

const RETURNED_MILESTONE: Milestone = {
  key: "returned", label: "مرتجع", icon: RotateCcw, matches: ["returned", "failed", "cancelled"],
};

interface TimelineStep extends Milestone {
  reachedAt: string | null;
  state: "complete" | "current" | "pending" | "failed";
}

/**
 * Build the vertical timeline by walking the canonical journey and finding the
 * first matching status entry in `history` for each milestone. Pure presentation —
 * no inferred dates, no fabricated milestones.
 */
function buildTimeline(currentStatus: string, history: StatusLog[], createdAt: string | null): TimelineStep[] {
  const sorted = [...history].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const findMatch = (m: Milestone) =>
    sorted.find((h) => m.matches.includes(h.new_status))?.created_at ?? null;

  const isReturned = RETURNED_MILESTONE.matches.includes(currentStatus);

  const steps: TimelineStep[] = JOURNEY.map((m, i) => {
    // First milestone reuses createdAt when no audit row exists yet.
    const reachedAt = findMatch(m) ?? (i === 0 ? createdAt : null);
    return {
      ...m,
      reachedAt,
      state: reachedAt ? "complete" : "pending",
    };
  });

  // Mark "current" — the last completed step OR the first pending one
  // depending on whether the order is mid-journey.
  const lastCompleteIdx = steps.reduce((acc, s, i) => (s.state === "complete" ? i : acc), -1);
  if (lastCompleteIdx >= 0 && lastCompleteIdx < steps.length - 1 && !isReturned) {
    const next = lastCompleteIdx + 1;
    if (steps[next] && steps[next].state === "pending") steps[next].state = "current";
  }

  if (isReturned) {
    const failedAt =
      sorted.find((h) => RETURNED_MILESTONE.matches.includes(h.new_status))?.created_at ?? null;
    steps.push({
      ...RETURNED_MILESTONE,
      reachedAt: failedAt,
      state: failedAt ? "failed" : "pending",
    });
  }

  return steps;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("ar-SY")} • ${d.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function TrackShipment() {
  const navigate = useNavigate();
  const { trackingId } = useParams();
  const [query, setQuery] = useState(trackingId || "");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [history, setHistory] = useState<StatusLog[]>([]);
  const [carrier, setCarrier] = useState<CarrierInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (trackingNum: string) => {
    if (!trackingNum.trim()) return;
    setLoading(true);
    setSearched(true);

    // Use secure RPC function — returns only safe public fields
    const { data } = await supabase.rpc("track_shipment_public", { p_tracking_number: trackingNum.trim() });
    if (data) {
      const d = data as any;
      setShipment({
        tracking_number: d.tracking_number,
        status: d.status,
        city: d.city,
        created_at: d.created_at,
        updated_at: d.updated_at,
      } as any);
      setHistory((d.history || []).map((h: any, i: number) => ({ id: String(i), ...h })));
      if (d.carrier_name) setCarrier({ name_ar: d.carrier_name });
      else setCarrier(null);
    } else {
      setShipment(null);
      setHistory([]);
      setCarrier(null);
    }
    setLoading(false);
  };

  // Auto-search if URL has tracking ID
  useEffect(() => {
    if (trackingId) doSearch(trackingId);
  }, [trackingId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const timeline = useMemo<TimelineStep[]>(
    () => (shipment ? buildTimeline(shipment.status, history, shipment.created_at) : []),
    [shipment, history],
  );

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">صلة — تتبع الشحنة</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground">الرئيسية</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>تتبع الشحنة</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">تتبع شحنتك</h1>
          <p className="text-muted-foreground">أدخل رقم التتبع لمعرفة حالة شحنتك</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input placeholder="رقم التتبع (مثال: SIL-XXXXXX)" value={query} onChange={e => setQuery(e.target.value)} className="flex-1" dir="ltr" />
          <Button type="submit" disabled={loading} className="gap-2"><Search className="h-4 w-4" /> تتبع</Button>
        </form>

        {loading && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="space-y-5 pt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {searched && !loading && !shipment && (
          <p className="text-center text-muted-foreground py-8">لم يتم العثور على شحنة بهذا الرقم</p>
        )}

        {shipment && !loading && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <span className="font-mono text-sm text-muted-foreground">{shipment.tracking_number}</span>
                </div>
                <Badge variant="outline" className={statusColor(shipment.status)}>
                  {STATUS_AR[shipment.status] || shipment.status}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{CITY_AR[shipment.city] || shipment.city}</span>
                </div>
              </div>

              {/* Carrier info & contact */}
              {carrier && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">شركة الشحن: {carrier.name_ar}</span>
                  </div>
                </div>
              )}

              {/* Vertical Journey Timeline */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-4">رحلة الشحنة</h3>
                <ol className="relative space-y-5">
                  {timeline.map((step, idx) => {
                    const Icon = step.icon;
                    const isLast = idx === timeline.length - 1;
                    const tone =
                      step.state === "failed"
                        ? { ring: "border-destructive bg-destructive text-destructive-foreground", line: "bg-destructive/40", title: "text-destructive font-semibold" }
                        : step.state === "complete"
                          ? { ring: "border-primary bg-primary text-primary-foreground", line: "bg-primary/50", title: "text-foreground font-semibold" }
                          : step.state === "current"
                            ? { ring: "border-primary bg-primary/15 text-primary animate-pulse", line: "bg-border", title: "text-primary font-semibold" }
                            : { ring: "border-border bg-muted text-muted-foreground", line: "bg-border", title: "text-muted-foreground" };
                    return (
                      <li key={step.key} className="relative flex items-start gap-4">
                        {!isLast && (
                          <span
                            aria-hidden
                            className={`absolute right-[17px] top-9 bottom-[-20px] w-px ${tone.line}`}
                          />
                        )}
                        <span
                          className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 ${tone.ring}`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className={`text-sm ${tone.title}`}>{step.label}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {fmtDateTime(step.reachedAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}