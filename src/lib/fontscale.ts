import { fsKey } from "./keys.ts";
import { numberPref, type ReadStore, type WriteStore, type Pref } from "./pref.ts";

export type FsKind = "Ui" | "Jp";

/** Bornes de LECTURE — une valeur persistée hors de [0,7 ; 2] est ignorée (→ 1). Plus larges
 *  que les bornes d'écriture ci-dessous : une échelle posée à la main reste honorée. */
const FS_MIN = 0.7, FS_MAX = 2, FS_DEFAULT = 1;
/** Bornes du PAS — ce que la molette des réglages peut atteindre. */
const BUMP_MIN = 0.8, BUMP_MAX = 1.8, BUMP_STEP = 0.1;

/** Une préférence par échelle : `jlptN3_fsUi` et `jlptN3_fsJp`. */
const scales: Record<FsKind, Pref<number>> = {
  Ui: numberPref(fsKey("Ui"), FS_MIN, FS_MAX, FS_DEFAULT),
  Jp: numberPref(fsKey("Jp"), FS_MIN, FS_MAX, FS_DEFAULT),
};

export function readFs(kind: FsKind, store: ReadStore = globalThis.localStorage): number {
  return scales[kind].read(store);
}

/** Décale l'échelle d'un cran dans `dir`, borné à [0,8 ; 1,8]. Rend la valeur écrite. */
export function bumpFs(
  kind: FsKind, dir: number, store: ReadStore & WriteStore = globalThis.localStorage,
): number {
  const stepped = Math.round((readFs(kind, store) + dir * BUMP_STEP) * 10) / 10;
  return scales[kind].write(Math.max(BUMP_MIN, Math.min(BUMP_MAX, stepped)), store);
}

export function applyFontScale(
  root: HTMLElement = document.documentElement,
  store: ReadStore = globalThis.localStorage,
): void {
  root.style.setProperty("--fs-ui", String(readFs("Ui", store)));
  root.style.setProperty("--fs-jp", String(readFs("Jp", store)));
}
