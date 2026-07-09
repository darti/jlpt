import { useState, useEffect } from "react";
import { readProgress } from "../../lib/storage.ts";
import type { Progress } from "../../types/progress.ts";

export function useProgress(): Progress | null {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    setProgress(readProgress());
    // Sync across tabs when storage changes (e.g., quiz on another tab)
    const handleStorageChange = () => setProgress(readProgress());
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
  return progress;
}
