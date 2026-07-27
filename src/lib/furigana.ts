import { FURI_KEY } from "./keys.ts";
import { boolPref, type ReadStore, type WriteStore } from "./pref.ts";

/** Furigana révélés globalement. Défaut false — masqués ; taper un mot ouvre sa définition
 *  (il n'y a plus de révélation mot à mot). */
const furiPref = boolPref(FURI_KEY, "on", "off");

export function readFuri(store: ReadStore = globalThis.localStorage): boolean {
  return furiPref.read(store);
}

/** Persiste l'état global des furigana ; rend la valeur écrite. */
export function writeFuri(on: boolean, store: WriteStore = globalThis.localStorage): boolean {
  return furiPref.write(on, store);
}

/** Applique l'état persisté à la racine via `data-furi` (le CSS révèle chaque annotation
 *  `.furi-rt` sous `[data-furi="on"]`). */
export function applyFuri(
  root: HTMLElement = document.documentElement,
  store: ReadStore = globalThis.localStorage,
): void {
  if (readFuri(store)) root.setAttribute("data-furi", "on");
  else root.removeAttribute("data-furi");
}
