import { SKILLS, type Skill } from "../types/progress.ts";
import { DRATING } from "./elo.ts";
import type { Question } from "../types/quiz.ts";
import { clearGraphCache, loadSkill, skillOfOrd, type SkillRange } from "./graph.ts";

export type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;

export function shuffle<T>(a: T[], rng: () => number = Math.random): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Clears the memoized category pools. Tests that drive `loadCategory` with a mocked
 *  fetch call this to isolate the shared module cache from other test files.
 *  Délègue à `graph.ts`, qui porte désormais la mémoïsation. */
export function clearCategoryCache(): void {
  clearGraphCache();
}

/** Le pool d'une compétence. Passe par le graphe (`q-<skill>.jsonld`) : la projection
 *  JSON-LD → `Question` vit dans `graph.ts`, pas ici, pour que les couches pures de ce
 *  module ne sachent rien du format des documents. */
export function loadCategory(cat: Skill, fetchImpl: FetchLike = fetch as FetchLike): Promise<Question[]> {
  return loadSkill(cat, fetchImpl);
}

/** Les cinq pools, chargés **en parallèle**. Une session composée a besoin de toutes les
 *  catégories : les charger au fil d'une boucle `await` sérialise jusqu'à cinq allers-retours
 *  réseau au premier démarrage. Les promesses restent mémoïsées par `loadCategory`. */
export async function loadAllCategories(
  fetchImpl: FetchLike = fetch as FetchLike,
): Promise<Record<Skill, Question[]>> {
  const pools = await Promise.all(SKILLS.map((s) => loadCategory(s, fetchImpl)));
  return Object.fromEntries(SKILLS.map((s, i) => [s, pools[i]])) as Record<Skill, Question[]>;
}

/** Resolve `ids → Question[]` by loading the pools of the categories the ids belong to.
 *  La compétence d'un id se déduit des intervalles du corpus (`skillOfOrd`) au lieu d'un
 *  index id→compétence de 190 Ko. Order follows `ids`; ids absent from the pools are dropped.
 *  Shared by resume + the errors slice. */
export async function questionsForIds(
  ids: number[], ranges: SkillRange[], fetchImpl: FetchLike = fetch as FetchLike,
): Promise<Question[]> {
  if (!ids.length) return [];
  const catsNeeded = new Set<Skill>();
  for (const id of ids) { const c = skillOfOrd(id, ranges); if (c) catsNeeded.add(c); }
  const pools = await Promise.all([...catsNeeded].map((c) => loadCategory(c, fetchImpl)));
  const byId = new Map<number, Question>();
  for (const pool of pools) for (const p of pool) byId.set(p.id, p);
  return ids.map((id) => byId.get(id)).filter((p): p is Question => p !== undefined);
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

/** Broad, level-triangulating selection for a diagnostic: ~equal share per skill with a spread of
 *  difficulties (d=1/2/3), shuffled. Distinct from pickAdaptive (mastery-weighted). Pure. */
export function selectDiagnostic(
  poolsBySkill: Partial<Record<Skill, Question[]>>, total: number, rng: () => number = Math.random,
): Question[] {
  if (total <= 0) return [];
  const skills = SKILLS.filter((s) => (poolsBySkill[s]?.length ?? 0) > 0);
  if (!skills.length) return [];
  const base = Math.floor(total / skills.length);
  let remainder = total - base * skills.length;
  const picked: Question[] = [];
  for (const s of skills) {
    const want = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    // Group this skill's (shuffled) pool by difficulty, then round-robin d1→d2→d3 to spread levels.
    const byD: [Question[], Question[], Question[]] = [[], [], []];
    for (const q of shuffle(poolsBySkill[s] ?? [], rng)) byD[q.d - 1].push(q);
    let taken = 0, di = 0;
    while (taken < want) {
      let advanced = false;
      for (let k = 0; k < 3; k++) {
        const bucket = byD[(di + k) % 3];
        if (bucket.length) {
          picked.push(bucket.shift() as Question);
          taken++; di = (di + k + 1) % 3; advanced = true;
          break;
        }
      }
      if (!advanced) break; // this skill's pool is exhausted
    }
  }
  return shuffle(picked, rng);
}

/** The `n` most-recent ids from `wrong[]` (its tail), newest first. Empty for n<=0 or no errors. */
export function selectRecentErrors(wrong: number[], n: number): number[] {
  if (n <= 0 || wrong.length === 0) return [];
  return wrong.slice(Math.max(0, wrong.length - n)).reverse();
}

/** Combine a guaranteed errors slice with adaptive fill into a single shuffled session.
 *  Adaptive fills `total - errorQs.length` (reconciles the budget when errorQs is short or empty;
 *  clamped at 0). Callers must exclude the error ids from `adaptiveCandidates` upstream. */
export function composeSession(
  errorQs: Question[], adaptiveCandidates: Question[], total: number, rng: () => number = Math.random,
): Question[] {
  const adaptiveTarget = Math.max(0, total - errorQs.length);
  const adaptiveQs = shuffle(adaptiveCandidates, rng).slice(0, adaptiveTarget);
  return shuffle([...errorQs, ...adaptiveQs], rng);
}

/** Questions for a session of `minutes` (~1.5/min, clamped to [4, 45]). */
export function questionCount(minutes: number): number {
  return Math.max(4, Math.min(45, Math.round(minutes * 1.5)));
}

/** Répartit un budget `total` de questions entre compétences, proportionnellement à un poids
 *  par compétence ; reliquat aux compétences de plus haut poids. */
export function allocateCount(weightOf: (c: Skill) => number, total: number): Record<Skill, number> {
  const w = {} as Record<Skill, number>;
  let sum = 0;
  for (const c of SKILLS) { w[c] = weightOf(c); sum += w[c]; }
  const alloc = {} as Record<Skill, number>;
  let assigned = 0;
  for (const c of SKILLS) { alloc[c] = sum > 0 ? Math.floor((total * w[c]) / sum) : 0; assigned += alloc[c]; }
  const order = [...SKILLS].sort((a, b) => w[b] - w[a]); // reliquat au plus haut poids d'abord
  let i = 0;
  while (assigned < total) { alloc[order[i % order.length]]++; assigned++; i++; }
  return alloc;
}

export function allocate(weightOf: (c: Skill) => number, minutes: number): { total: number; alloc: Record<Skill, number> } {
  const total = questionCount(minutes);
  return { total, alloc: allocateCount(weightOf, total) };
}
