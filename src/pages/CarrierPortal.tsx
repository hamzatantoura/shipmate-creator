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
import { Truck, MapPin, User, Phone, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

const MERCHANT_ID = "00000000-0000-0000-0000-000000000000";
const PLATFORM_MARKUP = 2000; // hidden 2,000 SYP markup
const RETURN_FEE = 5000; // fixed return fee

const STATUS_OPTIONS = [
  { value: "pending_pickup", label: "بانتظار الاستلام" },
  { value: "at_warehouse", label: "تم الاستلام / في المستودع" },
  { value: "in_transit_intercity", label: "قيد الشحن بين المحافظات" },
  { value: "with_distributor", label: "مع مندوب التوزيع" },
  { value: "delivered", label: "تم التسليم" },
  { value: "returned", label: "مرتجع" },
];

const STATUS_AR: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
);

const statusColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-primary/20 text-primary border-primary/30";
    case "returned": return "bg-destructive/20 text-destructive border-destructive/30";
    case "with_distributor": return "bg-info/20 text-info border-info/30";
    case "in_transit_intercity": return "bg-accent/20 text-accent-foreground border-accent/30";
    case "at_warehouse": return "bg-warning/20 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

interface StatusLog {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  created_at: string;
}

export default function CarrierPortal() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [historyMap, setHistoryMap] = useState<Record<string, StatusLog[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchShipments = async () => {
    const { data } = await supabase
      .from("shipments")
      .select("*")
      .not("status", "in", '("delivered","returned")')
      .order("created_at", { ascending: false });
    if (data) setShipments(data);
    setLoading(false);
  };

  useEffect(() => { fetchShipments(); }, []);

  const loadHistory = async (shipmentId: string) => {
    if (expandedId === shipmentId) {
      setExpandedId(null);
      return;
    }
    const { data } = await supabase
      .from("shipment_status_history")
      .select("*")
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: false });
    if (data) setHistoryMap((prev) => ({ ...prev, [shipmentId]: data as StatusLog[] }));
    setExpandedId(shipmentId);
  };

  const updateStatus = async (shipment: Shipment) => {
    const newStatus = statusMap[shipment.id];
    if (!newStatus || newStatus === shipment.status) return;

    setUpdatingId(shipment.id);

    // Log status change
    await supabase.from("shipment_status_history").insert({
      shipment_id: shipment.id,
      old_status: shipment.status,
      new_status: newStatus,
      changed_by: "carrier",
    } as any);

    // Update shipment status
    await supabase.from("shipments").update({ status: newStatus }).eq("id", shipment.id);

    // Financial triggers
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("merchant_id", shipment.merchant_id)
      .single();

    if (wallet) {
      if (newStatus === "delivered") {
        // Add COD (product price) to merchant wallet
        const codAmount = Number(shipment.cod_amount);
        // Deduct final shipping fee (base + hidden markup)
        const shippingFee = Number(shipment.shipping_fee || 0) + PLATFORM_MARKUP;
        const net = codAmount - shippingFee;
        const newBalance = Number(wallet.balance) + net;

        await supabase.from("wallets").update({ balance: newBalance } as any).eq("id", wallet.id);
        await supabase.from("wallet_transactions").insert([
          { wallet_id: wallet.id, type: "cod_settlement", amount: codAmount, description: `تسوية COD - ${shipment.tracking_number}`, reference_id: shipment.id },
          { wallet_id: wallet.id, type: "shipping_fee", amount: -shippingFee, description: `رسوم شحن نهائية - ${shipment.tracking_number}`, reference_id: shipment.id },
        ] as any);

        toast.success("تم التسليم وتسوية المبلغ في محفظة التاجر!");
      } else if (newStatus === "returned") {
        // Deduct fixed return fee only
        const newBalance = Number(wallet.balance) - RETURN_FEE;
        await supabase.from("wallets").update({ balance: newBalance } as any).eq("id", wallet.id);
        await supabase.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          type: "return_fee",
          amount: -RETURN_FEE,
          description: `رسوم إرجاع - ${shipment.tracking_number}`,
          reference_id: shipment.id,
        } as any);

        toast.success("تم تسجيل المرتجع وخصم رسوم الإرجاع (5,000 ل.س)");
      } else {
        toast.success(`تم تحديث الحالة إلى: ${STATUS_AR[newStatus] || newStatus}`);
      }
    }

    setUpdatingId(null);
    setStatusMap((prev) => ({ ...prev, [shipment.id]: "" }));
    fetchShipments();
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">بوابة الناقل</h1>
        </div>

        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <span className="text-sm text-muted-foreground">شحنات نشطة</span>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-display font-bold text-base px-3">
            {shipments.length}
          </Badge>
        </div>

        {loading ? (
          <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p>
        ) : shipments.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">لا توجد شحنات نشطة</p>
        ) : (
          <div className="space-y-3">
            {shipments.map((s) => (
              <Card key={s.id} className="bg-card border-border overflow-hidden">
                <CardContent className="p-0">
                  {/* Header */}
                  <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between border-b border-border">
                    <span className="font-mono text-xs text-muted-foreground">{s.tracking_number}</span>
                    <Badge variant="outline" className={statusColor(s.status)}>
                      {STATUS_AR[s.status] || s.status}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">{s.receiver_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground" dir="ltr">{s.phone_number}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <span className="text-sm font-medium text-foreground">{CITY_AR[s.city] || s.city}</span>
                        <p className="text-xs text-muted-foreground">{s.detailed_address}</p>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-md px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">COD</span>
                      <span className="font-display font-bold text-foreground">{Number(s.cod_amount).toLocaleString()} ل.س</span>
                    </div>
                  </div>

                  {/* Status update */}
                  <div className="px-4 pb-3 flex gap-2">
                    <Select
                      value={statusMap[s.id] || ""}
                      onValueChange={(v) => setStatusMap((prev) => ({ ...prev, [s.id]: v }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="تغيير الحالة..." />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.filter((o) => o.value !== s.status).map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={!statusMap[s.id] || updatingId === s.id}
                      onClick={() => updateStatus(s)}
                    >
                      تحديث
                    </Button>
                  </div>

                  {/* History toggle */}
                  <div className="border-t border-border">
                    <button
                      className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                      onClick={() => loadHistory(s.id)}
                    >
                      <Clock className="h-3 w-3" />
                      سجل الحالات
                      {expandedId === s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {expandedId === s.id && (
                      <div className="px-4 pb-3 space-y-1">
                        {(historyMap[s.id] || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">لا يوجد سجل بعد</p>
                        ) : (
                          (historyMap[s.id] || []).map((h) => (
                            <div key={h.id} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-16 shrink-0">
                                {new Date(h.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="text-muted-foreground">
                                {new Date(h.created_at).toLocaleDateString("ar")}
                              </span>
                              <span className="text-foreground">
                                {STATUS_AR[h.old_status || ""] || h.old_status || "—"} → {STATUS_AR[h.new_status] || h.new_status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
