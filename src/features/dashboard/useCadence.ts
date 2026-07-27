import { useEffect, useState } from "react";
import { readCadence, readRawProgress } from "../../lib/storage.ts";
import { asBits } from "../../lib/blob.ts";
import { masteredCount } from "../../lib/coverage.ts";
import { daysUntilExam } from "../../lib/scoring.ts";
import { dayNumber } from "../quiz/traps.ts";
import { cadenceModel, type CadenceModel } from "../../lib/cadence.ts";

/** Modèle de cadence pour l'Accueil : objectif du jour, progrès, série. Lu une fois au montage
 *  (comme `useTraps`) — `masteredNow` vient du bitset local, donc dispo même hors ligne. */
export function useCadence(): CadenceModel | null {
  const [model, setModel] = useState<CadenceModel | null>(null);
  useEffect(() => {
    const now = new Date();
    const masteredNow = masteredCount(asBits(readRawProgress(), "mastered"));
    setModel(cadenceModel(readCadence(), masteredNow, daysUntilExam(now), dayNumber(now)));
  }, []);
  return model;
}
