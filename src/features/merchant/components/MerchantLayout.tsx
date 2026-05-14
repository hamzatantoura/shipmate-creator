import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { MerchantSidebar } from "@/features/merchant/components/MerchantSidebar";
import MerchantBottomNav from "@/features/merchant/components/MerchantBottomNav";
import { useAuth } from "@/features/auth/hooks/use-auth";
import silaLogo from "@/assets/sila-logo.png";
import NotificationBell from "@/shared/components/feedback/NotificationBell";
import { useLanguage } from "@/i18n/use-language";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import MerchantApprovalBanner from "@/features/merchant/components/MerchantApprovalBanner";
import MerchantOnboardingTour from "@/features/merchant/components/MerchantOnboardingTour";

interface Props {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function MerchantLayout({ children, title, subtitle }: Props) {
  const { profile, signOut } = useAuth();
  const { isRtl, meta, change, language } = useLanguage();
  const { t } = useTranslation("dashboard");
  useEffect(() => { if (language !== "ar") change("ar"); }, [language, change]);
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background" dir={meta.dir}>
        <MerchantSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Link to="/merchant" className="flex items-center gap-2">
                <img src={silaLogo} alt="Sila" className="h-7 w-7" />
                <span className="font-display font-bold text-lg text-primary">
                  {isRtl ? "صلة" : "Sila"}
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              {profile?.store_name && (
                <span className="text-xs text-muted-foreground hidden md:inline">
                  {profile.store_name}
                </span>
              )}
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("merchant.signOut")}
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 space-y-6 max-w-7xl w-full mx-auto overflow-x-hidden">
            <MerchantApprovalBanner />
            {(title || subtitle) && (
              <div>
                {title && <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>}
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
              </div>
            )}
            {children}
          </main>
          <MerchantBottomNav />
          <MerchantOnboardingTour />
        </div>
      </div>
    </SidebarProvider>
  );
}