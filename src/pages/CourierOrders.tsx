import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Package, LogOut, RefreshCw, Search, TrendingUp, Truck, CheckCircle2, RotateCcw, PackageOpen,
  Download, ChevronDown, X, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, Legend,
} from "recharts";
import silaLogo from "@/assets/sila-logo.png";

interface CourierOrderRow {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  status: string;
  total_amount: number;
  final_sale_price: number | null;
  delivery_fee: number;
  created_at: string;
  updated_at: string;
  notes: string | null;
  return_reason?: string | null;
  couriers?: { name: string } | null;
  districts?: { name: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  new: "bg-muted text-muted-foreground border-border",
  processing: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  shipped: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  out_for_delivery: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  returned: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};
const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  processing: "قيد المعالجة",
  shipped: "تم الشحن",
  out_for_delivery: "قيد التوصيل",
  delivered: "تم التسليم",
  returned: "مرتجع",
  cancelled: "ملغي",
};

const NEXT_STATUSES = [
  { value: "out_for_delivery", label: "قيد التوصيل" },
  { value: "delivered", label: "تم التسليم" },
  { value: "returned", label: "مرتجع" },
];
const RETURN_REASONS = [
  { value: "customer_refused", label: "رفض المستلم" },
  { value: "no_answer", label: "لا يرد" },
  { value: "wrong_address", label: "عنوان خاطئ" },
  { value: "damaged", label: "تالف" },
  { value: "other", label: "أخرى" },
];

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";
const silaCodeOf = (id: string) => "SL-" + id.slice(0, 6).toUpperCase();
const isToday = (iso: string) => {
  const d = new Date(iso); const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
};

type TabKey = "all" | "pending" | "in_transit" | "delivered" | "returned";
const TAB_FILTERS: Record<TabKey, (s: string) => boolean> = {
  all: () => true,
  pending: (s) => ["new", "processing"].includes(s),
  in_transit: (s) => ["shipped", "out_for_delivery"].includes(s),
  delivered: (s) => s === "delivered",
  returned: (s) => s === "returned",
};

export default function CourierOrders() {
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState<CourierOrderRow[]>([]);
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [returnDialog, setReturnDialog] = useState<{ orderId: string } | null>(null);
  const [returnReason, setReturnReason] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [ordersRes, courierRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, receiver_name, phone_number, city, detailed_address, status, total_amount, final_sale_price, delivery_fee, created_at, updated_at, notes, return_reason, couriers(name), districts(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("couriers")
        .select("name")
        .eq("vendor_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);
    if (ordersRes.error) toast.error("تعذر تحميل الطلبات");
    else setOrders((ordersRes.data || []) as CourierOrderRow[]);
    if (courierRes.data?.name) setCompanyName(courierRes.data.name);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`courier-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchAll]);

  const updateStatus = async (id: string, newStatus: string, reason?: string) => {
    if (newStatus === "returned" && !reason) {
      setReturnDialog({ orderId: id });
      setReturnReason("");
      return;
    }
    setUpdatingId(id);
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === "returned" && reason) patch.return_reason = reason;
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    setUpdatingId(null);
    if (error) { toast.error(error.message || "تعذر تحديث الحالة"); return; }
    toast.success("تم تحديث الحالة");
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus, return_reason: reason ?? o.return_reason } : o));
    setReturnDialog(null);
  };

  // ===== Derived KPIs & chart data =====
  const kpis = useMemo(() => {
    const total = orders.length;
    const deliveredToday = orders.filter(o => o.status === "delivered" && isToday(o.updated_at)).length;
    const finishedToday = orders.filter(o => isToday(o.updated_at) && ["delivered", "returned"].includes(o.status)).length;
    const successRate = finishedToday ? Math.round((deliveredToday / finishedToday) * 100) : 0;
    const outForDelivery = orders.filter(o => o.status === "out_for_delivery").length;
    const returned = orders.filter(o => o.status === "returned").length;
    return { total, deliveredToday, successRate, outForDelivery, returned };
  }, [orders]);

  const chartData = useMemo(() => {
    const days: { key: string; label: string; delivered: number; returned: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("ar-SY", { weekday: "short", day: "numeric" });
      days.push({ key, label, delivered: 0, returned: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const o of orders) {
      if (!["delivered", "returned"].includes(o.status)) continue;
      const k = new Date(o.updated_at).toISOString().slice(0, 10);
      const i = idx.get(k);
      if (i === undefined) continue;
      if (o.status === "delivered") days[i].delivered++;
      else days[i].returned++;
    }
    return days;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (!TAB_FILTERS[tab](o.status)) return false;
      if (!q) return true;
      const sila = silaCodeOf(o.id).toLowerCase();
      return (
        sila.includes(q) ||
        o.receiver_name.toLowerCase().includes(q) ||
        o.phone_number.toLowerCase().includes(q)
      );
    });
  }, [orders, search, tab]);

  // Keep selection valid against current filtered view
  const filteredIds = useMemo(() => filtered.map(o => o.id), [filtered]);
  const visibleSelectedCount = useMemo(
    () => selectedIds.filter(id => filteredIds.includes(id)).length,
    [selectedIds, filteredIds],
  );
  const allVisibleSelected = filteredIds.length > 0 && visibleSelectedCount === filteredIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds(prev => {
      const set = new Set(prev);
      if (checked) filteredIds.forEach(id => set.add(id));
      else filteredIds.forEach(id => set.delete(id));
      return Array.from(set);
    });
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
  };
  const clearSelection = () => setSelectedIds([]);

  const exportCsv = () => {
    const rows = orders.filter(o => selectedIds.includes(o.id));
    if (rows.length === 0) { toast.error("لا توجد طلبات محددة"); return; }
    const headers = ["رمز Sila", "اسم المستلم", "الهاتف", "العنوان", "قيمة COD", "الحالة"];
    const escape = (v: unknown) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(",")];
    for (const o of rows) {
      const cod = o.final_sale_price ?? o.total_amount;
      const addr = `${o.districts?.name || o.city} - ${o.detailed_address}`;
      lines.push([
        silaCodeOf(o.id),
        o.receiver_name,
        o.phone_number,
        addr,
        cod,
        STATUS_LABEL[o.status] || o.status,
      ].map(escape).join(","));
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sila-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${rows.length} طلب`);
  };

  const bulkUpdateStatus = async (newStatus: "out_for_delivery" | "delivered") => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    const results = await Promise.all(
      selectedIds.map(id => supabase.from("orders").update({ status: newStatus }).eq("id", id))
    );
    const failed = results.filter(r => r.error).length;
    setBulkLoading(false);
    if (failed === 0) {
      toast.success(`تم تحديث ${selectedIds.length} طلب`);
    } else {
      toast.error(`فشل تحديث ${failed} من ${selectedIds.length} طلب`);
    }
    clearSelection();
    fetchAll();
  };

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/courier/orders" className="flex items-center gap-2.5">
            <img src={silaLogo} alt="Sila" className="h-8 w-8" />
            <div className="leading-tight">
              <div className="font-bold text-base text-primary">صِلة — بوابة شركة الشحن</div>
              <div className="text-[11px] text-muted-foreground">لوحة التحكم التشغيلية</div>
            </div>
          </Link>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={fetchAll} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">تحديث</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={signOut} className="gap-1.5 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              مرحباً، {loading && !companyName ? "..." : companyName || "شركة الشحن"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              نظرة عامة على أداء التوصيل والطلبات المسندة إليكم.
            </p>
          </div>
          <Badge variant="outline" className="self-start sm:self-auto gap-1.5 px-3 py-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            مُحدّث لحظياً
          </Badge>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            loading={loading}
            icon={<Package className="h-4 w-4" />}
            label="إجمالي الطلبات المسندة"
            value={kpis.total}
            tone="default"
          />
          <KpiCard
            loading={loading}
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="تم التسليم اليوم"
            value={kpis.deliveredToday}
            sub={`نسبة النجاح ${kpis.successRate}%`}
            tone="success"
          />
          <KpiCard
            loading={loading}
            icon={<Truck className="h-4 w-4" />}
            label="قيد التوصيل"
            value={kpis.outForDelivery}
            sub="الحمولة النشطة"
            tone="primary"
          />
          <KpiCard
            loading={loading}
            icon={<RotateCcw className="h-4 w-4" />}
            label="مرتجع"
            value={kpis.returned}
            tone="destructive"
          />
        </div>

        {/* Chart */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  أداء آخر 7 أيام
                </CardTitle>
                <CardDescription className="text-xs">
                  مقارنة بين الطلبات المُسلَّمة والمرتجعة
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gReturned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="delivered" name="تم التسليم" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gDelivered)" />
                    <Area type="monotone" dataKey="returned" name="مرتجع" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#gReturned)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 gap-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  الطلبات المسندة
                </CardTitle>
                <CardDescription className="text-xs">
                  ابحث، صنّف وحدّث حالات الطلبات بسرعة.
                </CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث برمز Sila، الاسم، أو الهاتف..."
                  className="pr-9 h-9 text-sm"
                />
              </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
              <TabsList className="grid grid-cols-5 w-full md:w-auto md:inline-grid">
                <TabsTrigger value="all" className="text-xs">الكل</TabsTrigger>
                <TabsTrigger value="pending" className="text-xs">معلّق</TabsTrigger>
                <TabsTrigger value="in_transit" className="text-xs">قيد التوصيل</TabsTrigger>
                <TabsTrigger value="delivered" className="text-xs">تم التسليم</TabsTrigger>
                <TabsTrigger value="returned" className="text-xs">مرتجع</TabsTrigger>
              </TabsList>
            </Tabs>

            {selectedIds.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">
                    {selectedIds.length}
                  </span>
                  <span className="font-medium">طلب محدد</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={clearSelection} disabled={bulkLoading}>
                    <X className="h-3.5 w-3.5" /> إلغاء التحديد
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportCsv} disabled={bulkLoading}>
                    <Download className="h-3.5 w-3.5" /> تصدير CSV
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-8 gap-1.5" disabled={bulkLoading}>
                        {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        تحديث الحالة
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel className="text-xs">حالة جماعية</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => bulkUpdateStatus("out_for_delivery")}>
                        <Truck className="h-4 w-4" /> قيد التوصيل
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => bulkUpdateStatus("delivered")}>
                        <CheckCircle2 className="h-4 w-4" /> تم التسليم
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasSearch={!!search || tab !== "all"} totalOrders={orders.length} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                          onCheckedChange={(c) => toggleAllVisible(!!c)}
                          aria-label="تحديد الكل"
                        />
                      </TableHead>
                      <TableHead className="text-xs">الكود</TableHead>
                      <TableHead className="text-xs">المستلم</TableHead>
                      <TableHead className="text-xs">الهاتف</TableHead>
                      <TableHead className="text-xs">العنوان</TableHead>
                      <TableHead className="text-xs">قيمة COD</TableHead>
                      <TableHead className="text-xs">الحالة</TableHead>
                      <TableHead className="w-[200px] text-xs">تحديث الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => {
                      const cod = o.final_sale_price ?? o.total_amount;
                      const isFinal = ["delivered", "returned", "cancelled"].includes(o.status);
                      const checked = selectedIds.includes(o.id);
                      return (
                        <TableRow key={o.id} className={`hover:bg-muted/30 ${checked ? "bg-primary/5" : ""}`}>
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => toggleOne(o.id, !!c)}
                              aria-label={`تحديد ${silaCodeOf(o.id)}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{silaCodeOf(o.id)}</TableCell>
                          <TableCell className="font-medium text-sm">{o.receiver_name}</TableCell>
                          <TableCell dir="ltr" className="text-xs text-muted-foreground">{o.phone_number}</TableCell>
                          <TableCell className="max-w-[260px]">
                            <div className="text-sm">{o.districts?.name || o.city}</div>
                            <div className="text-xs text-muted-foreground truncate">{o.detailed_address}</div>
                          </TableCell>
                          <TableCell className="font-semibold text-sm tabular-nums">{fmtSYP(Number(cod))}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[o.status] || STATUS_STYLE.new}`}>
                              {STATUS_LABEL[o.status] || o.status}
                            </span>
                            {o.status === "returned" && o.return_reason && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {RETURN_REASONS.find(r => r.value === o.return_reason)?.label || o.return_reason}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {isFinal ? (
                              <span className="text-xs text-muted-foreground">حالة نهائية</span>
                            ) : (
                              <Select
                                value={o.status}
                                onValueChange={(v) => updateStatus(o.id, v)}
                                disabled={updatingId === o.id}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="اختر حالة" />
                                </SelectTrigger>
                                <SelectContent>
                                  {NEXT_STATUSES.map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Return reason dialog */}
      <Dialog open={!!returnDialog} onOpenChange={(o) => !o && setReturnDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>سبب الإرجاع</DialogTitle>
            <DialogDescription>اختر سبب إرجاع الطلب — حقل إلزامي.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>السبب</Label>
            <Select value={returnReason} onValueChange={setReturnReason}>
              <SelectTrigger><SelectValue placeholder="اختر السبب" /></SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReturnDialog(null)}>إلغاء</Button>
            <Button
              disabled={!returnReason || !!updatingId}
              onClick={() => returnDialog && updateStatus(returnDialog.orderId, "returned", returnReason)}
            >
              تأكيد الإرجاع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Sub-components ---------- */

type Tone = "default" | "success" | "primary" | "destructive";
const TONES: Record<Tone, { ring: string; iconBg: string; iconText: string }> = {
  default:     { ring: "border-border/60",                iconBg: "bg-muted",              iconText: "text-foreground" },
  primary:     { ring: "border-primary/20",               iconBg: "bg-primary/10",         iconText: "text-primary" },
  success:     { ring: "border-emerald-500/20",           iconBg: "bg-emerald-500/10",     iconText: "text-emerald-600 dark:text-emerald-400" },
  destructive: { ring: "border-destructive/20",           iconBg: "bg-destructive/10",     iconText: "text-destructive" },
};

function KpiCard({
  icon, label, value, sub, tone = "default", loading,
}: { icon: React.ReactNode; label: string; value: number; sub?: string; tone?: Tone; loading?: boolean; }) {
  const t = TONES[tone];
  return (
    <Card className={`shadow-sm transition hover:shadow-md ${t.ring}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 min-w-0">
            <div className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">{label}</div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl sm:text-3xl font-bold tabular-nums leading-none">{value.toLocaleString("ar-SY")}</div>
            )}
            {sub && !loading && (
              <div className="text-[11px] text-muted-foreground">{sub}</div>
            )}
          </div>
          <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${t.iconBg} ${t.iconText}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ hasSearch, totalOrders }: { hasSearch: boolean; totalOrders: number }) {
  return (
    <div className="py-16 px-6 flex flex-col items-center text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
        <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center">
          <PackageOpen className="h-9 w-9 text-primary" />
        </div>
      </div>
      <h3 className="text-base font-semibold">
        {hasSearch ? "لا توجد نتائج مطابقة" : "لا توجد طلبات مسندة بعد"}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        {hasSearch
          ? "جرّب تعديل البحث أو اختيار تبويب آخر."
          : totalOrders === 0
            ? "بمجرد إسناد طلبات لشركتكم ستظهر هنا تلقائياً."
            : "لا توجد طلبات تطابق الفلتر الحالي."}
      </p>
    </div>
  );
}