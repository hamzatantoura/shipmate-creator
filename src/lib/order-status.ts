import { Sparkles, Clock, Loader2, Truck, PackageCheck, RotateCcw, XCircle, Bike, type LucideIcon } from "lucide-react";

export type OrderStatusKey =
  | "new"
  | "pending"
  | "processing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "cancelled";

export interface OrderStatusMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes using semantic tokens only. */
  className: string;
}

/**
 * The Sila Standard — single source of truth for status visuals across
 * Merchant / Admin / Vendor portals. Colors must reference semantic tokens
 * defined in index.css (no raw colors).
 */
export const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  new: {
    label: "طلب جديد",
    icon: Sparkles,
    className: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: "قيد الانتظار",
    icon: Clock,
    className: "bg-warning/15 text-warning border-warning/30",
  },
  processing: {
    label: "قيد المعالجة",
    icon: Loader2,
    className: "bg-primary/15 text-primary border-primary/30",
  },
  shipped: {
    label: "مع شركة الشحن",
    icon: Truck,
    className: "bg-info/15 text-info border-info/30",
  },
  out_for_delivery: {
    label: "قيد التوصيل",
    icon: Bike,
    className: "bg-accent/20 text-accent-foreground border-accent",
  },
  delivered: {
    label: "تم التسليم",
    icon: PackageCheck,
    className: "bg-success/15 text-success border-success/30",
  },
  returned: {
    label: "مرتجع",
    icon: RotateCcw,
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  cancelled: {
    label: "ملغي",
    icon: XCircle,
    className: "bg-destructive/25 text-destructive border-destructive/40",
  },
};

export const getOrderStatusMeta = (status: string | null | undefined): OrderStatusMeta =>
  ORDER_STATUS_META[(status || "").toLowerCase()] || {
    label: status || "—",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-border",
  };