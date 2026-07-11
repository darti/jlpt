import { InstallPrompt } from "./features/pwa/InstallPrompt.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { SyncSection } from "./features/sync/SyncSection.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";

/** Dashboard route content (shell now lives in AppShell). Pure/prop-driven. */
export function DashboardView({ model, days, onProgressChanged }: {
  model: DashboardModel | null; days: number; onProgressChanged: () => void;
}) {
  return (
    <>
      <InstallPrompt />
      <Dashboard model={model} days={days} />
      <SyncSection onProgressChanged={onProgressChanged} />
    </>
  );
}

/** Route container: owns progress state only. */
export default function App() {
  const [progress, refreshProgress] = useProgress();
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return <DashboardView model={model} days={daysUntilExam(now)} onProgressChanged={refreshProgress} />;
}
