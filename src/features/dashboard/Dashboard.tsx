import { passTier, type DashboardModel } from "../../lib/scoring.ts";
import { SkillChart } from "./SkillChart.tsx";
import { PassGauge } from "./PassGauge.tsx";
import { CoverageRings } from "./CoverageRings.tsx";
import type { SkillCoverage } from "../../lib/coverage.ts";
import type { Skill } from "../../types/progress.ts";

const TIER_COLOR = {
  ok: "text-status-completed", warn: "text-prio-high", bad: "text-status-failed",
} as const;

// Pure presentational component. Model validation (null check, shape verification) is deferred
// to the parent/caller (see useProgress hook). This component only checks for empty data state.
export function Dashboard(
  { model, days, coverage }:
  { model: DashboardModel | null; days: number; coverage?: Record<Skill, SkillCoverage> | null },
) {
  if (!model || model.answers === 0) {
    return (
      <div className="bg-panel border border-line rounded-xl px-6 py-5 mb-6 shadow-card surface-blur">
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
    <div className="bg-panel border border-line rounded-xl px-6 py-5 mb-6 shadow-card surface-blur">
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
      {model.hasEnough && <PassGauge passPct={model.passPct} />}
      <SkillChart mastery={model.barMastery} />
      {coverage && <CoverageRings coverage={coverage} />}
      <p className="text-fg-dim text-sm mt-2">
        {model.answers} réponses · fiabilité {Math.round(model.confidence * 100)}%
      </p>
    </div>
  );
}
