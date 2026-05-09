import { useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, CheckCheck, Inbox, BellRing, BellOff, Loader2,
} from "lucide-react";
import { useNotifications } from "../hooks/use-notifications";
import { usePushNotifications } from "../hooks/use-push-notifications";
import { NotificationItem } from "./NotificationItem";
import { categorizeNotification, type NotificationCategory } from "../lib/types";

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NotificationCenter({ trigger, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const { notifications, unreadCount, isLoading, markAllRead, markOneRead } = useNotifications();
  const { supported, permission, request } = usePushNotifications();
  const [tab, setTab] = useState<"all" | "unread" | NotificationCategory>("all");

  const filtered = useMemo(() => {
    if (tab === "all") return notifications;
    if (tab === "unread") return notifications.filter((n) => !n.is_read);
    return notifications.filter((n) => categorizeNotification(n) === tab);
  }, [notifications, tab]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bell className="h-4 w-4" /> الإشعارات
            {unreadCount > 0 && <Badge className="h-5 min-w-[18px] px-1">{unreadCount}</Badge>}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="left" dir="rtl" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" /> مركز الإشعارات
              {unreadCount > 0 && (
                <Badge className="h-5 min-w-[20px] px-1.5">{unreadCount}</Badge>
              )}
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-3.5 w-3.5" /> تحديد الكل
            </Button>
          </div>

          {/* Push toggle */}
          {supported && permission !== "granted" && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {permission === "denied" ? (
                  <BellOff className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <BellRing className="h-4 w-4 text-primary shrink-0" />
                )}
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold">تنبيهات فورية على المتصفح</div>
                  <div className="text-muted-foreground">
                    {permission === "denied"
                      ? "التنبيهات محظورة — فعّلها من إعدادات المتصفح."
                      : "فعّل لتصلك التحديثات حتى عند إغلاق التبويب."}
                  </div>
                </div>
              </div>
              {permission !== "denied" && (
                <Button size="sm" className="h-7 text-xs shrink-0" onClick={request}>
                  تفعيل
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="px-3 pt-2">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start gap-1 h-9">
            <TabsTrigger value="all" className="text-xs h-7">الكل</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs h-7">
              غير مقروء {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="merchant" className="text-xs h-7">المتجر</TabsTrigger>
            <TabsTrigger value="courier" className="text-xs h-7">الشحن</TabsTrigger>
            <TabsTrigger value="admin" className="text-xs h-7">الإدارة</TabsTrigger>
            <TabsTrigger value="system" className="text-xs h-7">النظام</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-40" />
              <span className="text-xs">لا توجد إشعارات</span>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((n) => (
                <li key={n.id}>
                  <NotificationItem
                    notification={n}
                    onMarkRead={markOneRead}
                    onNavigate={() => setOpen(false)}
                  />
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}