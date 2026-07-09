import type { DashboardModel } from "../../lib/scoring.ts";
import { SKILLS, type Skill } from "../../types/progress.ts";

const LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture",
};
const BAR: Record<Skill, string> = {
  grammaire: "bg-skill-grammaire", vocabulaire: "bg-skill-vocabulaire",
  kanji: "bg-skill-kanji", lecture: "bg-skill-lecture",
};

// Pure presentational component. Model validation (null check, shape verification) is deferred
// to the parent/caller (see useProgress hook). This component only checks for empty data state.
export function Dashboard({ model, days }: { model: DashboardModel | null; days: number }) {
  if (!model || model.answers === 0) {
    return (
      <div className="bg-panel border border-line rounded-xl px-6 py-5 mb-6">
        <p className="text-fg-dim text-sm m-0">
          Aucune donnée pour l'instant — lance un quiz dans l'entraînement adaptatif
          pour générer ton analyse. ({days} jours avant l'examen)
        </p>
      </div>
    );
  }
  const pct = model.hasEnough ? `${model.passPct}%` : "?";
  const score = model.hasEnough ? `${model.sectionTotal}/180` : "—";
  return (
    <div className="bg-panel border border-line rounded-xl px-6 py-5 mb-6">
      <div className="grid grid-cols-2 gap-2 text-center mb-3">
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className="text-xl font-bold text-status-completed">{pct}</div>
          <div className="text-meta text-fg-dim">réussite estimée</div>
        </div>
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className="text-xl font-bold text-accent">{score}</div>
          <div className="text-meta text-fg-dim">score estimé</div>
        </div>
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className="text-xl font-bold text-prio-high">{model.level}</div>
          <div className="text-meta text-fg-dim">niveau</div>
        </div>
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className="text-xl font-bold text-status-completed">{days}</div>
          <div className="text-meta text-fg-dim">jours restants</div>
        </div>
      </div>
      {SKILLS.map((c) => {
        const m = Math.round(model.skillMastery[c] * 100);
        return (
          <div key={c} className="flex items-center gap-2 my-1 text-sm">
            <span className="w-24 text-fg-dim">{LABELS[c]}</span>
            <div className="flex-1 h-[9px] bg-surface-2 rounded-full overflow-hidden border border-line">
              <div className={`h-full ${BAR[c]}`} style={{ width: `${m}%` }} />
            </div>
            <span className="w-9 text-right text-fg-dim">{m}%</span>
          </div>
        );
      })}
      <p className="text-fg-dim text-sm mt-2">
        {model.answers} réponses · fiabilité {Math.round(model.confidence * 100)}%
      </p>
    </div>
  );
}
