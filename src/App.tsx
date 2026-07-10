import { Header } from "./ui/Header.tsx";
import { TopNav } from "./ui/TopNav.tsx";
import { Footer } from "./ui/Footer.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { InstallPrompt } from "./features/pwa/InstallPrompt.tsx";
import { SyncSection } from "./features/sync/SyncSection.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import { useServiceWorker } from "./hooks/usePwa.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { ThemeName } from "./lib/theme.ts";

/** Pure, prop-driven view — unit-testable without globals. `InstallPrompt`/`SyncSection` read
 * their own browser state from SSR-guarded hooks, so they can be dropped in here without
 * threading install/sync-related props through this view — only the progress-refresh
 * callback crosses the boundary, since a successful pull needs to update the dashboard. */
export function AppView(props: {
  theme: ThemeName; onToggleTheme: () => void;
  updateReady: boolean; onApplyUpdate: () => void; onForceRefresh: () => void;
  model: DashboardModel | null; days: number; version: string;
  onProgressChanged: () => void;
}) {
  return (
    <>
      <Header />
      <TopNav theme={props.theme} onToggleTheme={props.onToggleTheme} />
      <div className="max-w-[680px] mx-auto px-5 pt-6 pb-10">
        <InstallPrompt />
        <Dashboard model={props.model} days={props.days} />
        <SyncSection onProgressChanged={props.onProgressChanged} />
      </div>
      <Footer onForceRefresh={props.onForceRefresh} version={props.version} />
      <UpdateBanner show={props.updateReady} onApply={props.onApplyUpdate} />
    </>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();
  const { updateReady, apply, forceRefresh, version } = useServiceWorker();
  const [progress, refreshProgress] = useProgress();
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return (
    <AppView
      theme={theme} onToggleTheme={toggle}
      updateReady={updateReady} onApplyUpdate={apply} onForceRefresh={forceRefresh}
      model={model} days={daysUntilExam(now)} version={version}
      onProgressChanged={refreshProgress}
    />
  );
}
