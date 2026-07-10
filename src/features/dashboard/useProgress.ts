import { useState, useEffect, useCallback } from "react";
import { readProgress } from "../../lib/storage.ts";
import type { Progress } from "../../types/progress.ts";

/** Returns the current progress plus a `refresh` to re-read it (e.g. after a Gist sync pull). */
export function useProgress(): [Progress | null, () => void] {
  const [progress, setProgress] = useState<Progress | null>(null);
  const refresh = useCallback(() => setProgress(readProgress()), []);
  useEffect(() => { refresh(); }, [refresh]);
  return [progress, refresh];
}
