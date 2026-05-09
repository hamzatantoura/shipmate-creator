import { useCallback, useEffect, useState } from "react";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

/**
 * Thin wrapper around the browser Notification API so the UI can offer
 * a single "enable push" toggle. Service-worker push (PWA) can be layered
 * on top later; this already covers desktop + mobile foreground alerts.
 */
export function usePushNotifications() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<PermissionState>(() =>
    supported ? (Notification.permission as PermissionState) : "unsupported"
  );

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission as PermissionState);
  }, [supported]);

  const request = useCallback(async () => {
    if (!supported) return "unsupported" as PermissionState;
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
    if (result === "granted") {
      try {
        new Notification("تم تفعيل الإشعارات", {
          body: "ستصلك تنبيهات فورية عند وصول طلبات أو تحديثات جديدة.",
          dir: "rtl",
          lang: "ar",
        });
      } catch {
        /* no-op */
      }
    }
    return result as PermissionState;
  }, [supported]);

  return { supported, permission, request };
}