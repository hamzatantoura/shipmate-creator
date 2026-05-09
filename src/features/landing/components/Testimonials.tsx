import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { TESTIMONIALS } from "../data/content";

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">آراء العملاء</p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            تجار يثقون بصلة كل يوم
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-6 relative"
            >
              <Quote className="absolute top-5 left-5 h-6 w-6 text-primary/30 -scale-x-100" />
              <blockquote className="text-sm text-foreground leading-relaxed">{t.text}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center">
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}