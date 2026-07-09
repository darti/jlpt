import { useState, useEffect } from "react";
import { readProgress } from "../../lib/storage.ts";
import type { Progress } from "../../types/progress.ts";

export function useProgress(): Progress | null {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => { setProgress(readProgress()); }, []);
  return progress;
}
