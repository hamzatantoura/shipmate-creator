import { motion } from "framer-motion";
import { ShoppingBag, Sparkles, Navigation, Wallet } from "lucide-react";
import { WORKFLOW } from "../data/content";

const ICONS = [ShoppingBag, Sparkles, Navigation, Wallet];

export function Workflow() {
  return (
    <section id="workflow" className="py-20 sm:py-28 bg-muted/30 border-y border-border/60">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">آلية العمل</p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
            من الطلب إلى التحصيل في أربع خطوات
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg">
            تدفق سلس بين متجرك، شركة الشحن، والعميل — بدون تدخل يدوي.
          </p>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="hidden lg:block absolute top-9 right-[12.5%] left-[12.5%] h-px bg-gradient-to-l from-transparent via-primary/30 to-transparent" aria-hidden />
          {WORKFLOW.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-6 text-center"
              >
                <div className="relative z-10 mx-auto h-14 w-14 rounded-2xl bg-background border border-border flex items-center justify-center mb-4 shadow-sm">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mb-1">{step.num}</p>
                <h3 className="font-display font-semibold text-base text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}