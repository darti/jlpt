import { useState } from "react";

export function Footer({ onForceRefresh, version }: { onForceRefresh: () => void | Promise<void>; version: string }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    // Guarantee the « Mise à jour… » state is painted and briefly visible even when there is
    // nothing new to fetch — forceRefresh() clears the caches and reloads near-instantly
    // otherwise, so the click would produce no perceptible acknowledgement.
    await new Promise((r) => setTimeout(r, 300));
    await onForceRefresh(); // désinscrit le SW + vide les caches + recharge la page
  };

  return (
    <footer className="text-center text-fg-dim text-sm mt-8">
      頑張ってください！ — Bon courage
      <br />
      <span className="inline-flex items-center gap-2 mt-2">
        <span className="text-meta opacity-70">version {version}</span>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          aria-busy={busy}
          className={`text-accent bg-transparent border border-line rounded-full px-3 py-1 text-sm ${busy ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
        >
          <span className={busy ? "jlpt-spin" : "inline-block"} aria-hidden="true">↻</span>{" "}
          {busy ? "Mise à jour…" : "Forcer la mise à jour"}
        </button>
      </span>
    </footer>
  );
}
