import { Header } from "./ui/Header.tsx";
import { TopNav } from "./ui/TopNav.tsx";
import { Footer } from "./ui/Footer.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { useServiceWorker } from "./hooks/usePwa.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { ThemeName } from "./lib/theme.ts";

/** Pure, prop-driven view — unit-testable without globals. */
export function AppView(props: {
  theme: ThemeName; onToggleTheme: () => void;
  updateReady: boolean; onApplyUpdate: () => void; onForceRefresh: () => void;
  model: DashboardModel | null; days: number;
}) {
  return (
    <>
      <Header />
      <TopNav theme={props.theme} onToggleTheme={props.onToggleTheme} />
      <div className="max-w-[680px] mx-auto px-5 pt-6 pb-10">
        <Dashboard model={props.model} days={props.days} />
      </div>
      <Footer onForceRefresh={props.onForceRefresh} />
      <UpdateBanner show={props.updateReady} onApply={props.onApplyUpdate} />
    </>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();
  const { updateReady, apply, forceRefresh } = useServiceWorker();
  const progress = useProgress();
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return (
    <AppView
      theme={theme} onToggleTheme={toggle}
      updateReady={updateReady} onApplyUpdate={apply} onForceRefresh={forceRefresh}
      model={model} days={daysUntilExam(now)}
    />
  );
}
