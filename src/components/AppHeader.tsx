import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Truck, ShoppingBag, Building2, Shield, Search } from "lucide-react";

const NAV_ITEMS = [
  { path: "/merchant", label: "التاجر", icon: ShoppingBag },
  { path: "/carrier", label: "الناقل", icon: Building2 },
  { path: "/driver", label: "السائق", icon: Truck },
  { path: "/admin-logistics", label: "الإدارة", icon: Shield },
  { path: "/track", label: "تتبع", icon: Search },
];

export default function AppHeader() {
  const { pathname } = useLocation();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between" dir="rtl">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">صلة</span>
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
