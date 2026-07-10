import { useEffect, useRef, useState, useCallback } from "react";
import { applyUpdate, forceRefresh, maxCacheVersion, parseVersionMessage } from "../lib/pwa.ts";

export function useServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);
  const [version, setVersion] = useState("—");
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

  // Numéro de version = nom du cache du service worker actif (source unique).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const scanCaches = () => {
      if (!globalThis.caches?.keys) return;
      globalThis.caches.keys().then((keys) => {
        const v = maxCacheVersion(keys);
        if (v) setVersion(v);
      }).catch(() => {});
    };

    // Meilleure source : on demande directement au service worker actif son nom de cache.
    const askSW = () => {
      navigator.serviceWorker.ready.then((reg) => {
        const w = navigator.serviceWorker.controller ?? reg.active;
        if (!w) return;
        const ch = new MessageChannel();
        ch.port1.onmessage = (ev) => {
          const v = parseVersionMessage(ev.data);
          if (v) setVersion(v);
        };
        w.postMessage({ type: "VERSION" }, [ch.port2]);
      }).catch(() => {});
    };

    scanCaches(); // repli immédiat : le nom du cache le plus récent
    askSW();
    navigator.serviceWorker.addEventListener("controllerchange", askSW);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", askSW);
    };
  }, []);

  const apply = useCallback(() => {
    setUpdateReady(false);
    if (waiting.current) applyUpdate(waiting.current);
    else location.reload();
  }, []);

  return { updateReady, apply, forceRefresh: async () => forceRefresh(), version };
}
