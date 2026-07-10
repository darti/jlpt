import { useCallback, useEffect, useState } from "react";

/** Chrome/Android's install prompt event — not yet in lib.dom.d.ts. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export const SHARE_URL = "https://darti.github.io/jlpt/";

export const FALLBACK_LINES = [
  "Pour installer :",
  "• Chrome/Edge : menu ⋮ → « Installer l'application »",
  "• Safari (Mac) : menu Fichier → « Ajouter au Dock »",
] as const;

/** Pure. iPadOS presents its UA as a Mac, so touch support disambiguates it from a real desktop. */
export function isIOS(userAgent: string, maxTouchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Pure. Already running as an installed PWA (Chrome's display-mode media query, or iOS's navigator.standalone). */
export function isStandalone(displayModeStandalone: boolean, navigatorStandalone: boolean | undefined): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

/** Pure. An iOS browser that isn't Safari (Chrome, Firefox, Edge, or an in-app browser) can't add to home screen. */
export function isNonSafariIOS(userAgent: string, ios: boolean): boolean {
  return ios && (/crios|fxios|edgios|gsa/i.test(userAgent) || !/safari/i.test(userAgent));
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayModeStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone(displayModeStandalone, navigatorStandalone);
}

/**
 * Captures `beforeinstallprompt` and exposes the install button's state + iOS guide.
 * All browser-global access is guarded (or deferred to the mount effect) so this hook
 * is safe to call during `renderToStaticMarkup` (no `window`/`matchMedia` at that point).
 */
export function useInstallPrompt() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const maxTouchPoints = typeof navigator === "undefined" ? 0 : (navigator.maxTouchPoints ?? 0);
  const ios = isIOS(userAgent, maxTouchPoints);
  const nonSafariIOS = isNonSafariIOS(userAgent, ios);

  const [visible, setVisible] = useState(() => !detectStandalone());
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !visible) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [visible]);

  const openGuide = useCallback(() => setGuideOpen(true), []);
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const dismissFallback = useCallback(() => setShowFallback(false), []);

  const onInstallClick = useCallback(() => {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(() => {
        setDeferred(null);
        setVisible(false);
      });
      return;
    }
    if (ios) {
      setGuideOpen(true);
      return;
    }
    setShowFallback(true);
  }, [deferred, ios]);

  const label = ios ? "📲 Ajouter à l'écran d'accueil" : "📲 Installer l'application";

  return { visible, label, ios, nonSafariIOS, guideOpen, openGuide, closeGuide, onInstallClick, showFallback, dismissFallback };
}
