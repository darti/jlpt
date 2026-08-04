/**
 * État d'affichage d'une entité de cours, DÉRIVÉ du modèle de mémoire.
 *
 * `COURS_KEY` (`Record<IRI, "known"|"review">`) et la carte FSRS (`Record<IRI, Fsrs>`)
 * partageaient le même espace de clés sans jamais se parler : on pouvait avoir R = 0,98 sur
 * 〜ばかり depuis trois semaines et voir toujours « ○ » dans le cours. L'état n'est donc plus
 * stocké — il se calcule. Module PUR : `today` est injecté, jamais lu d'une horloge.
 */
import { fsrsInit, isDue, type Fsrs } from "../../lib/fsrs.ts";
import type { FsrsMap } from "../quiz/revision.ts";
import type { CoursGroup, LearnCategory } from "./coursSchema.ts";

export type EntityState = "neuf" | "en-cours" | "a-revoir" | "acquis";

/**
 * Stabilité (jours) au-delà de laquelle une entité est « acquise ».
 *
 * ⚠ Seuil dérivé d'une mesure, pas choisi : la trajectoire `fsrsReview(·, Good, échéance)`
 * depuis `fsrsInit(3)` donne S = 3,7 → 14,8 → 49,5 → 147,4 j. 21 tombe entre la 1re et la 2e
 * révision réussie — « acquis » se gagne donc en DEUX succès espacés. Figé par un test de
 * mesure dans `entityState.test.ts`.
 */
export const STABILITE_ACQUISE = 21;

/**
 * L'état d'une entité au jour `today`.
 *
 * ⚠ L'ordre des tests compte. `isDue` ne peut pas trancher seul : `fsrsInit(1, j)` (réponse
 * fausse sur un item neuf) rend S = 0,49 j avec R = 1 le jour même — l'entité serait affichée
 * « acquise » quelques heures après avoir été ratée. C'est la STABILITÉ qui porte
 * l'acquisition, la rétrievabilité ne porte que l'urgence.
 */
export function entityState(f: Fsrs | undefined, today: number): EntityState {
  if (!f) return "neuf";
  if (isDue(f, today)) return "a-revoir";
  return f[0] >= STABILITE_ACQUISE ? "acquis" : "en-cours";
}

/**
 * La carte d'une entité que l'apprenant DÉCLARE déjà connue (« Je sais déjà », dans le cours).
 *
 * ⚠ Une déclaration n'est pas une note de révision, et c'est pourquoi elle ne passe pas par
 * `fsrsInit`. Ce dernier posait `S = 3,7 j` (Good) : comme une entité redevient due exactement
 * `S` jours après sa dernière réponse (`R(S,S) = 0,9`, garanti par construction dans `fsrs.ts`),
 * déclarer « je connais » ramenait le point QUATRE JOURS plus tard — l'inverse de l'évacuation
 * demandée. On pose donc directement le seuil d'acquisition : l'entité devient « acquise », sort
 * de la phase d'apprentissage (`nextLessonBlock` ne prend que le neuf et le dû) et ne revient
 * qu'une fois, dans ~3 semaines, pour vérifier la déclaration.
 *
 * ⚠ **Ne dégrade JAMAIS une carte plus forte** (`Math.max`) : une mémoire mesurée à `S = 49 j`
 * vaut mieux qu'une déclaration, et la ramener à 21 avancerait son échéance de quatre semaines.
 * La difficulté mesurée est conservée telle quelle ; une entité neuve prend celle de `Good`.
 *
 * Pure — `today` est injecté.
 */
export function declaredKnownCard(f: Fsrs | undefined, today: number): Fsrs {
  return [Math.max(f?.[0] ?? 0, STABILITE_ACQUISE), f?.[1] ?? fsrsInit(3, today)[1], today];
}

export interface GroupStats {
  acquis: number;
  enCours: number;
  aRevoir: number;
  neufs: number;
  total: number;
}

const VIDE: GroupStats = { acquis: 0, enCours: 0, aRevoir: 0, neufs: 0, total: 0 };

const CHAMP: Record<EntityState, keyof Omit<GroupStats, "total">> = {
  acquis: "acquis",
  "en-cours": "enCours",
  "a-revoir": "aRevoir",
  neuf: "neufs",
};

export function groupStates(group: CoursGroup, m: FsrsMap, today: number): GroupStats {
  const out: GroupStats = { ...VIDE };
  for (const it of group.items) {
    out[CHAMP[entityState(m[it.id], today)]]++;
    out.total++;
  }
  return out;
}

export function categoryStates(cat: LearnCategory, m: FsrsMap, today: number): GroupStats {
  return cat.groups.reduce<GroupStats>((acc, g) => {
    const s = groupStates(g, m, today);
    return {
      acquis: acc.acquis + s.acquis,
      enCours: acc.enCours + s.enCours,
      aRevoir: acc.aRevoir + s.aRevoir,
      neufs: acc.neufs + s.neufs,
      total: acc.total + s.total,
    };
  }, { ...VIDE });
}
