import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  merchantId: string;
  /** Number of days to display, default 30 */
  days?: number;
}

const fmtSYP = (n: number) =>
  new Intl.NumberFormat("ar-SY").format(Math.round(n)) + " ل.س";

export default function WalletAnalyticsChart({ merchantId, days = 30 }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ amount: number; created_at: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: walletRow } = await supabase
        .from("wallets")
        .select("id")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (!walletRow?.id) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("wallet_transactions")
        .select("amount, created_at")
        .eq("wallet_id", walletRow.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setRows((data || []).map((r: any) => ({ amount: Number(r.amount), created_at: r.created_at })));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId, days]);

  const { series, totals } = useMemo(() => {
    const map = new Map<string, { date: string; label: string; in: number; out: number }>();
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("ar-SY", { day: "numeric", month: "short" });
      map.set(key, { date: key, label, in: 0, out: 0 });
    }
    let totalIn = 0,
      totalOut = 0;
    for (const r of rows) {
      const key = new Date(r.created_at).toISOString().slice(0, 10);
      const bucket = map.get(key);
      if (!bucket) continue;
      if (r.amount >= 0) {
        bucket.in += r.amount;
        totalIn += r.amount;
      } else {
        const v = Math.abs(r.amount);
        bucket.out += v;
        totalOut += v;
      }
    }
    return { series: Array.from(map.values()), totals: { in: totalIn, out: totalOut } };
  }, [rows, days]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            التدفق المالي
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">آخر {days} يوماً</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-600">
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span className="font-semibold tabular-nums">{fmtSYP(totals.in)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-destructive">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span className="font-semibold tabular-nums">{fmtSYP(totals.out)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (
          <div className="h-[240px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name) => [
                    fmtSYP(value),
                    name === "in" ? "وارد" : "صادر",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(v) => (v === "in" ? "وارد" : "صادر")}
                />
                <Bar dataKey="in" stackId="a" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                <Bar
                  dataKey="out"
                  stackId="a"
                  fill="hsl(var(--destructive))"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}