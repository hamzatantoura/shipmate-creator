import { useEffect, useState, useCallback } from "react";
import MerchantLayout from "@/components/merchant/MerchantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Wallet, TrendingUp, ShoppingCart, RotateCcw, ShieldAlert,
  CheckCircle2, Truck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const fmt = (n: number) => new Intl.NumberFormat("ar-SY").format(Math.round(n)) + " ل.س";

interface DashboardData {
  loading: boolean;
  availableBalance: number; // wallet ledger sum
  pendingBalance: number;   // orders processing/shipped/out_for_delivery — net
  newOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  verificationStatus: string | null;
}

const PENDING_STATUSES = new Set(["processing", "shipped", "out_for_delivery"]);

export default function MerchantDashboard() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<DashboardData>({
    loading: true,
    availableBalance: 0,
    pendingBalance: 0,
    newOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    returnedOrders: 0,
    verificationStatus: null,
  });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setData((d) => ({ ...d, loading: true }));

    const [walletRes, ordersRes, merchantRes, shipmentsRes] = await Promise.all([
      supabase.from("wallets").select("id").eq("merchant_id", user.id).maybeSingle(),
      supabase
        .from("orders")
        .select("status, total_amount, final_sale_price, delivery_fee")
        .eq("merchant_id", user.id)
        .is("deleted_at", null),
      supabase
        .from("merchants")
        .select("verification_status")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("shipments")
        .select("id, status, cod_amount, merchant_shipping_fee, shipping_fee, carrier_fee, collection_fee, orders!shipments_order_id_fkey(id, status, shipment_id)")
        .eq("merchant_id", user.id)
        .in("status", ["pending", "processing", "picked_up", "received_by_courier", "at_warehouse", "in_transit", "out_for_delivery"]),
    ]);

    let availableBalance = 0;
    if (walletRes.data?.id) {
      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("wallet_id", walletRes.data.id);
      availableBalance = (txns || []).reduce((s, t: any) => s + Number(t.amount), 0);
    }

    let newOrders = 0, pendingOrders = 0, deliveredOrders = 0, returnedOrders = 0;
    let pendingBalance = 0;
    for (const o of (ordersRes.data || []) as any[]) {
      if (o.status === "new") newOrders++;
      else if (PENDING_STATUSES.has(o.status)) { pendingOrders++; }
      else if (o.status === "delivered") { deliveredOrders++; }
      else if (o.status === "returned") returnedOrders++;
    }

    // الرصيد المتوقع: نفس منطق صفحة المحفظة — شحنات نشطة، خصم أجور الشحن وبدل التحصيل، استبعاد اليتيمة/المكررة
    const SETTLED = new Set(["delivered", "returned", "cancelled"]);
    for (const s of (shipmentsRes.data || []) as any[]) {
      const ord = Array.isArray(s.orders) ? s.orders[0] : s.orders;
      if (!ord) continue;
      if (SETTLED.has(ord.status)) continue;
      if (ord.shipment_id && ord.shipment_id !== s.id) continue;
      const cod = Number(s.cod_amount) || 0;
      const shipping = Number(s.merchant_shipping_fee) || Number(s.shipping_fee) || Number(s.carrier_fee) || 0;
      const collection = Number(s.collection_fee) || 0;
      pendingBalance += cod - shipping - collection;
    }

    setData({
      loading: false,
      availableBalance,
      pendingBalance,
      newOrders,
      pendingOrders,
      deliveredOrders,
      returnedOrders,
      verificationStatus: (merchantRes.data as any)?.verification_status ?? null,
    });
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: refresh on orders changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dashboard-orders-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${user.id}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchAll]);

  const isLocked = data.verificationStatus !== null && data.verificationStatus !== "verified";
  const lockMessage =
    data.verificationStatus === "pending_verification"
      ? "أكمل بيانات متجرك من الإعدادات لتفعيل استقبال الطلبات."
      : data.verificationStatus === "pending_admin_approval"
      ? "تم استلام بياناتك وهي بانتظار اعتماد الإدارة."
      : data.verificationStatus === "rejected"
      ? "تم رفض الطلب — يرجى تحديث البيانات والمحاولة مجدداً."
      : "حسابك قيد المراجعة.";

  return (
    <MerchantLayout title="الرئيسية" subtitle={`مرحباً ${profile?.store_name || ""}`}>
      {data.loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {isLocked && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <ShieldAlert className="h-5 w-5" />
              <AlertTitle className="font-bold">الحساب غير مفعّل بعد</AlertTitle>
              <AlertDescription>{lockMessage}</AlertDescription>
            </Alert>
          )}

          {/* 3-Tier Wallet */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">المحفظة المالية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link to="/merchant/wallet" className="group">
                <Card className="border-r-4 border-r-emerald-500 bg-gradient-to-bl from-emerald-500/10 to-transparent hover:shadow-lg hover:border-r-emerald-400 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">الرصيد المتاح</CardTitle>
                      <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-500">{fmt(data.availableBalance)}</div>
                    <p className="text-xs text-muted-foreground mt-1">اضغط لعرض سجل الحركات التفصيلي</p>
                  </CardContent>
                </Card>
              </Link>

              <Card className="border-r-4 border-r-sky-500 bg-gradient-to-bl from-sky-500/10 to-transparent">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">الرصيد المتوقع</CardTitle>
                    <div className="h-9 w-9 rounded-full bg-sky-500/20 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-sky-500" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-sky-500">{fmt(data.pendingBalance)}</div>
                  <p className="text-xs text-muted-foreground mt-1">طلبات قيد المعالجة/التوصيل</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Order stats */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">إحصائيات الطلبات</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={ShoppingCart} label="طلبات جديدة" value={data.newOrders} tone="primary" />
              <StatCard icon={Truck} label="قيد التوصيل" value={data.pendingOrders} tone="sky" />
              <StatCard icon={CheckCircle2} label="تم التوصيل" value={data.deliveredOrders} tone="emerald" />
              <StatCard icon={RotateCcw} label="مرتجعات" value={data.returnedOrders} tone="destructive" />
            </div>
          </section>
        </>
      )}
    </MerchantLayout>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: number;
  tone: "primary" | "sky" | "emerald" | "destructive";
}) {
  const toneClass = {
    primary: "bg-primary/15 text-primary",
    sky: "bg-sky-500/15 text-sky-500",
    emerald: "bg-emerald-500/15 text-emerald-500",
    destructive: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <section>
        <Skeleton className="h-5 w-32 mb-3 shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 shimmer" />
                <Skeleton className="h-9 w-9 rounded-full shimmer" />
              </div>
              <Skeleton className="h-8 w-32 shimmer" />
              <Skeleton className="h-3 w-40 shimmer" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <Skeleton className="h-5 w-40 mb-3 shimmer" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg shimmer" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-20 shimmer" />
                <Skeleton className="h-6 w-12 shimmer" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
