import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Search, Package, MapPin, Phone, Clock, Truck, ArrowRight } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  pending_pickup: "بانتظار الاستلام",
  at_warehouse: "تم الاستلام / في المستودع",
  in_transit: "قيد التوصيل",
  in_transit_intercity: "قيد الشحن بين المحافظات",
  with_distributor: "مع مندوب التوزيع",
  delivered: "تم التسليم",
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
    case "returned":
    case "failed":
    case "cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
    case "with_distributor":
    case "in_transit":
    case "in_transit_intercity": return "bg-info/20 text-info border-info/30";
    default: return "bg-warning/20 text-warning border-warning/30";
  }
};

interface StatusLog {
  id: string;
  new_status: string;
  created_at: string;
}

export default function TrackShipment() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [history, setHistory] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    const { data } = await supabase
      .from("shipments")
      .select("*")
      .eq("tracking_number", query.trim())
      .single();

    if (data) {
      setShipment(data);
      const { data: logs } = await supabase
        .from("shipment_status_history")
        .select("*")
        .eq("shipment_id", data.id)
        .order("created_at", { ascending: true });
      if (logs) setHistory(logs as StatusLog[]);
    } else {
      setShipment(null);
      setHistory([]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header with back button */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">صلة — تتبع الشحنة</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground">
                الرئيسية
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>تتبع الشحنة</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">تتبع شحنتك</h1>
          <p className="text-muted-foreground">أدخل رقم التتبع لمعرفة حالة شحنتك</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="رقم التتبع (مثال: SHP-XXXXXX)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            dir="ltr"
          />
          <Button type="submit" disabled={loading} className="gap-2">
            <Search className="h-4 w-4" />
            تتبع
          </Button>
        </form>

        {searched && !loading && !shipment && (
          <p className="text-center text-muted-foreground py-8">لم يتم العثور على شحنة بهذا الرقم</p>
        )}

        {shipment && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-4">
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
                  <span className="text-foreground">{CITY_AR[shipment.city] || shipment.city} — {shipment.detailed_address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground" dir="ltr">{shipment.phone_number}</span>
                </div>
              </div>

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
