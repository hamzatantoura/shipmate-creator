import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  LayoutDashboard, Package, Wallet, Menu, LogOut, RefreshCw, ScanLine,
} from "lucide-react";
import silaLogo from "@/assets/sila-logo.png";

import { KpiCards } from "@/features/courier/components/dashboard/KpiCards";
import { WalletCard } from "@/features/courier/components/dashboard/WalletCard";
import { EarningsChart } from "@/features/courier/components/dashboard/EarningsChart";
import { AssignedShipments } from "@/features/courier/components/dashboard/AssignedShipments";
import { RouteList } from "@/features/courier/components/dashboard/RouteList";
import { DeliveryHistory } from "@/features/courier/components/dashboard/DeliveryHistory";
import { GpsPlaceholder } from "@/features/courier/components/dashboard/GpsPlaceholder";
import {
  ACTIVE_STATUSES, type CourierDashboardData, type CourierShipmentRow,
} from "@/features/courier/components/dashboard/types";

const RETURN_REASONS = [
  { value: "customer_refused", label: "رفض المستلم" },
  { value: "no_answer", label: "لا يرد" },
  { value: "wrong_address", label: "عنوان خاطئ" },
  { value: "damaged", label: "تالف" },
  { value: "other", label: "أخرى" },
];

const isSameDay = (iso: string, ref = new Date()) => {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
};
const isSameMonth = (iso: string, ref = new Date()) => {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
};

function buildDashboardData(rows: CourierShipmentRow[], walletBalance: number, companyName: string): CourierDashboardData {
  const now = new Date();
  const active = rows.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const delivered = rows.filter((r) => r.status === "delivered");
  const returned = rows.filter((r) => r.status === "returned" || r.status === "cancelled");

  const deliveredToday = delivered.filter((r) => isSameDay(r.updated_at)).length;
  const deliveredMonth = delivered.filter((r) => isSameMonth(r.updated_at)).length;
  const returnedMonth = returned.filter((r) => isSameMonth(r.updated_at)).length;

  const earningsMonth = delivered
    .filter((r) => isSameMonth(r.updated_at))
    .reduce((sum, r) => sum + Number(r.delivery_fee || 0), 0);

  const totalCompleted = deliveredMonth + returnedMonth;
  const successRate = totalCompleted > 0 ? (deliveredMonth / totalCompleted) * 100 : 0;

  // 14-day series
  const series: { date: string; earnings: number; deliveries: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const dayDelivered = delivered.filter((r) => {
      const t = new Date(r.updated_at).getTime();
      return t >= d.getTime() && t < next.getTime();
    });
    series.push({
      date: d.toLocaleDateString("ar-SY", { day: "2-digit", month: "2-digit" }),
      earnings: dayDelivered.reduce((s, r) => s + Number(r.delivery_fee || 0), 0),
      deliveries: dayDelivered.length,
    });
  }

  // Routes from active shipments
  const routeMap = new Map<string, { count: number; cod: number; orders: CourierShipmentRow[] }>();
  for (const r of active) {
    const key = r.districts?.name || r.city || "غير محدد";
    const cur = routeMap.get(key) || { count: 0, cod: 0, orders: [] };
    cur.count += 1;
    cur.cod += Number(r.total_amount || 0);
    cur.orders.push(r);
    routeMap.set(key, cur);
  }
  const routes = Array.from(routeMap.entries())
    .map(([district, v]) => ({ district, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const history = [...delivered, ...returned]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return {
    walletBalance,
    companyName,
    assigned: active.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    history,
    kpis: {
      activeCount: active.length,
      deliveredToday,
      deliveredMonth,
      returnedMonth,
      earningsMonth,
      successRate,
    },
    earningsSeries: series,
    routes,
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Skeleton className="h-[260px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

export default function CourierDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [returnDialog, setReturnDialog] = useState<{ row: CourierShipmentRow } | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["courier-dashboard", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CourierDashboardData> => {
      // Fetch vendor's courier company (for wallet balance + name)
      const { data: courier, error: cErr } = await supabase
        .from("couriers")
        .select("id, name, wallet_balance")
        .eq("vendor_id", user!.id)
        .maybeSingle();
      if (cErr) throw cErr;

      // Fetch orders visible via RLS (vendor sees assigned)
      const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select("id, receiver_name, phone_number, city, detailed_address, status, total_amount, delivery_fee, created_at, updated_at, districts(name)")
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(500);
      if (oErr) throw oErr;

      return buildDashboardData(
        (orders || []) as unknown as CourierShipmentRow[],
        Number(courier?.wallet_balance || 0),
        courier?.name || "شركة الشحن",
      );
    },
    staleTime: 30_000,
  });

  const handleAdvance = async (row: CourierShipmentRow, nextStatus: string) => {
    if (nextStatus === "returned") {
      setReturnDialog({ row });
      setReturnReason("");
      return;
    }
    setUpdatingId(row.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    setUpdatingId(null);
    if (error) {
      toast.error("فشل تحديث الحالة");
      return;
    }
    toast.success("تم تحديث الحالة");
    qc.invalidateQueries({ queryKey: ["courier-dashboard"] });
  };

  const confirmReturn = async () => {
    if (!returnDialog) return;
    if (!returnReason) {
      toast.error("سبب الإرجاع مطلوب");
      return;
    }
    setUpdatingId(returnDialog.row.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: "returned", return_reason: returnReason, updated_at: new Date().toISOString() })
      .eq("id", returnDialog.row.id);
    setUpdatingId(null);
    if (error) {
      toast.error("فشل التحديث");
      return;
    }
    toast.success("تم تسجيل المرتجع");
    setReturnDialog(null);
    qc.invalidateQueries({ queryKey: ["courier-dashboard"] });
  };

  const navItems = [
    { to: "/courier", label: "لوحة التحكم", icon: LayoutDashboard },
    { to: "/courier/orders", label: "الشحنات", icon: Package },
    { to: "/courier/wallet", label: "المحفظة", icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Top bar */}
      <header className="border-b border-border/60 bg-background">
        <div className="flex items-center justify-between gap-3 px-3 md:px-6 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[260px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <img src={silaLogo} alt="Sila" className="h-7" />
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-4 space-y-1">
                  {navItems.map((it) => (
                    <Link key={it.to} to={it.to} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                      <it.icon className="h-4 w-4" /> {it.label}
                    </Link>
                  ))}
                  <button onClick={signOut} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted text-destructive">
                    <LogOut className="h-4 w-4" /> تسجيل الخروج
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
            <img src={silaLogo} alt="Sila" className="h-7 hidden sm:block" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{data?.companyName || "بوابة شركة الشحن"}</div>
              <div className="text-[11px] text-muted-foreground hidden sm:block">لوحة التحكم</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9 hidden sm:inline-flex">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-9 hidden md:inline-flex">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 px-6 pb-2">
          {navItems.map((it) => (
            <Link key={it.to} to={it.to} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-muted">
              <it.icon className="h-4 w-4" /> {it.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="px-3 md:px-6 py-4 md:py-6 pb-24 md:pb-6 space-y-4 md:space-y-6 max-w-screen-2xl mx-auto">
        {isLoading || !data ? (
          <DashboardSkeleton />
        ) : (
          <>
            <KpiCards kpis={data.kpis} />

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <EarningsChart data={data.earningsSeries} />
                <AssignedShipments rows={data.assigned} onAdvance={handleAdvance} updatingId={updatingId} />
              </div>
              <div className="space-y-4">
                <WalletCard balance={data.walletBalance} earningsMonth={data.kpis.earningsMonth} />
                <RouteList routes={data.routes} />
                <GpsPlaceholder />
              </div>
            </div>

            <DeliveryHistory rows={data.history} />
          </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden border-t border-border/60 bg-background">
        <div className="grid grid-cols-3">
          {navItems.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Return reason dialog */}
      <Dialog open={!!returnDialog} onOpenChange={(o) => !o && setReturnDialog(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل مرتجع</DialogTitle>
            <DialogDescription>اختر سبب الإرجاع للشحنة.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>سبب الإرجاع</Label>
            <Select value={returnReason} onValueChange={setReturnReason}>
              <SelectTrigger><SelectValue placeholder="اختر السبب" /></SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReturnDialog(null)}>إلغاء</Button>
            <Button onClick={confirmReturn} disabled={!returnReason || !!updatingId}>تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}