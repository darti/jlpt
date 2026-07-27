import { useMemo } from "react";
import type { Progress, Skill } from "../../types/progress.ts";
import { loadCorpus } from "../../lib/graph.ts";
import { asBitsB64 } from "../../lib/blob.ts";
import { coverageBySkill, decodeBits, type SkillCoverage } from "../../lib/coverage.ts";
import { useAsyncOnce } from "../../hooks/useAsyncOnce.ts";

/** Couverture par compétence depuis les bitsets de progression + les intervalles du corpus.
 *  `null` tant que le corpus n'a pas résolu (ou s'il échoue — première visite hors ligne),
 *  pour que l'appelant masque les anneaux proprement.
 *
 *  ⚠ La mémoïsation porte sur les chaînes base64, pas sur les bitsets décodés : un
 *  `Uint8Array` serait une référence neuve à chaque rendu et le `useMemo` ne tiendrait
 *  jamais. D'où `asBitsB64` ici et `decodeBits` seulement dans le calcul. */
export function useCoverage(p: Progress | null): Record<Skill, SkillCoverage> | null {
  const ranges = useAsyncOnce(loadCorpus);

  const seenB64 = asBitsB64(p, "seen");
  const masteredB64 = asBitsB64(p, "mastered");
  return useMemo(() => {
    if (!p || !ranges) return null;
    return coverageBySkill(decodeBits(seenB64), decodeBits(masteredB64), ranges);
  }, [p, ranges, seenB64, masteredB64]);
}
