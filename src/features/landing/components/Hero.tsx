import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/use-language";
import silaLogo from "@/assets/sila-logo.png";
import heroIllustration from "@/assets/hero-illustration.png";

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

      <div className="max-w-6xl mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-24 relative">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={`text-center ${isRtl ? "lg:text-right" : "lg:text-left"} order-2 lg:order-1`}
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
            <div className={`mt-7 flex flex-wrap gap-3 justify-center ${isRtl ? "lg:justify-start" : "lg:justify-start"}`}>
              <Link to="/signup">
                <Button size="lg" className="gap-2 h-12 px-7 font-semibold glow-btn text-base">
                  {t("hero.ctaPrimary")} <Arrow className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/track">
                <Button size="lg" variant="outline" className="h-12 px-7 text-base border-border/80">
                  {t("hero.ctaSecondary")}
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t("hero.note")}</p>
          </motion.div>

          {/* Illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="order-1 lg:order-2 relative"
          >
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary/25 via-info/15 to-transparent rounded-[2rem] blur-3xl opacity-60" aria-hidden />
            <img
              src={heroIllustration}
              alt={t("hero.title1")}
              className="relative w-full max-w-md mx-auto drop-shadow-2xl"
              loading="eager"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
