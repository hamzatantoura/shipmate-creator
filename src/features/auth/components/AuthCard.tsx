import { ReactNode } from "react";
import { Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/i18n/use-language";
import LanguageSwitcher from "@/shared/components/i18n/LanguageSwitcher";
import { motion } from "framer-motion";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}

/**
 * Premium glass-morphism wrapper used by every auth screen.
 * Provides ambient gradient background, RTL-aware language switcher,
 * brand mark, and a soft entrance animation.
 */
export default function AuthCard({ title, subtitle, children, wide }: AuthCardProps) {
  const { meta } = useLanguage();

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4 py-8 overflow-y-auto relative"
      dir={meta.dir}
    >
      <div className="fixed inset-0 pointer-events-none -z-0">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,hsl(var(--primary)/0.18),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_90%_110%,hsl(var(--primary)/0.12),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,hsl(var(--background))_85%)]" />
      </div>

      <div className="absolute top-4 end-4 z-20">
        <LanguageSwitcher variant="outline" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={`relative z-10 w-full ${wide ? "max-w-lg" : "max-w-md"}`}
      >
        <Card className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl shadow-primary/5 overflow-hidden">
          <div className="text-center space-y-3 px-6 sm:px-8 pt-8">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]">
              <Truck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          <div className="px-6 sm:px-8 py-6">{children}</div>
        </Card>
        <p className="text-center mt-4 text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} Sila — صلة
        </p>
      </motion.div>
    </div>
  );
}