import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Plus, Printer, Trash2, Package, Lock, Info, Send, Radar, MapPin, Building2, ChevronDown, ChevronRight, ChevronLeft, X, FileCheck2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import silaLogo from "@/assets/sila-logo.png";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { printShippingLabel } from "@/lib/print-label";
import { printBulkLabels, type BulkLabelData } from "@/lib/print-bulk";
import { calculatePricing } from "@/lib/pricing-engine";
import EditOrderDialog from "@/components/merchant/EditOrderDialog";
import ShipmentTrackingTimeline from "@/components/merchant/ShipmentTrackingTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrderStatusMeta } from "@/lib/order-status";
import { isOrderLocked } from "@/lib/order-locking";
import { partitionOrdersForPrinting, validateOrderForPrinting } from "@/lib/print-validation";

type OrderStatus = "new" | "processing" | "shipped" | "out_for_delivery" | "delivered" | "returned" | "cancelled";

interface OrderRow {
  id: string;
  receiver_name: string;
  phone_number: string;
  city: string;
  detailed_address: string;
  district_id: string | null;
  courier_id: string | null;
  assigned_branch_id: string | null;
  status: string;
  total_amount: number;
  final_sale_price: number | null;
  shipment_id: string | null;
  created_at: string;
  label_printed_at: string | null;
  notes: string | null;
  return_reason: string | null;
  courier?: { name: string; logo_url: string | null } | null;
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
  logo_url?: string | null;
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
// Builds the globally-unique tracking number stored in shipments.tracking_number.
// Format: SL-XXXXXX-YYYY (14 chars total)
//   - XXXXXX: first 6 chars of the order UUID (uppercase) — keeps it tied to the order
//   - YYYY:   4 random uppercase alphanumeric chars — eliminates collisions on the
//             UNIQUE constraint that previously caused "duplicate key" failures
//             when the 6-char prefix repeated across re-created shipments.
// silaCodeOf() (the 9-char SL-XXXXXX form) is intentionally kept for UI display only.
const buildTrackingNumber = (orderId: string): string => {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${silaCodeOf(orderId)}-${suffix}`;
};
const isLocked = (o: OrderRow) => isOrderLocked(o).isEditLocked || isOrderLocked(o).isCancelLocked;

// Map an Arabic/English province label to the shipment_city enum value used
// by public.shipments.city. Mirrors the SQL helper map_order_city_to_shipment.
const mapCityToShipmentEnum = (
  city: string | null | undefined,
): "Damascus" | "Aleppo" | "Homs" | "Hama" | "Lattakia" | "Tartous" => {
  const c = (city || "").toLowerCase();
  if (c.includes("دمشق") || c.includes("damascus")) return "Damascus";
  if (c.includes("حلب") || c.includes("aleppo")) return "Aleppo";
  if (c.includes("حمص") || c.includes("homs")) return "Homs";
  if (c.includes("حماة") || c.includes("حماه") || c.includes("hama")) return "Hama";
  if (c.includes("لاذقية") || c.includes("اللاذقية") || c.includes("lattakia") || c.includes("latakia")) return "Lattakia";
  if (c.includes("طرطوس") || c.includes("tartous") || c.includes("tartus")) return "Tartous";
  return "Damascus";
};

// Create a shipment row for an order at the moment the merchant prints the
// waybill (Option A: shipments are created lazily, only on label print —
// not at order creation time). Returns the new shipment id and tracking number.
const createShipmentForOrder = async (
  order: OrderRow,
  merchantId: string,
  deliveryFee: number,
) => {
  const tracking = buildTrackingNumber(order.id);
  const cod = Number(order.final_sale_price ?? order.total_amount ?? 0);
  const fee = Number(deliveryFee || 0);
  const { data, error } = await supabase
    .from("shipments")
    .insert({
      order_id: order.id,
      merchant_id: merchantId,
      courier_id: order.courier_id,
      receiver_name: order.receiver_name,
      phone_number: order.phone_number,
      city: mapCityToShipmentEnum(order.city) as any,
      detailed_address: order.detailed_address,
      cod_amount: cod,
      collection_fee: fee,
      shipping_fee: fee,
      tracking_number: tracking,
      status: "pending",
    } as any)
    .select("id, tracking_number")
    .single();
  if (error || !data) throw new Error(error?.message || "تعذر إنشاء الشحنة");
  return { shipmentId: (data as any).id as string, trackingNumber: (data as any).tracking_number as string | null };
};

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
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
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
      supabase.from("couriers_public" as any).select("id, name, logo_url").eq("is_active", true).order("name"),
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
    staleTime: 60_000,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("orders")
        .select(
          "id, receiver_name, phone_number, city, detailed_address, district_id, courier_id, assigned_branch_id, status, total_amount, final_sale_price, shipment_id, created_at, label_printed_at, notes, return_reason, courier:couriers_public!orders_courier_id_fkey(name, logo_url), shipments!orders_shipment_id_fkey(tracking_number), districts(name)",
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

  const patchOrderInCache = useCallback((orderId: string, patch: Partial<OrderRow>) => {
    queryClient.setQueriesData<{ rows: OrderRow[]; total: number } | undefined>(
      { queryKey: ["merchant-orders", user?.id] },
      (old) => {
        if (!old) return old;
        let changed = false;
        const rows = old.rows.map((row) => {
          if (row.id !== orderId) return row;
          changed = true;
          return { ...row, ...patch };
        });
        return changed ? { ...old, rows } : old;
      },
    );
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`merchant-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `merchant_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as Partial<OrderRow> & { id?: string };
          if (!next.id) return;
          patchOrderInCache(next.id, {
            status: next.status,
            shipment_id: next.shipment_id,
            label_printed_at: next.label_printed_at,
            return_reason: next.return_reason,
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patchOrderInCache, user?.id]);

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
    // Pre-print validation: filter out invalid orders, surface clear toasts.
    const { printable, blocked } = partitionOrdersForPrinting(selectedOrders);
    if (blocked.length) {
      const sample = blocked[0];
      const name = sample.order.receiver_name || silaCodeOf((sample.order as OrderRow).id);
      toast.error(
        blocked.length === 1
          ? `لا يمكن طباعة "${name}": ${sample.error}`
          : `تعذّر طباعة ${blocked.length} طلب — الأول (${name}): ${sample.error}`,
      );
    }
    if (!printable.length) return;
    const printableOrders = printable as OrderRow[];

    // Option A: lazily create a shipment for any printable order that doesn't
    // have one yet. Track new shipment ids/tracking numbers per order.
    const newShipmentByOrder: Record<string, { id: string; tracking: string | null }> = {};
    if (user?.id) {
      for (const o of printableOrders) {
        if (o.shipment_id) continue;
        try {
          const provinceForFee = allDistricts.find((d) => d.id === o.district_id);
          const districtIdForFee = provinceForFee?.parent_id ? o.district_id : null;
          const provinceIdForFee = provinceForFee?.parent_id ? provinceForFee.parent_id : o.district_id;
          const fee = resolveDeliveryFee(districtIdForFee, provinceIdForFee, o.courier_id);
          const created = await createShipmentForOrder(o, user.id, fee);
          newShipmentByOrder[o.id] = { id: created.shipmentId, tracking: created.trackingNumber };
        } catch (e: any) {
          toast.error(`تعذر إنشاء شحنة لطلب ${o.receiver_name}: ${e?.message || ""}`);
          return;
        }
      }
    }

    const labels: BulkLabelData[] = printableOrders.map((order) => {
      const matched = allDistricts.find((d) => d.id === order.district_id);
      const districtName = matched?.parent_id ? matched.name : null;
      const branch = order.assigned_branch_id
        ? branches.find((b) => b.id === order.assigned_branch_id) ?? null
        : null;
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
        courierLogoUrl: courierLogoOf(order),
        trackingNumber:
          newShipmentByOrder[order.id]?.tracking ??
          order.shipments?.tracking_number ??
          null,
        branchName: branch?.name ?? null,
        branchAddress: null,
      };
    });
    try {
      printBulkLabels(labels);
    } catch (e: any) {
      toast.error(e?.message || "تعذر فتح نافذة الطباعة");
      return;
    }
    // Lock unprinted orders through the backend state-machine so shipment/order
    // linking, status sync, and edit-lock happen atomically.
    const toLock = printableOrders.filter((o) => !o.label_printed_at);
    if (toLock.length) {
      const updates = toLock.map((o) => {
        const newSh = newShipmentByOrder[o.id];
        return (supabase.rpc as any)("lock_order_after_label_print", {
          p_order_id: o.id,
          p_shipment_id: newSh?.id ?? o.shipment_id ?? null,
        });
      });
      const results = await Promise.all(updates);
      const nowIso = new Date().toISOString();
      results.forEach((r, index) => {
        if (r.error) return;
        const order = toLock[index];
        const newSh = newShipmentByOrder[order.id];
        patchOrderInCache(order.id, {
          label_printed_at: (r.data as OrderRow | null)?.label_printed_at ?? nowIso,
          status: "processing",
          shipment_id: (r.data as OrderRow | null)?.shipment_id ?? newSh?.id ?? order.shipment_id,
          shipments: {
            tracking_number: newSh?.tracking ?? order.shipments?.tracking_number ?? null,
          },
        });
      });
      const failed = results.filter((r) => r.error).length;
      if (failed) toast.error(`تعذّر قفل ${failed} طلب`);
      else toast.success(`تم اعتماد وطباعة ${printableOrders.length} بوليصة`);
      fetchOrders();
    } else {
      toast.success(`إعادة طباعة ${printableOrders.length} بوليصة`);
    }
    clearSelection();
  };

  // Cancel/delete an order — only allowed BEFORE the waybill is printed
  // and BEFORE a shipment exists (i.e. before handing it to the courier).
  // We use soft-delete (deleted_at + status='cancelled') so audit history
  // and any wallet ledger references stay intact.
  const handleCancelOrder = async () => {
    if (!cancelOrderId) return;
    const target = orders.find((o) => o.id === cancelOrderId);
    if (!target) {
      setCancelOrderId(null);
      return;
    }
    const targetLocks = isOrderLocked(target);
    if (targetLocks.isCancelLocked) {
      toast.error("لا يمكن إلغاء هذا الطلب — تم تسليمه إلى شركة الشحن أو طُبعت بوليصته.");
      setCancelOrderId(null);
      return;
    }
    setCancelling(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        deleted_at: new Date().toISOString(),
      } as any)
      .eq("id", cancelOrderId);
    setCancelling(false);
    if (error) {
      toast.error(error.message || "تعذّر إلغاء الطلب");
      return;
    }
    toast.success("تم إلغاء الطلب بنجاح");
    setCancelOrderId(null);
    setSelectedIds((prev) => prev.filter((id) => id !== cancelOrderId));
    fetchOrders();
  };

  // Resolve courier name: prefer local couriers map (RLS-safe via couriers_public),
  // fallback to joined relation when present.
  const courierNameOf = (order: OrderRow | null, courierId?: string | null) => {
    const id = courierId ?? order?.courier_id ?? null;
    const local = id ? couriers.find(c => c.id === id)?.name : null;
    if (local) return local;
    return order?.courier?.name ?? order?.couriers?.name ?? null;
  };
  const courierLogoOf = (order: OrderRow | null, courierId?: string | null) => {
    const id = courierId ?? order?.courier_id ?? null;
    const local = id ? couriers.find(c => c.id === id)?.logo_url ?? null : null;
    if (local) return local;
    return order?.courier?.logo_url ?? order?.couriers?.logo_url ?? null;
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

  const handleCreate = async (asDraft = false) => {
    if (!user) { toast.error("يجب تسجيل الدخول"); return; }
    if (asDraft) {
      // Bare-minimum validation for drafts: at least a receiver name OR phone
      if (!form.name && !form.phone) {
        toast.error("أدخل اسم المستلم أو رقم الهاتف على الأقل");
        return;
      }
    } else {
      if (!form.name || !form.phone || !form.provinceId) {
        toast.error("يرجى تعبئة الحقول المطلوبة");
        return;
      }
      if (!isValidSyrianPhone(form.phone)) {
        toast.error("رقم سوري غير صحيح. مثال: 0933123456");
        return;
      }
    }
    const prov = provinces.find(p => p.id === form.provinceId);
    const area = allDistricts.find(d => d.id === form.districtId);
    const finalDistrictId = area?.id || prov?.id || null;
    const cityLabel = prov?.name || "";
    const cod = Number(form.cod) || 0;
    const deliveryFee = resolveDeliveryFee(area?.id || null, prov?.id || null, form.courierId || null);

    // ===== Platform Financial Rule: COD must cover delivery fee + 50% margin =====
    // Drafts are excluded since merchants may still be filling in pricing.
    if (!asDraft && deliveryFee > 0 && cod < deliveryFee * 1.5) {
      toast.error(
        "عذراً، يجب أن يكون المبلغ المراد تحصيله أكبر من قيمة الشحن بـ 50% على الأقل لتغطية التكاليف."
      );
      return;
    }

    const picked = smartCouriers.find((s) => s.courier_id === form.courierId);
    // Prefer the branch the merchant explicitly selected; otherwise default to nearest.
    const assignedBranchId = form.branchId || picked?.nearest_branch_id || null;

    // ===== Optimistic Update Pattern =====
    // 1) Build a temporary order row that mirrors the shape returned by the
    //    paginated SELECT (columns + joined relations) so the UI renders
    //    correctly with no missing fields.
    const tempId = `temp-${crypto.randomUUID()}`;
    const matchedCourier = couriers.find((c) => c.id === form.courierId) || null;
    const courierLogo =
      smartCouriers.find((s) => s.courier_id === form.courierId)?.logo_url ?? null;
    const optimisticOrder: OrderRow = {
      id: tempId,
      receiver_name: form.name || "—",
      phone_number: form.phone || "",
      city: cityLabel,
      detailed_address: form.address || "",
      district_id: finalDistrictId,
      courier_id: form.courierId || null,
      assigned_branch_id: assignedBranchId ?? null,
      status: asDraft ? "draft" : "new",
      total_amount: cod,
      final_sale_price: null,
      shipment_id: null,
      created_at: new Date().toISOString(),
      label_printed_at: null,
      notes: null,
      return_reason: null,
      courier: matchedCourier
        ? { name: matchedCourier.name, logo_url: courierLogo }
        : null,
      couriers: matchedCourier
        ? { name: matchedCourier.name, logo_url: courierLogo }
        : null,
      shipments: null,
    };

    // 2) Snapshot the cache for this user (all pages) so we can rollback
    //    on failure. We also force the user back to page 0 so the new row
    //    is visible at the top.
    const userKey = ["merchant-orders", user.id] as const;
    const targetKey = ["merchant-orders", user.id, 0] as const;
    const previousSnapshots = queryClient.getQueriesData<{
      rows: OrderRow[];
      total: number;
    }>({ queryKey: userKey });

    setPage(0);
    queryClient.setQueryData<{ rows: OrderRow[]; total: number } | undefined>(
      targetKey,
      (old) => {
        const prevRows = old?.rows ?? [];
        const prevTotal = old?.total ?? 0;
        // Prepend optimistic row, keep page size at PAGE_SIZE
        const nextRows = [optimisticOrder, ...prevRows].slice(0, PAGE_SIZE);
        return { rows: nextRows, total: prevTotal + 1 };
      },
    );

    // 3) Close the dialog & reset form immediately for snappy UX.
    setSubmitting(true);
    resetForm();
    setCreateOpen(false);

    // 4) Persist to DB. On failure, rollback every cached page we touched.
    const { data: inserted, error } = await supabase
      .from("orders")
      .insert({
        merchant_id: user.id,
        receiver_name: form.name || "—",
        phone_number: form.phone || "",
        city: cityLabel,
        detailed_address: form.address || "",
        district_id: finalDistrictId,
        courier_id: form.courierId || null,
        assigned_branch_id: assignedBranchId,
        total_amount: cod,
        delivery_fee: deliveryFee,
        status: asDraft ? "draft" : "new",
      } as any)
      .select("id")
      .single();
    setSubmitting(false);

    if (error || !inserted) {
      // Rollback: restore every snapshot we captured.
      previousSnapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(error?.message || "تعذر إنشاء الطلب");
      return;
    }

    // 5) Swap the temp id for the real id on the cached row so subsequent
    //    actions (edit/print/select) operate on the real record. This avoids
    //    a UI flicker that a full refetch would cause.
    queryClient.setQueryData<{ rows: OrderRow[]; total: number } | undefined>(
      targetKey,
      (old) => {
        if (!old) return old;
        return {
          ...old,
          rows: old.rows.map((r) =>
            r.id === tempId ? { ...r, id: (inserted as any).id } : r,
          ),
        };
      },
    );

    toast.success(asDraft ? "تم حفظ المسودة" : "تم إنشاء الطلب");

    // 6) Background sync: invalidate so other pages (and joined data like
    //    districts(name)) reconcile silently. `refetchType: 'active'` keeps
    //    inactive pages cheap until the user navigates to them.
    queryClient.invalidateQueries({ queryKey: userKey, refetchType: "active" });
  };

  const confirmPrint = async () => {
    if (!printConfirmId) return;
    const order = orders.find(o => o.id === printConfirmId);
    if (!order) return;

    // Pre-print validation (mirrors the server-side trigger).
    const validation = validateOrderForPrinting(order);
    if (!validation.ok) {
      toast.error(validation.error || "الطلب غير صالح للطباعة");
      setPrintConfirmId(null);
      return;
    }

    // Resolve area/neighborhood name from districts table.
    // If district_id points to a child (has parent_id) → it's the area name.
    // If it points to a parent (province-level) → no specific area to print.
    const matched = allDistricts.find(d => d.id === order.district_id);
    const districtName = matched?.parent_id ? matched.name : null;
    const branch = order.assigned_branch_id
      ? branches.find((b) => b.id === order.assigned_branch_id) ?? null
      : null;

    // Option A: create the shipment NOW (at label-print time) if it doesn't
    // already exist. This is the moment the order physically transitions
    // from "merchant intent" to "courier liability".
    let shipmentTracking: string | null = order.shipments?.tracking_number ?? null;
    let newShipmentId: string | null = null;
    if (!order.shipment_id && user?.id) {
      try {
        const provinceForFee = allDistricts.find((d) => d.id === order.district_id);
        const districtIdForFee = provinceForFee?.parent_id ? order.district_id : null;
        const provinceIdForFee = provinceForFee?.parent_id ? provinceForFee.parent_id : order.district_id;
        const fee = resolveDeliveryFee(districtIdForFee, provinceIdForFee, order.courier_id);
        const created = await createShipmentForOrder(order, user.id, fee);
        newShipmentId = created.shipmentId;
        shipmentTracking = created.trackingNumber;
      } catch (e: any) {
        toast.error(e?.message || "تعذر إنشاء الشحنة");
        return;
      }
    }

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
        courierLogoUrl: courierLogoOf(order),
        trackingNumber: shipmentTracking,
        branchName: branch?.name ?? null,
        branchAddress: null,
      });
    } catch (e: any) {
      toast.error(e?.message || "تعذر فتح نافذة الطباعة");
      return;
    }

    // Lock the order in DB only if not already locked, using the backend
    // state-machine instead of a direct PATCH that the lock trigger blocks.
    if (!order.label_printed_at) {
      const { data, error } = await (supabase.rpc as any)("lock_order_after_label_print", {
        p_order_id: printConfirmId,
        p_shipment_id: newShipmentId ?? order.shipment_id ?? null,
      });
      if (error) {
        toast.error(error.message || "تم فتح البوليصة لكن تعذر قفل الطلب");
      } else {
        const lockedOrder = data as OrderRow | null;
        patchOrderInCache(order.id, {
          label_printed_at: lockedOrder?.label_printed_at ?? new Date().toISOString(),
          status: "processing",
          shipment_id: lockedOrder?.shipment_id ?? newShipmentId ?? order.shipment_id,
          shipments: {
            tracking_number: shipmentTracking ?? order.shipments?.tracking_number ?? null,
          },
        });
        toast.success("تم اعتماد الطلب وقفله للتعديل");
      }
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
                                    <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                                      <span aria-hidden className="mt-0.5">⚠️</span>
                                      <span>
                                        هذه المنطقة لا تحتوي على إحداثيات دقيقة بعد، لذلك يتم عرض شركات الشحن المتاحة في المحافظة <strong>بدون ميزة ترتيب الأقرب</strong>. يمكن للإدارة ضبط الإحداثيات لاحقاً لتفعيل الترتيب الذكي.
                                      </span>
                                    </div>
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

                  <DialogFooter className="gap-2 flex-wrap sm:flex-nowrap">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleCreate(true)}
                      disabled={submitting}
                    >
                      {submitting ? "جاري الحفظ..." : "حفظ كمسودة"}
                    </Button>
                    <Button onClick={() => handleCreate(false)} disabled={submitting}>
                      {submitting ? "جاري الحفظ..." : "تأكيد الطلب"}
                    </Button>
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
                    {loading &&
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={8} className="py-3">
                            <Skeleton className="h-9 w-full" />
                          </TableCell>
                        </TableRow>
                      ))}
                    {!loading && orders.map((order) => {
                      const meta = getOrderStatusMeta(order.status);
                      const StatusIcon = meta.icon;
                      const locks = isOrderLocked(order);
                      const locked = locks.isEditLocked || locks.isCancelLocked;
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
                            {order.label_printed_at && (
                              <div className="mt-1">
                                <Badge variant="outline" className="gap-1 text-[10px] bg-success/10 text-success border-success/30">
                                  <FileCheck2 className="h-3 w-3" />
                                  بوليصة مطبوعة
                                </Badge>
                              </div>
                            )}
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
                              {locks.isEditLocked ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button size="sm" variant="ghost" disabled className="gap-1">
                                          تعديل
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">لا يمكن التعديل بعد طباعة البوليصة</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditOrder(order)}
                                  className="gap-1"
                                >
                                  تعديل
                                </Button>
                              )}
                              {!locks.isCancelLocked && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setCancelOrderId(order.id)}
                                  className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="إلغاء الطلب"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  إلغاء
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
                          <div className="flex flex-col items-center gap-3 py-6">
                            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                              <Package className="h-7 w-7 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">لا توجد طلبات بعد</p>
                              <p className="text-xs text-muted-foreground">ابدأ بإضافة أول طلب لزبونك من زر "إضافة طلب جديد" بالأعلى</p>
                            </div>
                            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2 mt-1">
                              <Plus className="h-4 w-4" />
                              إضافة طلب جديد
                            </Button>
                          </div>
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

        {/* Cancel order confirmation */}
        <AlertDialog open={!!cancelOrderId} onOpenChange={(o) => !o && !cancelling && setCancelOrderId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <X className="h-5 w-5 text-destructive" />
                إلغاء الطلب؟
              </AlertDialogTitle>
              <AlertDialogDescription>
                سيتم إلغاء هذا الطلب نهائياً وإزالته من قائمة الطلبات النشطة.
                لا يمكن التراجع عن هذا الإجراء. هذا متاح فقط للطلبات التي لم يتم
                طباعة بوليصتها أو تسليمها لشركة الشحن.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={cancelling}>تراجع</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleCancelOrder(); }}
                disabled={cancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelling ? "جاري الإلغاء..." : "نعم، ألغِ الطلب"}
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
