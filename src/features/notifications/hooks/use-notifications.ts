import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toast } from "sonner";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications-api";
import {
  categorizeNotification,
  type NotificationCategory,
  type NotificationRow,
} from "../lib/types";

/**
 * Single source of truth for notifications: fetches the latest 50 rows for
 * the signed-in user, subscribes to realtime postgres_changes for that user,
 * and exposes optimistic mark-read mutations.
 *
 * UI surfaces (bell popover, full-page center, toasts, push) all consume this
 * hook so state stays consistent across the app.
 */
export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["notifications", user?.id], [user?.id]);

  const { data: notifications = [], isLoading } = useQuery<NotificationRow[]>({
    queryKey,
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: () => fetchNotifications(user!.id),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Realtime subscription — also surfaces a toast for new arrivals.
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
          qc.invalidateQueries({ queryKey });
          if (payload.eventType === "INSERT") {
            const row = payload.new as NotificationRow;
            toast.message(row.title, { description: row.message });
            // Native browser/PWA push if granted
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(row.title, { body: row.message, dir: "rtl", lang: "ar" });
              } catch {
                /* no-op */
              }
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryKey, qc]);

  const markOneRead = async (id: string) => {
    qc.setQueryData<NotificationRow[]>(queryKey, (prev) =>
      (prev || []).map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await markNotificationRead(id);
    } catch {
      toast.error("تعذّر تحديد الإشعار كمقروء");
      qc.invalidateQueries({ queryKey });
    }
  };

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    const previous = qc.getQueryData<NotificationRow[]>(queryKey);
    qc.setQueryData<NotificationRow[]>(queryKey, (prev) =>
      (prev || []).map((n) => ({ ...n, is_read: true }))
    );
    try {
      await markAllNotificationsRead(user.id);
    } catch {
      toast.error("تعذّر تحديث الإشعارات");
      if (previous) qc.setQueryData(queryKey, previous);
    }
  };

  const filterByCategory = (cat: NotificationCategory | "all") =>
    cat === "all"
      ? notifications
      : notifications.filter((n) => categorizeNotification(n) === cat);

  return {
    notifications,
    unreadCount,
    isLoading,
    markOneRead,
    markAllRead,
    filterByCategory,
  };
}