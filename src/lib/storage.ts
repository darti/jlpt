import type { Progress } from "../types/progress.ts";

const PROGRESS_KEY = "jlptN3adapt_v2";

// Lenient on purpose: progress.js's skR/skT default missing skills to R=1450/t=0,
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
