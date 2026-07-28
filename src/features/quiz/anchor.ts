/**
 * Ancrage : quelle question teste une entité donnée.
 *
 * Sert la phase d'apprentissage — chaque carte enseignée est suivie d'une question sur elle.
 *
 * ⚠ **Le pont kanji → mot est la raison d'être de ce module.** Les 551 kanji enseignés par le
 * cours et les 124 kanji que le corpus teste directement sont des ensembles DISJOINTS
 * (intersection vide, mesurée) : `link-answers.mjs` pose l'arête depuis la RÉPONSE, et la
 * réponse d'une question de kanji est presque toujours un MOT (2 690 arêtes `jlpt:word` contre
 * 436 `jlpt:kanji` dans `q-kanji.jsonld`). Sans ce pont, la piste kanji s'ancre à 0 % ; avec
 * lui, à 93 %. Aucune donnée n'est écrite : le pont se DÉRIVE des caractères du mot.
 *
 * Module PUR (aucune horloge, aucun aléa). Même patron de mémoïsation que `revision.ts#fsrsIndex`.
 */
import type { Question } from "../../types/quiz.ts";

export interface AnchorIndex {
  /** IRI d'entité → ords des questions qui la testent (arête `tests`). */
  direct: Map<string, number[]>;
  /** Caractère kanji → ords des questions testant un MOT qui le contient. */
  parKanji: Map<string, number[]>;
}

let cache: { key: Question[]; index: AnchorIndex } | null = null;

/** Vide la mémoïsation (isolation des tests, cf. `clearRevisionCache`). */
export function clearAnchorCache(): void { cache = null; }

const WORD = "jlpt:word/";
const KANJI = "jlpt:kanji/";

function push(m: Map<string, number[]>, k: string, ord: number): void {
  const a = m.get(k);
  if (a) a.push(ord); else m.set(k, [ord]);
}

export function anchorIndex(questions: Question[]): AnchorIndex {
  if (cache && cache.key === questions) return cache.index;
  const direct = new Map<string, number[]>();
  const parKanji = new Map<string, number[]>();
  for (const q of questions) {
    for (const iri of q.tests ?? []) {
      push(direct, iri, q.id);
      if (!iri.startsWith(WORD)) continue;
      // Un mot testé rend testable CHACUN de ses kanji. `new Set` évite qu'un mot répétant un
      // caractère (人人) inscrive deux fois le même ord.
      for (const ch of new Set(iri.slice(WORD.length))) push(parKanji, ch, q.id);
    }
  }
  cache = { key: questions, index: { direct, parKanji } };
  return cache.index;
}

/**
 * L'ord de la question qui ancre `iri`, ou `null` s'il n'y en a aucune de disponible.
 *
 * Deux temps : l'arête `tests` directe d'abord, le pont par le mot ensuite (kanji seulement).
 * À égalité, le plus petit ord gagne — c'est l'ordre du corpus, donc la question la plus
 * simple d'abord. `exclude` porte ce que la session a déjà réservé.
 */
export function selectAnchor(
  iri: string, index: AnchorIndex, exclude: Set<number>,
): number | null {
  const premier = (ords: number[] | undefined): number | null => {
    if (!ords) return null;
    let best: number | null = null;
    for (const o of ords) if (!exclude.has(o) && (best === null || o < best)) best = o;
    return best;
  };
  const directe = premier(index.direct.get(iri));
  if (directe !== null) return directe;
  if (!iri.startsWith(KANJI)) return null;
  return premier(index.parKanji.get(iri.slice(KANJI.length)));
}
