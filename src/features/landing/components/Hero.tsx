import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles, Truck, Wallet, BarChart3, Package, MapPin, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/use-language";
import silaLogo from "@/assets/sila-logo.png";

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-info/10 to-transparent rounded-3xl blur-2xl opacity-50" aria-hidden />
      {/* Card */}
      <div className="relative rounded-2xl border border-border/60 bg-card/90 backdrop-blur-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">شركة الشحن</p>
            <p className="text-[11px] text-muted-foreground">Sila Express</p>
          </div>
          <span className="mr-auto text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">نشط</span>
        </div>
        {/* COD Balance */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">رصيد COD</span>
          </div>
          <p className="text-3xl font-display font-bold text-foreground tracking-tight">325,000 <span className="text-base font-medium text-muted-foreground">ل.س</span></p>
          <p className="text-[11px] text-success mt-1">+12% هذا الشهر</p>
        </div>
        {/* Mini Chart */}
        <div className="px-5 pb-5">
          <div className="flex items-end gap-1.5 h-16">
            <div className="flex-1 rounded-sm bg-primary/20 h-[40%]" />
            <div className="flex-1 rounded-sm bg-primary/30 h-[60%]" />
            <div className="flex-1 rounded-sm bg-primary/40 h-[45%]" />
            <div className="flex-1 rounded-sm bg-primary/50 h-[75%]" />
            <div className="flex-1 rounded-sm bg-primary/60 h-[55%]" />
            <div className="flex-1 rounded-sm bg-primary/80 h-[90%]" />
            <div className="flex-1 rounded-sm bg-primary h-[65%]" />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>السبت</span>
            <span>الأحد</span>
            <span>الإثنين</span>
            <span>الثلاثاء</span>
            <span>الأربعاء</span>
            <span>الخميس</span>
            <span>الجمعة</span>
          </div>
        </div>
        {/* Footer pills */}
        <div className="px-5 pb-5 flex gap-2">
          <span className="text-[10px] font-medium bg-muted px-2.5 py-1 rounded-md text-muted-foreground">14 محافظة</span>
          <span className="text-[10px] font-medium bg-muted px-2.5 py-1 rounded-md text-muted-foreground">+50K شحنة</span>
        </div>
      </div>
    </div>
  );
}

function TrustBanner() {
  const partners = [
    { icon: Truck, label: "ناقل سريع" },
    { icon: Package, label: "باكج بلس" },
    { icon: MapPin, label: "وصل سوريا" },
    { icon: Building2, label: "لوجستك برو" },
  ];

  return (
    <div className="mt-14 pt-8 border-t border-border/30">
      <p className="text-center text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 font-medium mb-5">
        شركاؤنا اللوجستيون
      </p>
      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
        {partners.map((p) => (
          <div key={p.label} className="flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity">
            <p.icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium text-muted-foreground">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  const { t } = useTranslation("landing");
  const { isRtl } = useLanguage();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section className="relative overflow-hidden">
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
      <div className="absolute inset-x-0 -top-40 h-[480px] bg-gradient-to-b from-primary/15 via-info/10 to-transparent blur-3xl" aria-hidden />

      <div className="max-w-6xl mx-auto px-4 pt-16 md:pt-24 pb-8 md:pb-12 relative">
        <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`text-center ${isRtl ? "md:text-right" : "md:text-left"} order-2 md:order-1`}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium px-3.5 py-1.5 mb-5 border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              {t("hero.badge")}
            </span>
            <h1 className="font-display font-bold tracking-tight text-foreground text-4xl sm:text-5xl lg:text-[3.25rem] leading-[1.1]">
              {t("hero.title1")}
              <br className="hidden sm:block" />{" "}
              <span className="bg-gradient-to-l from-primary via-info to-primary bg-clip-text text-transparent">
                {t("hero.title2")}
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              {t("hero.subtitle")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3 justify-center md:justify-start">
              <Link to="/signup">
                <Button size="lg" className="gap-2 h-12 px-7 font-semibold glow-btn text-base">
                  {t("hero.ctaPrimary")} <Arrow className="h-4 w-4" />
                </Button>
              </Link>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base border-border/80">
                <a href="#workflow">
                  شاهد آلية العمل
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              ابدأ بإنشاء متجرك بدون رسوم اشتراك • أرباحك (COD) في محفظة واحدة • ربط فوري مع شركات الشحن
            </p>
          </motion.div>

          {/* Illustration */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="order-1 md:order-2 relative"
          >
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary/25 via-info/15 to-transparent rounded-[2rem] blur-3xl opacity-60" aria-hidden />
            <DashboardMockup />
          </motion.div>
        </div>

        {/* Trust Banner */}
        <TrustBanner />
      </div>
    </section>
  );
}
