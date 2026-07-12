import { useEffect, useMemo, useState } from "react";
import type { Progress, Skill } from "../../types/progress.ts";
import { loadBankIndex } from "../../lib/bank.ts";
import { coverageBySkill, decodeBits, type SkillCoverage } from "../../lib/coverage.ts";

/** Per-skill coverage from the progress bitsets + bank-index. `null` until the index resolves
 *  (or if it fails — offline first visit), so callers can hide the rings gracefully. */
export function useCoverage(p: Progress | null): Record<Skill, SkillCoverage> | null {
  const [index, setIndex] = useState<Record<number, Skill> | null>(null);
  useEffect(() => {
    let alive = true;
    loadBankIndex().then((idx) => { if (alive) setIndex(idx); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const seenB64 = typeof p?.seen === "string" ? p.seen : "";
  const masteredB64 = typeof p?.mastered === "string" ? p.mastered : "";
  return useMemo(() => {
    if (!p || !index) return null;
    return coverageBySkill(decodeBits(seenB64), decodeBits(masteredB64), index);
  }, [p, index, seenB64, masteredB64]);
}
