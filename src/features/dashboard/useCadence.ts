import { readCadence, readRawProgress } from "../../lib/storage.ts";
import { useClientOnce } from "../../hooks/useClientOnce.ts";
import { asBits } from "../../lib/blob.ts";
import { masteredCount } from "../../lib/coverage.ts";
import { daysUntilExam } from "../../lib/scoring.ts";
import { dayNumber } from "../quiz/traps.ts";
import { cadenceModel, type CadenceModel } from "../../lib/cadence.ts";

/** Modèle de cadence pour l'Accueil : objectif du jour, progrès, série. Lu une fois au montage
 *  (comme `useTraps`) — `masteredNow` vient du bitset local, donc dispo même hors ligne. */
export function useCadence(): CadenceModel | null {
  return useClientOnce(() => {
    const now = new Date();
    const masteredNow = masteredCount(asBits(readRawProgress(), "mastered"));
    return cadenceModel(readCadence(), masteredNow, daysUntilExam(now), dayNumber(now));
  });
}
