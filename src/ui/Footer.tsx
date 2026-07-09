export function Footer({ onForceRefresh }: { onForceRefresh: () => void }) {
  return (
    <footer className="text-center text-fg-dim text-sm mt-8">
      頑張ってください！ — Bon courage
      <br />
      <button
        type="button"
        onClick={onForceRefresh}
        className="mt-2 text-accent bg-transparent border border-line rounded-full px-3 py-1 cursor-pointer text-sm"
      >
        ↻ Forcer la mise à jour
      </button>
    </footer>
  );
}
