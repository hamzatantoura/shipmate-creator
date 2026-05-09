import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DashboardMockup } from "./DashboardMockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />
      {/* Color wash */}
      <div className="absolute inset-x-0 -top-40 h-[480px] bg-gradient-to-b from-primary/15 via-info/10 to-transparent blur-3xl" aria-hidden />

      <div className="max-w-6xl mx-auto px-4 pt-14 md:pt-20 pb-16 md:pb-24 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-right order-2 lg:order-1"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium px-3.5 py-1.5 mb-5 border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              منصة لوجستية متكاملة للسوق السوري
            </span>
            <h1 className="font-display font-bold tracking-tight text-foreground text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.1]">
              تجارة وشحن
              <br className="hidden sm:block" />{" "}
              <span className="bg-gradient-to-l from-primary via-info to-primary bg-clip-text text-transparent">
                بذكاء وسرعة
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              صلة هي البنية التحتية الموحّدة للتجار وشركات الشحن في سوريا — أنشئ متجرك، أدِر طلباتك،
              وحصّل أرباحك من لوحة واحدة بتجربة احترافية.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link to="/signup">
                <Button size="lg" className="gap-2 h-12 px-7 font-semibold glow-btn text-base">
                  ابدأ مجاناً <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/track">
                <Button size="lg" variant="outline" className="h-12 px-7 text-base border-border/80">
                  تتبّع شحنة
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              لا حاجة لبطاقة ائتمان • إعداد في دقيقتين
            </p>
          </motion.div>

          <div className="order-1 lg:order-2">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}