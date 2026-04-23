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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Download, ChevronDown, X, Loader2, MoreHorizontal, Scale, Undo2, AlertTriangle, ScanLine, Wallet,
  Camera, Zap,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, Legend,
} from "recharts";
import silaLogo from "@/assets/sila-logo.png";
import BarcodeScanner from "@/components/vendor/BarcodeScanner";
import WalletTransactionsLog from "@/components/shared/WalletTransactionsLog";
import CourierWalletPanel from "@/components/courier/CourierWalletPanel";
import { getOrderStatusMeta } from "@/lib/order-status";

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
  shipment_id?: string | null;
  couriers?: { name: string } | null;
  districts?: { name: string } | null;
}

/**
 * Logical lifecycle transitions for couriers.
 * processing → shipped → out_for_delivery → delivered | returned
 */
const NEXT_STATUS_MAP: Record<string, { value: string; label: string }[]> = {
  new:              [{ value: "processing", label: "قيد المعالجة" }, { value: "shipped", label: "مع شركة الشحن" }],
  processing:       [{ value: "shipped", label: "مع شركة الشحن" }, { value: "returned", label: "مرتجع" }],
  shipped:          [{ value: "out_for_delivery", label: "قيد التوصيل" }, { value: "returned", label: "مرتجع" }],
  out_for_delivery: [{ value: "delivered", label: "تم التسليم" }, { value: "returned", label: "مرتجع" }],
};
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

type TabKey = "all" | "pending" | "active" | "delivered" | "returned";
const TAB_FILTERS: Record<TabKey, (s: string) => boolean> = {
  all: () => true,
  // STRICT mutually exclusive pipeline buckets
  pending:   (s) => ["new", "pending"].includes(s),
  active:    (s) => ["processing", "shipped", "out_for_delivery"].includes(s),
  delivered: (s) => s === "delivered",
  returned:  (s) => ["returned", "cancelled"].includes(s),
};
const TAB_LABELS: Record<TabKey, string> = {
  all: "الكل",
  pending: "بانتظار الاستلام",
  active: "قيد التشغيل",
  delivered: "تم التسليم",
  returned: "مرتجع/ملغي",
};

export default function CourierOrders() {
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState<CourierOrderRow[]>([]);
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLoaded, setCompanyLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<"orders" | "scanner" | "wallet">("orders");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [returnDialog, setReturnDialog] = useState<{ orderId: string } | null>(null);
  const [returnReason, setReturnReason] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editDialog, setEditDialog] = useState<CourierOrderRow | null>(null);
  const [editWeight, setEditWeight] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [revertDialog, setRevertDialog] = useState<CourierOrderRow | null>(null);
  const [reverting, setReverting] = useState(false);

  // ===== Smart Scanner state =====
  const [scanInput, setScanInput] = useState("");
  const [quickAction, setQuickAction] = useState<{ order: CourierOrderRow; nextStatus: string } | null>(null);
  const [quickReason, setQuickReason] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [ordersRes, courierRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, receiver_name, phone_number, city, detailed_address, status, total_amount, final_sale_price, delivery_fee, created_at, updated_at, notes, return_reason, shipment_id, couriers(name), districts(name)")
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
    if (courierRes.error) {
      console.error("Courier fetch error:", courierRes.error);
    }
    setCompanyName(courierRes.data?.name ?? "");
    setCompanyLoaded(true);
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
    const target = orders.find(o => o.id === id);
    const oldStatus = target?.status ?? null;
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === "returned" && reason) patch.return_reason = reason;
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) {
      setUpdatingId(null);
      toast.error(error.message || "تعذر تحديث الحالة");
      return;
    }
    // Mirror to shipment + write to merchant timeline (shipment_status_history)
    if (target?.shipment_id) {
      await supabase.from("shipments").update({ status: newStatus }).eq("id", target.shipment_id);
      const { error: histErr } = await supabase.from("shipment_status_history").insert({
        shipment_id: target.shipment_id,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: user?.id ?? "system",
      });
      if (histErr) console.warn("Timeline log failed:", histErr.message);
    }
    setUpdatingId(null);
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

  // Per-tab counters (respect search to make counts useful)
  const tabCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchSearch = (o: CourierOrderRow) => {
      if (!q) return true;
      const sila = silaCodeOf(o.id).toLowerCase();
      return sila.includes(q) || o.receiver_name.toLowerCase().includes(q) || o.phone_number.toLowerCase().includes(q);
    };
    const base = orders.filter(matchSearch);
    return {
      all: base.length,
      pending: base.filter(o => TAB_FILTERS.pending(o.status)).length,
      active: base.filter(o => TAB_FILTERS.active(o.status)).length,
      delivered: base.filter(o => TAB_FILTERS.delivered(o.status)).length,
      returned: base.filter(o => TAB_FILTERS.returned(o.status)).length,
    } as Record<TabKey, number>;
  }, [orders, search]);

  // ===== Smart Scanner: lookup + propose next status =====
  const handleScan = useCallback((rawCode: string) => {
    const code = (rawCode || "").trim();
    if (!code) return;
    const upper = code.toUpperCase();
    const compact = upper.replace(/[^A-Z0-9]/g, "");
    const noPrefix = upper.replace(/^SL[-_]?/i, "").replace(/[^A-Z0-9]/g, "");

    const found = orders.find((o) => {
      const idCompact = o.id.replace(/-/g, "").toUpperCase();
      const sila = silaCodeOf(o.id).toUpperCase();
      return (
        sila === upper ||
        idCompact === compact ||
        idCompact.startsWith(noPrefix) ||
        idCompact.startsWith(compact)
      );
    });

    if (!found) {
      toast.error(`لم يتم العثور على طلب بالرمز: ${code}`);
      return;
    }

    const next = NEXT_STATUS_MAP[found.status]?.[0]?.value;
    if (!next) {
      toast.info(`الطلب ${silaCodeOf(found.id)} في حالة نهائية: ${getOrderStatusMeta(found.status).label}`);
      return;
    }
    setQuickReason("");
    setQuickAction({ order: found, nextStatus: next });
  }, [orders]);

  const confirmQuickAction = async () => {
    if (!quickAction) return;
    const { order, nextStatus } = quickAction;
    const reason = nextStatus === "returned" ? quickReason : undefined;
    if (nextStatus === "returned" && !reason) {
      toast.error("سبب الإرجاع مطلوب");
      return;
    }
    setQuickAction(null);
    setScanInput("");
    await updateStatus(order.id, nextStatus, reason);
  };

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
        getOrderStatusMeta(o.status).label,
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
    const targets = orders.filter(o => selectedIds.includes(o.id));
    const results = await Promise.all(
      targets.map(async (o) => {
        const oldStatus = o.status;
        const upd = await supabase.from("orders").update({ status: newStatus }).eq("id", o.id);
        if (upd.error) return upd;
        if (o.shipment_id) {
          await supabase.from("shipments").update({ status: newStatus }).eq("id", o.shipment_id);
          await supabase.from("shipment_status_history").insert({
            shipment_id: o.shipment_id,
            old_status: oldStatus,
            new_status: newStatus,
            changed_by: user?.id ?? "system",
          });
        }
        return upd;
      })
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

  // ===== Edit Weight & Price =====
  const openEditDialog = (o: CourierOrderRow) => {
    setEditDialog(o);
    // weight not stored on orders; default to 1 if no shipment-side value yet
    setEditWeight("1");
    setEditPrice(String(o.final_sale_price ?? o.total_amount ?? 0));
  };
  const saveEdit = async () => {
    if (!editDialog) return;
    const w = Number(editWeight);
    const p = Number(editPrice);
    if (!Number.isFinite(w) || w <= 0) { toast.error("الوزن غير صالح"); return; }
    if (!Number.isFinite(p) || p < 0) { toast.error("القيمة غير صالحة"); return; }
    setEditSaving(true);
    const orderUpd = await supabase
      .from("orders")
      .update({ final_sale_price: p })
      .eq("id", editDialog.id);
    let shipmentErr: string | null = null;
    if (editDialog.shipment_id) {
      const sh = await supabase
        .from("shipments")
        .update({ final_weight: w, cod_amount: p })
        .eq("id", editDialog.shipment_id);
      if (sh.error) shipmentErr = sh.error.message;
    }
    setEditSaving(false);
    if (orderUpd.error) { toast.error(orderUpd.error.message); return; }
    if (shipmentErr) toast.error("تم تحديث الطلب لكن تعذر تحديث الشحنة: " + shipmentErr);
    else toast.success("تم تحديث الوزن والقيمة");
    setEditDialog(null);
    fetchAll();
  };

  // ===== Revert final status =====
  const revertFinal = async () => {
    if (!revertDialog) return;
    setReverting(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "out_for_delivery", return_reason: null })
      .eq("id", revertDialog.id);
    setReverting(false);
    if (error) { toast.error(error.message || "تعذر التراجع"); return; }
    toast.success("تم إعادة الطلب إلى قيد التوصيل");
    setRevertDialog(null);
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
              {!companyLoaded
                ? "جارٍ التحميل..."
                : companyName
                  ? `مرحباً، ${companyName}`
                  : "مرحباً بك"}
            </h1>
            {companyLoaded && !companyName ? (
              <p className="text-sm text-destructive mt-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                لم يتم العثور على ملف شركة الشحن المرتبط بحسابك. يُرجى التواصل مع الإدارة.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                نظرة عامة على أداء التوصيل والطلبات المسندة إليكم.
              </p>
            )}
          </div>
          <Badge variant="outline" className="self-start sm:self-auto gap-1.5 px-3 py-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            مُحدّث لحظياً
          </Badge>
        </div>

        {/* Top-level tabs: Orders / Scanner / Wallet */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:inline-grid h-11 p-1">
            <TabsTrigger value="orders" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-card">
              <Package className="h-3.5 w-3.5" />
              الطلبات
            </TabsTrigger>
            <TabsTrigger value="scanner" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-card">
              <ScanLine className="h-3.5 w-3.5" />
              الماسح الضوئي
            </TabsTrigger>
            <TabsTrigger value="wallet" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-card">
              <Wallet className="h-3.5 w-3.5" />
              المحفظة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6 mt-0">
        {/* === SMART SCANNER BAR (Scan-to-Sort) === */}
        <Card className="border-primary/30 shadow-sm bg-gradient-to-l from-primary/5 to-transparent">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-bold">المسح السريع</div>
                  <div className="text-[11px] text-muted-foreground">امسح الباركود لتحديث الحالة فوراً</div>
                </div>
              </div>
              <form
                className="relative flex-1"
                onSubmit={(e) => { e.preventDefault(); handleScan(scanInput); }}
              >
                <ScanLine className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary" />
                <Input
                  autoFocus
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="امسح أو اكتب رمز الطلب (SL-XXXXXX) ثم اضغط Enter"
                  className="pr-9 h-10 text-sm font-mono border-primary/40 focus-visible:ring-primary"
                  dir="ltr"
                />
              </form>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  className="h-10 gap-1.5"
                  onClick={() => handleScan(scanInput)}
                  disabled={!scanInput.trim()}
                >
                  <Zap className="h-3.5 w-3.5" /> تنفيذ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-10 gap-1.5"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera className="h-3.5 w-3.5" /> الكاميرا
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <TabsList className="grid grid-cols-5 w-full gap-1 h-auto p-1 md:w-auto md:inline-grid">
                {(["all", "pending", "active", "delivered", "returned"] as TabKey[]).map((k) => (
                  <TabsTrigger
                    key={k}
                    value={k}
                    className="flex flex-col items-center justify-center gap-1 px-1 py-2 h-auto min-h-14 text-[11px] leading-tight whitespace-normal text-center md:flex-row md:gap-1.5 md:text-xs md:min-h-0 md:py-1.5"
                  >
                    <Badge
                      variant={tab === k ? "default" : "secondary"}
                      className="h-4 min-w-4 px-1 text-[10px] tabular-nums shrink-0"
                    >
                      {tabCounts[k]}
                    </Badge>
                    <span className="block">{TAB_LABELS[k]}</span>
                  </TabsTrigger>
                ))}
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
                      <TableHead className="w-[50px] text-xs"></TableHead>
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
                            {(() => {
                              const meta = getOrderStatusMeta(o.status);
                              const Icon = meta.icon;
                              return (
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                                  <Icon className="h-3 w-3" />
                                  {meta.label}
                                </span>
                              );
                            })()}
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
                                value=""
                                onValueChange={(v) => updateStatus(o.id, v)}
                                disabled={updatingId === o.id}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="تحديث الحالة" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(NEXT_STATUS_MAP[o.status] || []).map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel className="text-xs">إجراءات</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(o)} disabled={isFinal}>
                                  <Scale className="h-4 w-4" /> تعديل الوزن/القيمة
                                </DropdownMenuItem>
                                {isFinal && (
                                  <DropdownMenuItem onClick={() => setRevertDialog(o)} className="text-amber-700 dark:text-amber-300 focus:text-amber-700">
                                    <Undo2 className="h-4 w-4" /> تراجع عن الحالة
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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
          </TabsContent>

          {/* SCANNER TAB */}
          <TabsContent value="scanner" className="mt-0">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-primary" />
                  مسح الباركود
                </CardTitle>
                <CardDescription className="text-xs">
                  امسح باركود الشحنة لتحديث حالتها بسرعة. النتائج محصورة بشحنات شركتكم فقط.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BarcodeScanner />
              </CardContent>
            </Card>
          </TabsContent>

          {/* WALLET TAB */}
          <TabsContent value="wallet" className="mt-0">
            <CourierWalletPanel />
          </TabsContent>
        </Tabs>
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

      {/* === Quick Action dialog (after scan) === */}
      <Dialog open={!!quickAction} onOpenChange={(o) => !o && setQuickAction(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              تأكيد التحديث السريع
            </DialogTitle>
            <DialogDescription>
              {quickAction && (
                <>
                  الطلب <span className="font-mono">{silaCodeOf(quickAction.order.id)}</span> — {quickAction.order.receiver_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {quickAction && (
            <div className="space-y-3 py-1">
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">الحالة الحالية</span>
                  <span className="font-medium">{getOrderStatusMeta(quickAction.order.status).label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">الحالة المقترحة</span>
                  <span className="font-bold text-primary">
                    {NEXT_STATUS_MAP[quickAction.order.status]?.find(s => s.value === quickAction.nextStatus)?.label
                      || getOrderStatusMeta(quickAction.nextStatus).label}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">تغيير الإجراء (اختياري)</Label>
                <Select
                  value={quickAction.nextStatus}
                  onValueChange={(v) => setQuickAction({ ...quickAction, nextStatus: v })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(NEXT_STATUS_MAP[quickAction.order.status] || []).map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {quickAction.nextStatus === "returned" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">سبب الإرجاع *</Label>
                  <Select value={quickReason} onValueChange={setQuickReason}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر السبب" /></SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setQuickAction(null)}>إلغاء</Button>
            <Button
              onClick={confirmQuickAction}
              disabled={!!updatingId || (quickAction?.nextStatus === "returned" && !quickReason)}
              className="gap-1.5"
            >
              {updatingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              تأكيد التحديث
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Camera Scanner dialog === */}
      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              مسح الباركود بالكاميرا
            </DialogTitle>
            <DialogDescription>
              وجّه الكاميرا نحو الباركود. سيُحدَّث الطلب المرتبط تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <BarcodeScanner />
        </DialogContent>
      </Dialog>

      {/* Edit Weight & Price dialog */}
      <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              تعديل الوزن والقيمة
            </DialogTitle>
            <DialogDescription>
              {editDialog && <span className="font-mono">{silaCodeOf(editDialog.id)}</span>} — حدّث القيم الفعلية قبل تأكيد التسليم.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">الوزن النهائي (كغ)</Label>
              <Input
                type="number" min="0.1" step="0.1" inputMode="decimal"
                value={editWeight} onChange={(e) => setEditWeight(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">قيمة البيع النهائية (ل.س)</Label>
              <Input
                type="number" min="0" step="100" inputMode="numeric"
                value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
            {!editDialog?.shipment_id && (
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                هذا الطلب غير مرتبط بشحنة — سيتم تحديث الطلب فقط.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialog(null)} disabled={editSaving}>إلغاء</Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert final status dialog */}
      <Dialog open={!!revertDialog} onOpenChange={(o) => !o && setRevertDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Undo2 className="h-4 w-4" />
              تراجع عن الحالة
            </DialogTitle>
            <DialogDescription>
              سيتم إعادة الطلب {revertDialog && <span className="font-mono">{silaCodeOf(revertDialog.id)}</span>} إلى حالة "قيد التوصيل".
              يُستخدم هذا الإجراء عند تحديث الحالة بالخطأ. سيتم تسجيل الحركة في سجل التدقيق.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>قد يكون لهذا الإجراء أثر على المحفظة والتسويات إذا تم إعادة الحالة بعد المعالجة.</span>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevertDialog(null)} disabled={reverting}>إلغاء</Button>
            <Button variant="destructive" onClick={revertFinal} disabled={reverting}>
              {reverting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              تأكيد التراجع
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