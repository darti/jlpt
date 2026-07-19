import { fsKey, stampUpdated } from "./keys.ts";

export type FsKind = "Ui" | "Jp";

export function readFs(kind: FsKind, store: Pick<Storage, "getItem"> = globalThis.localStorage): number {
  try {
    const v = parseFloat(store.getItem(fsKey(kind)) ?? "");
    return v >= 0.7 && v <= 2 ? v : 1;
  } catch { return 1; }
}

export function bumpFs(kind: FsKind, dir: number, store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage): number {
  let v = Math.round((readFs(kind, store) + dir * 0.1) * 10) / 10;
  v = Math.max(0.8, Math.min(1.8, v));
  try { store.setItem(fsKey(kind), String(v)); stampUpdated(store); } catch { /* best-effort */ }
  return v;
}

export function applyFontScale(
  root: HTMLElement = document.documentElement,
  store: Pick<Storage, "getItem"> = globalThis.localStorage,
): void {
  root.style.setProperty("--fs-ui", String(readFs("Ui", store)));
  root.style.setProperty("--fs-jp", String(readFs("Jp", store)));
}
