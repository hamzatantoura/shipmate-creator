import { motion } from "framer-motion";
import { ShieldCheck, Zap, BarChart3, MapPin, Wallet } from "lucide-react";
import { useLanguage } from "@/i18n/use-language";
import silaLogo from "@/assets/sila-logo.png";

interface Feature {
  icon: React.ElementType;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  { icon: Wallet, title: "محفظة ذكية", desc: "تسوية فورية وسجل حركات شفّاف" },
  { icon: MapPin, title: "تسعير حسب المنطقة", desc: "تعرفات مخصّصة لكل محافظة ومنطقة" },
  { icon: BarChart3, title: "تحليلات لحظية", desc: "لوحة تحكّم احترافية لقياس الأداء" },
];

const STATS = [
  { value: "+1.2K", label: "تاجر نشط" },
  { value: "+85K", label: "شحنة شهرية" },
  { value: "14", label: "محافظة مغطّاة" },
];

export default function AuthBrandPanel() {
  const { meta } = useLanguage();
  const isRtl = meta.dir === "rtl";

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-background via-background to-card hidden lg:flex flex-col justify-between p-10 xl:p-12">
      {/* Mesh gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute -top-32 -start-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.55), transparent 70%)" }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -end-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.35), transparent 70%)" }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_28px_-6px_hsl(var(--primary)/0.7)]">
          <img src={silaLogo} alt="Sila" className="h-7 w-7" />
        </div>
        <div className={isRtl ? "text-right" : "text-left"}>
          <div className="font-display text-2xl font-bold tracking-tight text-foreground">صلة</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sila Logistics</div>
        </div>
      </motion.div>

      {/* Headline + features */}
      <div className="relative z-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs text-primary">
            <Zap className="h-3.5 w-3.5" />
            منصة لوجستية متكاملة
          </div>
          <h2 className="font-display text-3xl xl:text-4xl font-bold leading-tight text-foreground">
            أدر متجرك وشحناتك
            <br />
            <span className="text-primary">من مكان واحد</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            صلة تربط التجار بشركات الشحن المعتمدة في سوريا، مع محفظة ذكية، تسعير حسب المنطقة، وتقارير لحظية.
          </p>
        </motion.div>

        <ul className="space-y-3.5">
          {FEATURES.map((f, i) => (
            <motion.li
              key={f.title}
              initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
              className="flex items-start gap-3"
            >
              <div className="mt-0.5 w-9 h-9 rounded-xl bg-card/80 border border-border/60 backdrop-blur-sm flex items-center justify-center shrink-0">
                <f.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Stats + trust */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="relative z-10 space-y-4"
      >
        <div className="grid grid-cols-3 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm px-3 py-3 text-center"
            >
              <div className="font-display text-lg font-bold text-foreground">{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          مشفّرة بالكامل · بنية تحتية آمنة · دعم على مدار الساعة
        </div>
      </motion.div>
    </div>
  );
}
