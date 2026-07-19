import { useMemo } from "react";
import type { Progress, Skill } from "../../types/progress.ts";
import { loadBankIndex } from "../../lib/bank.ts";
import { coverageBySkill, decodeBits, type SkillCoverage } from "../../lib/coverage.ts";
import { useAsyncOnce } from "../../hooks/useAsyncOnce.ts";

/** Per-skill coverage from the progress bitsets + bank-index. `null` until the index resolves
 *  (or if it fails — offline first visit), so callers can hide the rings gracefully. */
export function useCoverage(p: Progress | null): Record<Skill, SkillCoverage> | null {
  const index = useAsyncOnce(loadBankIndex);

  const seenB64 = typeof p?.seen === "string" ? p.seen : "";
  const masteredB64 = typeof p?.mastered === "string" ? p.mastered : "";
  return useMemo(() => {
    if (!p || !index) return null;
    return coverageBySkill(decodeBits(seenB64), decodeBits(masteredB64), index);
  }, [p, index, seenB64, masteredB64]);
}
