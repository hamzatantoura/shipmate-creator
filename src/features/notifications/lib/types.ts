export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export type NotificationCategory = "merchant" | "courier" | "admin" | "system";

/**
 * Infer a category from the notification's deep-link so the UI can group
 * and filter notifications by role context.
 */
export function categorizeNotification(n: Pick<NotificationRow, "link" | "title">): NotificationCategory {
  const link = (n.link || "").toLowerCase();
  if (link.startsWith("/admin")) return "admin";
  if (link.startsWith("/courier")) return "courier";
  if (link.startsWith("/merchant") || link.startsWith("/topup") || link.startsWith("/orders")) return "merchant";
  return "system";
}

export function timeAgoAr(iso: string): string {
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