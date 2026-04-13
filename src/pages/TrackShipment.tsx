import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Search, Package, MapPin, Clock, Truck, ArrowRight } from "lucide-react";
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

const STATUS_ORDER = ["pending", "picked_up", "at_warehouse", "in_transit_intercity", "with_distributor", "out_for_delivery", "delivered"];

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

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/[\s-]/g, "").replace(/^0/, "963");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  const callPhone = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

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

        {searched && !loading && !shipment && (
          <p className="text-center text-muted-foreground py-8">لم يتم العثور على شحنة بهذا الرقم</p>
        )}

        {shipment && (
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

              {/* Progress bar */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {STATUS_ORDER.map((status, i) => {
                  const currentIdx = STATUS_ORDER.indexOf(shipment.status);
                  const isReturned = shipment.status === "returned";
                  const isActive = !isReturned && i <= currentIdx;
                  const isCurrent = shipment.status === status;
                  return (
                    <div key={status} className="flex items-center gap-1">
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full border-2 ${
                          isCurrent ? 'bg-primary border-primary scale-125' :
                          isActive ? 'bg-primary/60 border-primary/60' :
                          'bg-muted border-border'
                        }`} />
                        <span className={`text-[9px] mt-1 whitespace-nowrap ${isCurrent ? 'text-primary font-bold' : isActive ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                          {STATUS_AR[status]}
                        </span>
                      </div>
                      {i < STATUS_ORDER.length - 1 && (
                        <div className={`h-0.5 w-6 ${isActive && i < currentIdx ? 'bg-primary/60' : 'bg-border'}`} />
                      )}
                    </div>
                  );
                })}
                {shipment.status === "returned" && (
                  <div className="flex items-center gap-1 mr-2">
                    <div className="h-0.5 w-4 bg-destructive/40" />
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-destructive border-2 border-destructive scale-125" />
                      <span className="text-[9px] mt-1 text-destructive font-bold">مرتجع</span>
                    </div>
                  </div>
                )}
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

              {/* Timeline */}
              {history.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> سجل الحالات
                  </h3>
                  <div className="space-y-3 pr-4 border-r-2 border-primary/20">
                    {history.map((h, i) => (
                      <div key={h.id} className="relative pr-4">
                        <div className={`absolute -right-[9px] top-1 w-4 h-4 rounded-full border-2 ${
                          i === history.length - 1 ? "bg-primary border-primary" : "bg-background border-primary/40"
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{STATUS_AR[h.new_status] || h.new_status}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(h.created_at).toLocaleDateString("ar")} — {new Date(h.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}