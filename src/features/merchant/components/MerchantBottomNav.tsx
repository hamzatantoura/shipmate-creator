import { NavLink, useLocation } from "react-router-dom";
import { Home, ShoppingCart, Wallet, Store, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "الرئيسية", url: "/merchant", icon: Home, exact: true },
  { title: "الطلبات", url: "/merchant/orders", icon: ShoppingCart },
  { title: "المحفظة", url: "/merchant/wallet", icon: Wallet },
  { title: "المتجر", url: "/merchant/products", icon: Store },
  { title: "الإعدادات", url: "/merchant/settings", icon: Settings },
];

export default function MerchantBottomNav() {
  const location = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/90 backdrop-blur-md border-t border-border h-16 flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]"
      dir="rtl"
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
            <span>{item.title}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}