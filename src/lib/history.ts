import { readRawProgress } from "./storage.ts";

/** Session scores /180 over time, from the raw blob's `history`. Non-numeric
 *  entries are dropped, so the result is always a clean numeric series in order. */
export function readSessionScores(store: Pick<Storage, "getItem"> = globalThis.localStorage): number[] {
  const raw = readRawProgress(store);
  const hist = raw && Array.isArray((raw as { history?: unknown }).history)
    ? (raw as { history: unknown[] }).history
    : [];
  return hist
    .map((h) => (h && typeof (h as { score?: unknown }).score === "number" ? (h as { score: number }).score : NaN))
    .filter((n) => Number.isFinite(n));
}
