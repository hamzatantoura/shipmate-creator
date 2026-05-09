import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, PackageOpen } from "lucide-react";
import { DashboardOrder, STATUS_LABELS, fmtSYP } from "./types";

const STATUS_TONE: Record<string, string> = {
  new: "bg-primary/15 text-primary border-primary/30",
  processing: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  shipped: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  out_for_delivery: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  delivered: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  returned: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const relativeTime = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} ي`;
};

export default function RecentOrders({ orders }: { orders: DashboardOrder[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">آخر الطلبات</CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-xs h-7">
          <Link to="/merchant/orders" className="flex items-center gap-1">
            عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <PackageOpen className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">لا توجد طلبات حديثة</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {orders.map((o) => {
              const amount = Number(o.final_sale_price) || Number(o.total_amount) || 0;
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground truncate">
                      <span className="truncate">{o.receiver_name || "—"}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground truncate">{o.city || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={STATUS_TONE[o.status] || ""}>
                        {STATUS_LABELS[o.status] || o.status}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {relativeTime(o.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-sm font-bold text-foreground">{fmtSYP(amount)}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      #{o.id.slice(0, 6)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}