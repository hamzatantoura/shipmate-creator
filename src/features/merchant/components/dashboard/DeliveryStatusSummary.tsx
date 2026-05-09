import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, RotateCcw, ShoppingCart, Truck } from "lucide-react";
import { fmtNum } from "./types";

interface Props {
  newOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
}

export default function DeliveryStatusSummary({
  newOrders,
  pendingOrders,
  deliveredOrders,
  returnedOrders,
}: Props) {
  const total = newOrders + pendingOrders + deliveredOrders + returnedOrders;
  const items = [
    { label: "جديدة", value: newOrders, icon: ShoppingCart, color: "text-primary", bar: "bg-primary" },
    { label: "قيد التوصيل", value: pendingOrders, icon: Truck, color: "text-sky-600", bar: "bg-sky-500" },
    { label: "تم التوصيل", value: deliveredOrders, icon: CheckCircle2, color: "text-emerald-600", bar: "bg-emerald-500" },
    { label: "مرتجعة", value: returnedOrders, icon: RotateCcw, color: "text-destructive", bar: "bg-destructive" },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          ملخص حالات التوصيل
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((it) => {
          const pct = total ? (it.value / total) * 100 : 0;
          return (
            <div key={it.label}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <div className="flex items-center gap-2">
                  <it.icon className={`h-4 w-4 ${it.color}`} />
                  <span className="text-foreground font-medium">{it.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {fmtNum(it.value)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${it.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}