/**
 * État d'affichage d'une entité de cours, DÉRIVÉ du modèle de mémoire.
 *
 * `COURS_KEY` (`Record<IRI, "known"|"review">`) et la carte FSRS (`Record<IRI, Fsrs>`)
 * partageaient le même espace de clés sans jamais se parler : on pouvait avoir R = 0,98 sur
 * 〜ばかり depuis trois semaines et voir toujours « ○ » dans le cours. L'état n'est donc plus
 * stocké — il se calcule. Module PUR : `today` est injecté, jamais lu d'une horloge.
 */
import { isDue, type Fsrs } from "../../lib/fsrs.ts";
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
