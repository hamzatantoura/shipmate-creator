import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, ChevronDown, ChevronUp, Clock, User, Shield, Truck as TruckIcon } from "lucide-react";
import QRCode from "qrcode";
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

async function generateLabel(s: Shipment) {
  const qrDataUrl = await QRCode.toDataURL(s.tracking_number || s.id, { width: 120, margin: 1 });
  const w = window.open("", "_blank", "width=450,height=650");
  if (!w) return;
  w.document.write(`
    <html dir="rtl"><head><title>بطاقة شحن - ${s.tracking_number}</title>
    <style>
      @page { size: 105mm 148mm; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Tahoma, sans-serif; width: 105mm; min-height: 148mm; padding: 6mm; background: #fff; color: #000; }
      .label { border: 2.5px solid #000; height: 100%; display: flex; flex-direction: column; }
      .header { background: #111; color: #fff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
      .header h1 { font-size: 18px; font-weight: 800; letter-spacing: 1px; }
      .header span { font-size: 10px; opacity: 0.7; }
      .tracking { background: #f5f5f5; padding: 8px 12px; text-align: center; border-bottom: 2px dashed #000; }
      .tracking p { font-size: 9px; color: #666; margin-bottom: 2px; }
      .tracking h2 { font-size: 18px; font-weight: 900; letter-spacing: 3px; font-family: monospace; }
      .details { padding: 10px 12px; flex: 1; }
      .row { display: flex; border-bottom: 1px solid #ddd; padding: 5px 0; }
      .row:last-child { border-bottom: none; }
      .row .lbl { font-size: 10px; color: #666; min-width: 70px; font-weight: 600; }
      .row .val { font-size: 12px; font-weight: 700; }
      .cod-box { background: #111; color: #fff; margin: 6px 12px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 800; }
      .codes { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-top: 2px dashed #000; }
      .codes .qr img { width: 80px; height: 80px; }
      .codes .barcode { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .barcode-placeholder { width: 140px; height: 40px; border: 1.5px solid #000; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #999; margin-bottom: 2px; background: repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 5px, #fff 5px, #fff 9px); background-size: 9px 100%; }
      .barcode-text { font-size: 8px; font-family: monospace; color: #333; }
      .footer { text-align: center; font-size: 7px; color: #aaa; padding: 4px; border-top: 1px solid #eee; }
    </style></head><body>
    <div class="label">
      <div class="header"><h1>Sila — صلة</h1><span>خدمات الشحن والتوصيل</span></div>
      <div class="tracking"><p>رقم التتبع</p><h2>${s.tracking_number || '—'}</h2></div>
      <div class="details">
        <div class="row"><span class="lbl">المستلم</span><span class="val">${s.receiver_name}</span></div>
        <div class="row"><span class="lbl">الهاتف</span><span class="val" style="direction:ltr;text-align:right">${s.phone_number}</span></div>
        <div class="row"><span class="lbl">المدينة</span><span class="val">${CITY_AR[s.city] || s.city}</span></div>
        <div class="row"><span class="lbl">العنوان</span><span class="val">${s.detailed_address}</span></div>
      </div>
      <div class="cod-box"><span>الدفع عند الاستلام</span><span>${Number(s.cod_amount).toLocaleString()} ل.س</span></div>
      <div class="codes">
        <div class="qr"><img src="${qrDataUrl}" alt="QR" /></div>
        <div class="barcode"><div class="barcode-placeholder"></div><span class="barcode-text">${s.tracking_number || ''}</span></div>
      </div>
      <div class="footer">Sila © ${new Date().getFullYear()} — هذه البطاقة مولّدة تلقائياً</div>
    </div>
    <script>window.print()</script>
    </body></html>
  `);
  w.document.close();
}

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
            <TableHead>بطاقة</TableHead>
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
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); generateLabel(s); }}>
                    <Printer className="h-4 w-4" />
                  </Button>
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
