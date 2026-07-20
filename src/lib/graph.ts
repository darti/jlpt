/**
 * Lecture du graphe JSON-LD : fetch des documents de `data/graph/` et projection vers les
 * types internes du moteur.
 *
 * C'est le SEUL module qui connaît le vocabulaire du graphe. Les couches pures
 * (`pickAdaptive`, `allocateCount`, `composeSession`, `selectDiagnostic`, `elo`, `scoring`)
 * continuent de recevoir exactement ce qu'elles recevaient : c'est ce qui prouve que la
 * bascule n'a pas touché aux règles du moteur.
 */

import type { Skill } from "../types/progress.ts";
import type { Difficulty, Question } from "../types/quiz.ts";

export type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;

/** Une compétence et l'intervalle d'ordinaux qu'elle occupe. */
export interface SkillRange { skill: Skill; from: number; count: number }

type Sujet = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const list = (v: unknown): string[] | undefined => (Array.isArray(v) ? (v as string[]) : undefined);

/** Projette un sujet `jlpt:Question` vers le type `Question` du moteur. */
export function toQuestion(s: Sujet): Question {
  const q: Question = {
    id: s["jlpt:ord"] as number,
    cat: s["jlpt:skill"] as Skill,
    d: s["jlpt:difficulty"] as Difficulty,
    q: String(s["jlpt:stem"] ?? ""),
    o: list(s.opts) ?? [],
    a: s["jlpt:answer"] as number,
  };
  // Assignés seulement s'ils existent : `q.e === undefined` et « pas de clé e » ne sont pas
  // la même chose pour les composants qui testent la présence du corrigé.
  const e = str(s["schema:description"]); if (e !== undefined) q.e = e;
  const g = str(s["jlpt:gloss"]); if (g !== undefined) q.g = g;
  const od = list(s["jlpt:optionNote"]); if (od !== undefined) q.od = od;
  const script = str(s["jlpt:script"]); if (script !== undefined) q.script = script;
  const passage = str(s["jlpt:passage"]); if (passage !== undefined) q.passage = passage;
  return q;
}

const cache = new Map<Skill, Promise<Question[]>>();
let corpusPromise: Promise<SkillRange[]> | null = null;

/** Vide les mémoïsations. Les tests partagent le module (cf. CLAUDE.md : happy-dom est
 *  préchargé pour toute la suite) : sans ça, un test pollue le suivant. */
export function clearGraphCache(): void {
  cache.clear();
  corpusPromise = null;
}

const graphDoc = (r: { json: () => Promise<unknown> }) =>
  r.json() as Promise<{ "@graph"?: Sujet[] }>;

/** Le pool d'une compétence, mémoïsé. Un shard par compétence : `data/graph/q-<skill>.jsonld`. */
export function loadSkill(
  skill: Skill, fetchImpl: FetchLike = fetch as FetchLike,
): Promise<Question[]> {
  let p = cache.get(skill);
  if (!p) {
    p = fetchImpl(`data/graph/q-${skill}.jsonld`)
      .then(graphDoc)
      .then((doc) => (doc["@graph"] ?? []).map(toQuestion));
    cache.set(skill, p);
  }
  return p;
}

/** Les cinq intervalles du corpus, mémoïsés. Remplace la lecture de `bank-index.json`. */
export function loadCorpus(fetchImpl: FetchLike = fetch as FetchLike): Promise<SkillRange[]> {
  if (!corpusPromise) {
    corpusPromise = fetchImpl("data/graph/corpus.jsonld")
      .then(graphDoc)
      .then((doc) => (doc["@graph"] ?? []).map((s) => ({
        skill: s["jlpt:skill"] as Skill,
        from: s["jlpt:from"] as number,
        count: s["jlpt:count"] as number,
      })));
  }
  return corpusPromise;
}

/** Compétence d'un ordinal, par comparaison de bornes. Remplace la lecture d'un index de
 *  190 Ko : les ordinaux étant groupés par compétence, 5 intervalles suffisent. */
export function skillOfOrd(ord: number, ranges: SkillRange[]): Skill | null {
  for (const r of ranges) {
    if (ord >= r.from && ord < r.from + r.count) return r.skill;
  }
  return null;
}
