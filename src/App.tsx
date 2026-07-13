import { useEffect, useState } from "react";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { ProgressChart } from "./features/dashboard/ProgressChart.tsx";
import { MethodeN3 } from "./features/dashboard/MethodeN3.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { useCoverage } from "./features/dashboard/useCoverage.ts";
import { readSessionScores } from "./lib/history.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { SkillCoverage } from "./lib/coverage.ts";
import type { Skill } from "./types/progress.ts";

/** Accueil route content (shell lives in AppShell): stats overview, session-score chart, and the collapsible « Méthode N3 » section.
 *  Sync lives on Paramétrage; the session launcher lives on the Entraînement route. */
export function DashboardView({ model, days, scores, coverage }: {
  model: DashboardModel | null; days: number; scores: number[];
  coverage?: Record<Skill, SkillCoverage> | null;
}) {
  return (
    <>
      <Dashboard model={model} days={days} coverage={coverage} />
      <section className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
        <h2 className="text-fg text-lg font-bold mt-0 mb-3">Progression</h2>
        <ProgressChart scores={scores} />
      </section>
      <MethodeN3 />
    </>
  );
}

/** Route container: owns progress + session-score state. */
export default function App() {
  const [progress] = useProgress();
  const coverage = useCoverage(progress);
  const [scores, setScores] = useState<number[]>([]);
  useEffect(() => { setScores(readSessionScores()); }, []);
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return <DashboardView model={model} days={daysUntilExam(now)} scores={scores} coverage={coverage} />;
}
