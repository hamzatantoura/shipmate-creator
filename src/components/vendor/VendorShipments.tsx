import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, MapPin, CheckCircle, Clock, ChevronDown, ChevronUp, Loader2, Navigation } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { ALEPPO_MERCHANTS } from "@/data/aleppo-demo-merchants";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

interface Props {
  selectedMerchantId: string | null;
  onSelectMerchant: (id: string) => void;
  assignedIds: Set<string>;
}

const STATUS_OPTIONS = [
  { value: "at_warehouse", label: "تم الاستلام" },
  { value: "in_transit_intercity", label: "قيد الشحن" },
  { value: "with_distributor", label: "مع مندوب التوزيع" },
  { value: "delivered", label: "تم التسليم" },
  { value: "returned", label: "مرتجع" },
];

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  pending_pickup: "بانتظار الاستلام",
  at_warehouse: "في المستودع",
  in_transit_intercity: "قيد الشحن",
  with_distributor: "مع التوزيع",
  delivered: "تم التسليم",
  returned: "مرتجع",
};

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

const statusColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-primary/20 text-primary border-primary/30";
    case "returned": return "bg-destructive/20 text-destructive border-destructive/30";
    case "with_distributor": return "bg-primary/10 text-primary border-primary/20";
    case "in_transit_intercity": return "bg-accent text-accent-foreground border-accent";
    case "at_warehouse": return "bg-secondary text-secondary-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function VendorShipments({ selectedMerchantId, onSelectMerchant, assignedIds }: Props) {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const selectedRef = useRef<HTMLDivElement | null>(null);

  // Active demo merchants (not assigned)
  const demoMerchants = ALEPPO_MERCHANTS.filter(m => !assignedIds.has(m.id));

  const fetchShipments = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("shipments")
      .select("*")
      .not("status", "in", '("delivered","returned")')
      .order("created_at", { ascending: false });
    if (data) setShipments(data);
    setLoading(false);
  };

  useEffect(() => { fetchShipments(); }, [user]);

  // Scroll to selected
  useEffect(() => {
    if (selectedMerchantId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedMerchantId]);

  const updateStatus = async (shipment: Shipment) => {
    const ns = statusMap[shipment.id];
    if (!ns) return;
    setUpdatingId(shipment.id);

    await supabase.from("shipment_status_history").insert({
      shipment_id: shipment.id,
      old_status: shipment.status,
      new_status: ns,
      changed_by: "vendor",
    } as any);

    await supabase.from("shipments").update({ status: ns }).eq("id", shipment.id);

    if (ns === "delivered") {
      const { data: wallet } = await supabase
        .from("wallets").select("*").eq("merchant_id", shipment.merchant_id).single();
      if (wallet) {
        const codAmount = Number(shipment.cod_amount);
        const shippingFee = Number(shipment.shipping_fee || 0) + 2000;
        const net = codAmount - shippingFee;
        await supabase.from("wallets").update({ balance: Number(wallet.balance) + net } as any).eq("id", wallet.id);
        await supabase.from("wallet_transactions").insert([
          { wallet_id: wallet.id, type: "cod_settlement", amount: codAmount, description: `تسوية COD - ${shipment.tracking_number}`, reference_id: shipment.id },
          { wallet_id: wallet.id, type: "shipping_fee", amount: -shippingFee, description: `رسوم شحن - ${shipment.tracking_number}`, reference_id: shipment.id },
        ] as any);
      }
      toast.success("تم التسليم وتسوية المبلغ!");
    } else if (ns === "returned") {
      const { data: wallet } = await supabase.from("wallets").select("*").eq("merchant_id", shipment.merchant_id).single();
      if (wallet) {
        await supabase.from("wallets").update({ balance: Number(wallet.balance) - 5000 } as any).eq("id", wallet.id);
        await supabase.from("wallet_transactions").insert({
          wallet_id: wallet.id, type: "return_fee", amount: -5000,
          description: `رسوم إرجاع - ${shipment.tracking_number}`, reference_id: shipment.id,
        } as any);
      }
      toast.success("تم تسجيل المرتجع");
    } else {
      toast.success(`تم تحديث الحالة إلى: ${STATUS_AR[ns] || ns}`);
    }

    setUpdatingId(null);
    setStatusMap(prev => ({ ...prev, [shipment.id]: "" }));
    fetchShipments();
  };

  const loadHistory = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    const { data } = await supabase.from("shipment_status_history").select("*").eq("shipment_id", id).order("created_at", { ascending: false });
    if (data) setHistoryMap(prev => ({ ...prev, [id]: data }));
    setExpandedId(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo merchant cards synced with map */}
      {demoMerchants.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-lg text-foreground mb-3">طلبات الاستلام — حلب (عرض توضيحي)</h2>
          <div className="space-y-2">
            {demoMerchants.map(m => {
              const isSelected = m.id === selectedMerchantId;
              return (
                <div
                  key={m.id}
                  ref={isSelected ? selectedRef : null}
                  onClick={() => onSelectMerchant(m.id)}
                  className={`cursor-pointer rounded-lg border p-3 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${isSelected ? 'bg-primary' : 'bg-muted-foreground/60'}`}>
                        {m.packages}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.neighborhood} — حلب</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-foreground">{m.productValue.toLocaleString()} ل.س</p>
                      <p className="text-xs text-primary">{m.shippingFee.toLocaleString()} ل.س شحن</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                      <Navigation className="h-3 w-3" />
                      اضغط لعرض الموقع على الخريطة
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Real shipments */}
      <div>
        <h2 className="font-display font-semibold text-lg text-foreground mb-3">الشحنات النشطة</h2>
        {shipments.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">لا توجد شحنات نشطة حالياً</p>
        ) : (
          <div className="space-y-3">
            {shipments.map(s => (
              <Card key={s.id} className="bg-card border-border overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between border-b border-border">
                    <span className="font-mono text-xs text-muted-foreground">{s.tracking_number}</span>
                    <Badge variant="outline" className={statusColor(s.status)}>
                      {STATUS_AR[s.status] || s.status}
                    </Badge>
                  </div>
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

                  <div className="px-4 pb-3 flex gap-2">
                    <Select value={statusMap[s.id] || ""} onValueChange={v => setStatusMap(prev => ({ ...prev, [s.id]: v }))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="تغيير الحالة..." /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.filter(o => o.value !== s.status).map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button disabled={!statusMap[s.id] || updatingId === s.id} onClick={() => updateStatus(s)} className="glow-btn">
                      <CheckCircle className="h-4 w-4 ml-1" /> تحديث
                    </Button>
                  </div>

                  <div className="border-t border-border">
                    <button className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:bg-muted/30 transition-colors" onClick={() => loadHistory(s.id)}>
                      <Clock className="h-3 w-3" /> سجل الحالات
                      {expandedId === s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {expandedId === s.id && (
                      <div className="px-4 pb-3 space-y-1">
                        {(historyMap[s.id] || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">لا يوجد سجل</p>
                        ) : (historyMap[s.id] || []).map((h: any) => (
                          <div key={h.id} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-16">{new Date(h.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
                            <span className="text-foreground">{STATUS_AR[h.old_status] || "—"} → {STATUS_AR[h.new_status] || h.new_status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
