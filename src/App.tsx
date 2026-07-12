import { useEffect, useState } from "react";
import { InstallPrompt } from "./features/pwa/InstallPrompt.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { ProgressChart } from "./features/dashboard/ProgressChart.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { readSessionScores } from "./lib/history.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";

/** Accueil route content (shell lives in AppShell): stats overview + session-score chart.
 *  Sync lives on Paramétrage; the session launcher lives on the Entraînement route. */
export function DashboardView({ model, days, scores }: {
  model: DashboardModel | null; days: number; scores: number[];
}) {
  return (
    <>
      <InstallPrompt />
      <Dashboard model={model} days={days} />
      <section className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
        <h2 className="text-fg text-lg font-bold mt-0 mb-3">Progression</h2>
        <ProgressChart scores={scores} />
      </section>
    </>
  );
}

/** Route container: owns progress + session-score state. */
export default function App() {
  const [progress] = useProgress();
  const [scores, setScores] = useState<number[]>([]);
  useEffect(() => { setScores(readSessionScores()); }, []);
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return <DashboardView model={model} days={daysUntilExam(now)} scores={scores} />;
}
