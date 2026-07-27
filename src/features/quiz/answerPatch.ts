/**
 * Ce qu'UNE réponse écrit dans le blob de progression, et comment une tranche de session est
 * piochée. Deux fonctions PURES (le temps est injecté) extraites de `useQuiz.ts` : c'est là
 * que sont les règles, donc là que doivent porter les tests.
 */

import { SKILLS, type Skill } from "../../types/progress.ts";
import type { Question } from "../../types/quiz.ts";
import { updateRating } from "../../lib/elo.ts";
import { pickAdaptive } from "../../lib/bank.ts";
import { asBits, asNum, asSkillState, asWrong, type RawProgress } from "../../lib/blob.ts";
import { encodeBits, setBit } from "../../lib/coverage.ts";
import { asConfusions, confusionPatch } from "./traps.ts";
import { asFsrs, fsrsPatch } from "./revision.ts";

/** Taille de l'anneau des erreurs récentes conservé dans le blob. */
const WRONG_MAX = 80;

/**
 * Pioche `alloc[cat]` questions par catégorie via `pickAdaptive`, au niveau (R) de la
 * compétence. `exclude` est muté au fil de l'eau : aucune question ne sort deux fois dans
 * la même session, y compris entre deux tranches successives.
 *
 * `poolOf` laisse l'appelant restreindre le vivier — la tranche « apprendre » le filtre sur
 * le non-vu, la tranche adaptative prend le pool entier. C'est la seule différence entre les
 * deux, avec `wrong` (le bonus +150 n'a de sens que là où des erreurs peuvent apparaître).
 */
export function pickSlice(
  alloc: Record<Skill, number>,
  poolOf: (cat: Skill) => Question[],
  raw: RawProgress,
  exclude: Set<number>,
  wrong: number[],
): Question[] {
  const out: Question[] = [];
  for (const cat of SKILLS) {
    const n = alloc[cat];
    if (!n) continue;
    const picks = pickAdaptive(poolOf(cat), asSkillState(raw, cat).R, exclude, wrong).slice(0, n);
    for (const q of picks) exclude.add(q.id);
    out.push(...picks);
  }
  return out;
}

/** Patch de progression pour UNE réponse. Pur (temps injecté) → testé unitairement.
 *  `chosen` = index de l'option cochée, ou `null` en production (aucune option cochée) :
 *  dans ce cas on n'écrit PAS le graphe de confusion (erreur de rappel, pas de reconnaissance). */
export function answerPatch(
  raw: RawProgress,
  q: Question,
  correct: boolean,
  chosen: number | null,
  today: number,
  nowMs: number,
  isLastDiag: boolean,
  production = false,
): Record<string, unknown> {
  const curWrong = asWrong(raw);
  const nextSkill = updateRating(asSkillState(raw, q.cat), q.d, correct);
  const withoutId = curWrong.filter((id) => id !== q.id);
  const nextWrong = (correct ? withoutId : [...withoutId, q.id]).slice(-WRONG_MAX);
  const nextConfusions = chosen === null
    ? undefined
    : confusionPatch(asConfusions(raw), q.id, chosen, correct, today);
  const nextFsrs = fsrsPatch(asFsrs(raw), Array.isArray(q.tests) ? q.tests : [], correct, today, production);
  const seen = encodeBits(setBit(asBits(raw, "seen"), q.id));
  const mastered = correct
    ? encodeBits(setBit(asBits(raw, "mastered"), q.id))
    : undefined;
  return {
    skill: { [q.cat]: nextSkill },
    total: asNum(raw, "total") + 1,
    right: asNum(raw, "right") + (correct ? 1 : 0),
    wrong: nextWrong,
    seen,
    ...(mastered !== undefined ? { mastered } : {}),
    ...(isLastDiag ? { diagAt: nowMs } : {}),
    ...(nextConfusions !== undefined ? { confusions: nextConfusions } : {}),
    ...(nextFsrs !== undefined ? { fsrs: nextFsrs } : {}),
  };
}
