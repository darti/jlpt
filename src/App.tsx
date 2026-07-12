import { InstallPrompt } from "./features/pwa/InstallPrompt.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";

/** Dashboard route content (shell lives in AppShell). Sync moved to the Paramétrage route. */
export function DashboardView({ model, days }: { model: DashboardModel | null; days: number }) {
  return (
    <>
      <InstallPrompt />
      <Dashboard model={model} days={days} />
    </>
  );
}

/** Route container: owns progress state only. */
export default function App() {
  const [progress] = useProgress();
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return <DashboardView model={model} days={daysUntilExam(now)} />;
}
