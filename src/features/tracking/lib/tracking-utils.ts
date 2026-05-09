import type { LucideIcon } from "lucide-react";
import {
  PackagePlus, PackageCheck, Warehouse, Bike, CheckCircle2, RotateCcw,
} from "lucide-react";

export const STATUS_AR: Record<string, string> = {
  new: "جديد",
  pending: "قيد الانتظار",
  picked_up: "تم الاستلام من التاجر",
  processing: "قيد المعالجة",
  assigned: "تم تعيين مندوب",
  pending_pickup: "بانتظار الاستلام",
  at_warehouse: "في المستودع",
  in_transit_intercity: "جاري الشحن بين المحافظات",
  with_distributor: "مع مندوب التوزيع",
  out_for_delivery: "خرج للتوصيل",
  in_transit: "قيد التوصيل",
  delivered: "تم التسليم ✓",
  returned: "مرتجع",
  cancelled: "ملغاة",
  failed: "فشل التسليم",
};

export const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

export const statusColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-primary/20 text-primary border-primary/30";
    case "returned": case "failed": case "cancelled":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "out_for_delivery": case "assigned": case "in_transit":
    case "in_transit_intercity": case "with_distributor":
      return "bg-info/20 text-info border-info/30";
    default: return "bg-warning/20 text-warning border-warning/30";
  }
};

export interface StatusLog {
  id: string;
  new_status: string;
  old_status: string | null;
  created_at: string;
  changed_by_role?: string | null;
}

export interface Milestone {
  key: string;
  label: string;
  icon: LucideIcon;
  matches: string[];
}

export const JOURNEY: Milestone[] = [
  { key: "created", label: "تم إنشاء الطلب", icon: PackagePlus, matches: ["pending", "new"] },
  { key: "picked_up", label: "تم الاستلام من التاجر", icon: PackageCheck, matches: ["picked_up", "processing"] },
  { key: "in_transit", label: "قيد الشحن", icon: Warehouse, matches: ["at_warehouse", "in_transit_intercity", "shipped"] },
  { key: "out_for_delivery", label: "خرج للتوصيل", icon: Bike, matches: ["with_distributor", "out_for_delivery", "in_transit"] },
  { key: "completed", label: "تم التسليم", icon: CheckCircle2, matches: ["delivered"] },
];

export const RETURNED_MILESTONE: Milestone = {
  key: "returned", label: "مرتجع", icon: RotateCcw, matches: ["returned", "failed", "cancelled"],
};

export interface TimelineStep extends Milestone {
  reachedAt: string | null;
  state: "complete" | "current" | "pending" | "failed";
}

export function buildTimeline(
  currentStatus: string,
  history: StatusLog[],
  createdAt: string | null,
): TimelineStep[] {
  const sorted = [...history].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const findMatch = (m: Milestone) =>
    sorted.find((h) => m.matches.includes(h.new_status))?.created_at ?? null;

  const isReturned = RETURNED_MILESTONE.matches.includes(currentStatus);

  const steps: TimelineStep[] = JOURNEY.map((m, i) => {
    const reachedAt = findMatch(m) ?? (i === 0 ? createdAt : null);
    return { ...m, reachedAt, state: reachedAt ? "complete" : "pending" };
  });

  const lastCompleteIdx = steps.reduce((acc, s, i) => (s.state === "complete" ? i : acc), -1);
  if (lastCompleteIdx >= 0 && lastCompleteIdx < steps.length - 1 && !isReturned) {
    const next = lastCompleteIdx + 1;
    if (steps[next] && steps[next].state === "pending") steps[next].state = "current";
  }

  if (isReturned) {
    const failedAt = sorted.find((h) => RETURNED_MILESTONE.matches.includes(h.new_status))?.created_at ?? null;
    steps.push({ ...RETURNED_MILESTONE, reachedAt: failedAt, state: failedAt ? "failed" : "pending" });
  }

  return steps;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("ar-SY")} • ${d.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Heuristic ETA based on current status & last update. Returns null if delivered/returned. */
export function computeEta(status: string, lastUpdate: string | null): {
  label: string;
  hint: string;
  done: boolean;
} | null {
  if (status === "delivered") return { label: "تم التسليم", hint: "وصلت الشحنة بنجاح", done: true };
  if (["returned", "cancelled", "failed"].includes(status)) return null;

  const baseHours: Record<string, number> = {
    new: 48, pending: 48,
    processing: 36, picked_up: 36, assigned: 24, pending_pickup: 36,
    at_warehouse: 24, in_transit_intercity: 12,
    with_distributor: 4, out_for_delivery: 2, in_transit: 4,
  };
  const hrs = baseHours[status] ?? 24;
  const base = lastUpdate ? new Date(lastUpdate) : new Date();
  const eta = new Date(base.getTime() + hrs * 3600 * 1000);
  const day = eta.toLocaleDateString("ar-SY", { weekday: "long", day: "numeric", month: "long" });
  const time = eta.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" });
  const hintText = hrs <= 4 ? "خلال ساعات قليلة" : hrs <= 24 ? "خلال 24 ساعة" : `خلال ${Math.round(hrs / 24)} أيام تقريباً`;
  return { label: `${day} • ${time}`, hint: `الوصول المتوقع ${hintText}`, done: false };
}

export const IN_TRANSIT_STATUSES = new Set([
  "assigned", "picked_up", "processing", "at_warehouse",
  "in_transit_intercity", "with_distributor", "out_for_delivery", "in_transit",
]);