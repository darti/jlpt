import { passTier, type DashboardModel } from "../../lib/scoring.ts";
import { BAR_SKILLS, type Skill } from "../../types/progress.ts";

const LABELS = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture",
} as Record<Skill, string>;
const BAR = {
  grammaire: "bg-skill-grammaire", vocabulaire: "bg-skill-vocabulaire",
  kanji: "bg-skill-kanji", lecture: "bg-skill-lecture",
} as Record<Skill, string>;
const TIER_COLOR = {
  ok: "text-status-completed", warn: "text-prio-high", bad: "text-status-failed",
} as const;

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
  const pctColor = TIER_COLOR[passTier(model.passPct)];
  return (
    <div className="bg-panel border border-line rounded-xl px-6 py-5 mb-6">
      <div className="grid grid-cols-2 gap-2 text-center mb-3">
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className={`text-xl font-bold ${pctColor}`}>{pct}</div>
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
      {model.hasEnough && (
        <div className="h-3 rounded-full bg-surface-2 border border-line relative mb-3">
          <div
            className="absolute w-[3px] h-5 -top-1 rounded bg-accent"
            style={{ left: `clamp(1%, ${model.passPct}%, 99%)` }}
          />
        </div>
      )}
      {BAR_SKILLS.map((c) => {
        const m = model.barMastery[c];
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
