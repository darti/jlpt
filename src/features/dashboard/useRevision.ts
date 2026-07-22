import { useEffect, useState } from "react";
import { readRawProgress } from "../../lib/storage.ts";
import { asFsrs, dueBySkill } from "../quiz/revision.ts";
import { dayNumber } from "../quiz/traps.ts";
import type { DueCounts } from "./RevisionPanel.tsx";

/**
 * Décompte des entités dues aujourd'hui. Contrairement à `useTraps`, AUCUN fetch : la
 * rétrievabilité se calcule depuis la seule carte `fsrs` du blob (FSRS markovien) — les pools
 * ne servent qu'à la SÉLECTION, pas au comptage. Un nouvel arrivant (blob sans `fsrs`) obtient
 * `total: 0` sans rien charger.
 */
export function useRevision(): DueCounts | null {
  const [counts, setCounts] = useState<DueCounts | null>(null);
  useEffect(() => {
    const map = asFsrs(readRawProgress());
    if (!Object.keys(map).length) return; // rien collecté encore → état vide
    setCounts(dueBySkill(map, dayNumber(new Date())));
  }, []);
  return counts;
}
