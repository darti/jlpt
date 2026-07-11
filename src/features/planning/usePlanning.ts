import { useCallback, useEffect, useState } from "react";
import type { Week } from "./weeks.ts";

export type PlanState = Record<string, boolean>;
const KEY = "jlptN3progress_v1";
const UPDATED_KEY = "jlptN3_updatedAt";

/** Checked count / total tasks / percentage across the whole plan. */
export function progressOf(state: PlanState, weeks: Week[]): { done: number; total: number; pct: number } {
  const total = weeks.reduce((s, w) => s + w.items.length, 0);
  const done = Object.values(state).filter(Boolean).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Checked items within one week (1-based `weekNo`, key format `${weekNo}_${itemIdx}`). */
export function weekDone(state: PlanState, weekNo: number, itemCount: number): number {
  let n = 0;
  for (let j = 0; j < itemCount; j++) if (state[`${weekNo}_${j}`]) n++;
  return n;
}

function readState(): PlanState {
  try {
    const v = JSON.parse(globalThis.localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as PlanState) : {};
  } catch { return {}; }
}
function writeState(state: PlanState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(UPDATED_KEY, new Date().toISOString()); }
  catch { /* best-effort */ }
}

/** Planner checkbox state persisted to `jlptN3progress_v1`. Initial render uses `{}`
 *  (SSR-safe); a mount effect hydrates from localStorage. */
export function usePlanning(): { state: PlanState; toggle: (weekNo: number, itemIdx: number) => void; reset: () => void } {
  const [state, setState] = useState<PlanState>({});
  useEffect(() => { setState(readState()); }, []);

  const toggle = useCallback((weekNo: number, itemIdx: number) => {
    setState((prev) => {
      const key = `${weekNo}_${itemIdx}`;
      const next = { ...prev, [key]: !prev[key] };
      writeState(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => { setState({}); writeState({}); }, []);

  return { state, toggle, reset };
}
