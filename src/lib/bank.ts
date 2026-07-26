import { SKILLS, type Skill } from "../types/progress.ts";
import { DRATING } from "./elo.ts";
import type { Question } from "../types/quiz.ts";
import { clearGraphCache, loadPassages, loadSkill, skillOfOrd, type SkillRange } from "./graph.ts";

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

/** Le pool d'une compétence, passages **résolus**. Passe par le graphe (`q-<skill>.jsonld`) :
 *  la projection JSON-LD → `Question` vit dans `graph.ts`, pas ici.
 *
 *  ⚠ Une question dont le `passageId` ne résout pas est ÉCARTÉE : sans son texte, elle est
 *  inrépondable. Le court-circuit `some()` garde les quatre autres compétences sur le tableau
 *  mémoïsé tel quel — seule la lecture paie la reconstruction (une centaine d'objets). */
export async function loadCategory(
  cat: Skill, fetchImpl: FetchLike = fetch as FetchLike,
): Promise<Question[]> {
  const pool = await loadSkill(cat, fetchImpl);
  if (!pool.some((q) => typeof q.passageId === "string")) return pool;
  const passages = await loadPassages(fetchImpl);
  const out: Question[] = [];
  for (const q of pool) {
    if (typeof q.passageId !== "string") { out.push(q); continue; }
    const p = passages.get(q.passageId);
    if (!p) { console.warn(`question ${q.id} : passage ${q.passageId} introuvable — écartée`); continue; }
    out.push({ ...q, passage: p });
  }
  return out;
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

/**
 * Regroupe les questions d'un même passage : complète les fratries manquantes depuis `pool`,
 * écarte un groupe qui ne tient pas dans `total`, puis rend les membres adjacents et triés par
 * `id` (l'ordre de lecture du texte). Pure.
 *
 * ⚠ Appelée APRÈS `composeSession` / `selectDiagnostic` : c'est la seule position qui survive
 * au mélange final. L'ordre du reste de la session est préservé — chaque groupe est simplement
 * ramené d'un bloc à la position de son premier membre.
 *
 * ⚠ Un groupe écarté n'est PAS remplacé : la session est alors plus courte (borné à 3
 * questions). Refiler la place exigerait le vivier complet, les poids et le jeu d'exclusion —
 * une session légèrement plus courte est le prix accepté (cf. spec §4).
 */
export function withPassageGroups(session: Question[], pool: Question[], total: number): Question[] {
  // Construire l'index des groupes par passage dans le pool.
  const groups = new Map<string, Question[]>();
  for (const q of pool) {
    const pid = typeof q.passageId === "string" ? q.passageId : null;
    if (!pid) continue;
    const g = groups.get(pid);
    if (g) g.push(q); else groups.set(pid, [q]);
  }
  // Si aucun groupe, retourner la session telle quelle.
  if (!groups.size) return session;
  // Trier chaque groupe par id (ordre de lecture).
  for (const g of groups.values()) g.sort((a, b) => a.id - b.id);

  // Calculer quels groupes peuvent tenir : compter les places restantes après les singletons.
  const pidOf = (q: Question) => (typeof q.passageId === "string" ? q.passageId : null);
  let room = total - session.filter((q) => !pidOf(q)).length;
  const kept = new Set<string>();
  for (const q of session) {
    const pid = pidOf(q);
    if (!pid || kept.has(pid)) continue;
    const g = groups.get(pid);
    // Un groupe ne rentre que s'il tient ENTIER dans les places restantes.
    if (g && g.length <= room) { kept.add(pid); room -= g.length; }
  }

  // Construire la sortie : replacer les groupes complétés à la position de leur premier membre.
  const out: Question[] = [];
  const placed = new Set<string>();
  for (const q of session) {
    const pid = pidOf(q);
    if (!pid) { out.push(q); continue; }
    if (!kept.has(pid) || placed.has(pid)) continue;
    placed.add(pid);
    out.push(...(groups.get(pid) as Question[]));
  }
  return out;
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
