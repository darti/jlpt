import { useCallback, useEffect, useState } from "react";
import { EntrainementHome } from "./features/entrainement/EntrainementHome.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { readSessionScores } from "./lib/history.ts";
import { useThemeContext } from "./hooks/useThemeContext.tsx";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { ThemeName } from "./lib/theme.ts";

/** Entrainement route content (shell + dict/font-scale now in AppShell). Prop-driven;
 *  the leaf features own their SSR-guarded effects. */
export function EntrainementAppView(props: {
  theme: ThemeName; onToggleTheme: () => void;
  model: DashboardModel | null; days: number; scores: number[]; onProgressChanged: () => void;
}) {
  return (
    <EntrainementHome
      model={props.model}
      days={props.days}
      scores={props.scores}
      theme={props.theme}
      onToggleTheme={props.onToggleTheme}
      onProgressChanged={props.onProgressChanged}
    />
  );
}

export default function EntrainementApp() {
  const { theme, toggle } = useThemeContext();
  const [progress, refreshProgress] = useProgress();
  const [scores, setScores] = useState<number[]>([]);

  const onProgressChanged = useCallback(() => {
    refreshProgress();
    setScores(readSessionScores());
  }, [refreshProgress]);

  useEffect(() => { setScores(readSessionScores()); }, []);

  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return (
    <EntrainementAppView
      theme={theme} onToggleTheme={toggle}
      model={model} days={daysUntilExam(now)} scores={scores} onProgressChanged={onProgressChanged}
    />
  );
}
