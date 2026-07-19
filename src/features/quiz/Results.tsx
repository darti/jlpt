import { PANEL, BTN_PRIMARY } from "../../ui/styles.ts";
/** Session results screen — port of legacy `finish()`'s score line (app-n3.html:968-969). */
export function Results({
  count, right, onRestart,
}: {
  count: number;
  right: number;
  onRestart: () => void;
}) {
  return (
    <div className={`${PANEL} text-center`}>
      <p className="text-fg-dim text-sm mb-1">Résultat de la session</p>
      <p className="text-3xl font-bold text-accent mb-4">{right} / {count}</p>
      <button
        type="button"
        onClick={onRestart}
        className={BTN_PRIMARY}
      >
        Recommencer
      </button>
    </div>
  );
}
