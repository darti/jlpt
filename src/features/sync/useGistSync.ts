import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearCfg, cloudCreate, cloudPull, cloudPush, findExistingGist, hasPending, readCfg, writeCfg,
  type GistDeps, type PullResult,
} from "../../lib/gist.ts";
import { readTheme } from "../../lib/theme.ts";

export type SyncTone = "ok" | "bad" | "neutral";

const INITIAL_STATUS = "Non connecté. Synchronise ta progression entre appareils via un Gist GitHub privé.";

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Owns the "Synchronisation multi-appareils" state/actions. All browser-global access (localStorage,
 * fetch, document, window, navigator) is confined to effects/callbacks — never touched during the
 * render pass itself — so this hook is safe to call under `renderToStaticMarkup` (SSR).
 */
export function useGistSync(onProgressChanged: () => void) {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [tone, setTone] = useState<SyncTone>("neutral");
  const [connected, setConnected] = useState(false);
  const [gistId, setGistId] = useState("");
  const [busy, setBusy] = useState(false);

  const deps = useMemo<GistDeps>(() => ({ store: globalThis.localStorage, fetchImpl: globalThis.fetch }), []);

  const syncCfgState = useCallback(() => {
    const cfg = readCfg(deps.store);
    if (cfg && cfg.token && cfg.gist) { setConnected(true); setGistId(cfg.gist); }
    else { setConnected(false); setGistId(""); }
  }, [deps]);

  const refreshThemeAndProgress = useCallback(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", readTheme(deps.store));
    }
    onProgressChanged();
  }, [deps, onProgressChanged]);

  /** Runs `cloudPull` and reflects its outcome as a status message (verbatim French, matching app-n3.html). */
  const doPull = useCallback(async (manual: boolean): Promise<PullResult> => {
    const result = await cloudPull(deps, manual);
    switch (result.kind) {
      case "not-configured": break;
      case "missing-file":
        setStatus("Fichier introuvable dans le Gist (vérifie l'ID)."); setTone("bad"); break;
      case "unreadable":
        setStatus(`Données distantes illisibles : ${result.message}`); setTone("bad"); break;
      case "cancelled": break;
      case "unusable":
        setStatus("Le Gist ne contient pas de progression exploitable (format inattendu ou vide)."); setTone("bad"); break;
      case "applied":
        setStatus("Récupéré depuis le cloud."); setTone("ok"); refreshThemeAndProgress(); break;
      case "up-to-date":
        if (manual) { setStatus("Local déjà à jour (rien de plus récent en ligne)."); setTone("ok"); }
        break;
    }
    return result;
  }, [deps, refreshThemeAndProgress]);

  const connect = useCallback(async (token: string, gist: string) => {
    const t = token.trim();
    const g = gist.trim();
    if (!t) { setStatus("Renseigne un token."); setTone("bad"); return; }
    setBusy(true);
    writeCfg(deps.store, { token: t, gist: g });
    setStatus("Connexion…"); setTone("neutral");
    try {
      if (g) {
        await doPull(true);
      } else {
        setStatus("Recherche d'un Gist existant…"); setTone("neutral");
        const found = await findExistingGist(deps);
        if (found) {
          writeCfg(deps.store, { token: t, gist: found });
          await doPull(true);
        } else {
          await cloudCreate(deps);
          setStatus("Gist privé créé. Progression sauvegardée."); setTone("ok");
        }
      }
      syncCfgState();
    } catch (e) {
      setStatus(`Échec : ${errorMessage(e)}`); setTone("bad");
    } finally {
      setBusy(false);
    }
  }, [deps, doPull, syncCfgState]);

  const disconnect = useCallback(() => {
    clearCfg(deps.store);
    setConnected(false); setGistId("");
    setStatus("Déconnecté. Données conservées localement."); setTone("neutral");
  }, [deps]);

  const pull = useCallback(async () => {
    setBusy(true);
    try {
      await doPull(true);
    } catch (e) {
      setStatus(`Échec : ${errorMessage(e)}`); setTone("bad");
    } finally {
      setBusy(false);
    }
  }, [doPull]);

  const copyId = useCallback(() => {
    if (!gistId) return;
    const succeed = () => { setStatus(`ID du Gist copié : ${gistId}`); setTone("ok"); };
    const fail = () => { setStatus(`Copie impossible — ID : ${gistId}`); setTone("bad"); };
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = gistId;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        succeed();
      } catch { fail(); }
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(gistId).then(succeed, fallback);
    } else {
      fallback();
    }
  }, [gistId]);

  // Pull on load, then flush anything that failed to push while we were away (`cloudInit`, ported).
  useEffect(() => {
    syncCfgState();
    const cfg = readCfg(deps.store);
    if (!cfg || !cfg.token || !cfg.gist) return;
    (async () => {
      try {
        await doPull(false);
      } catch (e) {
        setStatus(`Synchro indisponible : ${errorMessage(e)}`); setTone("bad");
        return;
      }
      if (hasPending(deps.store)) await cloudPush(deps, false);
    })();
    // Runs once on mount, mirroring legacy's cloudInit.
  }, []);

  // Resync on reconnect; flush a pending push before the tab is hidden/closed.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOnline = () => {
      const cfg = readCfg(deps.store);
      if (cfg?.token && cfg.gist && hasPending(deps.store)) {
        setStatus("Connexion rétablie — synchronisation…"); setTone("neutral");
        cloudPush(deps, true).then((result) => {
          if (result.kind === "pushed") { setStatus("Envoyé vers le cloud."); setTone("ok"); }
          else if (result.kind === "failed") { setStatus(`Envoi reporté (sera resynchronisé) : ${result.message}`); setTone("bad"); }
        });
      }
    };
    const flushPending = () => {
      const cfg = readCfg(deps.store);
      if (cfg?.token && cfg.gist && hasPending(deps.store)) void cloudPush(deps, false);
    };
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") flushPending(); };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushPending);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushPending);
    };
  }, [deps]);

  return { status, tone, connected, gistId, busy, connect, disconnect, pull, copyId };
}
