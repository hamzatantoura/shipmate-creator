import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Request browser notification permission and show notifications
 * when new orders arrive (for merchants) or new shipments (for vendors).
 */
export function useRealtimeNotifications(role: "merchant" | "vendor") {
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window)) return;

    // Request permission
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    } else {
      permissionRef.current = Notification.permission;
    }

    const showNotification = (title: string, body: string) => {
      if (permissionRef.current !== "granted") return;
      try {
        new Notification(title, {
          body,
          icon: "/placeholder.svg",
          badge: "/placeholder.svg",
          dir: "rtl",
          lang: "ar",
        });
      } catch {
        // Notification API not supported in this context
      }
    };

    if (role === "merchant") {
      // Listen for new orders for this merchant
      const channel = supabase
        .channel("merchant-orders-notify")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `merchant_id=eq.${user.id}`,
          },
          (payload) => {
            const order = payload.new as any;
            showNotification(
              "🛒 طلب جديد!",
              `طلب جديد من ${order.receiver_name || "عميل"} — ${Number(order.total_amount || 0).toLocaleString()} ل.س`
            );
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }

    if (role === "vendor") {
      // Listen for new shipments (pending pickup)
      const channel = supabase
        .channel("vendor-shipments-notify")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "shipments",
          },
          (payload) => {
            const shipment = payload.new as any;
            showNotification(
              "📦 شحنة جديدة!",
              `شحنة جديدة إلى ${shipment.receiver_name || "—"} — ${shipment.city}`
            );
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user, role]);
}
