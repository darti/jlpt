/**
 * La file de la phase d'apprentissage : quelles entités, dans quel ordre, avec quelle ancre.
 *
 * Toute la règle de la phase 1 vit ici, pas dans le hook — `useQuiz` n'orchestre que les
 * phases. Module PUR.
 */
import { allocateCount } from "../../lib/bank.ts";
import { SKILLS, type Skill } from "../../types/progress.ts";
import type { Question } from "../../types/quiz.ts";
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import type { FsrsMap } from "../quiz/revision.ts";
import { anchorIndex, isAnchor, selectAnchor, type AnchorIndex } from "../quiz/anchor.ts";
import { nextLessonBlock, type Track } from "./curriculum.ts";

/** Les trois pistes enseignables et la compétence de quiz correspondante. */
export const TRACK_DE_SKILL: Record<Track, Skill> = {
  gram: "grammaire", vocab: "vocabulaire", kanji: "kanji",
};

const TRACKS: Track[] = ["gram", "vocab", "kanji"];

/**
 * Plancher de cartes de GRAMMAIRE par séance : au moins autant de cartes neuves de grammaire, pour
 * en accélérer l'apprentissage. La grammaire est ainsi PRIORITAIRE sur le vocabulaire et les kanji,
 * quels que soient les poids de maîtrise.
 *
 * ⚠ Deux bornes le plafonnent en aval, sans quoi il fabriquerait des cartes hors budget : le
 * budget d'apprentissage (`total`, argument d'`allocateLearn`) et, plus loin, le nombre de points
 * de grammaire encore neufs — `nextLessonBlock` n'en rend jamais plus qu'il n'en reste. Le budget
 * lui-même est garanti par `sessionPlan.LEARN_MIN`, jumeau de ce plancher.
 */
export const GRAM_LEARN_FLOOR = 5;

/**
 * Répartit `total` entités à enseigner sur les trois pistes enseignables.
 *
 * ⚠ `allocateCount` distribue sur les CINQ compétences, or `lecture` et `ecoute` n'ont aucune
 * entité (leur réponse est un fragment de texte, pas une entité du référentiel). On leur donne
 * un poids nul, puis on RAPATRIE ce qui leur écherrait malgré tout : le reliquat de la division
 * entière est distribué par poids décroissant et peut les atteindre. Sans ce rapatriement, le
 * budget d'apprentissage fuit vers des pistes qui ne peuvent rien en faire.
 *
 * ⚠ Puis le plancher de grammaire (`GRAM_LEARN_FLOOR`) : la grammaire est ramenée à au moins
 * `min(GRAM_LEARN_FLOOR, total)` cartes, ce qui lui manque étant prélevé sur le vocabulaire puis
 * les kanji. Le total est conservé (simple transfert entre pistes).
 */
export function allocateLearn(
  weightOf: (c: Skill) => number, total: number,
): Record<Track, number> {
  if (total <= 0) return { gram: 0, vocab: 0, kanji: 0 };
  const enseignable = (c: Skill) => (TRACKS.some((t) => TRACK_DE_SKILL[t] === c) ? weightOf(c) : 0);
  const brut = allocateCount(enseignable, total);
  const out: Record<Track, number> = {
    gram: brut.grammaire, vocab: brut.vocabulaire, kanji: brut.kanji,
  };
  // Rapatriement : tout ce qui est allé aux compétences non enseignables revient à la piste
  // enseignable de plus fort poids (à égalité, l'ordre de TRACKS tranche — déterministe).
  let orphelins = 0;
  for (const c of SKILLS) if (!TRACKS.some((t) => TRACK_DE_SKILL[t] === c)) orphelins += brut[c];
  if (orphelins > 0) {
    const meilleure = TRACKS.reduce((a, b) =>
      weightOf(TRACK_DE_SKILL[b]) > weightOf(TRACK_DE_SKILL[a]) ? b : a);
    out[meilleure] += orphelins;
  }
  // Plancher de grammaire : prioritaire, prélevé sur vocab puis kanji. Borné par `total` — on ne
  // fabrique jamais de carte au-delà du budget d'apprentissage de la séance.
  let manque = Math.min(GRAM_LEARN_FLOOR, total) - out.gram;
  for (const t of ["vocab", "kanji"] as const) {
    if (manque <= 0) break;
    const pris = Math.min(manque, out[t]);
    out[t] -= pris; out.gram += pris; manque -= pris;
  }
  return out;
}

/** Une étape de la phase d'apprentissage : la carte, et la question qui la teste (ou aucune). */
export interface LearnStep {
  item: CoursItem;
  /** Ord de la question d'ancrage — `null` quand rien dans le corpus ne teste l'entité. */
  anchor: number | null;
}

/**
 * La file de la phase 1 : les entités du programme, **en blocs contigus par piste**, chacune
 * suivie de sa question d'ancrage.
 *
 * ⚠ Une entité sans ancre reste enseignée : 38 kanji et ~14 % de la grammaire et du vocabulaire
 * n'ont aucune question qui les teste. On n'invente pas de question — la carte proposera
 * l'auto-évaluation. Son créneau de question retourne au quiz (cf. l'invariant de budget).
 */
export function buildLearnQueue(args: {
  categories: CoursCategory[];
  fsrs: FsrsMap;
  today: number;
  alloc: Record<Track, number>;
  index: AnchorIndex;
  exclude: Set<number>;
}): LearnStep[] {
  const { categories, fsrs, today, alloc, index } = args;
  const pris = new Set(args.exclude);
  const out: LearnStep[] = [];
  for (const track of TRACKS) {
    for (const item of nextLessonBlock(track, categories, fsrs, today, alloc[track])) {
      const anchor = selectAnchor(item.id, index, pris);
      if (anchor !== null) pris.add(anchor);
      out.push({ item, anchor });
    }
  }
  return out;
}

/**
 * Les ords des **reprises** : une seconde question par entité enseignée, dans l'ordre de la file,
 * bornée à `place` — les places que la tranche garantie du quiz a encore de libres.
 *
 * ⚠ **La borne est la raison d'être de cette fonction.** Les reprises rejoignent la tranche
 * GARANTIE de `composeSession`, et celle-ci n'est JAMAIS tronquée (`bank.ts:125-131` :
 * `adaptiveTarget = max(0, total - errorQs.length)` puis `[...errorQs, ...adaptiveQs]`). Or
 * `sessionPlan` n'a jamais budgété de reprises : sans borne, une séance dont les erreurs, la
 * confusion et la révision saturent déjà le budget (`alloc.adaptive === 0`, l'état NORMAL d'un
 * apprenant chargé) rend `alloc.learn` questions de TROP — 17 au lieu de 15 sur 10 min, 48 au
 * lieu de 45 sur 30 min, sans la moindre erreur.
 *
 * `exclude` n'est pas muté (copie interne, comme `buildLearnQueue`) : l'appelant décide ce qu'il
 * réserve. Une entité sans seconde question disponible n'en produit simplement aucune.
 */
export function selectReprises(
  learnFile: LearnStep[], index: AnchorIndex, exclude: Set<number>, place: number,
): number[] {
  if (place <= 0) return [];
  const pris = new Set(exclude);
  const out: number[] = [];
  for (const step of learnFile) {
    if (out.length >= place) break;
    const ord = selectAnchor(step.item.id, index, pris);
    if (ord === null) continue;
    pris.add(ord);
    out.push(ord);
  }
  return out;
}

/** Index IRI → item du programme, toutes pistes enseignables confondues. */
function itemsParIri(categories: CoursCategory[]): Map<string, CoursItem> {
  const out = new Map<string, CoursItem>();
  for (const cat of categories) {
    if (cat.kind !== "learn") continue;
    for (const g of cat.groups) for (const it of g.items) out.set(it.id, it);
  }
  return out;
}

/**
 * La file d'une session REPRISE : les entités restant à enseigner (`iris`, tels que persistés
 * dans `ResumeState.learn`) et, pour chacune, l'ancre que la session lui réserve déjà.
 *
 * ⚠ L'ancre se **lit** dans l'ordre de la session, elle ne se recalcule pas. Les questions
 * d'ancrage ouvrent `questions` dans l'ordre de la file et se consomment une par une : à partir
 * de `from` (la position où la session s'est interrompue), la question courante est l'ancre de
 * l'entité courante si elle la teste. Rejouer `selectAnchor` rendrait un autre ord — le jeu
 * d'exclusion d'origine (erreurs, révision, confusion) n'existe plus à la reprise.
 *
 * Une entité que le programme ne connaît plus est ignorée. L'alignement dégrade alors vers
 * « plus d'ancre » (les questions restantes redeviennent de simples questions de quiz), jamais
 * vers une ancre fausse : le budget de la séance est préservé dans tous les cas.
 */
export function rebuildLearnQueue(
  iris: string[], categories: CoursCategory[], questions: Question[], from: number,
): LearnStep[] {
  const parIri = itemsParIri(categories);
  const index = anchorIndex(questions);
  const out: LearnStep[] = [];
  let pos = from;
  for (const iri of iris) {
    const item = parIri.get(iri);
    if (!item) continue;
    const q = questions[pos];
    const anchor = q && isAnchor(iri, q.id, index) ? q.id : null;
    if (anchor !== null) pos++;
    out.push({ item, anchor });
  }
  return out;
}
