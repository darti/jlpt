import { useCallback, useEffect, useState } from "react";
import { Header } from "./ui/Header.tsx";
import { TopNav } from "./ui/TopNav.tsx";
import { Footer } from "./ui/Footer.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { EntrainementHome } from "./features/entrainement/EntrainementHome.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { readSessionScores } from "./lib/history.ts";
import { applyFontScale } from "./lib/fontscale.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { useServiceWorker } from "./hooks/usePwa.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { ThemeName } from "./lib/theme.ts";

/** Pure, prop-driven view — mirrors `AppView`. The leaf features (ResumeBanner, Settings,
 *  SyncSection) read their own browser state from SSR-guarded effects, so only the
 *  progress model/scores/refresh cross this boundary. SSR-renderable: no hooks here. */
export function EntrainementAppView(props: {
  theme: ThemeName; onToggleTheme: () => void;
  updateReady: boolean; onApplyUpdate: () => void; onForceRefresh: () => void; version: string;
  model: DashboardModel | null; days: number; scores: number[];
  onProgressChanged: () => void;
}) {
  return (
    <>
      <Header />
      <TopNav theme={props.theme} onToggleTheme={props.onToggleTheme} />
      <div className="max-w-[680px] mx-auto px-5 pt-6 pb-10">
        <EntrainementHome
          model={props.model}
          days={props.days}
          scores={props.scores}
          theme={props.theme}
          onToggleTheme={props.onToggleTheme}
          onProgressChanged={props.onProgressChanged}
        />
      </div>
      <Footer onForceRefresh={props.onForceRefresh} version={props.version} />
      <UpdateBanner show={props.updateReady} onApply={props.onApplyUpdate} />
    </>
  );
}

export default function EntrainementApp() {
  const { theme, toggle } = useTheme();
  const { updateReady, apply, forceRefresh, version } = useServiceWorker();
  const [progress, refreshProgress] = useProgress();
  const [scores, setScores] = useState<number[]>([]);

  // A Gist pull (or any progress change) must also refresh the chart's session scores.
  const onProgressChanged = useCallback(() => {
    refreshProgress();
    setScores(readSessionScores());
  }, [refreshProgress]);

  // Mount: read the session-score series, apply the persisted font scale, and wire
  // dict.js tap-to-define (app-n3.html loads dict.js). All browser access in the effect.
  useEffect(() => {
    setScores(readSessionScores());
    applyFontScale();
    (window as unknown as { initDefs?: (o: { singleTap: boolean }) => void }).initDefs?.({ singleTap: true });
  }, []);

  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return (
    <EntrainementAppView
      theme={theme} onToggleTheme={toggle}
      updateReady={updateReady} onApplyUpdate={apply} onForceRefresh={forceRefresh} version={version}
      model={model} days={daysUntilExam(now)} scores={scores}
      onProgressChanged={onProgressChanged}
    />
  );
}
