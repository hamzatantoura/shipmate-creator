import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, MapPin, CheckCircle2, XCircle, Truck, ArrowRight, User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق",
  Aleppo: "حلب",
  Homs: "حمص",
  Lattakia: "اللاذقية",
  Hama: "حماة",
  Tartous: "طرطوس",
};

const FAIL_REASONS = [
  "الزبون لم يرد",
  "العنوان خاطئ",
  "رفض الاستلام",
];

export default function DriverDashboard() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [failReasonMap, setFailReasonMap] = useState<Record<string, string>>({});

  const fetchShipments = async () => {
    const { data } = await supabase
      .from("shipments")
      .select("*")
      .in("status", ["pending", "in_transit"])
      .order("created_at", { ascending: false });
    if (data) setShipments(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    const { error } = await supabase.from("shipments").update({ status }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(status === "delivered" ? "تم تسليم الشحنة بنجاح!" : "تم تسجيل فشل التسليم");
      fetchShipments();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-lg text-foreground">لوحة السائق</span>
          </div>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <ArrowRight className="h-3.5 w-3.5" />
              لوحة التاجر
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Stats bar */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <span className="text-sm text-muted-foreground">شحنات نشطة</span>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-display font-bold text-base px-3">
            {shipments.length}
          </Badge>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">لا توجد شحنات نشطة حالياً</div>
        ) : (
          shipments.map((s) => (
            <Card key={s.id} className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                {/* Card Header */}
                <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between border-b border-border">
                  <span className="font-mono text-xs text-muted-foreground">{s.tracking_number}</span>
                  <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-xs">
                    {s.status === "in_transit" ? "قيد التوصيل" : "قيد الانتظار"}
                  </Badge>
                </div>

                {/* Info */}
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-foreground">{s.receiver_name}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground" dir="ltr">{s.phone_number}</span>
                    </div>
                    <a href={`tel:${s.phone_number}`}>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-primary/30 text-primary hover:bg-primary/10">
                        <Phone className="h-3 w-3" />
                        اتصال
                      </Button>
                    </a>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-foreground">{CITY_AR[s.city] || s.city}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.detailed_address}</p>
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-md px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">الدفع عند الاستلام</span>
                    <span className="font-display font-bold text-foreground">{Number(s.cod_amount).toLocaleString()} ل.س</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 space-y-2">
                  <Button
                    className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    disabled={updatingId === s.id}
                    onClick={() => updateStatus(s.id, "delivered")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    تحديث الحالة إلى: تم التسليم
                  </Button>

                  <div className="flex gap-2">
                    <Select
                      value={failReasonMap[s.id] || ""}
                      onValueChange={(v) => setFailReasonMap((prev) => ({ ...prev, [s.id]: v }))}
                    >
                      <SelectTrigger className="flex-1 text-xs h-9">
                        <SelectValue placeholder="سبب فشل التسليم..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FAIL_REASONS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 h-9 px-3 shrink-0"
                      disabled={!failReasonMap[s.id] || updatingId === s.id}
                      onClick={() => updateStatus(s.id, "failed")}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      فشل التسليم
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
