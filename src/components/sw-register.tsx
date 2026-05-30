"use client";

import { useEffect } from "react";

// Registers the service worker on mount. Its only job is to make the app
// installable (Chrome/Android needs an active SW with a fetch handler before
// it will fire beforeinstallprompt). No offline caching.
export default function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore — install button just won't show on unsupported browsers.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
