import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
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

function generateLabel(s: Shipment) {
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  w.document.write(`
    <html dir="rtl"><head><title>بطاقة الشحن</title>
    <style>
      body{font-family:sans-serif;padding:24px;background:#fff;color:#000}
      .box{border:2px solid #000;padding:16px;margin-bottom:12px}
      h2{margin:0 0 8px}
      .track{font-size:20px;font-weight:bold;letter-spacing:2px}
    </style></head><body>
    <div class="box">
      <h2>بطاقة الشحن</h2>
      <p class="track">${s.tracking_number}</p>
    </div>
    <div class="box">
      <strong>إلى:</strong> ${s.receiver_name}<br/>
      <strong>الهاتف:</strong> ${s.phone_number}<br/>
      <strong>المدينة:</strong> ${CITY_AR[s.city] || s.city}<br/>
      <strong>العنوان:</strong> ${s.detailed_address}
    </div>
    <div class="box">
      <strong>الدفع عند الاستلام:</strong> ${Number(s.cod_amount).toLocaleString()} ل.س
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
