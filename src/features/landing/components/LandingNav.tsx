import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Menu, X } from "lucide-react";
import silaLogo from "@/assets/sila-logo.png";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageSwitcher } from "@/shared/components/i18n/LanguageSwitcher";
import { useTranslation } from "react-i18next";

export function LandingNav() {
  const { t } = useTranslation("landing");
  const NAV = [
    { href: "#features", label: t("nav.features") },
    { href: "#workflow", label: t("nav.features") },
    { href: "#pricing", label: t("nav.pricing") },
    { href: "#faq", label: t("nav.faq") },
  ];
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={silaLogo} alt="Sila" className="h-8 w-8" />
          <span className="font-display font-bold text-xl text-primary tracking-tight">Sila</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-foreground transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher compact />
          <Link to="/track" className="hidden sm:block">
            <Button variant="ghost" size="sm">تتبع شحنة</Button>
          </Link>
          <Link to="/install" className="hidden md:block">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              التطبيق
            </Button>
          </Link>
          <Link to="/login">
            <Button size="sm" className="gap-1.5 glow-btn">
              <span>دخول</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-border/60 bg-background/95 backdrop-blur"
          >
            <div className="px-4 py-3 flex flex-col gap-1 text-sm">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="py-2 px-2 rounded-md hover:bg-muted text-foreground"
                >
                  {n.label}
                </a>
              ))}
              <Link to="/track" onClick={() => setOpen(false)} className="py-2 px-2 rounded-md hover:bg-muted">تتبع شحنة</Link>
              <Link to="/install" onClick={() => setOpen(false)} className="py-2 px-2 rounded-md hover:bg-muted">حمّل التطبيق</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}