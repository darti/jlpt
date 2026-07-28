/**
 * Lecture de l'état dérivé des entités du cours, et unique geste d'écriture (« je connais »).
 *
 * Remplace `useCoursProgress` : plus de cochage cyclique persisté, l'état se calcule depuis la
 * carte FSRS (`entityState.ts`). Le seul geste offert AMORCE la mémoire au lieu de poser un
 * drapeau — l'entité entre dans le planificateur et reviendra en révision. Une affirmation
 * devient une hypothèse testable au lieu d'un angle mort.
 */
import { useCallback, useEffect, useState } from "react";
import { fsrsInit } from "../../lib/fsrs.ts";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { asFsrs, type FsrsMap } from "../quiz/revision.ts";
import { dayNumber } from "../quiz/traps.ts";
import { COURS_MIGRE_KEY } from "../../lib/keys.ts";
import { entityState, type EntityState } from "./entityState.ts";
import { loadCoursProgress, migrateCoursProgress } from "./coursProgress.ts";

export interface EntityStates {
  fsrs: FsrsMap;
  today: number;
  stateOf: (iri: string) => EntityState;
  markKnown: (iri: string, grade?: 1 | 3) => void;
}

export function useEntityStates(): EntityStates {
  const [today] = useState(() => dayNumber(new Date()));
  const [fsrs, setFsrs] = useState<FsrsMap>(() => asFsrs(readRawProgress()));

  // Migration unique du cochage manuel (COURS_KEY) vers la carte FSRS. Le marqueur la rend
  // idempotente ; `migrateCoursProgress` n'écrase jamais une carte existante.
  useEffect(() => {
    let deja: string | null = null;
    try { deja = globalThis.localStorage.getItem(COURS_MIGRE_KEY); } catch { return; }
    if (deja === "1") return;
    const suivant = migrateCoursProgress(loadCoursProgress(), asFsrs(readRawProgress()), today);
    if (suivant) {
      writeProgress({ fsrs: suivant });
      setFsrs(suivant);
    }
    try { globalThis.localStorage.setItem(COURS_MIGRE_KEY, "1"); } catch { /* best-effort */ }
  }, [today]);

  const stateOf = useCallback(
    (iri: string) => entityState(fsrs[iri], today),
    [fsrs, today],
  );

  // ⚠ `writeProgress` ne deep-merge QUE `skill` : le champ `fsrs` est remplacé en entier, il
  // faut donc toujours réécrire la carte complète (même contrainte que `fsrsPatch`).
  const markKnown = useCallback((iri: string, grade: 1 | 3 = 3) => {
    setFsrs((cur) => {
      const suivant: FsrsMap = { ...cur, [iri]: fsrsInit(grade, today) };
      writeProgress({ fsrs: suivant });
      return suivant;
    });
  }, [today]);

  return { fsrs, today, stateOf, markKnown };
}
