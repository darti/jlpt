import { useEffect, useRef, useState, useCallback } from "react";
import { applyUpdate, forceRefresh } from "../lib/pwa.ts";

export function useServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);
  const waiting = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloaded = false;

    const handleControllerChange = () => {
      if (reloaded) return; reloaded = true; location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker.register("sw.js").then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting.current = reg.waiting; setUpdateReady(true);
      }
      const handleUpdateFound = () => {
        const nw = reg.installing; if (!nw) return;
        const handleStateChange = () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            waiting.current = reg.waiting ?? nw; setUpdateReady(true);
          }
        };
        nw.addEventListener("statechange", handleStateChange);
      };
      reg.addEventListener("updatefound", handleUpdateFound);
      reg.update?.();
    }).catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const apply = useCallback(() => {
    setUpdateReady(false);
    if (waiting.current) applyUpdate(waiting.current);
    else location.reload();
  }, []);

  return { updateReady, apply, forceRefresh: async () => forceRefresh() };
}
