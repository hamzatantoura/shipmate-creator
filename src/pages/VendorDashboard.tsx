import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck, DollarSign, User, Phone, MapPin, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

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
    case "with_distributor": return "bg-info/20 text-info border-info/30";
    case "in_transit_intercity": return "bg-accent/20 text-accent-foreground border-accent/30";
    case "at_warehouse": return "bg-warning/20 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function VendorDashboard() {
  const { user, profile } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [cashMap, setCashMap] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<string, any[]>>({});

  const fetchShipments = async () => {
    if (!user) return;
    // Vendor sees all shipments assigned to them via carrier_id
    // For now, show all non-completed shipments (admin assigns carrier_id)
    const { data } = await supabase
      .from("shipments")
      .select("*")
      .not("status", "in", '("delivered","returned")')
      .order("created_at", { ascending: false });
    if (data) setShipments(data);
  };

  useEffect(() => { fetchShipments(); }, [user]);

  const deliveredShipments = shipments.filter(s => s.status === "delivered").length;
  const totalCOD = shipments
    .filter(s => s.status === "delivered")
    .reduce((sum, s) => sum + Number(s.cod_amount), 0);

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

    // Financial settlement on delivery
    if (ns === "delivered") {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("merchant_id", shipment.merchant_id)
        .single();

      if (wallet) {
        const codAmount = Number(shipment.cod_amount);
        const shippingFee = Number(shipment.shipping_fee || 0) + 2000; // platform markup
        const net = codAmount - shippingFee;
        const newBalance = Number(wallet.balance) + net;
        await supabase.from("wallets").update({ balance: newBalance } as any).eq("id", wallet.id);
        await supabase.from("wallet_transactions").insert([
          { wallet_id: wallet.id, type: "cod_settlement", amount: codAmount, description: `تسوية COD - ${shipment.tracking_number}`, reference_id: shipment.id },
          { wallet_id: wallet.id, type: "shipping_fee", amount: -shippingFee, description: `رسوم شحن - ${shipment.tracking_number}`, reference_id: shipment.id },
        ] as any);
      }
      toast.success("تم التسليم وتسوية المبلغ!");
    } else if (ns === "returned") {
      const { data: wallet } = await supabase.from("wallets").select("*").eq("merchant_id", shipment.merchant_id).single();
      if (wallet) {
        const newBalance = Number(wallet.balance) - 5000;
        await supabase.from("wallets").update({ balance: newBalance } as any).eq("id", wallet.id);
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

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">لوحة شركة الشحن</h1>
            {profile?.store_name && (
              <p className="text-sm text-muted-foreground mt-1">{profile.store_name}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">شحنات نشطة</p>
                <p className="text-xl font-display font-bold text-foreground">{shipments.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">تم التسليم</p>
                <p className="text-xl font-display font-bold text-foreground">{deliveredShipments}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي COD محصّل</p>
                <p className="text-xl font-display font-bold text-primary">{totalCOD.toLocaleString()} ل.س</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Shipments */}
        <h2 className="font-display font-semibold text-lg text-foreground">الشحنات المسندة إليك</h2>
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

                  {/* Status update */}
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

                  {/* Cash confirmation */}
                  {s.status === "delivered" && (
                    <div className="px-4 pb-3">
                      <Label className="text-xs text-muted-foreground">تأكيد المبلغ المحصّل</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={cashMap[s.id] || String(s.cod_amount)}
                          onChange={e => setCashMap(prev => ({ ...prev, [s.id]: e.target.value }))}
                          type="number"
                          className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={() => toast.success("تم تأكيد المبلغ")}>تأكيد</Button>
                      </div>
                    </div>
                  )}

                  {/* History toggle */}
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
      </main>
    </div>
  );
}
