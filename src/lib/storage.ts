import type { Progress } from "../types/progress.ts";
import { PROGRESS_KEY, stampUpdated } from "./keys.ts";


// Lenient on purpose: the legacy blob format defaults missing skills to R=1450/t=0,
// so individual skills need NOT be present here — only `total` (number) and `skill`
// (object) are required for the blob to be usable.
function isProgress(v: unknown): v is Progress {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.total !== "number") return false;
  const s = o.skill;
  return typeof s === "object" && s !== null;
}

export function readProgress(store: Pick<Storage, "getItem"> = globalThis.localStorage): Progress | null {
  let raw: string | null;
  try { raw = store.getItem(PROGRESS_KEY); } catch { return null; }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : null;
  } catch { return null; }
}

/** Read the raw progress blob (all fields) or null.
 *  Best-effort: returns null on missing blob, malformed JSON, or storage read errors. */
export function readRawProgress(
  store: Pick<Storage, "getItem"> = globalThis.localStorage,
): Record<string, unknown> | null {
  try {
    const raw = store.getItem(PROGRESS_KEY);
    if (raw === null) return null;
    const v = JSON.parse(raw);
    return typeof v === "object" && v !== null ? v : null;
  } catch { return null; }
}

/** Merge `patch` onto the current blob (deep-merge `skill`), preserving every
 *  other field the vanilla app owns (gram/streak/history/…). Never throws.
 *  Best-effort: silently ignores storage errors (read/write failures, JSON parse errors).
 *  Every field the caller patches is written; vanilla-app fields not present in the
 *  patch are preserved because `cur` is spread first. */
export function writeProgress(
  patch: Record<string, unknown>,
  store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage,
): void {
  try {
    const cur = readRawProgress(store) ?? {};
    const next: Record<string, unknown> = { ...cur, ...patch }; // write ANY patched field
    if (patch.skill && typeof patch.skill === "object" && !Array.isArray(patch.skill)) {
      const curSkill = (
        typeof cur.skill === "object" && cur.skill !== null && !Array.isArray(cur.skill)
      )
        ? (cur.skill as Record<string, unknown>)
        : {};
      next.skill = { ...curSkill, ...(patch.skill as Record<string, unknown>) };
    }
    store.setItem(PROGRESS_KEY, JSON.stringify(next));
    stampUpdated(store);
  } catch { /* best-effort: silently ignore all storage errors */ }
}
