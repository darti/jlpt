import { useMemo } from "react";
import type { Progress, Skill } from "../../types/progress.ts";
import { loadCorpus } from "../../lib/graph.ts";
import { coverageBySkill, decodeBits, type SkillCoverage } from "../../lib/coverage.ts";
import { useAsyncOnce } from "../../hooks/useAsyncOnce.ts";

/** Per-skill coverage from the progress bitsets + les intervalles du corpus. `null` until the
 *  corpus resolves (or if it fails — offline first visit), so callers can hide the rings
 *  gracefully. */
export function useCoverage(p: Progress | null): Record<Skill, SkillCoverage> | null {
  const ranges = useAsyncOnce(loadCorpus);

  const seenB64 = typeof p?.seen === "string" ? p.seen : "";
  const masteredB64 = typeof p?.mastered === "string" ? p.mastered : "";
  return useMemo(() => {
    if (!p || !ranges) return null;
    return coverageBySkill(decodeBits(seenB64), decodeBits(masteredB64), ranges);
  }, [p, ranges, seenB64, masteredB64]);
}
