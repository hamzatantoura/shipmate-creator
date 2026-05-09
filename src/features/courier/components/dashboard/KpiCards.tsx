import { Card, CardContent } from "@/components/ui/card";
import { Activity, CheckCircle2, RotateCcw, TrendingUp } from "lucide-react";
import { fmtNum, fmtSYP, type CourierDashboardData } from "./types";

interface Props { kpis: CourierDashboardData["kpis"]; }

const items = (k: CourierDashboardData["kpis"]) => [
  {
    label: "شحنات نشطة",
    value: fmtNum(k.activeCount),
    icon: Activity,
    accent: "text-primary bg-primary/10",
    sub: "قيد التشغيل الآن",
  },
  {
    label: "تم التسليم اليوم",
    value: fmtNum(k.deliveredToday),
    icon: CheckCircle2,
    accent: "text-success bg-success/10",
    sub: `${fmtNum(k.deliveredMonth)} هذا الشهر`,
  },
  {
    label: "أرباح الشهر",
    value: fmtSYP(k.earningsMonth),
    icon: TrendingUp,
    accent: "text-warning bg-warning/10",
    sub: "من رسوم التوصيل",
  },
  {
    label: "نسبة النجاح",
    value: `${k.successRate.toFixed(0)}%`,
    icon: RotateCcw,
    accent: "text-info bg-info/10",
    sub: `${fmtNum(k.returnedMonth)} مرتجعات`,
  },
];

export function KpiCards({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {items(kpis).map((it) => (
        <Card key={it.label} className="border-border/50 hover:border-primary/30 transition-colors">
          <CardContent className="p-4 md:p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{it.label}</span>
              <span className={`p-2 rounded-lg ${it.accent}`}>
                <it.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="text-xl md:text-2xl font-bold tracking-tight">{it.value}</div>
            <div className="text-[11px] text-muted-foreground">{it.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}