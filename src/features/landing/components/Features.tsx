import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FEATURE_ICONS, FEATURE_ACCENTS } from "../data/content";

interface Item { title: string; desc: string; }

export function Features() {
  const { t } = useTranslation("landing");
  const items = t("features.items", { returnObjects: true }) as Item[];

  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">{t("features.eyebrow")}</p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            {t("features.title")}
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg leading-relaxed">{t("features.subtitle")}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? FEATURE_ICONS[0];
            const accent = FEATURE_ACCENTS[i] ?? FEATURE_ACCENTS[0];
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="group relative rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 overflow-hidden hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all"
              >
                <div className={`absolute -inset-px bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl`} aria-hidden />
                <div className="relative">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-semibold text-lg text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
