import { createRoot } from "react-dom/client";
import App from "@/app/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// PWA: register service worker only in production, outside iframes,
// and never on Lovable preview hosts.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovableproject-dev.com") ||
  host.includes("lovable.app");

if (isInIframe || isPreviewHost) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
} else if (import.meta.env.PROD && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
