import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import MerchantLayout from "@/features/merchant/components/MerchantLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import KpiCards from "@/features/merchant/components/dashboard/KpiCards";
import RevenueChart from "@/features/merchant/components/dashboard/RevenueChart";
import RecentOrders from "@/features/merchant/components/dashboard/RecentOrders";
import WalletOverview from "@/features/merchant/components/dashboard/WalletOverview";
import DeliveryStatusSummary from "@/features/merchant/components/dashboard/DeliveryStatusSummary";
import MerchantReadinessProgress from "@/features/merchant/components/dashboard/MerchantReadinessProgress";
import SetPasswordBanner from "@/features/merchant/components/SetPasswordBanner";
import { DashboardData, PENDING_STATUSES } from "@/features/merchant/components/dashboard/types";

export default function MerchantDashboard() {
  const { user, profile } = useAuth();
  const { t, i18n } = useTranslation("dashboard");
  const [data, setData] = useState<DashboardData>({
    loading: true,
    availableBalance: 0,
    pendingBalance: 0,
    newOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    returnedOrders: 0,
    totalOrders30d: 0,
    revenue30d: 0,
    revenuePrev30d: 0,
    deliveryRate: 0,
    avgOrderValue: 0,
    recentOrders: [],
    revenueSeries: [],
    verificationStatus: null,
  });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setData((d) => ({ ...d, loading: true }));

    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000).toISOString();
    const [walletRes, ordersRes, recentRes, analyticsRes, merchantRes, shipmentsRes] = await Promise.all([
      supabase.from("wallets").select("id").eq("merchant_id", user.id).maybeSingle(),
      supabase
        .from("orders")
        .select("status, total_amount, final_sale_price, delivery_fee")
        .eq("merchant_id", user.id)
        .is("deleted_at", null),
      supabase
        .from("orders")
        .select("id, status, total_amount, final_sale_price, delivery_fee, receiver_name, city, created_at")
        .eq("merchant_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("orders")
        .select("status, total_amount, final_sale_price, created_at")
        .eq("merchant_id", user.id)
        .is("deleted_at", null)
        .gte("created_at", sixtyDaysAgo),
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

    // 30/60-day analytics
    const now = Date.now();
    const day = 86400_000;
    const analyticsRows = (analyticsRes.data || []) as any[];
    let revenue30d = 0, revenuePrev30d = 0, totalOrders30d = 0;
    let delivered30d = 0, attempted30d = 0;
    const seriesMap = new Map<string, { revenue: number; orders: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * day);
      const key = d.toISOString().slice(0, 10);
      seriesMap.set(key, { revenue: 0, orders: 0 });
    }
    for (const o of analyticsRows) {
      const t = new Date(o.created_at).getTime();
      const ageDays = (now - t) / day;
      const amount = Number(o.final_sale_price) || Number(o.total_amount) || 0;
      if (ageDays <= 30) {
        totalOrders30d++;
        if (o.status === "delivered") {
          revenue30d += amount;
          delivered30d++;
        }
        if (["delivered", "returned", "cancelled"].includes(o.status)) attempted30d++;
      } else if (ageDays <= 60) {
        if (o.status === "delivered") revenuePrev30d += amount;
      }
      if (ageDays <= 14) {
        const key = new Date(o.created_at).toISOString().slice(0, 10);
        const bucket = seriesMap.get(key);
        if (bucket && o.status === "delivered") {
          bucket.revenue += amount;
          bucket.orders += 1;
        } else if (bucket) {
          bucket.orders += 1;
        }
      }
    }
    const revenueSeries = Array.from(seriesMap.entries()).map(([date, v]) => {
      const d = new Date(date);
      const locale = i18n.language === "en" ? "en-US" : "ar-SY";
      const label = d.toLocaleDateString(locale, { day: "numeric", month: "short" });
      return { date, label, revenue: v.revenue, orders: v.orders };
    });
    const deliveryRate = attempted30d ? (delivered30d / attempted30d) * 100 : 0;
    const avgOrderValue = delivered30d ? revenue30d / delivered30d : 0;

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
      totalOrders30d,
      revenue30d,
      revenuePrev30d,
      deliveryRate,
      avgOrderValue,
      recentOrders: (recentRes.data || []) as any[],
      revenueSeries,
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

  return (
    <MerchantLayout title={t("merchant.home")} subtitle={t("merchant.homeSubtitle", { name: profile?.store_name || "" })}>
      {data.loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-5 md:space-y-6">
          <SetPasswordBanner />
          <MerchantReadinessProgress />

          <KpiCards
            revenue30d={data.revenue30d}
            revenuePrev30d={data.revenuePrev30d}
            totalOrders30d={data.totalOrders30d}
            avgOrderValue={data.avgOrderValue}
            deliveryRate={data.deliveryRate}
          />

          <WalletOverview available={data.availableBalance} pending={data.pendingBalance} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2">
              <RevenueChart data={data.revenueSeries} />
            </div>
            <DeliveryStatusSummary
              newOrders={data.newOrders}
              pendingOrders={data.pendingOrders}
              deliveredOrders={data.deliveredOrders}
              returnedOrders={data.returnedOrders}
            />
          </div>

          <RecentOrders orders={data.recentOrders} />
        </div>
      )}
    </MerchantLayout>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-3 w-20 shimmer" />
            <Skeleton className="h-7 w-24 shimmer" />
            <Skeleton className="h-3 w-28 shimmer" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32 shimmer" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-72 shimmer" />
        <Skeleton className="h-72 shimmer" />
      </div>
      <Skeleton className="h-64 shimmer" />
    </div>
  );
}
