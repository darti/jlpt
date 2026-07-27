import { PROD_KEY } from "./keys.ts";
import { boolPref, type ReadStore, type WriteStore } from "./pref.ts";

/** Mode rappel actif. Défaut false : le QCM reste le mode par défaut. Stocké en "1"/"0"
 *  pour rester lisible dans l'export Gist. */
const productionPref = boolPref(PROD_KEY, "1", "0");

export function readProduction(store: ReadStore = globalThis.localStorage): boolean {
  return productionPref.read(store);
}

/** Persiste le mode rappel actif ; rend la valeur écrite. */
export function writeProduction(on: boolean, store: WriteStore = globalThis.localStorage): boolean {
  return productionPref.write(on, store);
}
