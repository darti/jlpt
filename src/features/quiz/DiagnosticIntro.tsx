/** Diagnostic intro: notifies the learner they're entering a test (no per-question corrigé,
 *  full report at the end). [Commencer le test] starts it; [Plus tard] runs a normal session
 *  instead (the diagnostic is never forced). Pure / prop-driven. */
export function DiagnosticIntro({
  count, onStart, onLater,
}: {
  count: number;
  onStart: () => void;
  onLater: () => void;
}) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
      <h2 className="text-fg text-lg font-bold mt-0 mb-2">🧭 Mode test</h2>
      <p className="text-fg-dim text-sm mt-0 mb-2">On évalue ton niveau réel sur toutes les catégories.</p>
      <ul className="text-fg-dim text-sm list-disc pl-5 mt-0 mb-4 flex flex-col gap-1">
        <li>{count} questions, difficultés variées</li>
        <li>pas de correction au fil de l&#39;eau</li>
        <li>ton niveau estimé et le corrigé complet à la fin</li>
      </ul>
      <button
        type="button"
        onClick={onStart}
        className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
      >
        Commencer le test
      </button>
      <button
        type="button"
        onClick={onLater}
        className="w-full bg-transparent border border-line text-fg-dim rounded-xl px-4 py-2.5 text-sm cursor-pointer mt-2"
      >
        Plus tard
      </button>
    </div>
  );
}
