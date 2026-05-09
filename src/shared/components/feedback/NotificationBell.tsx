import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { toast } from "sonner";

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const FETCH_LIMIT = 30;

function timeAgoAr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return "الآن";
  const min = Math.floor(sec / 60);
  if (min < 60) return `منذ ${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} س`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `منذ ${day} ي`;
  return new Date(iso).toLocaleDateString("ar-SY", {
    year: "2-digit", month: "2-digit", day: "2-digit",
  });
}

export default function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["notifications", user?.id], [user?.id]);

  const { data: notifications = [] } = useQuery<NotificationRow[]>({
    queryKey,
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("id, user_id, title, message, link, is_read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);
      if (error) throw error;
      return (data || []) as unknown as NotificationRow[];
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Realtime: any insert/update for THIS user → invalidate the list.
  // The badge updates instantly because the unread count is derived.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey });
          if (payload.eventType === "INSERT") {
            const row = payload.new as NotificationRow;
            toast.message(row.title, { description: row.message });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryKey, queryClient]);

  const markOneRead = async (id: string) => {
    // Optimistic update
    queryClient.setQueryData<NotificationRow[]>(queryKey, (prev) =>
      (prev || []).map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    const { error } = await supabase
      .from("notifications" as any)
      .update({ is_read: true })
      .eq("id", id);
    if (error) {
      toast.error("تعذّر تحديد الإشعار كمقروء");
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    const previous = queryClient.getQueryData<NotificationRow[]>(queryKey);
    queryClient.setQueryData<NotificationRow[]>(queryKey, (prev) =>
      (prev || []).map((n) => ({ ...n, is_read: true }))
    );
    const { error } = await supabase
      .from("notifications" as any)
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) {
      toast.error("تعذّر تحديث الإشعارات");
      if (previous) queryClient.setQueryData(queryKey, previous);
    }
  };

  if (!user) return null;

  return (
    <Popover>
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
            <CheckCheck className="h-3.5 w-3.5" />
            تحديد الكل كمقروء
          </Button>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-50" />
            <span className="text-xs">لا توجد إشعارات بعد</span>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const Inner = (
                  <div className="flex items-start gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        n.is_read ? "bg-transparent" : "bg-primary"
                      }`}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`text-sm leading-snug ${
                            n.is_read ? "text-muted-foreground" : "text-foreground font-semibold"
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                          {timeAgoAr(n.created_at)}
                        </span>
                      </div>
                      <p
                        className={`text-xs leading-relaxed mt-0.5 ${
                          n.is_read ? "text-muted-foreground/80" : "text-foreground/80"
                        }`}
                      >
                        {n.message}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link to={n.link} onClick={() => !n.is_read && markOneRead(n.id)}>
                        {Inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-right"
                        onClick={() => !n.is_read && markOneRead(n.id)}
                      >
                        {Inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}