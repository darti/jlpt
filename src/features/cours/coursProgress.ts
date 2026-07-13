/** Progression de cours : état par item (known/review), persistée à part du quiz. Pur + localStorage. */
import type { CoursGroup, LearnCategory } from "./coursSchema.ts";

export type ItemState = "known" | "review";
export type CoursProgress = Record<string, ItemState>;
export interface GroupStats { known: number; review: number; total: number; }

const KEY = "jlptN3_cours_v1";

export function groupProgress(group: CoursGroup, p: CoursProgress): GroupStats {
  let known = 0, review = 0;
  for (const it of group.items) {
    if (p[it.id] === "known") known++;
    else if (p[it.id] === "review") review++;
  }
  return { known, review, total: group.items.length };
}

export function categoryProgress(cat: LearnCategory, p: CoursProgress): GroupStats {
  return cat.groups.reduce<GroupStats>((acc, grp) => {
    const s = groupProgress(grp, p);
    return { known: acc.known + s.known, review: acc.review + s.review, total: acc.total + s.total };
  }, { known: 0, review: 0, total: 0 });
}

export function cycleState(cur: ItemState | undefined): ItemState | undefined {
  if (cur === undefined) return "known";
  if (cur === "known") return "review";
  return undefined;
}

export function setItemState(p: CoursProgress, id: string, s: ItemState | undefined): CoursProgress {
  const next = { ...p };
  if (s === undefined) delete next[id]; else next[id] = s;
  return next;
}

export function loadCoursProgress(store: Pick<Storage, "getItem"> = globalThis.localStorage): CoursProgress {
  let raw: string | null;
  try { raw = store.getItem(KEY); } catch { return {}; }
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: CoursProgress = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === "known" || v === "review") out[k] = v;
    }
    return out;
  } catch { return {}; }
}

export function saveCoursProgress(p: CoursProgress, store: Pick<Storage, "setItem"> = globalThis.localStorage): void {
  try { store.setItem(KEY, JSON.stringify(p)); } catch { /* best-effort */ }
}
