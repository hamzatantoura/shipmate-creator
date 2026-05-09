import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/use-language";

export function CtaBanner() {
  const { t } = useTranslation("landing");
  const { isRtl } = useLanguage();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-info/10 p-10 sm:p-14 text-center">
          <div
            aria-hidden
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0%, transparent 40%), radial-gradient(circle at 80% 80%, hsl(var(--info)) 0%, transparent 40%)",
            }}
          />
          <div className="relative">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
              {t("ctaBanner.title")}
            </h2>
            <p className="mt-4 text-muted-foreground sm:text-lg max-w-xl mx-auto">
              {t("ctaBanner.subtitle")}
            </p>
            <Link to="/signup" className="inline-block mt-7">
              <Button size="lg" className="h-12 px-8 gap-2 glow-btn font-semibold">
                {t("ctaBanner.cta")}
                <Arrow className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
