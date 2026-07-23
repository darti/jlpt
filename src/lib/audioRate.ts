import { RATE_KEY } from "./keys.ts";

/** Les trois débits de lecture de l'écoute : lent, normal (défaut), rapide. */
export const RATES = [0.7, 0.9, 1.0] as const;
export type Rate = (typeof RATES)[number];

const DEFAULT_RATE: Rate = 0.9;

/** Le débit d'écoute persisté (défaut 0.9). Toute valeur hors des trois crans est rabattue
 *  sur 0.9. Pur — le store est injectable. */
export function readRate(store: Pick<Storage, "getItem"> = globalThis.localStorage): Rate {
  try {
    const v = Number(store.getItem(RATE_KEY));
    return (RATES as readonly number[]).includes(v) ? (v as Rate) : DEFAULT_RATE;
  } catch { return DEFAULT_RATE; }
}

/** Persiste le débit d'écoute ; best-effort. Rend la valeur écrite. */
export function writeRate(
  rate: Rate, store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage,
): Rate {
  try { store.setItem(RATE_KEY, String(rate)); } catch { /* best-effort */ }
  return rate;
}
