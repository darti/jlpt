import type { Progress } from "../types/progress.ts";
import { SKILLS } from "../types/progress.ts";

const PROGRESS_KEY = "jlptN3adapt_v2";

function isProgress(v: unknown): v is Progress {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.total !== "number") return false;
  const s = o.skill as Record<string, unknown> | undefined;
  if (typeof s !== "object" || s === null) return false;
  if (SKILLS.length === 0) return false;
  return SKILLS.every((c) => {
    const e = s[c] as Record<string, unknown> | undefined;
    return typeof e === "object" && e !== null && typeof e.R === "number";
  });
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
