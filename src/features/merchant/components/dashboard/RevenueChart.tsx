import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { fmtSYP } from "./types";

interface Props { data: { date: string; label: string; revenue: number; orders: number }[]; }

export default function RevenueChart({ data }: Props) {
  const { t } = useTranslation("dashboard");
  const total = data.reduce((s, d) => s + d.revenue, 0);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">{t("revenueChart.title")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t("revenueChart.subtitle")}</p>
        </div>
        <div className="text-left">
          <p className="text-xs text-muted-foreground">{t("revenueChart.total")}</p>
          <p className="text-lg font-bold text-foreground">{fmtSYP(total)}</p>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[260px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} width={48} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                formatter={(value: number, name) => {
                  if (name === "revenue") return [fmtSYP(value), t("revenueChart.revenue")];
                  return [value, t("revenueChart.orders")];
                }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
