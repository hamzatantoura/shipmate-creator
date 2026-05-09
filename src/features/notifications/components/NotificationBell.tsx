import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, Inbox, ArrowLeft } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useNotifications } from "../hooks/use-notifications";
import { NotificationItem } from "./NotificationItem";
import { NotificationCenter } from "./NotificationCenter";

export default function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markOneRead, markAllRead } = useNotifications();
  const [centerOpen, setCenterOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label={unreadCount > 0 ? `الإشعارات (${unreadCount} غير مقروء)` : "الإشعارات"}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center tabular-nums shadow-sm ring-2 ring-card">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[340px] p-0 overflow-hidden"
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">الإشعارات</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold tabular-nums">
                  {unreadCount}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-[11px]"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-3.5 w-3.5" /> الكل
            </Button>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-50" />
              <span className="text-xs">لا توجد إشعارات بعد</span>
            </div>
          ) : (
            <ScrollArea className="max-h-[360px]">
              <ul className="divide-y divide-border">
                {notifications.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <NotificationItem
                      notification={n}
                      onMarkRead={markOneRead}
                      onNavigate={() => setPopoverOpen(false)}
                      compact
                    />
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}

          <div className="border-t border-border px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 justify-between text-xs"
              onClick={() => {
                setPopoverOpen(false);
                setCenterOpen(true);
              }}
            >
              عرض كل الإشعارات
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Full notification center, controlled via custom trigger above */}
      {centerOpen && (
        <NotificationCenter
          defaultOpen
          trigger={<button hidden aria-hidden />}
        />
      )}
    </>
  );
}