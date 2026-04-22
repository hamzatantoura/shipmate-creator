import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Shield, Search, Package, LogOut, Wallet, Receipt } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import silaLogo from "@/assets/sila-logo.png";

export default function AppHeader() {
  const { pathname } = useLocation();
  const { user, role, profile, signOut } = useAuth();

  const NAV_ITEMS = role === "admin"
    ? [
        { path: "/admin", label: "الإدارة", icon: Shield },
        { path: "/admin/settlements", label: "تسويات المناديب", icon: Receipt },
        { path: "/track", label: "تتبع", icon: Search },
      ]
    : role === "vendor"
    ? [
        { path: "/courier/orders", label: "لوحة الشحن", icon: Package },
        { path: "/courier/wallet", label: "المحفظة", icon: Wallet },
        { path: "/track", label: "تتبع", icon: Search },
      ]
    : [
        { path: "/merchant", label: "التاجر", icon: ShoppingBag },
        { path: "/track", label: "تتبع", icon: Search },
      ];

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between" dir="rtl">
        <Link to="/" className="flex items-center gap-2">
          <img src={silaLogo} alt="Sila" className="h-7 w-7" />
          <span className="font-display font-bold text-lg text-primary tracking-tight">Sila</span>
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
          {user && (
            <div className="flex items-center gap-2 mr-2 border-r border-border pr-2">
              {profile?.store_name && (
                <span className="text-xs text-muted-foreground hidden md:inline">{profile.store_name}</span>
              )}
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={signOut}>
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline">خروج</span>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
