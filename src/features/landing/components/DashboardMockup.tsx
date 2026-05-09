import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Package, Truck, CheckCircle2, TrendingUp, Wallet, ArrowUpRight } from "lucide-react";

const SERIES = [
  { d: 1, v: 18 }, { d: 2, v: 26 }, { d: 3, v: 22 }, { d: 4, v: 38 },
  { d: 5, v: 31 }, { d: 6, v: 48 }, { d: 7, v: 44 }, { d: 8, v: 60 },
  { d: 9, v: 56 }, { d: 10, v: 72 },
];

/** Premium dashboard mockup used in hero & dedicated preview. */
export function DashboardMockup() {
  return (
    <div className="relative w-full">
      {/* Glow */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-primary/30 via-info/15 to-transparent rounded-[2rem] blur-3xl opacity-60" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden"
      >
        {/* top bar */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border/60 bg-background/40">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="mr-auto text-[11px] font-mono text-muted-foreground">app.sila-sy.com/dashboard</span>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: Package, label: "طلبات اليوم", value: "248", trend: "+12%" },
              { icon: Truck, label: "قيد التوصيل", value: "57", trend: "+4" },
              { icon: CheckCircle2, label: "نسبة التسليم", value: "98%", trend: "+1.2" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <k.icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] text-success font-semibold flex items-center gap-0.5">
                    <ArrowUpRight className="h-3 w-3" />
                    {k.trend}
                  </span>
                </div>
                <p className="text-lg font-display font-bold text-foreground mt-1.5 tabular-nums">{k.value}</p>
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Chart card */}
          <div className="rounded-xl border border-border/60 bg-background/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[11px] text-muted-foreground">الإيرادات (آخر 10 أيام)</p>
                <p className="text-base font-display font-bold text-foreground tabular-nums">12,840,000 ل.س</p>
              </div>
              <span className="text-[11px] text-success flex items-center gap-1 font-semibold">
                <TrendingUp className="h-3.5 w-3.5" /> +18.4%
              </span>
            </div>
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SERIES} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lp-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#lp-grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent rows */}
          <div className="rounded-xl border border-border/60 bg-background/50 divide-y divide-border/60">
            {[
              { name: "أحمد ك.", city: "دمشق", status: "تم التسليم", tone: "text-success" },
              { name: "ريم ح.", city: "حلب", status: "قيد التوصيل", tone: "text-info" },
              { name: "محمد ع.", city: "حمص", status: "تم الاستلام", tone: "text-primary" },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {r.name.split(" ")[0][0]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.name}</p>
                    <p className="text-muted-foreground">{r.city}</p>
                  </div>
                </div>
                <span className={`font-semibold ${r.tone}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Floating cards */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="hidden sm:flex absolute -left-4 top-16 items-center gap-2.5 rounded-xl bg-card/90 backdrop-blur-md border border-border/60 px-3 py-2 shadow-lg"
      >
        <div className="h-8 w-8 rounded-lg bg-success/15 text-success flex items-center justify-center">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground leading-tight">تسليم ناجح</p>
          <p className="text-xs font-bold text-foreground leading-tight">+24 طلب</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.55, duration: 0.6 }}
        className="hidden sm:flex absolute -right-4 bottom-16 items-center gap-2.5 rounded-xl bg-card/90 backdrop-blur-md border border-border/60 px-3 py-2 shadow-lg"
      >
        <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <Wallet className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground leading-tight">تحصيل COD</p>
          <p className="text-xs font-bold text-foreground leading-tight tabular-nums">+1.8M ل.س</p>
        </div>
      </motion.div>
    </div>
  );
}