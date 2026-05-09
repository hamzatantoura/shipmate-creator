import { NavLink, useLocation } from "react-router-dom";
import { Home, ShoppingCart, Wallet, Store, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/use-language";

export default function MerchantBottomNav() {
  const location = useLocation();
  const { t } = useTranslation("dashboard");
  const { meta } = useLanguage();
  const items = [
    { key: "home", url: "/merchant", icon: Home, exact: true },
    { key: "orders", url: "/merchant/orders", icon: ShoppingCart },
    { key: "wallet", url: "/merchant/wallet", icon: Wallet },
    { key: "store", url: "/merchant/products", icon: Store },
    { key: "settings", url: "/merchant/settings", icon: Settings },
  ];
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/90 backdrop-blur-md border-t border-border h-16 flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]"
      dir={meta.dir}
    >
      {items.map((item) => {
        const isActive = item.exact
          ? location.pathname === item.url
          : location.pathname === item.url || location.pathname.startsWith(item.url + "/");
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
    </nav>
  );
}