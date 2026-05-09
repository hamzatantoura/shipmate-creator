import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { TRUSTED_BRANDS } from "../data/content";

interface Stat { value: string; label: string; }

export function TrustedBy() {
  const { t } = useTranslation("landing");
  const stats = t("trustedBy.stats", { returnObjects: true }) as Stat[];

  return (
    <section className="py-14 border-y border-border/60 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4">
        <p className="text-center text-xs sm:text-sm text-muted-foreground tracking-wide mb-7">
          {t("trustedBy.title")}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-x-6 gap-y-4 items-center mb-10 opacity-70">
          {TRUSTED_BRANDS.map((b, i) => (
            <motion.span
              key={b}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="text-center font-display font-semibold text-muted-foreground text-sm sm:text-base whitespace-nowrap"
            >
              {b}
            </motion.span>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <p className="text-2xl md:text-3xl font-display font-bold text-foreground tabular-nums">
                {s.value}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
