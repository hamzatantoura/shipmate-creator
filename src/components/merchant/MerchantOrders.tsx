import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMerchantId } from "@/hooks/use-merchant-id";

const STATUS_AR: Record<string, string> = {
  pending: "جديد", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغى",
};

interface Order {
  id: string; product_id: string | null; quantity: number; total_amount: number;
  receiver_name: string; phone_number: string; city: string; detailed_address: string;
  status: string; shipment_id: string | null; created_at: string;
  products?: { name: string } | null;
}

export default function MerchantOrders() {
  const merchantId = useMerchantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders").select("*, products(name)")
        .eq("merchant_id", merchantId).order("created_at", { ascending: false });
      if (data) setOrders(data as any);
      setLoading(false);
    })();
  }, []);

  const createShipment = (o: Order) => {
    const params = new URLSearchParams({
      order_id: o.id, receiver_name: o.receiver_name, phone_number: o.phone_number,
      city: o.city, detailed_address: o.detailed_address, cod_amount: String(o.total_amount),
    });
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
              <p className="text-sm font-display font-bold text-primary">{Number(o.total_amount).toLocaleString()} ل.س</p>
            </div>
            {!o.shipment_id && o.status === "pending" && (
              <Button size="sm" className="gap-1.5 shrink-0" onClick={() => createShipment(o)}>
                <Truck className="h-3.5 w-3.5" /> إنشاء شحنة
              </Button>
            )}
            {o.shipment_id && <Badge className="bg-primary/15 text-primary border-primary/30">تم الشحن</Badge>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
