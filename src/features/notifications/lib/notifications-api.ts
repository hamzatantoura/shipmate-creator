import { supabase } from "@/integrations/supabase/client";
import type { NotificationRow } from "./types";

const FETCH_LIMIT = 50;

export async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications" as any)
    .select("id, user_id, title, message, link, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);
  if (error) throw error;
  return (data || []) as unknown as NotificationRow[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications" as any)
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications" as any)
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}