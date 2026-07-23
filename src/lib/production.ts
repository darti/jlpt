import { PROD_KEY } from "./keys.ts";

/** Mode rappel actif persisté (défaut false : le QCM reste le mode par défaut). Pur — le
 *  store est injectable. Stocké en "1"/"0" pour rester lisible dans l'export Gist. */
export function readProduction(store: Pick<Storage, "getItem"> = globalThis.localStorage): boolean {
  try { return store.getItem(PROD_KEY) === "1"; } catch { return false; }
}

/** Persiste le mode rappel actif ; best-effort. Rend la valeur écrite. */
export function writeProduction(
  on: boolean, store: Pick<Storage, "setItem"> = globalThis.localStorage,
): boolean {
  try { store.setItem(PROD_KEY, on ? "1" : "0"); } catch { /* best-effort */ }
  return on;
}
