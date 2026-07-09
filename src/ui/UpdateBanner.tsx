export function UpdateBanner({ show, onApply }: { show: boolean; onApply: () => void }) {
  if (!show) return null;
  return (
    <div className="fixed left-3 right-3 bottom-3 z-toast bg-accent text-fg-on-accent rounded-xl px-4 py-3 flex items-center gap-3 shadow-hover max-w-[560px] mx-auto" role="alert">
      <span>Nouvelle version disponible.</span>
      <button
        type="button"
        onClick={onApply}
        className="ml-auto bg-fg-on-accent text-bg border-none rounded-lg px-4 py-2 font-bold cursor-pointer"
      >
        Recharger
      </button>
    </div>
  );
}
