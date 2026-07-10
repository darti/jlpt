export function Footer({ onForceRefresh, version }: { onForceRefresh: () => void; version: string }) {
  return (
    <footer className="text-center text-fg-dim text-sm mt-8">
      頑張ってください！ — Bon courage
      <br />
      <span className="inline-flex items-center gap-2 mt-2">
        <span className="text-meta opacity-70">version {version}</span>
        <button
          type="button"
          onClick={onForceRefresh}
          className="text-accent bg-transparent border border-line rounded-full px-3 py-1 cursor-pointer text-sm"
        >
          ↻ Forcer la mise à jour
        </button>
      </span>
    </footer>
  );
}
