import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Truck, Loader2, MapPin, Search, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

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

export default function MerchantOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

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

  const confirmAndShip = async () => {
    if (!confirmOrder) return;
    const finalPrice = parseFloat(editPrice) || confirmOrder.total_amount;
    const deliveryFee = Number(confirmOrder.delivery_fee || 0);
    const platformFee = finalPrice * 0.05;
    const netAmount = finalPrice - deliveryFee - platformFee;
    setSubmitting(true);

    await supabase.from("orders").update({
      final_sale_price: finalPrice,
      platform_fee: platformFee,
      net_amount: netAmount,
      status: "processing",
    } as any).eq("id", confirmOrder.id);

    const params = new URLSearchParams({
      order_id: confirmOrder.id,
      receiver_name: confirmOrder.receiver_name,
      phone_number: confirmOrder.phone_number,
      city: confirmOrder.city,
      detailed_address: confirmOrder.detailed_address,
      cod_amount: String(finalPrice),
    });
    setSubmitting(false);
    setConfirmOrder(null);
    navigate(`/merchant?tab=shipments&${params.toString()}`);
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
                  <th className="p-3 text-right font-medium">التوصيل</th>
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
                    <td className="p-3 font-bold text-primary">{Number(o.net_amount || 0).toLocaleString()} ل.س</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${statusColor(o.status)}`}>
                        {STATUS_AR[o.status] || o.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
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
          {confirmOrder && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                <p className="font-semibold text-foreground">{confirmOrder.receiver_name}</p>
                <p className="text-sm text-muted-foreground">{confirmOrder.city} — {confirmOrder.detailed_address}</p>
                <p className="text-sm text-muted-foreground">{confirmOrder.phone_number}</p>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">سعر البيع النهائي (ل.س) — الدفع عند الاستلام</Label>
                <Input type="number" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="text-lg font-display font-bold" />
                {editPrice && (
                  <div className="text-sm space-y-1 p-3 bg-muted/50 rounded-lg">
                    <p>رسوم التوصيل: <span className="font-bold">{Number(confirmOrder.delivery_fee || 0).toLocaleString()} ل.س</span></p>
                    <p>عمولة المنصة (5%): <span className="font-bold">{(parseFloat(editPrice) * 0.05).toLocaleString()} ل.س</span></p>
                    <p className="text-primary font-bold">صافي الربح: {(parseFloat(editPrice) - Number(confirmOrder.delivery_fee || 0) - parseFloat(editPrice) * 0.05).toLocaleString()} ل.س</p>
                  </div>
                )}
              </div>
              <Button className="w-full glow-btn" disabled={submitting} onClick={confirmAndShip}>
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
