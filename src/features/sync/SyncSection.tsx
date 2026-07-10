import { useState } from "react";
import { useGistSync, type SyncTone } from "./useGistSync.ts";

const TONE_CLASS: Record<SyncTone, string> = {
  ok: "text-status-completed",
  bad: "text-danger-fg",
  neutral: "text-fg-dim",
};

const FIELD_CLASS = "w-full px-2.5 py-2.5 rounded-lg border border-line bg-panel-2 text-fg my-1.5";
const GHOST_BUTTON_CLASS =
  "bg-panel-2 text-fg border-none rounded-2xl px-4 py-2.5 font-bold cursor-pointer disabled:opacity-60 disabled:cursor-default";

/**
 * "Synchronisation multi-appareils" card. Self-contained: owns its own state via `useGistSync`
 * (SSR-safe, like `InstallPrompt`), so it can be dropped into the pure `AppView` without threading
 * sync-related props through it — only the progress-refresh callback crosses that boundary.
 */
export function SyncSection({ onProgressChanged }: { onProgressChanged: () => void }) {
  const { status, tone, connected, gistId, busy, connect, disconnect, pull, copyId } = useGistSync(onProgressChanged);
  const [token, setToken] = useState("");
  const [gist, setGist] = useState("");

  return (
    <div className="bg-panel border border-line rounded-xl px-6 py-[22px] mb-6 shadow-card surface-blur">
      <h2 className="mt-0 text-lg text-fg">Synchronisation multi-appareils</h2>
      <p className={`text-sm m-0 mb-3 ${TONE_CLASS[tone]}`}>{status}</p>

      {!connected && (
        <div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token GitHub classic (scope : gist)"
            className={FIELD_CLASS}
          />
          <input
            type="text"
            value={gist}
            onChange={(e) => setGist(e.target.value)}
            placeholder="Gist ID (laisser vide : retrouvé ou créé automatiquement)"
            className={FIELD_CLASS}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => connect(token, gist)}
            className={`block w-full my-2 ${GHOST_BUTTON_CLASS}`}
          >
            Connecter &amp; synchroniser
          </button>
          <p className="text-fg-dim text-meta mt-1.5 mb-0">
            Erreur 403 ? Le token n'a pas le droit « gist ». Le plus fiable :{" "}
            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=jlpt-sync"
              target="_blank"
              rel="noreferrer"
              className="text-accent"
            >
              créer un token <b>classic</b>
            </a>{" "}
            et cocher <b>uniquement la case « gist »</b>. (Les tokens fine-grained échouent souvent à créer un Gist.)
            Le token reste stocké dans ce navigateur uniquement.
          </p>
        </div>
      )}

      {connected && (
        <div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" disabled={busy} onClick={() => void pull()} className={GHOST_BUTTON_CLASS}>
              Récupérer
            </button>
            <button
              type="button"
              onClick={disconnect}
              className="bg-transparent border border-line text-fg-dim rounded-lg px-3 py-1.5 text-sm cursor-pointer"
            >
              Déconnecter
            </button>
          </div>
          <p className="text-fg-dim text-meta mt-1.5 mb-0">
            Gist :{" "}
            <span
              onClick={copyId}
              title="Cliquer pour copier l'ID complet"
              className="text-accent underline decoration-dashed cursor-pointer"
            >
              {gistId.slice(0, 8)}…
            </span>{" "}
            · <a href={`https://gist.github.com/${gistId}`} target="_blank" rel="noreferrer" className="text-accent">
              ouvrir
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
