export type ThemeName = "light" | "dark";
const THEME_KEY = "jlptN3_theme";
const UPDATED_KEY = "jlptN3_updatedAt";

export function readTheme(store: Pick<Storage, "getItem"> = globalThis.localStorage): ThemeName {
  try { return store.getItem(THEME_KEY) === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}

export function otherTheme(t: ThemeName): ThemeName {
  return t === "light" ? "dark" : "light";
}

export function applyTheme(
  t: ThemeName,
  root: HTMLElement = document.documentElement,
  store: Pick<Storage, "setItem"> = globalThis.localStorage,
): void {
  root.setAttribute("data-theme", t);
  try {
    store.setItem(THEME_KEY, t);
    store.setItem(UPDATED_KEY, new Date().toISOString());
  } catch { /* best-effort */ }
}
