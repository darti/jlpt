import { collectData, applyData, type SyncPayload } from "./gist.ts";
import { blankSkills } from "./elo.ts";

type Store = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem" | "key" | "length">>;
const PROGRESS_KEY = "jlptN3adapt_v2";
const UPDATED_KEY = "jlptN3_updatedAt";

/** Pure. `{app, updatedAt, store}` over every `jlptN3*` key — collectData already
 *  excludes `jlptN3_gh` (C1: backups must never carry the GitHub token). */
export function exportJson(store: Store = globalThis.localStorage): string {
  return JSON.stringify(collectData(store as Storage, new Date().toISOString()), null, 2);
}

/** Parses a backup and writes it back into `store` after confirmation. `false` (no write)
 *  on malformed JSON, a missing `store` field, or a declined confirm. */
export function importJson(
  json: string,
  store: Store = globalThis.localStorage,
  confirmFn: () => boolean = () => true,
): boolean {
  let payload: { store?: Record<string, string> };
  try { payload = JSON.parse(json); } catch { return false; }
  if (!payload || typeof payload.store !== "object" || payload.store === null) return false;
  if (!confirmFn()) return false;
  try {
    // M1: never import a GitHub-token config from an untrusted file.
    const safe = { ...payload, store: { ...payload.store } };
    delete safe.store.jlptN3_gh;
    applyData(store as Storage, safe as unknown as SyncPayload);
    store.setItem(UPDATED_KEY, new Date().toISOString());
    return true;
  } catch { return false; }
}

/** Writes a fresh blank progress blob — mirrors the legacy `load()` default EXACTLY
 *  (M3: `gram:{}` included so vanilla SRS state isn't wiped/desynced). Does not touch
 *  theme/gist/fontscale keys. */
export function resetProgress(store: Store = globalThis.localStorage): void {
  const blank = { skill: blankSkills(), total: 0, right: 0, bestStreak: 0, streak: 0, wrong: [], history: [], lastDiag: null, gram: {} };
  try {
    store.setItem(PROGRESS_KEY, JSON.stringify(blank));
    store.setItem(UPDATED_KEY, new Date().toISOString());
  } catch { /* best-effort */ }
}
