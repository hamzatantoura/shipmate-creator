import { Home, ShoppingCart, Wallet, Store, Settings, Archive } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/use-language";
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

export function MerchantSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { t } = useTranslation("dashboard");
  const { isRtl } = useLanguage();

  const items = [
    { key: "home", url: "/merchant", icon: Home, exact: true },
    { key: "orders", url: "/merchant/orders", icon: ShoppingCart },
    { key: "archive", url: "/merchant/archive", icon: Archive },
    { key: "wallet", url: "/merchant/wallet", icon: Wallet },
    { key: "store", url: "/merchant/products", icon: Store },
    { key: "settings", url: "/merchant/settings", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" side={isRtl ? "right" : "left"}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("merchant.title")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.url
                  : location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={item.url} end className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{t(`merchant.${item.key}`)}</span>}
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
