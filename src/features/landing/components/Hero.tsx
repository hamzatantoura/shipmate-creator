import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Zap,
  TrendingUp,
  Package,
  Store,
  Truck,
  Wallet,
} from "lucide-react";

export function Hero() {
  const scrollToFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section dir="rtl" className="relative overflow-hidden">
      {/* Background grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 -top-40 h-[480px] bg-gradient-to-b from-primary/15 via-info/10 to-transparent blur-3xl"
      />

      <div className="max-w-6xl mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-24 relative">
        <div className="grid md:grid-cols-2 gap-12 md:gap-10 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center md:text-right order-2 md:order-1"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium px-3.5 py-1.5 mb-5 border border-primary/20">
              <Zap className="h-3.5 w-3.5" />
              نظام تشغيل متكامل لتجارتك
            </span>
            <h1 className="font-display font-bold tracking-normal text-foreground text-4xl sm:text-5xl lg:text-[3rem] leading-[1.32] [word-spacing:0.025em] py-2 text-balance">
              <span className="block">أدر متجرك وشحناتك</span>
              <span className="block">
                وأموالك من{" "}
                <span className="bg-gradient-to-l from-primary via-info to-primary bg-clip-text text-transparent pb-1 leading-[1.35]">
                  منصة واحدة
                </span>
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-[1.9] [word-spacing:0.035em] max-w-xl mx-auto md:mx-0">
              صلة تمنحك متجراً إلكترونياً احترافياً، وتربطك آلياً بأفضل شركات
              الشحن مع محفظة مالية تضبط أرباحك بدقة.
            </p>

            <div className="mt-7 flex flex-wrap gap-3 justify-center md:justify-start">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="gap-2 h-12 px-7 font-semibold glow-btn text-base"
                >
                  ابدأ مجاناً <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features" onClick={scrollToFeatures}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 text-base border-border/80"
                >
                  استكشف الميزات
                </Button>
              </a>
            </div>

            <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 justify-center md:justify-start text-sm text-muted-foreground">
              <li className="inline-flex items-center gap-2">
                <Store className="w-4 h-4 text-primary/80" />
                متجر إلكتروني مجاني
              </li>
              <li className="inline-flex items-center gap-2">
                <Truck className="w-4 h-4 text-primary/80" />
                ربط لوجستي فوري
              </li>
              <li className="inline-flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary/80" />
                تسويات مالية دقيقة
              </li>
            </ul>
          </motion.div>

          {/* Glassmorphism dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="order-1 md:order-2 relative h-[360px] sm:h-[420px]"
          >
            {/* Pulsing glow */}
            <div
              aria-hidden
              className="absolute inset-8 bg-primary opacity-20 blur-3xl rounded-full animate-pulse"
            />
            <div
              aria-hidden
              className="absolute -top-6 -left-6 w-48 h-48 bg-info/30 opacity-30 blur-3xl rounded-full"
            />

            {/* Card 2 — Ops (background, offset) */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="absolute top-2 left-2 sm:top-0 sm:left-0 w-[72%] max-w-[280px] rounded-2xl border border-border/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-xl p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  طلبات قيد التوصيل
                </span>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/15 text-blue-500">
                  <Package className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold text-foreground">42</div>
              <div className="mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[68%] bg-blue-500 rounded-full" />
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
              </div>
            </motion.div>

            {/* Card 1 — Financial (foreground) */}
            <motion.div
              initial={{ opacity: 0, x: -20, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="absolute bottom-2 right-2 sm:bottom-0 sm:right-0 w-[78%] max-w-[320px] rounded-2xl border border-border/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  الرصيد المتاح (COD)
                </span>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                  1,250,000
                </span>
                <span className="text-sm text-muted-foreground">ل.س</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-500 font-medium">
                <TrendingUp className="w-4 h-4" />
                +15% هذا الشهر
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                {[40, 65, 50, 80, 60, 90, 75].slice(0, 7).map((h, i) => (
                  <div
                    key={i}
                    className="h-8 rounded-md bg-gradient-to-t from-primary/30 to-primary/60"
                    style={{ opacity: 0.4 + (h / 100) * 0.6 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
