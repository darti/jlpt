import { SKILLS, type Skill } from "../types/progress.ts";
import { DRATING } from "./elo.ts";
import type { Question } from "../types/quiz.ts";

type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;

export function shuffle<T>(a: T[], rng: () => number = Math.random): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const cache = new Map<Skill, Promise<Question[]>>();

/** Clears the memoized category pools. Tests that drive `loadCategory` with a mocked
 *  fetch call this to isolate the shared module cache from other test files. */
export function clearCategoryCache(): void {
  cache.clear();
}

export function loadCategory(cat: Skill, fetchImpl: FetchLike = fetch as FetchLike): Promise<Question[]> {
  let p = cache.get(cat);
  if (!p) {
    p = fetchImpl(`data/bank-${cat}.json`).then((r) => r.json() as Promise<Question[]>);
    cache.set(cat, p);
  }
  return p;
}

export function pickAdaptive(
  pool: Question[], R: number, exclude: Set<number>, wrong: number[], rng: () => number = Math.random,
): Question[] {
  return pool
    .filter((q) => !exclude.has(q.id))
    .map((q) => ({ q, w: -Math.abs(DRATING[q.d] - R) + (wrong.includes(q.id) ? 150 : 0) + rng() * 90 }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.q);
}

export function allocate(masteryOf: (c: Skill) => number, minutes: number): { total: number; alloc: Record<Skill, number> } {
  const total = Math.max(4, Math.min(45, Math.round(minutes * 1.5)));
  const w = {} as Record<Skill, number>;
  let sum = 0;
  for (const c of SKILLS) { w[c] = 0.2 + (1 - masteryOf(c)) * 1.3; sum += w[c]; }
  const alloc = {} as Record<Skill, number>;
  let assigned = 0;
  for (const c of SKILLS) { alloc[c] = Math.floor((total * w[c]) / sum); assigned += alloc[c]; }
  const order = [...SKILLS].sort((a, b) => masteryOf(a) - masteryOf(b));
  let i = 0;
  while (assigned < total) { alloc[order[i % order.length]]++; assigned++; i++; }
  return { total, alloc };
}
