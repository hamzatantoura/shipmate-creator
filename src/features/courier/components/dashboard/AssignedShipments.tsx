import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Phone, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { getOrderStatusMeta } from "@/features/shipments/lib/order-status";
import { fmtSYP, silaCodeOf, NEXT_STATUS_MAP, type CourierShipmentRow } from "./types";

interface Props {
  rows: CourierShipmentRow[];
  onAdvance: (row: CourierShipmentRow, nextStatus: string) => void;
  updatingId: string | null;
}

export function AssignedShipments({ rows, onAdvance, updatingId }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">الشحنات المسندة</CardTitle>
        <Button asChild size="sm" variant="ghost" className="h-8 -mr-2">
          <Link to="/courier/orders" className="flex items-center gap-1 text-xs">
            عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">لا توجد شحنات نشطة</div>
        )}
        {rows.slice(0, 6).map((r) => {
          const meta = getOrderStatusMeta(r.status);
          const next = NEXT_STATUS_MAP[r.status]?.[0];
          return (
            <div key={r.id} className="rounded-lg border border-border/60 p-3 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-muted-foreground">{silaCodeOf(r.id)}</span>
                    <Badge variant="outline" className={`${meta.className} text-[10px] gap-1 px-1.5 py-0`}>
                      <meta.icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="font-semibold text-sm truncate">{r.receiver_name}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.districts?.name || r.city}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone_number}</span>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="text-sm font-bold">{fmtSYP(r.total_amount)}</div>
                  <div className="text-[10px] text-muted-foreground">شحن: {fmtSYP(r.delivery_fee)}</div>
                </div>
              </div>
              {next && (
                <div className="mt-2 pt-2 border-t border-border/40 flex justify-end">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={updatingId === r.id}
                    onClick={() => onAdvance(r, next.value)}
                  >
                    {updatingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : next.label}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}