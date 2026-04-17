import { Home, ShoppingCart, Wallet, Store, Settings } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "الرئيسية", url: "/merchant/dashboard", icon: Home },
  { title: "الطلبات", url: "/merchant/orders", icon: ShoppingCart },
  { title: "المحفظة", url: "/merchant?tab=wallet", icon: Wallet },
  { title: "المتجر", url: "/merchant?tab=products", icon: Store },
  { title: "الإعدادات", url: "/merchant?tab=settings", icon: Settings },
];

export function MerchantSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>لوحة التاجر</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  location.pathname + location.search === item.url ||
                  (item.url === "/merchant/dashboard" && location.pathname === "/merchant/dashboard");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={item.url} end className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
