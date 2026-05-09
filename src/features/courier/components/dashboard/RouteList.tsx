import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Package } from "lucide-react";
import { fmtSYP, fmtNum, type CourierDashboardData } from "./types";

interface Props { routes: CourierDashboardData["routes"]; }

export function RouteList({ routes }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" /> خطوط التوصيل اليوم
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {routes.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">لا توجد خطوط نشطة</div>
        )}
        {routes.map((r) => (
          <div key={r.district} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Package className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{r.district}</div>
                <div className="text-[11px] text-muted-foreground">{fmtNum(r.count)} شحنة</div>
              </div>
            </div>
            <div className="text-end shrink-0">
              <div className="text-xs text-muted-foreground">إجمالي التحصيل</div>
              <div className="text-sm font-bold">{fmtSYP(r.cod)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}