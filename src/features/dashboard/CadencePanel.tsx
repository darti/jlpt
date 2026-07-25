import type { CadenceModel } from "../../lib/cadence.ts";
import { PANEL, H2 } from "../../ui/styles.ts";

/** Panneau Accueil : cadence quotidienne. Sans logique — le modèle vient de `useCadence`,
 *  pur et testé à part. */
export function CadencePanel({ model }: { model: CadenceModel | null }) {
  if (!model) return null;
  const { goal, done, streak, best, reached, daysLeft } = model;
  const record = best > streak ? ` · record ${best}` : "";
  return (
    <section className={PANEL}>
      <h2 className={H2}>Cadence</h2>
      <p className="text-fg text-sm mt-0 mb-2">🔥 Série : {streak} jour(s){record}</p>
      {daysLeft === 0 ? (
        <p className="text-fg-dim text-sm m-0">L&#39;examen est passé — bravo pour le chemin parcouru.</p>
      ) : reached ? (
        <p className="text-fg-dim text-sm m-0">Objectif de maîtrise atteint — continue à consolider.</p>
      ) : (
        <>
          <p className="text-fg text-sm mt-0 mb-2">Objectif du jour : {done} / {goal} apprises</p>
          <div
            role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={goal}
            className="h-2 rounded-full bg-surface-2 overflow-hidden mb-2"
          >
            <div className="h-full bg-accent" style={{ width: `${goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 100}%` }} />
          </div>
          <p className="text-meta text-fg-dim m-0">
            N = (70 % du banc − déjà apprises) ÷ jours avant l&#39;examen ({daysLeft} j).
          </p>
        </>
      )}
    </section>
  );
}
