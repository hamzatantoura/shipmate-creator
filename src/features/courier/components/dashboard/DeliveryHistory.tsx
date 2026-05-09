import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOrderStatusMeta } from "@/features/shipments/lib/order-status";
import { fmtSYP, silaCodeOf, type CourierShipmentRow } from "./types";

const relTime = (iso: string) => {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.round(diff / 60000);
  if (m < 60) return `${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} س`;
  return `${Math.round(h / 24)} ي`;
};

interface Props { rows: CourierShipmentRow[]; }

export function DeliveryHistory({ rows }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">سجل التوصيلات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">لا يوجد سجل بعد</div>
        )}
        {rows.slice(0, 6).map((r) => {
          const meta = getOrderStatusMeta(r.status);
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 p-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${meta.className} text-[10px] gap-1 px-1.5 py-0`}>
                    <meta.icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">منذ {relTime(r.updated_at)}</span>
                </div>
                <div className="text-sm font-medium truncate mt-1">{r.receiver_name}</div>
                <div className="text-[11px] font-mono text-muted-foreground">{silaCodeOf(r.id)}</div>
              </div>
              <div className="text-end shrink-0 text-sm font-bold">{fmtSYP(r.total_amount)}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}