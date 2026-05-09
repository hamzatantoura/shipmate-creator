import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, DollarSign, ShoppingBag, Truck, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fmtNum, fmtSYP } from "./types";

interface Props {
  revenue30d: number;
  revenuePrev30d: number;
  totalOrders30d: number;
  avgOrderValue: number;
  deliveryRate: number;
}

function pctDelta(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

export default function KpiCards({
  revenue30d,
  revenuePrev30d,
  totalOrders30d,
  avgOrderValue,
  deliveryRate,
}: Props) {
  const { t } = useTranslation("dashboard");
  const delta = pctDelta(revenue30d, revenuePrev30d);
  const items = [
    { label: t("kpi.revenue30d"), value: fmtSYP(revenue30d), icon: DollarSign, tone: "text-emerald-600 bg-emerald-500/10", delta },
    { label: t("kpi.totalOrders"), value: fmtNum(totalOrders30d), icon: ShoppingBag, tone: "text-primary bg-primary/10" },
    { label: t("kpi.avgOrderValue"), value: fmtSYP(avgOrderValue), icon: TrendingUp, tone: "text-sky-600 bg-sky-500/10" },
    { label: t("kpi.deliveryRate"), value: `${deliveryRate.toFixed(1)}%`, icon: Truck, tone: "text-amber-600 bg-amber-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {items.map((it) => (
        <Card key={it.label} className="overflow-hidden">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{it.label}</p>
                <p className="text-xl md:text-2xl font-bold text-foreground mt-1 truncate">{it.value}</p>
                {typeof it.delta === "number" && (
                  <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${it.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {it.delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {Math.abs(it.delta).toFixed(1)}%
                    <span className="text-muted-foreground font-normal">{t("kpi.vsLastMonth")}</span>
                  </div>
                )}
              </div>
              <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${it.tone}`}>
                <it.icon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
