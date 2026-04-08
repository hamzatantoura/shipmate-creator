import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Truck, Loader2, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const STATUS_AR: Record<string, string> = {
  pending: "جديد", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغى",
};

interface Order {
  id: string; product_id: string | null; quantity: number; total_amount: number;
  receiver_name: string; phone_number: string; city: string; detailed_address: string;
  status: string; shipment_id: string | null; created_at: string;
  final_sale_price: number | null; customer_lat: number | null; customer_lng: number | null;
  products?: { name: string } | null;
}

export default function MerchantOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
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
    setSubmitting(true);

    // Update order with final sale price
    await supabase.from("orders").update({
      final_sale_price: finalPrice,
    } as any).eq("id", confirmOrder.id);

    // Navigate to shipments tab with prefilled data
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

  return (
    <div className="space-y-4">
      {loading ? <p className="text-center py-12 text-muted-foreground">جاري التحميل...</p> :
       orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" /><p>لا توجد طلبات بعد.</p></div>
      ) : orders.map(o => (
        <Card key={o.id} className="bg-card border-border">
          <CardContent className="p-4 flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{o.receiver_name}</span>
                <Badge variant="outline" className="text-xs">{STATUS_AR[o.status] || o.status}</Badge>
              </div>
              {o.products?.name && <p className="text-sm text-muted-foreground">{o.products.name} × {o.quantity}</p>}
              <p className="text-xs text-muted-foreground">{o.city} — {o.detailed_address}</p>
              <div className="flex items-center gap-3">
                <p className="text-sm font-display font-bold text-primary">{Number(o.final_sale_price || o.total_amount).toLocaleString()} ل.س</p>
                {o.customer_lat && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> موقع محدد
                  </span>
                )}
              </div>
            </div>
            {!o.shipment_id && o.status === "pending" && (
              <Button size="sm" className="gap-1.5 shrink-0 glow-btn" onClick={() => openConfirm(o)}>
                <Truck className="h-3.5 w-3.5" /> طلب شحن
              </Button>
            )}
            {o.shipment_id && <Badge className="bg-primary/15 text-primary border-primary/30">تم الشحن</Badge>}
          </CardContent>
        </Card>
      ))}

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
                <Input
                  type="number" min="0"
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  className="text-lg font-display font-bold"
                />
                <p className="text-xs text-muted-foreground">يمكنك تعديل السعر قبل طلب الشحن. هذا المبلغ سيُحصّل من العميل عند الاستلام (COD).</p>
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
