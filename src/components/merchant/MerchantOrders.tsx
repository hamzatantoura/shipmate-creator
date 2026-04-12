import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Truck, Loader2, Search, ShieldAlert, PhoneCall, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { calculatePricing, isLossOrder } from "@/lib/pricing-engine";
import type { Database } from "@/integrations/supabase/types";

const STATUS_AR: Record<string, string> = {
  new: "جديد", processing: "قيد المعالجة", assigned: "تم تعيين مندوب",
  out_for_delivery: "خرج للتوصيل", delivered: "تم التسليم", returned: "مرتجع",
  pending: "قيد الانتظار", shipped: "تم الشحن", cancelled: "ملغى",
};

const statusColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-primary/20 text-primary border-primary/30";
    case "returned": case "cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
    case "assigned": case "out_for_delivery": case "shipped": return "bg-info/20 text-info border-info/30";
    default: return "bg-warning/20 text-warning border-warning/30";
  }
};

interface Order {
  id: string; product_id: string | null; quantity: number; total_amount: number;
  receiver_name: string; phone_number: string; city: string; detailed_address: string;
  status: string; shipment_id: string | null; created_at: string;
  final_sale_price: number | null; customer_lat: number | null; customer_lng: number | null;
  delivery_fee: number; platform_fee: number; net_amount: number;
  products?: { name: string } | null;
}

type ShipmentCity = Database["public"]["Enums"]["shipment_city"];

const CITY_TO_ENUM: Record<string, ShipmentCity> = {
  damascus: "Damascus", "دمشق": "Damascus", "ريف دمشق": "Damascus",
  aleppo: "Aleppo", "حلب": "Aleppo",
  homs: "Homs", "حمص": "Homs",
  lattakia: "Lattakia", "اللاذقية": "Lattakia", latakia: "Lattakia",
  hama: "Hama", "حماة": "Hama",
  tartous: "Tartous", tartus: "Tartous", "طرطوس": "Tartous",
};

const normalizeShipmentCity = (city: string): ShipmentCity => CITY_TO_ENUM[city.trim().toLowerCase()] || "Aleppo";
const createTrackingNumber = () => `SIL-${Date.now().toString(36).toUpperCase()}`;

export default function MerchantOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("orders").select("*, products(name)")
      .eq("merchant_id", user.id).order("created_at", { ascending: false });
    if (data) setOrders(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openConfirm = (o: Order) => {
    setConfirmOrder(o);
    setEditPrice(String(o.final_sale_price || o.total_amount));
  };

  // Look up carrier fee + carrier_id from shipping_zones based on order city
  const [carrierFeeForOrder, setCarrierFeeForOrder] = useState(0);
  const [carrierIdForOrder, setCarrierIdForOrder] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmOrder) { setCarrierFeeForOrder(0); setCarrierIdForOrder(null); return; }
    supabase.from("shipping_zones").select("delivery_fee, carrier_id")
      .eq("province_name_ar", confirmOrder.city).eq("is_active", true)
      .is("area_name", null).is("neighborhood_name", null)
      .limit(1).then(({ data }) => {
        setCarrierFeeForOrder(data?.[0]?.delivery_fee || 0);
        setCarrierIdForOrder(data?.[0]?.carrier_id || null);
      });
  }, [confirmOrder]);

  const confirmPricing = (() => {
    if (!confirmOrder) return null;
    const finalPrice = parseFloat(editPrice) || confirmOrder.total_amount;
    return calculatePricing({ carrier_fee: carrierFeeForOrder, cod_amount: finalPrice });
  })();

  const isLoss = confirmPricing ? isLossOrder(confirmPricing, parseFloat(editPrice) || 0) : false;

  const confirmAndShip = async () => {
    if (!confirmOrder || !user || !confirmPricing) return;
    if (isLoss) { toast.error("لا يمكن إتمام الطلب: شحنة خاسرة"); return; }

    const finalPrice = parseFloat(editPrice) || confirmOrder.total_amount;
    const trackingNumber = createTrackingNumber();
    setSubmitting(true);

    const { data: shipment, error: shipmentError } = await supabase.from("shipments").insert({
      merchant_id: user.id,
      receiver_name: confirmOrder.receiver_name,
      phone_number: confirmOrder.phone_number,
      city: normalizeShipmentCity(confirmOrder.city),
      detailed_address: confirmOrder.detailed_address,
      cod_amount: finalPrice,
      tracking_number: trackingNumber,
      shipping_fee: confirmPricing.merchant_shipping_fee,
      carrier_fee: confirmPricing.carrier_fee,
      platform_margin: confirmPricing.platform_margin,
      collection_fee: confirmPricing.collection_fee,
      merchant_shipping_fee: confirmPricing.merchant_shipping_fee,
      billable_weight: confirmPricing.billable_weight,
      volumetric_weight: confirmPricing.volumetric_weight,
      order_id: confirmOrder.id,
      status: "pending",
    } as any).select("id").single();

    if (shipmentError || !shipment) {
      setSubmitting(false);
      toast.error(shipmentError?.message || "تعذر إنشاء الشحنة");
      return;
    }

    const { error: orderError } = await supabase.from("orders").update({
      final_sale_price: finalPrice,
      delivery_fee: confirmPricing.merchant_shipping_fee,
      platform_fee: confirmPricing.collection_fee,
      net_amount: confirmPricing.net_to_merchant,
      status: "processing",
      shipment_id: shipment.id,
    } as any).eq("id", confirmOrder.id);

    if (orderError) {
      await supabase.from("shipments").delete().eq("id", shipment.id);
      setSubmitting(false);
      toast.error(orderError.message || "تعذر ربط الشحنة بالطلب");
      return;
    }

    setSubmitting(false);
    setConfirmOrder(null);
    toast.success(`تم إنشاء الشحنة بنجاح — رقم التتبع: ${trackingNumber}`);
    fetchOrders();
  };

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.receiver_name.toLowerCase().includes(q) || o.phone_number.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-lg text-foreground">الطلبات ({orders.length})</h2>
        </div>
        <div className="relative w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
      </div>

      {loading ? <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p> :
       filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" /><p>لا توجد طلبات بعد.</p></div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="p-3 text-right font-medium">العميل</th>
                  <th className="p-3 text-right font-medium">المدينة</th>
                  <th className="p-3 text-right font-medium">المبلغ</th>
                  <th className="p-3 text-right font-medium">رسوم الشحن</th>
                  <th className="p-3 text-right font-medium">بدل تحصيل</th>
                  <th className="p-3 text-right font-medium">صافي</th>
                  <th className="p-3 text-right font-medium">الحالة</th>
                  <th className="p-3 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-medium text-foreground">{o.receiver_name}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{o.phone_number}</p>
                      {o.products?.name && <p className="text-xs text-muted-foreground">{o.products.name} × {o.quantity}</p>}
                    </td>
                    <td className="p-3 text-foreground">{o.city}</td>
                    <td className="p-3 text-foreground">{(o.final_sale_price || o.total_amount).toLocaleString()} ل.س</td>
                    <td className="p-3 text-muted-foreground">{Number(o.delivery_fee || 0).toLocaleString()} ل.س</td>
                    <td className="p-3 text-muted-foreground">{Number(o.platform_fee || 0).toLocaleString()} ل.س</td>
                    <td className="p-3 font-bold text-primary">{Number(o.net_amount || 0).toLocaleString()} ل.س</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${statusColor(o.status)}`}>
                        {STATUS_AR[o.status] || o.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`tel:${o.phone_number}`)}>
                          <PhoneCall className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          const phone = o.phone_number.replace(/[\s-]/g, "").replace(/^0/, "963");
                          window.open(`https://wa.me/${phone}`, "_blank");
                        }}>
                          <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                        </Button>
                        {!o.shipment_id && ["new", "pending", "processing"].includes(o.status) && (
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => openConfirm(o)}>
                            <Truck className="h-3.5 w-3.5 text-primary" /> شحن
                          </Button>
                        )}
                        {o.shipment_id && <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">تم الشحن</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Price Adjustment Dialog */}
      <Dialog open={!!confirmOrder} onOpenChange={o => !o && setConfirmOrder(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تأكيد الطلب وطلب الشحن</DialogTitle></DialogHeader>
          {confirmOrder && confirmPricing && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                <p className="font-semibold text-foreground">{confirmOrder.receiver_name}</p>
                <p className="text-sm text-muted-foreground">{confirmOrder.city} — {confirmOrder.detailed_address}</p>
                <p className="text-sm text-muted-foreground">{confirmOrder.phone_number}</p>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">مبلغ التحصيل النهائي (ل.س)</Label>
                <Input type="number" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="text-lg font-display font-bold" />
                {editPrice && (
                  <div className="text-sm space-y-1 p-3 bg-muted/50 rounded-lg">
                    <p>رسوم الشحن: <span className="font-bold">{confirmPricing.merchant_shipping_fee.toLocaleString()} ل.س</span></p>
                    <p>بدل تحصيل (1%): <span className="font-bold">{confirmPricing.collection_fee.toLocaleString()} ل.س</span></p>
                    <div className="h-px bg-border my-1" />
                    <p className={`font-bold ${confirmPricing.net_to_merchant >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      صافي الربح: {confirmPricing.net_to_merchant.toLocaleString()} ل.س
                    </p>
                  </div>
                )}
              </div>

              {isLoss && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <p>شحنة خاسرة — لا يمكن الإتمام</p>
                </div>
              )}

              <Button className="w-full glow-btn" disabled={submitting || isLoss} onClick={confirmAndShip}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Truck className="h-4 w-4 ml-2" />}
                تأكيد وطلب شحن
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
