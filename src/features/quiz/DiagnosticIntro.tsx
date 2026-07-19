import { PANEL, H2, BTN_PRIMARY, BTN_GHOST } from "../../ui/styles.ts";
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
    <div className={PANEL}>
      <h2 className={H2}>🧭 Mode test</h2>
      <p className="text-fg-dim text-sm mt-0 mb-2">On évalue ton niveau réel sur toutes les catégories.</p>
      <ul className="text-fg-dim text-sm list-disc pl-5 mt-0 mb-4 flex flex-col gap-1">
        <li>{count} questions, difficultés variées</li>
        <li>pas de correction au fil de l&#39;eau</li>
        <li>ton niveau estimé et le corrigé complet à la fin</li>
      </ul>
      <button
        type="button"
        onClick={onStart}
        className={`w-full ${BTN_PRIMARY}`}
      >
        Commencer le test
      </button>
      <button
        type="button"
        onClick={onLater}
        className={`w-full ${BTN_GHOST} mt-2`}
      >
        Plus tard
      </button>
    </div>
  );
}
