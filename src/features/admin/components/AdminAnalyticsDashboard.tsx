import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, Package, CheckCircle2, RotateCcw, AlertTriangle
} from "lucide-react";

interface KPI {
  total_orders: number;
  total_delivered: number;
  total_returned: number;
  total_platform_revenue: number;
}
interface TrendPoint {
  day: string;
  order_count: number;
  delivered_count: number;
  revenue: number;
}
interface CourierRow {
  courier_id: string;
  courier_name: string;
  total: number;
  delivered: number;
  returned: number;
  success_rate: number;
}
interface AdminAnalytics {
  kpis: KPI;
  trend_last_30_days: TrendPoint[];
  courier_performance: CourierRow[];
  generated_at: string;
}

const fmtSYP = (n: number) =>
  `${Math.round(n).toLocaleString("ar-SY")} ل.س`;
const fmtNum = (n: number) => n.toLocaleString("ar-SY");
const fmtDay = (iso: string) => {
  // YYYY-MM-DD -> DD/MM
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export default function AdminAnalyticsDashboard() {
  const { data, isLoading, isError, error } = useQuery<AdminAnalytics>({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_analytics");
      if (error) throw error;
      return data as unknown as AdminAnalytics;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-card border-border">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[260px] w-full" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader>
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="bg-card border-destructive/40">
        <CardContent className="p-6 flex items-center gap-3 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          تعذّر تحميل الإحصائيات: {(error as Error)?.message ?? "خطأ غير متوقع"}
        </CardContent>
      </Card>
    );
  }

  const { kpis, trend_last_30_days, courier_performance } = data;

  const kpiCards = [
    {
      label: "إجمالي الطلبات",
      value: fmtNum(kpis.total_orders),
      Icon: Package,
      tone: "text-foreground",
      bg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "طلبات مُسلَّمة",
      value: fmtNum(kpis.total_delivered),
      Icon: CheckCircle2,
      tone: "text-success",
      bg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      label: "طلبات مُرتجَعة",
      value: fmtNum(kpis.total_returned),
      Icon: RotateCcw,
      tone: "text-destructive",
      bg: "bg-destructive/10",
      iconColor: "text-destructive",
    },
    {
      label: "أرباح المنصة (مُسلَّمة)",
      value: fmtSYP(kpis.total_platform_revenue),
      Icon: TrendingUp,
      tone: "text-primary",
      bg: "bg-primary/10",
      iconColor: "text-primary",
    },
  ];

  // Recharts wants ascending data; tooltip labels in Arabic dd/mm
  const trendData = trend_last_30_days.map((p) => ({
    ...p,
    label: fmtDay(p.day),
  }));

  const courierData = courier_performance.slice(0, 8).map((c) => ({
    name: c.courier_name,
    delivered: c.delivered,
    returned: c.returned,
    success_rate: c.success_rate,
  }));

  return (
    <div className="space-y-6" dir="rtl">
      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, Icon, tone, bg, iconColor }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-11 w-11 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">{label}</p>
                <p className={`text-xl font-display font-bold ${tone}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 30-day trend */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-display">
            حركة الطلبات والأرباح — آخر 30 يوماً
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {trendData.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  reversed
                />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  orientation="right"
                />
                <YAxis
                  yAxisId="right"
                  orientation="left"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    direction: "rtl",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "الإيرادات") return [fmtSYP(value), name];
                    return [fmtNum(value), name];
                  }}
                />
                <Legend wrapperStyle={{ direction: "rtl" }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="order_count"
                  name="عدد الطلبات"
                  stroke="hsl(var(--primary))"
                  fill="url(#orderGrad)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  name="الإيرادات"
                  stroke="hsl(var(--success))"
                  fill="url(#revGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Courier performance */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-display">
            أداء شركات الشحن
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[340px]">
          {courierData.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={courierData}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                  reversed
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  orientation="right"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    direction: "rtl",
                  }}
                  formatter={(value: number, name: string) => [fmtNum(value), name]}
                />
                <Legend wrapperStyle={{ direction: "rtl" }} />
                <Bar dataKey="delivered" name="مُسلَّمة" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="returned" name="مُرتجَعة" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Courier success-rate table strip */}
      {courier_performance.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-display">نسب نجاح التسليم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {courier_performance.map((c) => (
                <div
                  key={c.courier_id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.courier_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtNum(c.delivered)} / {fmtNum(c.total)} مُسلَّمة
                    </p>
                  </div>
                  <span
                    className={
                      "text-sm font-display font-bold " +
                      (c.success_rate >= 80
                        ? "text-success"
                        : c.success_rate >= 50
                        ? "text-warning"
                        : "text-destructive")
                    }
                  >
                    {c.success_rate}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
