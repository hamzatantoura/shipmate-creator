import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Truck, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";

const MERCHANT_ID = "00000000-0000-0000-0000-000000000000";

const STATUS_AR: Record<string, string> = {
  pending: "جديد",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

interface Order {
  id: string;
  product_id: string | null;
  quantity: number;
  total_amount: number;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  status: string;
  shipment_id: string | null;
  created_at: string;
  products?: { name: string } | null;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, products(name)")
      .eq("merchant_id", MERCHANT_ID)
      .order("created_at", { ascending: false });
    if (data) setOrders(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const createShipmentFromOrder = (order: Order) => {
    // Navigate to dashboard with prefilled data via query params
    const params = new URLSearchParams({
      order_id: order.id,
      receiver_name: order.receiver_name,
      phone_number: order.phone_number,
      city: order.city,
      detailed_address: order.detailed_address,
      cod_amount: String(order.total_amount),
    });
    navigate(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-display font-bold text-foreground">الطلبات</h1>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>لا توجد طلبات بعد.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <Card key={o.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{o.receiver_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {STATUS_AR[o.status] || o.status}
                        </Badge>
                      </div>
                      {o.products?.name && (
                        <p className="text-sm text-muted-foreground">{o.products.name} × {o.quantity}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{o.city} — {o.detailed_address}</p>
                      <p className="text-sm font-display font-bold text-primary">{Number(o.total_amount).toLocaleString()} ل.س</p>
                    </div>
                    {!o.shipment_id && o.status === "pending" && (
                      <Button size="sm" className="gap-1.5 shrink-0" onClick={() => createShipmentFromOrder(o)}>
                        <Truck className="h-3.5 w-3.5" />
                        إنشاء شحنة
                      </Button>
                    )}
                    {o.shipment_id && (
                      <Badge className="bg-primary/15 text-primary border-primary/30">تم الشحن</Badge>
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
