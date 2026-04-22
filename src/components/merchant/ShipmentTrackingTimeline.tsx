import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, User } from "lucide-react";
import { getOrderStatusMeta } from "@/lib/order-status";

interface HistoryEntry {
  id: string;
  shipment_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  shipmentId: string | null;
  silaCode?: string;
  trackingNumber?: string | null;
  courierName?: string | null;
}

const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ar-SY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

/** Resolve `changed_by` to a friendly label.
 *  The column is `text` (system / role / user UUID), so we best-effort
 *  translate common values without doing N+1 lookups.
 */
const resolveActorLabel = (changed_by: string | null): string => {
  if (!changed_by || changed_by === "system") return "النظام";
  const v = changed_by.toLowerCase();
  if (v === "merchant") return "التاجر";
  if (v === "vendor") return "شركة الشحن";
  if (v === "admin") return "الإدارة";
  if (v === "courier") return "المندوب";
  return "تحديث يدوي";
};

export default function ShipmentTrackingTimeline({
  open,
  onClose,
  shipmentId,
  silaCode,
  trackingNumber,
  courierName,
}: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !shipmentId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("shipment_status_history")
        .select("id, shipment_id, old_status, new_status, changed_by, created_at")
        .eq("shipment_id", shipmentId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        setHistory([]);
      } else {
        setHistory((data as HistoryEntry[]) || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, shipmentId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            رحلة الشحنة
          </DialogTitle>
          <DialogDescription className="space-y-1">
            {silaCode && (
              <span className="block">
                كود صِلة:{" "}
                <span className="font-mono text-primary font-semibold" dir="ltr">
                  {silaCode}
                </span>
              </span>
            )}
            {trackingNumber && (
              <span className="block">
                رقم التتبع:{" "}
                <span className="font-mono text-foreground" dir="ltr">
                  {trackingNumber}
                </span>
              </span>
            )}
            {courierName && (
              <span className="block">
                شركة الشحن:{" "}
                <span className="text-foreground font-medium">{courierName}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!shipmentId ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            لم يتم إنشاء شحنة لهذا الطلب بعد.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            جاري تحميل سجل التتبع...
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            لا يوجد سجل حركات بعد لهذه الشحنة.
          </div>
        ) : (
          <ol className="relative border-r-2 border-border pr-6 space-y-5 mt-2">
            {history.map((entry, idx) => {
              const meta = getOrderStatusMeta(entry.new_status);
              const Icon = meta.icon;
              const isLast = idx === history.length - 1;
              return (
                <li key={entry.id} className="relative">
                  <span
                    className={`absolute -right-[34px] top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background shadow-sm ${meta.className}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div
                    className={`rounded-lg border p-3 space-y-1.5 ${
                      isLast ? "bg-card border-primary/30" : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtDate(entry.created_at)}
                      </span>
                    </div>
                    {entry.old_status && (
                      <p className="text-xs text-muted-foreground">
                        من «{getOrderStatusMeta(entry.old_status).label}» إلى «{meta.label}»
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{resolveActorLabel(entry.changed_by)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}