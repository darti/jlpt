import { useState } from "react";
import { FALLBACK_LINES, SHARE_URL, useInstallPrompt } from "./useInstallPrompt.ts";

type CopyStatus = "idle" | "copied" | "manual";

/** Presentational — the iOS "add to home screen" guide. Kept separate from
 * `useInstallPrompt` so it can be unit-tested with `renderToStaticMarkup`
 * regardless of the hook's internal open/closed state. */
export function IosGuideModal({
  nonSafariIOS, onCopy, onClose, copyStatus,
}: {
  nonSafariIOS: boolean; onCopy: () => void; onClose: () => void; copyStatus: CopyStatus;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-drawer flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-panel border border-line rounded-2xl max-w-[360px] w-full p-5 shadow-pop surface-blur">
        <h3 className="mt-0 mb-3 text-lg text-fg">📲 Ajouter à l'écran d'accueil</h3>
        {nonSafariIOS && (
          <div className="bg-danger-bg border border-danger-line text-danger-fg rounded-lg px-3 py-2.5 text-sm mb-3">
            Cette page n'est pas ouverte dans <b>Safari</b>. L'ajout à l'écran d'accueil n'existe que dans
            Safari. Copie le lien et colle-le dans Safari.
          </div>
        )}
        <ol className="m-0 pl-5">
          <li className="my-2 text-sm text-fg">Ouvre la page dans <b>Safari</b> (pas Chrome ni un navigateur intégré).</li>
          <li className="my-2 text-sm text-fg">
            Touche le bouton <b>Partager</b>{" "}
            <span className="inline-flex items-center justify-center w-[26px] h-[26px] border-2 border-accent rounded-md text-accent">↑</span>{" "}
            (barre du bas).
          </li>
          <li className="my-2 text-sm text-fg"><b>Fais défiler la liste</b> vers le bas → <b>« Sur l'écran d'accueil »</b>.</li>
          <li className="my-2 text-sm text-fg">Touche <b>« Ajouter »</b>. (Si l'option manque : Partager → « Modifier les actions » → active-la.)</li>
        </ol>
        <div className="flex gap-2 mt-4">
          <button
            type="button" onClick={onCopy}
            className="flex-1 border-none rounded-lg py-2.5 font-bold text-sm cursor-pointer bg-accent text-fg-on-accent"
          >
            {copyStatus === "copied" ? "✅ Lien copié !" : "🔗 Copier le lien"}
          </button>
          <button
            type="button" onClick={onClose}
            className="flex-1 border border-line rounded-lg py-2.5 font-bold text-sm cursor-pointer bg-panel-2 text-fg"
          >
            Fermer
          </button>
        </div>
        {copyStatus === "manual" && (
          <p className="text-fg-dim text-sm mt-3 mb-0 break-all">
            Copie ce lien et ouvre-le dans Safari : {SHARE_URL}
          </p>
        )}
      </div>
    </div>
  );
}

/** The install button + (when relevant) its iOS guide. Self-contained: reads
 * its own state from `useInstallPrompt`, so it can be dropped anywhere without
 * threading props through the pure `AppView`. */
export function InstallPrompt() {
  const { visible, label, nonSafariIOS, guideOpen, closeGuide, onInstallClick, showFallback, dismissFallback } =
    useInstallPrompt();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  if (!visible) return null;

  const copyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(SHARE_URL).then(
        () => {
          setCopyStatus("copied");
          setTimeout(() => setCopyStatus("idle"), 2000);
        },
        () => setCopyStatus("manual"),
      );
    } else {
      setCopyStatus("manual");
    }
  };

  return (
    <>
      <button
        type="button" onClick={onInstallClick}
        className="block w-full mb-4 bg-accent text-fg-on-accent border-none rounded-xl px-3 py-3 font-bold cursor-pointer"
      >
        {label}
      </button>
      {showFallback && (
        <p className="text-fg-dim text-sm -mt-2 mb-4">
          {FALLBACK_LINES.map((line) => (<span key={line}>{line}<br /></span>))}
          <button type="button" onClick={dismissFallback} className="text-accent bg-transparent border-none cursor-pointer underline p-0 mt-1">
            Fermer
          </button>
        </p>
      )}
      {guideOpen && (
        <IosGuideModal nonSafariIOS={nonSafariIOS} onCopy={copyLink} onClose={closeGuide} copyStatus={copyStatus} />
      )}
    </>
  );
}
