import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
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
  Camera, Zap, ArrowUp, ArrowDown, FileSpreadsheet, CalendarIcon, ChevronRight, ChevronLeft, ClipboardList,
} from "lucide-react";
import * as XLSX from "xlsx";
import { printDailyManifest, type ManifestRow } from "@/lib/print-bulk";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
  assigned_branch_id?: string | null;
  couriers?: { name: string } | null;
  districts?: { name: string } | null;
  shipments?: { collection_fee: number | null } | null;
  branch_name?: string | null;
  collection_fee?: number;
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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLoaded, setCompanyLoaded] = useState(false);
  const [mainTab, setMainTab] = useState<"orders" | "scanner" | "wallet">("orders");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [returnDialog, setReturnDialog] = useState<{ orderId: string } | null>(null);
  const [returnReason, setReturnReason] = useState<string>("");
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [tab, setTab] = useState<TabKey>(() => {
    const t = searchParams.get("tab") as TabKey | null;
    return t && ["all","pending","active","delivered","returned"].includes(t) ? t : "all";
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from && !to) return undefined;
    return {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };
  });
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editDialog, setEditDialog] = useState<CourierOrderRow | null>(null);
  const [editWeight, setEditWeight] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [revertDialog, setRevertDialog] = useState<CourierOrderRow | null>(null);
  const [reverting, setReverting] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [manifestLoading, setManifestLoading] = useState(false);

  // ===== Smart Scanner state =====
  const [scanInput, setScanInput] = useState("");
  const [quickAction, setQuickAction] = useState<{ order: CourierOrderRow; nextStatus: string } | null>(null);
  const [quickReason, setQuickReason] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  // Pagination
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);

  // ===== Courier company name (one-shot) =====
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("couriers")
      .select("name")
      .eq("vendor_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Courier fetch error:", error);
        setCompanyName(data?.name ?? "");
        setCompanyLoaded(true);
      });
    return () => { cancelled = true; };
  }, [user]);

  // ===== AGGREGATE QUERY: lightweight, ALL rows for KPIs / chart / scanner / tab counts =====
  // No heavy joins. Used purely to compute analytics + power the smart scanner search.
  type AggOrder = Pick<
    CourierOrderRow,
    "id" | "status" | "updated_at" | "created_at" | "receiver_name" | "phone_number" | "shipment_id" | "return_reason"
  >;
  const aggregateQuery = useQuery({
    queryKey: ["courier-orders-aggregate", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, updated_at, created_at, receiver_name, phone_number, shipment_id, return_reason")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AggOrder[];
    },
  });
  const aggOrders: AggOrder[] = aggregateQuery.data ?? [];

  // ===== PAGINATED TABLE QUERY: server-side filters + full joins =====
  // All filters (tab, status, date range, search) applied at the DB level so
  // pagination reflects the user's view.
  const pageQuery = useQuery({
    queryKey: [
      "courier-orders-page",
      user?.id, page, tab, statusFilter, sortDir,
      search.trim().toLowerCase(),
      dateRange?.from?.toISOString() ?? null,
      dateRange?.to?.toISOString() ?? null,
    ],
    enabled: !!user?.id,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("orders")
        .select(
          "id, receiver_name, phone_number, city, detailed_address, status, total_amount, final_sale_price, delivery_fee, created_at, updated_at, notes, return_reason, shipment_id, assigned_branch_id, couriers(name), districts(name), shipments:shipment_id(collection_fee)",
          { count: "exact" }
        )
        .is("deleted_at", null);

      // Tab filter (mutually exclusive buckets — mirror TAB_FILTERS server-side)
      if (tab === "pending") q = q.in("status", ["new", "pending"]);
      else if (tab === "active") q = q.in("status", ["processing", "shipped", "out_for_delivery"]);
      else if (tab === "delivered") q = q.eq("status", "delivered");
      else if (tab === "returned") q = q.in("status", ["returned", "cancelled"]);

      if (statusFilter !== "all") q = q.eq("status", statusFilter);

      if (dateRange?.from) {
        const fromD = new Date(dateRange.from); fromD.setHours(0, 0, 0, 0);
        q = q.gte("created_at", fromD.toISOString());
      }
      if (dateRange?.to) {
        const toD = new Date(dateRange.to); toD.setHours(23, 59, 59, 999);
        q = q.lte("created_at", toD.toISOString());
      }

      const term = search.trim();
      if (term) {
        // OR across name / phone / address. Sila code search is handled
        // client-side via the aggregate query (id-prefix lookup).
        const safe = term.replace(/[%,]/g, " ");
        q = q.or(
          `receiver_name.ilike.%${safe}%,phone_number.ilike.%${safe}%,detailed_address.ilike.%${safe}%`
        );
      }

      q = q.order("created_at", { ascending: sortDir === "asc" }).range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;

      const rawOrders = (data || []) as unknown as CourierOrderRow[];

      // Resolve branch names in a single batched query (no FK on assigned_branch_id)
      const branchIds = Array.from(new Set(rawOrders.map(o => o.assigned_branch_id).filter(Boolean) as string[]));
      let branchMap = new Map<string, string>();
      if (branchIds.length) {
        const { data: branches } = await supabase
          .from("courier_branches").select("id, name").in("id", branchIds);
        branchMap = new Map((branches || []).map(b => [b.id as string, b.name as string]));
      }
      const enriched = rawOrders.map(o => ({
        ...o,
        branch_name: o.assigned_branch_id ? (branchMap.get(o.assigned_branch_id) ?? null) : null,
        collection_fee: Number(o.shipments?.collection_fee ?? 0),
      }));
      return { rows: enriched, total: count ?? 0 };
    },
  });
  const orders: CourierOrderRow[] = pageQuery.data?.rows ?? [];
  const totalCount = pageQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const loading = pageQuery.isLoading;

  // Reset to page 0 whenever filters change
  useEffect(() => { setPage(0); }, [tab, statusFilter, sortDir, search, dateRange?.from, dateRange?.to]);

  const fetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["courier-orders-aggregate", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["courier-orders-page", user?.id] });
  }, [queryClient, user?.id]);

  // Persist filters to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const setOrDel = (k: string, v: string) => { if (v) next.set(k, v); else next.delete(k); };
    setOrDel("q", search.trim());
    setOrDel("tab", tab === "all" ? "" : tab);
    setOrDel("status", statusFilter === "all" ? "" : statusFilter);
    setOrDel("from", dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "");
    setOrDel("to", dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tab, statusFilter, dateRange]);

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
    fetchAll();
    setReturnDialog(null);
  };

  // ===== Derived KPIs & chart data (driven by lightweight AGGREGATE query — ALL rows) =====
  const kpis = useMemo(() => {
    const total = aggOrders.length;
    const deliveredToday = aggOrders.filter(o => o.status === "delivered" && isToday(o.updated_at)).length;
    const finishedToday = aggOrders.filter(o => isToday(o.updated_at) && ["delivered", "returned"].includes(o.status)).length;
    const successRate = finishedToday ? Math.round((deliveredToday / finishedToday) * 100) : 0;
    const outForDelivery = aggOrders.filter(o => o.status === "out_for_delivery").length;
    const returned = aggOrders.filter(o => o.status === "returned").length;
    return { total, deliveredToday, successRate, outForDelivery, returned };
  }, [aggOrders]);

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
    for (const o of aggOrders) {
      if (!["delivered", "returned"].includes(o.status)) continue;
      const k = new Date(o.updated_at).toISOString().slice(0, 10);
      const i = idx.get(k);
      if (i === undefined) continue;
      if (o.status === "delivered") days[i].delivered++;
      else days[i].returned++;
    }
    return days;
  }, [aggOrders]);

  // The page query is already filtered + sorted server-side. `filtered` is the
  // current page's rows as displayed.
  const filtered = orders;

  // Distinct statuses present in current data, for the status filter dropdown
  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    aggOrders.forEach(o => set.add(o.status));
    return Array.from(set);
  }, [aggOrders]);

  // Per-tab counters — driven by the aggregate query so counts reflect ALL data.
  const tabCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchSearch = (o: AggOrder) => {
      if (!q) return true;
      const sila = silaCodeOf(o.id).toLowerCase();
      return sila.includes(q) || o.receiver_name.toLowerCase().includes(q) || o.phone_number.toLowerCase().includes(q);
    };
    const base = aggOrders.filter(matchSearch);
    return {
      all: base.length,
      pending: base.filter(o => TAB_FILTERS.pending(o.status)).length,
      active: base.filter(o => TAB_FILTERS.active(o.status)).length,
      delivered: base.filter(o => TAB_FILTERS.delivered(o.status)).length,
      returned: base.filter(o => TAB_FILTERS.returned(o.status)).length,
    } as Record<TabKey, number>;
  }, [aggOrders, search]);

  // ===== Smart Scanner: lookup across ALL orders (aggregate query) =====
  const handleScan = useCallback((rawCode: string) => {
    const code = (rawCode || "").trim();
    if (!code) return;
    const upper = code.toUpperCase();
    const compact = upper.replace(/[^A-Z0-9]/g, "");
    const noPrefix = upper.replace(/^SL[-_]?/i, "").replace(/[^A-Z0-9]/g, "");

    const found = aggOrders.find((o) => {
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
    // Cast to CourierOrderRow shape; quick-action dialog only needs id/status/receiver_name
    setQuickAction({ order: found as unknown as CourierOrderRow, nextStatus: next });
  }, [aggOrders]);

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

  // Row background tint based on status (semantic tokens, low opacity)
  const rowToneClass = (status: string): string => {
    switch (status) {
      case "delivered":        return "bg-success/10 hover:bg-success/15";
      case "out_for_delivery": return "bg-info/10 hover:bg-info/15";
      case "shipped":          return "bg-info/5 hover:bg-info/10";
      case "processing":       return "bg-primary/5 hover:bg-primary/10";
      case "pending":
      case "new":              return "bg-warning/10 hover:bg-warning/15";
      case "returned":
      case "cancelled":        return "bg-destructive/10 hover:bg-destructive/15";
      default:                 return "hover:bg-muted/30";
    }
  };

  // Excel export — ON-DEMAND fetch of the FILTERED dataset with full joins.
  // Heavy export data is NOT kept in memory — we only fetch when the user clicks.
  const exportExcel = async () => {
    if (!user) return;
    if (totalCount === 0) { toast.error("لا توجد طلبات للتصدير"); return; }
    setExportLoading(true);
    try {
      // Re-apply the SAME filters as the page query, but without `.range()` — fetch all.
      let q = supabase
        .from("orders")
        .select(
          "id, receiver_name, phone_number, city, detailed_address, status, total_amount, final_sale_price, delivery_fee, created_at, updated_at, notes, return_reason, shipment_id, assigned_branch_id, couriers(name), districts(name), shipments:shipment_id(collection_fee)"
        )
        .is("deleted_at", null);
      if (tab === "pending") q = q.in("status", ["new", "pending"]);
      else if (tab === "active") q = q.in("status", ["processing", "shipped", "out_for_delivery"]);
      else if (tab === "delivered") q = q.eq("status", "delivered");
      else if (tab === "returned") q = q.in("status", ["returned", "cancelled"]);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (dateRange?.from) {
        const fromD = new Date(dateRange.from); fromD.setHours(0, 0, 0, 0);
        q = q.gte("created_at", fromD.toISOString());
      }
      if (dateRange?.to) {
        const toD = new Date(dateRange.to); toD.setHours(23, 59, 59, 999);
        q = q.lte("created_at", toD.toISOString());
      }
      const term = search.trim();
      if (term) {
        const safe = term.replace(/[%,]/g, " ");
        q = q.or(
          `receiver_name.ilike.%${safe}%,phone_number.ilike.%${safe}%,detailed_address.ilike.%${safe}%`
        );
      }
      q = q.order("created_at", { ascending: sortDir === "asc" }).limit(10000);

      const { data: rows, error } = await q;
      if (error) throw error;
      const list = (rows || []) as unknown as CourierOrderRow[];
      if (list.length === 0) { toast.error("لا توجد طلبات للتصدير"); return; }

      // Resolve branch names in one batched query
      const branchIds = Array.from(new Set(list.map(o => o.assigned_branch_id).filter(Boolean) as string[]));
      let branchMap = new Map<string, string>();
      if (branchIds.length) {
        const { data: branches } = await supabase
          .from("courier_branches").select("id, name").in("id", branchIds);
        branchMap = new Map((branches || []).map(b => [b.id as string, b.name as string]));
      }

      const data = list.map(o => {
        const cod = Number(o.final_sale_price ?? o.total_amount ?? 0);
        const branchName = o.assigned_branch_id ? (branchMap.get(o.assigned_branch_id) ?? null) : null;
        const collectionFee = Number(o.shipments?.collection_fee ?? 0);
        return {
          "تاريخ الطلبية": new Date(o.created_at).toLocaleDateString("en-GB"),
          "مكان التسليم": o.detailed_address || "",
          "الكود": silaCodeOf(o.id),
          "اسم المستلم": o.receiver_name,
          "رقم الهاتف": o.phone_number,
          "المدينة": o.districts?.name || o.city,
          "الفرع": branchName || "—",
          "قيمة": Number(o.total_amount ?? 0),
          "المبلغ المطلوب تحصيله (COD)": cod,
          "قيمة أجور الحوالة": collectionFee,
          "رسوم التوصيل": Number(o.delivery_fee ?? 0),
          "الحالة": getOrderStatusMeta(o.status).label,
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const headers = Object.keys(data[0] || {});
      ws["!cols"] = headers.map((h) => {
        const maxContent = data.reduce((m, row) => {
          const v = (row as Record<string, unknown>)[h];
          const len = String(v ?? "").length;
          return len > m ? len : m;
        }, h.length);
        return { wch: Math.min(60, Math.max(14, maxContent + 6)) };
      });
      ws["!views"] = [{ RTL: true }];
      const wb = XLSX.utils.book_new();
      wb.Workbook = { ...(wb.Workbook || {}), Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, "الطلبات");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `sila-orders-${stamp}.xlsx`);
      toast.success(`تم تصدير ${list.length} طلب إلى Excel`);
    } catch (e: any) {
      toast.error(e?.message || "فشل التصدير");
    } finally {
      setExportLoading(false);
    }
  };

  // Daily Manifest — ON-DEMAND fetch.
  // If rows are selected, print just those (from current page).
  // Otherwise, fetch the FULL filtered dataset (same filters as the page query)
  // so the manifest covers the courier's whole filtered trip — not just one page.
  const printManifest = async () => {
    if (!user) return;
    setManifestLoading(true);
    try {
      let manifestRows: ManifestRow[] = [];

      if (selectedIds.length > 0) {
        const sel = orders.filter((o) => selectedIds.includes(o.id));
        manifestRows = sel.map((o) => ({
          silaCode: silaCodeOf(o.id),
          receiverName: o.receiver_name,
          address: [o.districts?.name || o.city, o.detailed_address].filter(Boolean).join(" — "),
          phone: o.phone_number,
          cod: Number(o.final_sale_price ?? o.total_amount ?? 0),
        }));
      } else {
        // Re-apply page-query filters without `.range()` to get the entire filtered set.
        let q = supabase
          .from("orders")
          .select(
            "id, receiver_name, phone_number, city, detailed_address, status, total_amount, final_sale_price, created_at, districts(name)"
          )
          .is("deleted_at", null);
        if (tab === "pending") q = q.in("status", ["new", "pending"]);
        else if (tab === "active") q = q.in("status", ["processing", "shipped", "out_for_delivery"]);
        else if (tab === "delivered") q = q.eq("status", "delivered");
        else if (tab === "returned") q = q.in("status", ["returned", "cancelled"]);
        if (statusFilter !== "all") q = q.eq("status", statusFilter);
        if (dateRange?.from) {
          const fromD = new Date(dateRange.from); fromD.setHours(0, 0, 0, 0);
          q = q.gte("created_at", fromD.toISOString());
        }
        if (dateRange?.to) {
          const toD = new Date(dateRange.to); toD.setHours(23, 59, 59, 999);
          q = q.lte("created_at", toD.toISOString());
        }
        const term = search.trim();
        if (term) {
          const safe = term.replace(/[%,]/g, " ");
          q = q.or(
            `receiver_name.ilike.%${safe}%,phone_number.ilike.%${safe}%,detailed_address.ilike.%${safe}%`
          );
        }
        q = q.order("created_at", { ascending: sortDir === "asc" }).limit(5000);
        const { data, error } = await q;
        if (error) throw error;
        const list = (data || []) as any[];
        manifestRows = list.map((o) => ({
          silaCode: silaCodeOf(o.id),
          receiverName: o.receiver_name,
          address: [o.districts?.name || o.city, o.detailed_address].filter(Boolean).join(" — "),
          phone: o.phone_number,
          cod: Number(o.final_sale_price ?? o.total_amount ?? 0),
        }));
      }

      if (!manifestRows.length) {
        toast.error("لا توجد طلبات في النطاق المحدد");
        return;
      }
      printDailyManifest(manifestRows, companyName || "شركة الشحن");
      toast.success(`تم تجهيز كشف ${manifestRows.length} طلب`);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر إنشاء كشف الرحلة");
    } finally {
      setManifestLoading(false);
    }
  };

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
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="بحث برمز، اسم، هاتف، أو عنوان..."
                    className="pr-9 h-9 text-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm w-full sm:w-44">
                    <SelectValue placeholder="تصفية الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    {availableStatuses.map(s => (
                      <SelectItem key={s} value={s}>{getOrderStatusMeta(s).label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 gap-1.5 justify-start text-sm w-full sm:w-56 font-normal",
                        !dateRange?.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yyyy")} — {format(dateRange.to, "dd/MM/yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>تصفية حسب التاريخ</span>
                      )}
                      {dateRange?.from && (
                        <X
                          className="h-3.5 w-3.5 mr-auto opacity-60 hover:opacity-100"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDateRange(undefined); }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5"
                  onClick={exportExcel}
                  disabled={totalCount === 0 || exportLoading}
                >
                  {exportLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <FileSpreadsheet className="h-3.5 w-3.5" />}
                  تصدير إلى إكسل
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5"
                  onClick={printManifest}
                  disabled={manifestLoading || (totalCount === 0 && selectedIds.length === 0)}
                  title={selectedIds.length > 0 ? `طباعة كشف لـ ${selectedIds.length} طلب محدد` : "طباعة كشف الرحلة لكامل الفلترة الحالية"}
                >
                  {manifestLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <ClipboardList className="h-3.5 w-3.5" />}
                  طباعة كشف الرحلة
                  {selectedIds.length > 0 && ` (${selectedIds.length})`}
                </Button>
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
                      <TableHead className="text-xs">
                        <button
                          type="button"
                          onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
                          className="inline-flex items-center gap-1 hover:text-primary transition"
                        >
                          تاريخ الطلبية
                          {sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs">مكان التسليم</TableHead>
                      <TableHead className="text-xs">الكود</TableHead>
                      <TableHead className="text-xs">اسم المستلم</TableHead>
                      <TableHead className="text-xs">رقم الهاتف</TableHead>
                      <TableHead className="text-xs">المدينة</TableHead>
                      <TableHead className="text-xs">الفرع</TableHead>
                      <TableHead className="text-xs">قيمة</TableHead>
                      <TableHead className="text-xs">المبلغ المطلوب تحصيله</TableHead>
                      <TableHead className="text-xs">قيمة أجور الحوالة</TableHead>
                      <TableHead className="text-xs">رسوم التوصيل</TableHead>
                      <TableHead className="text-xs">الحالة</TableHead>
                      <TableHead className="w-[180px] text-xs">تحديث الحالة</TableHead>
                      <TableHead className="w-[50px] text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => {
                      const cod = o.final_sale_price ?? o.total_amount;
                      const isFinal = ["delivered", "returned", "cancelled"].includes(o.status);
                      const checked = selectedIds.includes(o.id);
                      return (
                        <TableRow key={o.id} className={`${rowToneClass(o.status)} ${checked ? "ring-1 ring-primary/40" : ""}`}>
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => toggleOne(o.id, !!c)}
                              aria-label={`تحديد ${silaCodeOf(o.id)}`}
                            />
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap tabular-nums">
                            {new Date(o.created_at).toLocaleDateString("en-GB")}
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <div className="text-xs text-muted-foreground truncate" title={o.detailed_address}>
                              {o.detailed_address || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{silaCodeOf(o.id)}</TableCell>
                          <TableCell className="font-medium text-sm">{o.receiver_name}</TableCell>
                          <TableCell dir="ltr" className="text-xs text-muted-foreground">{o.phone_number}</TableCell>
                          <TableCell className="text-sm">{o.districts?.name || o.city}</TableCell>
                          <TableCell className="text-xs">{o.branch_name || "—"}</TableCell>
                          <TableCell className="text-xs tabular-nums whitespace-nowrap">{fmtSYP(Number(o.total_amount ?? 0))}</TableCell>
                          <TableCell className="font-semibold text-sm tabular-nums whitespace-nowrap">{fmtSYP(Number(cod))}</TableCell>
                          <TableCell className="text-xs tabular-nums whitespace-nowrap">{fmtSYP(Number(o.collection_fee ?? 0))}</TableCell>
                          <TableCell className="text-xs tabular-nums whitespace-nowrap">{fmtSYP(Number(o.delivery_fee ?? 0))}</TableCell>
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
                                {!isFinal && (NEXT_STATUS_MAP[o.status] || []).length > 0 && (
                                  <>
                                    <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal">
                                      تحديث سريع للحالة
                                    </DropdownMenuLabel>
                                    {(NEXT_STATUS_MAP[o.status] || []).map(s => (
                                      <DropdownMenuItem
                                        key={s.value}
                                        onClick={() => updateStatus(o.id, s.value)}
                                        disabled={updatingId === o.id}
                                      >
                                        <CheckCircle2 className="h-4 w-4" /> {s.label}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                  </>
                                )}
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

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between gap-3 mt-1 px-1 flex-wrap">
            <div className="text-xs text-muted-foreground tabular-nums">
              عرض {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} من {totalCount}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || pageQuery.isFetching}
              >
                <ChevronRight className="h-3.5 w-3.5" />
                السابق
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-2">
                صفحة {page + 1} من {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                disabled={page + 1 >= totalPages || pageQuery.isFetching}
              >
                التالي
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
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