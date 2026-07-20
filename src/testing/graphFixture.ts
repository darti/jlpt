/**
 * Faux corpus au format graphe, partagé par les harnais qui montent `EntrainementApp`.
 *
 * Les quatre fichiers `EntrainementApp.*.test.tsx` construisaient chacun leur banque et leur
 * index. Avec les ordinaux GROUPÉS par compétence, la contrainte n'est plus seulement « des
 * ids uniques » mais « des intervalles contigus qui correspondent aux pools » : quatre copies
 * de cette règle, c'est quatre occasions de la casser à moitié. Une seule ici.
 */

import { SKILLS, type Skill } from "../types/progress.ts";
import type { SkillRange } from "../lib/graph.ts";

/** Questions par compétence dans le faux corpus. */
export const PER_SKILL = 8;

/** Sujets `jlpt:Question` par compétence, ordinaux contigus dans l'ordre de `SKILLS`. */
export const GRAPH: Record<Skill, Record<string, unknown>[]> = Object.fromEntries(
  SKILLS.map((cat, idx) => [
    cat,
    Array.from({ length: PER_SKILL }, (_, i) => {
      const ord = idx * PER_SKILL + i;
      return {
        "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question",
        "jlpt:skill": cat, "jlpt:difficulty": (i % 3) + 1, "jlpt:ord": ord,
        "jlpt:stem": `Q-${cat}-${i}`,
        opts: ["a", "b", "c", "d"], "jlpt:answer": 0,
      };
    }),
  ]),
) as unknown as Record<Skill, Record<string, unknown>[]>;

/** Tous les ordinaux du faux corpus, dans l'ordre. */
export const ALL_ORDS: number[] = SKILLS.flatMap((_, idx) =>
  Array.from({ length: PER_SKILL }, (_, i) => idx * PER_SKILL + i),
);

/** Les intervalles correspondants — ce que sert `corpus.jsonld`. */
export const RANGES: SkillRange[] = SKILLS.map((skill, idx) => ({
  skill, from: idx * PER_SKILL, count: PER_SKILL,
}));

/** `fetch` simulé : sert `corpus.jsonld` et les cinq shards `q-<skill>.jsonld`. */
export function graphFetch(): typeof fetch {
  return (async (url: string) => {
    const u = String(url);
    if (u.includes("corpus.jsonld")) {
      return { json: async () => ({ "@graph": RANGES.map((r) => ({
        "@id": `jlpt:corpus/${r.skill}`, "@type": "jlpt:SkillRange",
        "jlpt:skill": r.skill, "jlpt:from": r.from, "jlpt:count": r.count,
      })) }) };
    }
    const m = u.match(/q-([a-z]+)\.jsonld/);
    if (m && GRAPH[m[1] as Skill]) return { json: async () => ({ "@graph": GRAPH[m[1] as Skill] }) };
    return { json: async () => ({}) };
  }) as unknown as typeof fetch;
}
