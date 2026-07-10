import type { Progress } from "../types/progress.ts";

const PROGRESS_KEY = "jlptN3adapt_v2";
const UPDATED_KEY = "jlptN3_updatedAt";

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
 *  Only quiz-managed fields (total, right, skill) are merged; others are ignored. */
export function writeProgress(
  patch: Record<string, unknown>,
  store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage,
): void {
  try {
    const cur = readRawProgress(store) ?? {};
    // Only permit quiz-managed fields; build safe patch to preserve vanilla app fields
    const safePatch: Record<string, unknown> = {};
    const PERMITTED = new Set(["total", "right", "skill"]);
    for (const key of PERMITTED) {
      if (key in patch) {
        safePatch[key] = patch[key];
      }
    }
    // Validate skill patch: must be a plain object (not array, not null)
    if (
      "skill" in safePatch &&
      (safePatch.skill === null ||
        typeof safePatch.skill !== "object" ||
        Array.isArray(safePatch.skill))
    ) {
      delete safePatch.skill; // invalid skill type: skip it entirely
    }
    const next: Record<string, unknown> = { ...cur, ...safePatch };
    // Deep-merge skill: validate it's a plain object (not array, not null)
    const patchSkill = patch.skill;
    if (
      patchSkill !== null &&
      patchSkill !== undefined &&
      typeof patchSkill === "object" &&
      !Array.isArray(patchSkill)
    ) {
      const curSkill = cur.skill;
      const baseSkill = (
        typeof curSkill === "object" && curSkill !== null && !Array.isArray(curSkill)
          ? curSkill
          : {}
      ) as Record<string, unknown>;
      next.skill = { ...baseSkill, ...patchSkill };
    }
    store.setItem(PROGRESS_KEY, JSON.stringify(next));
    store.setItem(UPDATED_KEY, new Date().toISOString());
  } catch { /* best-effort: silently ignore all storage errors */ }
}
