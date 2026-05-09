import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface Tier {
  name: string;
  price: string;
  desc: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

export function Pricing() {
  const { t } = useTranslation("landing");
  const tiers = t("pricing.tiers", { returnObjects: true }) as Tier[];

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-muted/30 border-y border-border/60">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">{t("pricing.eyebrow")}</p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            {t("pricing.title")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`relative rounded-2xl border p-7 flex flex-col ${
                tier.highlight
                  ? "border-primary/50 bg-card shadow-2xl shadow-primary/10"
                  : "border-border/60 bg-card/60 backdrop-blur-sm"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 right-6 inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow">
                  <Sparkles className="h-3 w-3" /> {t("pricing.popular")}
                </span>
              )}
              <h3 className="font-display font-semibold text-xl text-foreground">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{tier.desc}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-display font-bold text-foreground">{tier.price}</span>
                {tier.price.includes("$") && <span className="text-sm text-muted-foreground">{t("pricing.perMonth")}</span>}
              </div>
              <ul className="mt-6 space-y-2.5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="mt-7">
                <Button
                  className={`w-full h-11 ${tier.highlight ? "glow-btn" : ""}`}
                  variant={tier.highlight ? "default" : "outline"}
                >
                  {tier.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
