import { readRawProgress } from "./storage.ts";
import { asHistory } from "./blob.ts";

/** Scores de session /180 au fil du temps, depuis le champ `history` du blob. Les entrées
 *  non numériques sont écartées : la série rendue est toujours propre, dans l'ordre. */
export function readSessionScores(store: Pick<Storage, "getItem"> = globalThis.localStorage): number[] {
  return asHistory(readRawProgress(store))
    .map((h) => (h && typeof (h as { score?: unknown }).score === "number" ? (h as { score: number }).score : NaN))
    .filter((n) => Number.isFinite(n));
}
