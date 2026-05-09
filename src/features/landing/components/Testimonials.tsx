import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Item { name: string; role: string; text: string; initials: string; }

export function Testimonials() {
  const { t } = useTranslation("landing");
  const items = t("testimonials.items", { returnObjects: true }) as Item[];

  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">{t("testimonials.eyebrow")}</p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            {t("testimonials.title")}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <motion.figure
              key={item.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-6 relative"
            >
              <Quote className="absolute top-5 left-5 h-6 w-6 text-primary/30 -scale-x-100" />
              <blockquote className="text-sm text-foreground leading-relaxed">{item.text}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center">
                  {item.initials}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
