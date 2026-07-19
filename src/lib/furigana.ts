import { FURI_KEY } from "./keys.ts";

/** Whether furigana are globally revealed (persisted). Default false — hidden, tap a word
 *  to reveal. Complements the per-word `.show` toggle from dict `furi()`. */
export function readFuri(store: Pick<Storage, "getItem"> = globalThis.localStorage): boolean {
  try { return store.getItem(FURI_KEY) === "on"; } catch { return false; }
}

/** Persist the global furigana state; returns the value written. */
export function writeFuri(on: boolean, store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage): boolean {
  try { store.setItem(FURI_KEY, on ? "on" : "off"); } catch { /* best-effort */ }
  return on;
}

/** Apply the persisted global furigana state to the root via `data-furi` (CSS reveals
 *  all `<rt>` when `[data-furi="on"]`). */
export function applyFuri(root: HTMLElement = document.documentElement, store: Pick<Storage, "getItem"> = globalThis.localStorage): void {
  if (readFuri(store)) root.setAttribute("data-furi", "on");
  else root.removeAttribute("data-furi");
}
