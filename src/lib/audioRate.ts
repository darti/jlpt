import { RATE_KEY } from "./keys.ts";
import { enumPref, type ReadStore, type WriteStore } from "./pref.ts";

/** Les trois débits de lecture de l'écoute : lent, normal (défaut), rapide. */
export const RATES = [0.7, 0.9, 1.0] as const;
export type Rate = (typeof RATES)[number];

const DEFAULT_RATE: Rate = 0.9;

/** Débit d'écoute persisté (défaut 0.9) — toute valeur hors des trois crans est rabattue. */
const ratePref = enumPref<Rate>(RATE_KEY, RATES, DEFAULT_RATE);

export function readRate(store: ReadStore = globalThis.localStorage): Rate {
  return ratePref.read(store);
}

/** Persiste le débit d'écoute ; rend la valeur écrite. */
export function writeRate(rate: Rate, store: WriteStore = globalThis.localStorage): Rate {
  return ratePref.write(rate, store);
}
