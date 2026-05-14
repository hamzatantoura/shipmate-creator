import { ReactNode } from "react";
import { Truck } from "lucide-react";
import { useLanguage } from "@/i18n/use-language";
import LanguageSwitcher from "@/shared/components/i18n/LanguageSwitcher";
import { motion } from "framer-motion";
import AuthBrandPanel from "@/features/auth/components/AuthBrandPanel";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Wider form column (used by the multi-field signup form). */
  wide?: boolean;
  /** Hide the brand panel entirely (e.g. confirmation screens). */
  hideBrand?: boolean;
}

/**
 * Premium split-screen wrapper for every auth screen.
 * - Desktop (lg+): Brand panel on one side, form card on the other.
 * - Mobile: form card centered with ambient gradient background.
 */
export default function AuthCard({ title, subtitle, children, wide, hideBrand }: AuthCardProps) {
  const { meta } = useLanguage();

  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-hidden" dir={meta.dir}>
      {/* Mobile ambient background */}
      <div className="lg:hidden fixed inset-0 pointer-events-none -z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,hsl(var(--primary)/0.18),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_90%_110%,hsl(var(--primary)/0.12),transparent_70%)]" />
      </div>

      <div className="absolute top-4 end-4 z-30">
        <LanguageSwitcher variant="outline" />
      </div>

      <div className={`grid min-h-[100dvh] ${hideBrand ? "lg:grid-cols-1" : "lg:grid-cols-[1.1fr_1fr]"}`}>
        {/* Brand Panel (desktop only) */}
        {!hideBrand && <AuthBrandPanel />}

        {/* Form column */}
        <div className="flex items-center justify-center p-4 sm:p-6 py-10 relative">
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className={`relative z-10 w-full ${wide ? "max-w-xl" : "max-w-md"}`}
          >
            {/* Mobile brand mark */}
            <div className="lg:hidden flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]">
                <Truck className="h-7 w-7 text-primary" />
              </div>
              <div className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">صلة</div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden">
              <div className="px-6 sm:px-8 pt-7 pb-2 space-y-2">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-foreground">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
                )}
              </div>
              <div className="px-6 sm:px-8 pt-4 pb-7">{children}</div>
            </div>
            <p className="text-center mt-4 text-[11px] text-muted-foreground/70">
              © {new Date().getFullYear()} Sila — صلة · جميع الحقوق محفوظة
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
