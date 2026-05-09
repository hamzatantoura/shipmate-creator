import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, ChevronDown, ChevronUp, Clock, User, Shield, Truck as TruckIcon, PhoneCall, MessageCircle } from "lucide-react";
import { generateShippingLabel } from "@/features/shipments/lib/shipping-label";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

interface AuditLog {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by_role: string | null;
  created_at: string;
}

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق", Aleppo: "حلب", Homs: "حمص",
  Lattakia: "اللاذقية", Hama: "حماة", Tartous: "طرطوس",
};

const STATUS_AR: Record<string, string> = {
  pending: "جديد",
  picked_up: "تم الاستلام من التاجر",
  at_warehouse: "في المستودع",
  in_transit_intercity: "جاري الشحن بين المحافظات",
  with_distributor: "مع مندوب التوزيع",
  out_for_delivery: "جاري التوصيل",
  delivered: "تم التسليم",
  returned: "مرتجع",
  cancelled: "ملغاة",
};

const ROLE_AR: Record<string, string> = {
  merchant: "التاجر",
  vendor: "شركة الشحن",
  admin: "مدير المنصة",
  system: "النظام",
};

const STATUS_ORDER = ["pending", "picked_up", "at_warehouse", "in_transit_intercity", "with_distributor", "out_for_delivery", "delivered"];

const statusColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-primary/20 text-primary border-primary/30";
    case "out_for_delivery":
    case "in_transit_intercity":
    case "with_distributor": return "bg-info/20 text-info border-info/30";
    case "cancelled":
    case "returned": return "bg-destructive/20 text-destructive border-destructive/30";
    case "picked_up":
    case "at_warehouse": return "bg-warning/20 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const roleIcon = (role: string | null) => {
  switch (role) {
    case "merchant": return <User className="h-3 w-3" />;
    case "vendor": return <TruckIcon className="h-3 w-3" />;
    case "admin": return <Shield className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
  }
};

// Label generation moved to src/lib/shipping-label.ts

function ShipmentTimeline({ shipmentId }: { shipmentId: string }) {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    if (logs !== null) { setLogs(null); return; } // toggle
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs" as any)
      .select("*")
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: true }) as { data: AuditLog[] | null };
    setLogs(data || []);
    setLoading(false);
  };

  return (
    <div>
      <button
        onClick={loadLogs}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1"
      >
        <Clock className="h-3 w-3" />
        سجل الحالات
        {logs !== null ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {loading && <p className="text-xs text-muted-foreground py-2">جاري التحميل...</p>}
      {logs !== null && !loading && (
        <div className="mt-2 mr-2 border-r-2 border-primary/20 pr-4 space-y-3 pb-2">
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا يوجد سجل بعد</p>
          ) : logs.map((log) => (
            <div key={log.id} className="relative">
              <div className="absolute -right-[1.3rem] top-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor(log.new_status)}`}>
                  {STATUS_AR[log.new_status] || log.new_status}
                </Badge>
                {log.old_status && (
                  <span className="text-[10px] text-muted-foreground">
                    من: {STATUS_AR[log.old_status] || log.old_status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                {roleIcon(log.changed_by_role)}
                <span>{ROLE_AR[log.changed_by_role || "system"] || log.changed_by_role}</span>
                <span>•</span>
                <span>{new Date(log.created_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShipmentTable({ shipments }: { shipments: Shipment[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!shipments.length) {
    return <div className="text-center py-12 text-muted-foreground">لا توجد شحنات بعد. أنشئ أول شحنة أعلاه.</div>;
  }

  // Determine if a shipment is locked (past pickup)
  const LOCKED_STATUSES = new Set(["at_warehouse", "in_transit_intercity", "with_distributor", "out_for_delivery", "delivered", "returned"]);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>رقم التتبع</TableHead>
            <TableHead>المستلم</TableHead>
            <TableHead>المدينة</TableHead>
            <TableHead>المبلغ</TableHead>
             <TableHead>الحالة</TableHead>
             <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((s) => (
            <>
              <TableRow
                key={s.id}
                className={`hover:bg-muted/30 transition-colors cursor-pointer ${expandedId === s.id ? 'bg-muted/20' : ''}`}
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <TableCell className="font-mono text-xs">{s.tracking_number}</TableCell>
                <TableCell>{s.receiver_name}</TableCell>
                <TableCell>{CITY_AR[s.city] || s.city}</TableCell>
                <TableCell>{Number(s.cod_amount).toLocaleString()} ل.س</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={statusColor(s.status)}>
                      {STATUS_AR[s.status] || s.status}
                    </Badge>
                    {LOCKED_STATUSES.has(s.status) && (
                      <span className="text-[10px] text-muted-foreground" title="مقفل — لا يمكن التعديل">🔒</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); window.open(`tel:${s.phone_number}`); }}>
                      <PhoneCall className="h-3.5 w-3.5 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {
                      e.stopPropagation();
                      const phone = s.phone_number.replace(/[\s-]/g, "").replace(/^0/, "963");
                      window.open(`https://wa.me/${phone}`, "_blank");
                    }}>
                      <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); generateShippingLabel(s); }}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedId === s.id && (
                <TableRow key={`${s.id}-timeline`}>
                  <TableCell colSpan={6} className="bg-muted/10 px-6 py-3">
                    {/* Progress bar */}
                    <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
                      {STATUS_ORDER.map((status, i) => {
                        const currentIdx = STATUS_ORDER.indexOf(s.status);
                        const isReturned = s.status === "returned";
                        const isActive = !isReturned && i <= currentIdx;
                        const isCurrent = s.status === status;
                        return (
                          <div key={status} className="flex items-center gap-1">
                            <div className={`flex flex-col items-center`}>
                              <div className={`h-3 w-3 rounded-full border-2 ${
                                isCurrent ? 'bg-primary border-primary scale-125' :
                                isActive ? 'bg-primary/60 border-primary/60' :
                                'bg-muted border-border'
                              }`} />
                              <span className={`text-[9px] mt-1 whitespace-nowrap ${isCurrent ? 'text-primary font-bold' : isActive ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                                {STATUS_AR[status]}
                              </span>
                            </div>
                            {i < STATUS_ORDER.length - 1 && (
                              <div className={`h-0.5 w-6 ${isActive && i < currentIdx ? 'bg-primary/60' : 'bg-border'}`} />
                            )}
                          </div>
                        );
                      })}
                      {s.status === "returned" && (
                        <div className="flex items-center gap-1 mr-2">
                          <div className="h-0.5 w-4 bg-destructive/40" />
                          <div className="flex flex-col items-center">
                            <div className="h-3 w-3 rounded-full bg-destructive border-2 border-destructive scale-125" />
                            <span className="text-[9px] mt-1 text-destructive font-bold">مرتجع</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <ShipmentTimeline shipmentId={s.id} />
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
