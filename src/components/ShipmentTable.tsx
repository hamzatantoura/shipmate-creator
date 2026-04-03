import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import QRCode from "qrcode";
import type { Database } from "@/integrations/supabase/types";

type Shipment = Database["public"]["Tables"]["shipments"]["Row"];

const CITY_AR: Record<string, string> = {
  Damascus: "دمشق",
  Aleppo: "حلب",
  Homs: "حمص",
  Lattakia: "اللاذقية",
  Hama: "حماة",
  Tartous: "طرطوس",
};

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  in_transit: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغاة",
};

const statusColor = (s: string) => {
  switch (s) {
    case "delivered": return "bg-primary/20 text-primary border-primary/30";
    case "in_transit": return "bg-info/20 text-info border-info/30";
    case "cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
    default: return "bg-warning/20 text-warning border-warning/30";
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
      <div class="header">
        <h1>ShipDash</h1>
        <span>خدمات الشحن والتوصيل</span>
      </div>
      <div class="tracking">
        <p>رقم التتبع</p>
        <h2>${s.tracking_number || '—'}</h2>
      </div>
      <div class="details">
        <div class="row"><span class="lbl">المستلم</span><span class="val">${s.receiver_name}</span></div>
        <div class="row"><span class="lbl">الهاتف</span><span class="val" style="direction:ltr;text-align:right">${s.phone_number}</span></div>
        <div class="row"><span class="lbl">المدينة</span><span class="val">${CITY_AR[s.city] || s.city}</span></div>
        <div class="row"><span class="lbl">العنوان</span><span class="val">${s.detailed_address}</span></div>
      </div>
      <div class="cod-box">
        <span>الدفع عند الاستلام</span>
        <span>${Number(s.cod_amount).toLocaleString()} ل.س</span>
      </div>
      <div class="codes">
        <div class="qr"><img src="${qrDataUrl}" alt="QR" /></div>
        <div class="barcode">
          <div class="barcode-placeholder"></div>
          <span class="barcode-text">${s.tracking_number || ''}</span>
        </div>
      </div>
      <div class="footer">ShipDash © ${new Date().getFullYear()} — هذه البطاقة مولّدة تلقائياً</div>
    </div>
    <script>window.print()</script>
    </body></html>
  `);
  w.document.close();
}

export default function ShipmentTable({ shipments }: { shipments: Shipment[] }) {
  if (!shipments.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        لا توجد شحنات بعد. أنشئ أول شحنة أعلاه.
      </div>
    );
  }

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
            <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-mono text-xs">{s.tracking_number}</TableCell>
              <TableCell>{s.receiver_name}</TableCell>
              <TableCell>{CITY_AR[s.city] || s.city}</TableCell>
              <TableCell>{Number(s.cod_amount).toLocaleString()} ل.س</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusColor(s.status)}>
                  {STATUS_AR[s.status] || s.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => generateLabel(s)}>
                  <Printer className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
