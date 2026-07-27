import { THEME_KEY } from "./keys.ts";
import { pref, type ReadStore, type WriteStore } from "./pref.ts";

export type ThemeName = "light" | "dark";

/** Thème persisté. Défaut « dark » : seule la chaîne "light" bascule en clair. */
const themePref = pref<ThemeName>(THEME_KEY, {
  decode: (raw) => (raw === "light" ? "light" : "dark"),
  encode: (t) => t,
});

export function readTheme(store: ReadStore = globalThis.localStorage): ThemeName {
  return themePref.read(store);
}

export function otherTheme(t: ThemeName): ThemeName {
  return t === "light" ? "dark" : "light";
}

/** Pose `data-theme` sur la racine ET persiste. L'attribut est écrit AVANT le stockage :
 *  un store en échec ne doit pas empêcher la bascule visuelle. */
export function applyTheme(
  t: ThemeName,
  root: HTMLElement = document.documentElement,
  store: WriteStore = globalThis.localStorage,
): void {
  root.setAttribute("data-theme", t);
  themePref.write(t, store);
}
