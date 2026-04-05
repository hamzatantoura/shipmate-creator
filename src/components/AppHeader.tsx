import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Truck, Package, ShoppingCart, Wallet, LayoutDashboard, Building2, CreditCard, Search } from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { path: "/products", label: "المنتجات", icon: Package },
  { path: "/orders", label: "الطلبات", icon: ShoppingCart },
  { path: "/wallet", label: "المحفظة", icon: Wallet },
  { path: "/carrier", label: "الناقل", icon: Building2 },
  { path: "/driver", label: "السائق", icon: Truck },
  { path: "/admin/payouts", label: "التسويات", icon: CreditCard },
  { path: "/track", label: "تتبع", icon: Search },
];

export default function AppHeader() {
  const { pathname } = useLocation();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between" dir="rtl">
        <Link to="/" className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-display font-bold text-lg text-foreground">ShipDash</span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button
                variant={pathname === item.path ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs shrink-0"
              >
                <item.icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{item.label}</span>
              </Button>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
