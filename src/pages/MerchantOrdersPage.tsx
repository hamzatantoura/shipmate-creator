import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SyrianPhoneInput } from "@/components/SyrianPhoneInput";
import StarRating from "@/components/StarRating";
import { isValidSyrianPhone } from "@/lib/syrian-phone";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MerchantSidebar } from "@/components/merchant/MerchantSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Printer, Trash2, Package, Lock, Info, Send, Radar, MapPin, Building2, ChevronDown, ChevronRight, ChevronLeft, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import silaLogo from "@/assets/sila-logo.png";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { printShippingLabel } from "@/lib/print-label";
import { printBulkLabels, type BulkLabelData } from "@/lib/print-bulk";
import EditOrderDialog from "@/components/merchant/EditOrderDialog";
import ShipmentTrackingTimeline from "@/components/merchant/ShipmentTrackingTimeline";
import { getOrderStatusMeta } from "@/lib/order-status";

type OrderStatus = "new" | "processing" | "shipped" | "out_for_delivery" | "delivered" | "returned" | "cancelled";

interface OrderRow {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  district_id: string | null;
  courier_id: string | null;
  status: string;
  total_amount: number;
  final_sale_price: number | null;
  shipment_id: string | null;
  created_at: string;
  label_printed_at: string | null;
  notes: string | null;
  return_reason: string | null;
  couriers?: { name: string; logo_url: string | null } | null;
  shipments?: { tracking_number: string | null } | null;
}

interface DistrictRow {
  id: string;
  name: string;
  parent_id: string | null;
  delivery_fee: number;
}

interface CourierOption {
  id: string;
  name: string;
}

interface CourierRate {
  courier_id: string;
  district_id: string;
  custom_delivery_fee: number;
}

interface BranchRow {
  id: string;
  courier_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  district_id: string | null;
  province_id: string | null;
}

interface DistrictRowGeo {
  id: string;
  lat: number | null;
  lng: number | null;
}

interface SmartCourierRow {
  courier_id: string;
  courier_name: string;
  logo_url: string | null;
  nearest_branch_id: string;
  nearest_branch_name: string;
  nearest_branch_address: string | null;
  nearest_branch_phone: string | null;
  nearest_branch_lat: number | null;
  nearest_branch_lng: number | null;
  distance_km: number | null;
  total_branches_in_destination: number;
}

interface CourierBranchOption {
  branch_id: string;
  branch_name: string;
  address_details: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
}

const RETURN_REASON_AR: Record<string, string> = {
  customer_refused: "رفض المستلم",
  no_answer: "لا يرد",
  wrong_address: "عنوان خاطئ",
  damaged: "تالف",
  other: "أخرى",
};

interface BoxItem {
  id: string;
  weight: string;
}

const fmtSYP = (n: number) => new Intl.NumberFormat("ar-SY").format(n) + " ل.س";
const silaCodeOf = (id: string) => "SL-" + id.slice(0, 6).toUpperCase();
const isLocked = (o: OrderRow) => !!o.label_printed_at || !!o.shipment_id || ["processing", "shipped", "out_for_delivery", "delivered", "returned"].includes(o.status);

// Format Syrian phone to international E.164-like (no +): 963XXXXXXXXX
const toIntlSyrianPhone = (raw: string): string => {
  let p = (raw || "").replace(/[^\d]/g, "");
  if (!p) return "";
  if (p.startsWith("00963")) p = p.slice(5);
  else if (p.startsWith("963")) p = p.slice(3);
  p = p.replace(/^0+/, "");
  return "963" + p;
};

const buildTrackingShareUrl = (silaCode: string) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/track?code=${encodeURIComponent(silaCode)}`;
};

const sendTrackingViaWhatsApp = (order: OrderRow) => {
  const phone = toIntlSyrianPhone(order.phone_number);
  if (!phone || phone.length < 10) {
    toast.error("رقم هاتف الزبون غير صالح");
    return;
  }
  const sila = silaCodeOf(order.id);
  const url = buildTrackingShareUrl(sila);
  const message =
    `مرحباً ${order.receiver_name}، طلبك جاهز! 📦\n\n` +
    `يمكنك تتبع حالة شحنتك عبر منصة صِلة من هنا:\n${url}\n\n` +
    `رمز التتبع: ${sila}`;
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(wa, "_blank", "noopener,noreferrer");
};

export default function MerchantOrdersPage() {
  const { profile, signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const [merchantProvinceId, setMerchantProvinceId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printConfirmId, setPrintConfirmId] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<OrderRow | null>(null);
  // Bulk selection (for "Bulk Print Waybills")
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Districts (real data)
  const [allDistricts, setAllDistricts] = useState<DistrictRow[]>([]);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [courierRates, setCourierRates] = useState<CourierRate[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [districtGeo, setDistrictGeo] = useState<Record<string, { lat: number | null; lng: number | null }>>({});
  const [smartCouriers, setSmartCouriers] = useState<SmartCourierRow[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  // All branches per courier in destination province (for the expanded picker)
  const [branchesByCourier, setBranchesByCourier] = useState<Record<string, CourierBranchOption[]>>({});
  const [expandedCourierId, setExpandedCourierId] = useState<string | null>(null);
  // Map: districts.id (province-level row) -> provinces.id (FK target used by RPC & branches)
  const [provinceIdMap, setProvinceIdMap] = useState<Record<string, string>>({});
  useEffect(() => {
    Promise.all([
      supabase.from("districts").select("id, name, parent_id, delivery_fee").order("name"),
      supabase.from("couriers_public" as any).select("id, name").eq("is_active", true).order("name"),
      supabase.from("courier_district_rates" as any).select("courier_id, district_id, custom_delivery_fee"),
      supabase.from("courier_branches" as any).select("id, courier_id, name, lat, lng, district_id, province_id").eq("is_active", true),
      supabase.from("districts").select("id, lat, lng"),
      supabase.from("districts").select("id, province_ar, parent_id"),
      supabase.from("provinces").select("id, name_ar"),
    ]).then(([dRes, cRes, rRes, bRes, gRes, dpRes, pRes]) => {
      setAllDistricts((dRes.data || []) as DistrictRow[]);
      setCouriers(((cRes.data || []) as unknown) as CourierOption[]);
      setCourierRates((rRes.data || []) as unknown as CourierRate[]);
      setBranches(((bRes.data || []) as unknown as BranchRow[]));
      const geo: Record<string, { lat: number | null; lng: number | null }> = {};
      ((gRes.data || []) as unknown as DistrictRowGeo[]).forEach((d) => {
        geo[d.id] = { lat: d.lat, lng: d.lng };
      });
      setDistrictGeo(geo);
      // Build name->provinces.id index
      const provByName: Record<string, string> = {};
      ((pRes.data || []) as any[]).forEach((p) => { provByName[p.name_ar] = p.id; });
      // Map every province-level district row to its real provinces.id by Arabic name
      const map: Record<string, string> = {};
      ((dpRes.data || []) as any[]).forEach((d) => {
        if (!d.parent_id && d.province_ar && provByName[d.province_ar]) {
          map[d.id] = provByName[d.province_ar];
        }
      });
      setProvinceIdMap(map);
    });
  }, []);

  // Load merchant's own province (origin of every shipment)
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("merchants")
      .select("province_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMerchantProvinceId((data as any)?.province_id ?? null));
  }, [user?.id]);
  const provinces = allDistricts.filter(d => !d.parent_id);
  const areasOf = (provId: string) => allDistricts.filter(d => d.parent_id === provId);

  // Resolve delivery fee: courier-specific rate (district → province fallback) → district default → province default
  const resolveDeliveryFee = (districtId: string | null, provinceId: string | null, courierId: string | null): number => {
    const dDefault = allDistricts.find(d => d.id === districtId)?.delivery_fee ?? 0;
    const pDefault = allDistricts.find(d => d.id === provinceId)?.delivery_fee ?? 0;
    if (!courierId) return dDefault || pDefault;
    if (districtId) {
      const r = courierRates.find(x => x.courier_id === courierId && x.district_id === districtId);
      if (r) return Number(r.custom_delivery_fee);
    }
    if (provinceId) {
      const r = courierRates.find(x => x.courier_id === courierId && x.district_id === provinceId);
      if (r) return Number(r.custom_delivery_fee);
    }
    return dDefault || pDefault;
  };

  // Fetch real orders (with courier name resolved client-side from couriers state)
  // ===== React Query: paginated orders (20/page) with relational joins =====
  // Single query with joins — no N+1. districts(name) added so we don't depend
  // on the client-side allDistricts lookup for area names.
  const ordersQuery = useQuery({
    queryKey: ["merchant-orders", user?.id, page],
    enabled: !!user?.id,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("orders")
        .select(
          "id, receiver_name, phone_number, city, detailed_address, district_id, courier_id, status, total_amount, final_sale_price, shipment_id, created_at, label_printed_at, notes, return_reason, couriers(name, logo_url), shipments(tracking_number), districts(name)",
          { count: "exact" }
        )
        .eq("merchant_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data || []) as OrderRow[], total: count ?? 0 };
    },
  });
  const orders: OrderRow[] = ordersQuery.data?.rows ?? [];
  const totalCount = ordersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const loading = ordersQuery.isLoading;
  const fetchOrders = () =>
    queryClient.invalidateQueries({ queryKey: ["merchant-orders", user?.id] });

  // Reset selection when the visible page/orders change
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => orders.some((o) => o.id === id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, ordersQuery.dataUpdatedAt]);

  const visibleIds = orders.map((o) => o.id);

  // Fetch reviews for currently visible delivered/returned orders (lightweight)
  const reviewableIds = orders
    .filter((o) => o.status === "delivered" || o.status === "returned")
    .map((o) => o.id);
  const reviewsQuery = useQuery({
    queryKey: ["merchant-orders-reviews", reviewableIds.sort().join(",")],
    enabled: reviewableIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews" as any)
        .select("order_id, rating")
        .in("order_id", reviewableIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) map[r.order_id] = r.rating;
      return map;
    },
  });
  const reviewMap = reviewsQuery.data ?? {};

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id)) && !allVisibleSelected;
  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, ...visibleIds]));
      return prev.filter((id) => !visibleIds.includes(id));
    });
  };
  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  const clearSelection = () => setSelectedIds([]);

  const handleBulkPrint = async () => {
    if (!selectedIds.length) return;
    const selectedOrders = orders.filter((o) => selectedIds.includes(o.id));
    const labels: BulkLabelData[] = selectedOrders.map((order) => {
      const matched = allDistricts.find((d) => d.id === order.district_id);
      const districtName = matched?.parent_id ? matched.name : null;
      return {
        silaCode: silaCodeOf(order.id),
        createdAt: order.created_at,
        sender: {
          storeName: profile?.store_name || "متجر التاجر",
          phone: profile?.phone || null,
          city: profile?.city || null,
        },
        receiver: {
          name: order.receiver_name,
          phone: order.phone_number,
          city: order.city,
          district: districtName,
          address: order.detailed_address,
        },
        cod: Number(order.final_sale_price ?? order.total_amount),
        notes: order.notes,
        courierName: courierNameOf(order),
        courierLogoUrl: order.couriers?.logo_url ?? null,
        trackingNumber: order.shipments?.tracking_number ?? null,
      };
    });
    try {
      printBulkLabels(labels);
    } catch (e: any) {
      toast.error(e?.message || "تعذر فتح نافذة الطباعة");
      return;
    }
    // Lock unprinted orders so the merchant can't edit them after waybills exist
    const toLock = selectedOrders.filter((o) => !o.label_printed_at);
    if (toLock.length) {
      const nowIso = new Date().toISOString();
      const updates = toLock.map((o) =>
        supabase
          .from("orders")
          .update({
            label_printed_at: nowIso,
            status: o.status === "new" ? "processing" : o.status,
          } as any)
          .eq("id", o.id),
      );
      const results = await Promise.all(updates);
      const failed = results.filter((r) => r.error).length;
      if (failed) toast.error(`تعذّر قفل ${failed} طلب`);
      else toast.success(`تم اعتماد وطباعة ${selectedOrders.length} بوليصة`);
      fetchOrders();
    } else {
      toast.success(`إعادة طباعة ${selectedOrders.length} بوليصة`);
    }
    clearSelection();
  };

  // Resolve courier name: prefer joined relation, fallback to local couriers list
  const courierNameOf = (order: OrderRow | null, courierId?: string | null) => {
    if (order?.couriers?.name) return order.couriers.name;
    const id = courierId ?? order?.courier_id ?? null;
    return id ? couriers.find(c => c.id === id)?.name || null : null;
  };

  // Form state
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    provinceId: "",
    districtId: "",
    cod: "",
    courierId: "",
    branchId: "",
  });
  const [boxes, setBoxes] = useState<BoxItem[]>([
    { id: crypto.randomUUID(), weight: "" },
  ]);

  const resetForm = () => {
    setForm({ name: "", phone: "", address: "", provinceId: "", districtId: "", cod: "", courierId: "", branchId: "" });
    setBoxes([{ id: crypto.randomUUID(), weight: "" }]);
    setExpandedCourierId(null);
    setBranchesByCourier({});
  };

  const addBox = () => setBoxes((b) => [...b, { id: crypto.randomUUID(), weight: "" }]);
  const removeBox = (id: string) =>
    setBoxes((b) => (b.length > 1 ? b.filter((x) => x.id !== id) : b));
  const updateBox = (id: string, weight: string) =>
    setBoxes((b) => b.map((x) => (x.id === id ? { ...x, weight } : x)));

  const handleCreate = async () => {
    if (!user) { toast.error("يجب تسجيل الدخول"); return; }
    if (!form.name || !form.phone || !form.provinceId) {
      toast.error("يرجى تعبئة الحقول المطلوبة");
      return;
    }
    if (!isValidSyrianPhone(form.phone)) {
      toast.error("رقم سوري غير صحيح. مثال: 0933123456");
      return;
    }
    const prov = provinces.find(p => p.id === form.provinceId);
    const area = allDistricts.find(d => d.id === form.districtId);
    const finalDistrictId = area?.id || prov?.id || null;
    const cityLabel = prov?.name || "";
    const cod = Number(form.cod) || 0;
    const deliveryFee = resolveDeliveryFee(area?.id || null, prov?.id || null, form.courierId || null);
    const picked = smartCouriers.find((s) => s.courier_id === form.courierId);
    // Prefer the branch the merchant explicitly selected; otherwise default to nearest.
    const assignedBranchId = form.branchId || picked?.nearest_branch_id || null;

    setSubmitting(true);
    const { error } = await supabase.from("orders").insert({
      merchant_id: user.id,
      receiver_name: form.name,
      phone_number: form.phone,
      city: cityLabel,
      detailed_address: form.address || "",
      district_id: finalDistrictId,
      courier_id: form.courierId || null,
      assigned_branch_id: assignedBranchId,
      total_amount: cod,
      delivery_fee: deliveryFee,
      status: "new",
    } as any);
    setSubmitting(false);

    if (error) { toast.error(error.message || "تعذر إنشاء الطلب"); return; }
    toast.success("تم إنشاء الطلب");
    resetForm();
    setCreateOpen(false);
    fetchOrders();
  };

  const confirmPrint = async () => {
    if (!printConfirmId) return;
    const order = orders.find(o => o.id === printConfirmId);
    if (!order) return;

    // Resolve area/neighborhood name from districts table.
    // If district_id points to a child (has parent_id) → it's the area name.
    // If it points to a parent (province-level) → no specific area to print.
    const matched = allDistricts.find(d => d.id === order.district_id);
    const districtName = matched?.parent_id ? matched.name : null;

    try {
      printShippingLabel({
        silaCode: silaCodeOf(order.id),
        createdAt: order.created_at,
        sender: {
          storeName: profile?.store_name || "متجر التاجر",
          phone: profile?.phone || null,
          city: profile?.city || null,
        },
        receiver: {
          name: order.receiver_name,
          phone: order.phone_number,
          city: order.city,
          district: districtName,
          address: order.detailed_address,
        },
        cod: Number(order.final_sale_price ?? order.total_amount),
        notes: order.notes,
        courierName: courierNameOf(order),
        courierLogoUrl: order.couriers?.logo_url ?? null,
        trackingNumber: order.shipments?.tracking_number ?? null,
      });
    } catch (e: any) {
      toast.error(e?.message || "تعذر فتح نافذة الطباعة");
      return;
    }

    // Lock the order in DB only if not already locked
    if (!order.label_printed_at) {
      const newStatus = order.status === "new" ? "processing" : order.status;
      const { error } = await supabase.from("orders")
        .update({ label_printed_at: new Date().toISOString(), status: newStatus } as any)
        .eq("id", printConfirmId);
      if (error) { toast.error("تم فتح البوليصة لكن تعذر قفل الطلب"); }
      else { toast.success("تم اعتماد الطلب وقفله للتعديل"); }
    } else {
      toast.success("إعادة طباعة البوليصة");
    }

    setPrintConfirmId(null);
    fetchOrders();
  };

  // Smart routing: call RPC whenever province/district selection changes
  useEffect(() => {
    if (!merchantProvinceId || !form.provinceId) {
      setSmartCouriers([]);
      return;
    }
    const customerProvinceUuid = provinceIdMap[form.provinceId] || form.provinceId;
    const dest = form.districtId
      ? districtGeo[form.districtId]
      : districtGeo[form.provinceId];
    setSmartLoading(true);
    (supabase.rpc as any)("find_couriers_for_order", {
      merchant_province_id: merchantProvinceId,
      customer_province_id: customerProvinceUuid,
      customer_lat: dest?.lat ?? null,
      customer_lng: dest?.lng ?? null,
    }).then(({ data, error }: any) => {
      if (error) {
        toast.error("تعذر تحميل شركات الشحن");
        setSmartCouriers([]);
      } else {
        setSmartCouriers((data || []) as SmartCourierRow[]);
      }
      setSmartLoading(false);
    });
  }, [merchantProvinceId, form.provinceId, form.districtId, districtGeo, provinceIdMap]);

  // Reset branches cache + expansion + selected branch when destination changes
  useEffect(() => {
    setBranchesByCourier({});
    setExpandedCourierId(null);
    setForm((f) => ({ ...f, branchId: "" }));
  }, [form.provinceId, form.districtId]);

  // Lazy-load all branches of a courier in the destination province
  const loadBranchesForCourier = async (courierId: string) => {
    if (branchesByCourier[courierId] || !form.provinceId) return;
    const customerProvinceUuid = provinceIdMap[form.provinceId] || form.provinceId;
    const dest = form.districtId ? districtGeo[form.districtId] : districtGeo[form.provinceId];
    const { data, error } = await (supabase.rpc as any)("list_courier_branches_for_order", {
      p_courier_id: courierId,
      p_customer_province_id: customerProvinceUuid,
      p_customer_lat: dest?.lat ?? null,
      p_customer_lng: dest?.lng ?? null,
    });
    if (error) { toast.error("تعذر تحميل الفروع"); return; }
    setBranchesByCourier((m) => ({ ...m, [courierId]: (data || []) as CourierBranchOption[] }));
  };

  const availableCouriers = smartCouriers;

  // Reset selected courier if it's no longer in the available list
  useEffect(() => {
    if (form.courierId && !availableCouriers.find((c) => c.courier_id === form.courierId)) {
      setForm((f) => ({ ...f, courierId: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCouriers]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background" dir="rtl">
        <MerchantSidebar />

        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Link to="/" className="flex items-center gap-2">
                <img src={silaLogo} alt="Sila" className="h-7 w-7" />
                <span className="font-display font-bold text-lg text-primary">صلة</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {profile?.store_name && (
                <span className="text-xs text-muted-foreground hidden md:inline">
                  {profile.store_name}
                </span>
              )}
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                خروج
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl w-full mx-auto">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">الطلبات</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  إدارة طلبات الزبائن وطباعة البوالص
                </p>
              </div>
              <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة طلب جديد
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة طلب جديد</DialogTitle>
                    <DialogDescription>
                      أدخل بيانات الزبون والطرود لإنشاء طلب جديد
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5 py-2">
                    {/* Customer */}
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">بيانات الزبون</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="name">اسم الزبون *</Label>
                          <Input
                            id="name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="مثال: أحمد العلي"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="phone">رقم الهاتف *</Label>
                          <SyrianPhoneInput
                            id="phone"
                            value={form.phone}
                            onChange={(v) => setForm({ ...form, phone: v })}
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="address">العنوان التفصيلي</Label>
                          <Textarea
                            id="address"
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            placeholder="الشارع، رقم البناء، الطابق..."
                            rows={2}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="province">المحافظة *</Label>
                          <Select
                            value={form.provinceId}
                            onValueChange={(v) => setForm({ ...form, provinceId: v, districtId: "" })}
                          >
                            <SelectTrigger id="province">
                              <SelectValue placeholder="اختر المحافظة" />
                            </SelectTrigger>
                            <SelectContent>
                              {provinces.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="district">المنطقة / الحي</Label>
                          <Select
                            value={form.districtId}
                            onValueChange={(v) => setForm({ ...form, districtId: v })}
                            disabled={!form.provinceId || areasOf(form.provinceId).length === 0}
                          >
                            <SelectTrigger id="district">
                              <SelectValue placeholder={
                                !form.provinceId ? "اختر محافظة أولاً" :
                                areasOf(form.provinceId).length === 0 ? "لا توجد مناطق" :
                                "اختر المنطقة"
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {areasOf(form.provinceId).map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cod">المبلغ المطلوب تحصيله (ل.س)</Label>
                          <Input
                            id="cod"
                            type="number"
                            value={form.cod}
                            onChange={(e) => setForm({ ...form, cod: e.target.value })}
                            placeholder="0"
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>شركة الشحن *</Label>
                          {!merchantProvinceId ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400 p-3 bg-amber-500/10 rounded-md border border-amber-500/30">
                              يجب تحديد محافظتك في إعدادات الحساب أولاً ليتمكن النظام من إيجاد شركات الشحن المناسبة.
                            </p>
                          ) : !form.provinceId ? (
                            <p className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-md border border-border">
                              اختر المحافظة أولاً لعرض شركات الشحن وأسعارها
                            </p>
                          ) : smartLoading ? (
                            <p className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-md border border-border">
                              جاري البحث عن شركات الشحن المناسبة...
                            </p>
                          ) : availableCouriers.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-md border border-border">
                              لا توجد شركة شحن تخدم المسار من محافظتك إلى المحافظة المختارة.
                              <br />
                              يجب أن يكون لدى الشركة فرع نشط في كلتا المحافظتين.
                            </p>
                          ) : (
                            <>
                              {(() => {
                                const dest = form.districtId
                                  ? districtGeo[form.districtId]
                                  : districtGeo[form.provinceId];
                                const hasGeo = dest?.lat != null && dest?.lng != null;
                                if (!hasGeo) {
                                  return (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                                      ⚠ ترتيب الفروع تقريبي — لم تُضبط إحداثيات هذه المنطقة بعد.
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                              <div className="grid grid-cols-1 gap-2">
                                {availableCouriers.map((c, idx) => {
                                  const fee = resolveDeliveryFee(form.districtId || null, form.provinceId, c.courier_id);
                                  const selected = form.courierId === c.courier_id;
                                  const isClosest = idx === 0 && c.distance_km != null;
                                  const isExpanded = expandedCourierId === c.courier_id;
                                  const branchesList = branchesByCourier[c.courier_id];
                                  const selectedBranchInfo = branchesList?.find((b) => b.branch_id === form.branchId);
                                  const displayBranchName = selected && selectedBranchInfo ? selectedBranchInfo.branch_name : c.nearest_branch_name;
                                  const displayDistance = selected && selectedBranchInfo ? selectedBranchInfo.distance_km : c.distance_km;
                                  return (
                                    <div
                                      key={c.courier_id}
                                      className={`rounded-md border transition-all ${
                                        selected
                                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                                          : "border-border hover:border-primary/40 bg-card"
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setForm({ ...form, courierId: c.courier_id, branchId: selected ? form.branchId : "" })}
                                        className="w-full text-right p-3"
                                      >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                          {c.logo_url ? (
                                            <img src={c.logo_url} alt="" className="h-9 w-9 rounded-md object-cover border border-border shrink-0" />
                                          ) : (
                                            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                              <Building2 className="h-4 w-4 text-primary" />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-medium text-sm text-foreground">{c.courier_name}</span>
                                              {isClosest && (
                                                <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                                                  ⭐ الأقرب
                                                </Badge>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                                              <MapPin className="h-3 w-3 shrink-0" />
                                              <span className="truncate">{displayBranchName}</span>
                                              {displayDistance != null && (
                                                <span className="text-primary font-medium shrink-0">
                                                  · {displayDistance.toFixed(1)} كم
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <span className="text-sm font-bold text-primary shrink-0">{fmtSYP(fee)}</span>
                                      </div>
                                      </button>

                                      {c.total_branches_in_destination > 1 && (
                                        <Collapsible
                                          open={isExpanded}
                                          onOpenChange={(open) => {
                                            setExpandedCourierId(open ? c.courier_id : null);
                                            if (open) loadBranchesForCourier(c.courier_id);
                                          }}
                                        >
                                          <CollapsibleTrigger
                                            type="button"
                                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-border/60 transition-colors"
                                          >
                                            <span>اختيار فرع آخر ({c.total_branches_in_destination} فروع متاحة)</span>
                                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="border-t border-border/60 bg-muted/20">
                                            {!branchesList ? (
                                              <div className="p-3 text-[11px] text-muted-foreground text-center">جاري تحميل الفروع...</div>
                                            ) : branchesList.length === 0 ? (
                                              <div className="p-3 text-[11px] text-muted-foreground text-center">لا توجد فروع</div>
                                            ) : (
                                              <div className="divide-y divide-border/40">
                                                {branchesList.map((b) => {
                                                  const branchSelected = selected && form.branchId === b.branch_id;
                                                  return (
                                                    <button
                                                      key={b.branch_id}
                                                      type="button"
                                                      onClick={() => setForm({ ...form, courierId: c.courier_id, branchId: b.branch_id })}
                                                      className={`w-full text-right px-3 py-2 flex items-start justify-between gap-2 hover:bg-primary/5 transition-colors ${
                                                        branchSelected ? "bg-primary/10" : ""
                                                      }`}
                                                    >
                                                      <div className="flex items-start gap-2 flex-1 min-w-0">
                                                        <div className={`mt-1 h-3 w-3 rounded-full border-2 shrink-0 ${
                                                          branchSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                                                        }`} />
                                                        <div className="flex-1 min-w-0">
                                                          <div className="text-xs font-medium text-foreground truncate">{b.branch_name}</div>
                                                          {b.address_details && (
                                                            <div className="text-[10px] text-muted-foreground truncate">{b.address_details}</div>
                                                          )}
                                                        </div>
                                                      </div>
                                                      {b.distance_km != null && (
                                                        <span className="text-[11px] text-primary font-medium shrink-0">
                                                          {b.distance_km.toFixed(1)} كم
                                                        </span>
                                                      )}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </CollapsibleContent>
                                        </Collapsible>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Boxes */}
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          الطرود ({boxes.length})
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={addBox} className="gap-1">
                          <Plus className="h-3.5 w-3.5" />
                          إضافة طرد
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {boxes.map((box, i) => (
                          <Card key={box.id} className="p-3 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <Label htmlFor={`w-${box.id}`} className="text-xs text-muted-foreground">
                                الوزن (كغ)
                              </Label>
                              <Input
                                id={`w-${box.id}`}
                                type="number"
                                step="0.1"
                                value={box.weight}
                                onChange={(e) => updateBox(box.id, e.target.value)}
                                placeholder="0.0"
                                dir="ltr"
                                className="mt-1"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBox(box.id)}
                              disabled={boxes.length === 1}
                              className="text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Card>
                        ))}
                      </div>
                    </section>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
                    <Button onClick={handleCreate} disabled={submitting}>{submitting ? "جاري الحفظ..." : "إنشاء الطلب"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Orders Table */}
            <Card className="overflow-hidden">
              {selectedIds.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-primary/30 bg-primary/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">
                      {selectedIds.length}
                    </span>
                    <span className="font-medium">طلب محدد</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={clearSelection}>
                      <X className="h-3.5 w-3.5" /> إلغاء التحديد
                    </Button>
                  </div>
                  <Button size="sm" className="h-8 gap-1.5" onClick={handleBulkPrint}>
                    <Printer className="h-3.5 w-3.5" />
                    طباعة البوليصات المحددة ({selectedIds.length})
                  </Button>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] text-right">
                        <Checkbox
                          checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                          onCheckedChange={(c) => toggleAllVisible(!!c)}
                          aria-label="تحديد كل الطلبات الظاهرة"
                        />
                      </TableHead>
                      <TableHead className="text-right">الزبون</TableHead>
                      <TableHead className="text-right">المحافظة</TableHead>
                      <TableHead className="text-right">شركة الشحن</TableHead>
                      <TableHead className="text-right">حالة الطلب</TableHead>
                      <TableHead className="text-right">كود صِلة</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && orders.map((order) => {
                      const meta = getOrderStatusMeta(order.status);
                      const StatusIcon = meta.icon;
                      const locked = isLocked(order);
                      const districtName = allDistricts.find(d => d.id === order.district_id)?.name;
                      const display = districtName ? `${order.city} - ${districtName}` : order.city;
                      const amount = order.final_sale_price ?? order.total_amount;
                      const courierName = courierNameOf(order);
                      const trackingNumber = order.shipments?.tracking_number ?? null;
                      const checked = selectedIds.includes(order.id);
                      return (
                        <TableRow key={order.id} className={checked ? "bg-primary/5" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => toggleOne(order.id, !!c)}
                              aria-label={`تحديد ${silaCodeOf(order.id)}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{order.receiver_name}</div>
                            <div className="text-xs text-muted-foreground" dir="ltr">{order.phone_number}</div>
                          </TableCell>
                          <TableCell className="text-sm">{display}</TableCell>
                          <TableCell className="text-sm">
                            {courierName ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-foreground font-medium">{courierName}</span>
                                {trackingNumber && (
                                  <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                                    {trackingNumber}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setTrackingOrder(order)}
                                className="focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
                                title="عرض رحلة الشحنة"
                              >
                                <Badge variant="outline" className={`gap-1 cursor-pointer ${meta.className}`}>
                                  {locked && <Lock className="h-3 w-3" />}
                                  <StatusIcon className="h-3 w-3" />
                                  {meta.label}
                                </Badge>
                              </button>
                              {order.status === "returned" && order.return_reason && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-1 text-[11px] text-destructive/90 cursor-help">
                                        <Info className="h-3 w-3" />
                                        {RETURN_REASON_AR[order.return_reason] || order.return_reason}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">سبب الإرجاع المسجَّل من شركة الشحن</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {reviewMap[order.id] && (
                                <span className="inline-flex items-center gap-1" title="تقييم العميل">
                                  <StarRating value={reviewMap[order.id]} readOnly size={12} />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-primary font-semibold" dir="ltr">
                              {silaCodeOf(order.id)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {fmtSYP(Number(amount))}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setTrackingOrder(order)}
                                className="gap-1.5"
                                title="رحلة الشحنة"
                              >
                                <Radar className="h-3.5 w-3.5 text-info" />
                                التتبع
                              </Button>
                              {!locked && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditOrder(order)}
                                  className="gap-1"
                                >
                                  تعديل
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => sendTrackingViaWhatsApp(order)}
                                className="gap-1.5 text-primary hover:text-primary"
                                title="إرسال رابط التتبع للعميل عبر واتساب"
                              >
                                <Send className="h-3.5 w-3.5" />
                                إرسال للعميل
                              </Button>
                              <Button
                                size="sm"
                                variant={locked ? "outline" : "default"}
                                onClick={() => setPrintConfirmId(order.id)}
                                className="gap-1.5"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                {locked ? "إعادة طباعة" : "طباعة البوليصة"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && orders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          لا توجد طلبات بعد
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between gap-3 mt-3 px-1 flex-wrap">
                <div className="text-xs text-muted-foreground tabular-nums">
                  عرض {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} من {totalCount}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || ordersQuery.isFetching}
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
                    disabled={page + 1 >= totalPages || ordersQuery.isFetching}
                  >
                    التالي
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Print confirmation */}
        <AlertDialog open={!!printConfirmId} onOpenChange={(o) => !o && setPrintConfirmId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                هل أنت متأكد؟
              </AlertDialogTitle>
              <AlertDialogDescription>
                طباعة البوليصة ستؤدي إلى اعتماد الطلب ولا يمكن تعديل بياناته بعد الآن.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPrint}>
                نعم، اعتمد واطبع
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {editOrder && (
          <EditOrderDialog
            order={editOrder}
            districts={allDistricts}
            couriers={couriers}
            courierRates={courierRates}
            onClose={() => setEditOrder(null)}
            onSaved={fetchOrders}
          />
        )}

        <ShipmentTrackingTimeline
          open={!!trackingOrder}
          onClose={() => setTrackingOrder(null)}
          shipmentId={trackingOrder?.shipment_id ?? null}
          silaCode={trackingOrder ? silaCodeOf(trackingOrder.id) : undefined}
          trackingNumber={trackingOrder?.shipments?.tracking_number ?? null}
          courierName={trackingOrder ? courierNameOf(trackingOrder) : null}
        />
      </div>
    </SidebarProvider>
  );
}
