/**
 * Charge la progression de cours une fois (localStorage), expose un toggle
 * qui cycle + persiste.
 */
import { useCallback, useState } from "react";
import {
  loadCoursProgress,
  saveCoursProgress,
  cycleState,
  setItemState,
  type CoursProgress,
} from "./coursProgress.ts";

export function useCoursProgress(): {
  progress: CoursProgress;
  toggle: (id: string) => void;
} {
  const [progress, setProgress] = useState<CoursProgress>(() =>
    loadCoursProgress()
  );
  const toggle = useCallback((id: string) => {
    setProgress((cur) => {
      const next = setItemState(cur, id, cycleState(cur[id]));
      saveCoursProgress(next);
      return next;
    });
  }, []);
  return { progress, toggle };
}
