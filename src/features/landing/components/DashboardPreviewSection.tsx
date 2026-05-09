import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DashboardMockup } from "./DashboardMockup";

export function DashboardPreviewSection() {
  const { t } = useTranslation("landing");
  const points = t("dashboardPreview.points", { returnObjects: true }) as string[];

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">{t("dashboardPreview.eyebrow")}</p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
              {t("dashboardPreview.title")}
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">{t("dashboardPreview.subtitle")}</p>
            <ul className="mt-6 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
