import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  ShoppingCart,
  Wallet,
  Store,
  Settings,
  Archive,
  Package,
  CreditCard,
  LogOut,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/use-language";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function MerchantBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");
  const { meta } = useLanguage();
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = [
    { key: "home", url: "/merchant", icon: Home, exact: true },
    { key: "orders", url: "/merchant/orders", icon: ShoppingCart },
    { key: "wallet", url: "/merchant/wallet", icon: Wallet },
    { key: "store", url: "/merchant/products", icon: Store },
  ];

  const secondary = [
    { key: "archive", url: "/merchant/archive", icon: Archive },
    { key: "products", url: "/merchant/products", icon: Package },
    { key: "topup", url: "/topup", icon: CreditCard },
    { key: "settings", url: "/merchant/settings", icon: Settings },
  ];

  const isPathActive = (url: string, exact?: boolean) =>
    exact ? location.pathname === url : location.pathname === url || location.pathname.startsWith(url + "/");

  const moreActive = secondary.some((s) => isPathActive(s.url)) && !primary.some((p) => isPathActive(p.url, p.exact));

  const handleSecondary = (url: string) => {
    setMoreOpen(false);
    navigate(url);
  };

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/90 backdrop-blur-md border-t border-border h-16 flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]"
      dir={meta.dir}
    >
      {primary.map((item) => {
        const isActive = isPathActive(item.url, item.exact);
        return (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.exact}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors relative",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
            )}
            <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
            <span>{t(`merchant.${item.key}`)}</span>
          </NavLink>
        );
      })}

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors relative",
              moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {moreActive && (
              <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
            )}
            <MoreHorizontal className={cn("h-5 w-5 transition-transform", moreActive && "scale-110")} />
            <span>{t("merchant.more", "المزيد")}</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]" dir={meta.dir}>
          <SheetHeader className="text-start">
            <SheetTitle>{t("merchant.more", "المزيد")}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {secondary.map((item) => {
              const active = isPathActive(item.url);
              return (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => handleSecondary(item.url)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border border-border p-4 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-card text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  <span>
                    {item.key === "topup"
                      ? t("merchant.topup", "شحن الرصيد")
                      : t(`merchant.${item.key}`)}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive hover:bg-destructive/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("merchant.signOut")}
          </button>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
