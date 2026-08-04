/**
 * Le curseur de programme : quelles entités la séance du jour enseigne.
 *
 * On avance dans l'ORDRE DU COURS plutôt que de laisser un algorithme composer un paquet
 * hétéroclite : apprendre 〜たら, 〜ば et 〜なら ensemble permet de les contraster, ce qu'un
 * tirage par compétence la plus faible ne donne jamais.
 *
 * Module PUR : `today` est injecté. L'état d'un item se DÉRIVE de la carte FSRS
 * (`entityState`) — il n'y a plus de cochage manuel.
 */
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import { entityState } from "../cours/entityState.ts";
import type { FsrsMap } from "../quiz/revision.ts";

export type Track = "gram" | "vocab" | "kanji";

/**
 * Jusqu'à `n` entités à ENSEIGNER sur `track`, dans l'ordre du programme.
 *
 * ⚠ On n'enseigne que le NEUF (jamais rencontré) et le DÛ (« à revoir »). Une entité « en cours »
 * — déjà introduite mais pas encore due — a quitté la phase d'apprentissage : c'est la révision
 * espacée qui la reprendra le jour de son échéance. Sans cette garde, une seconde séance le même
 * jour ré-enseignait les points tout juste vus : introduits aujourd'hui, ils restent « en cours »
 * (jamais « acquis » avant deux succès espacés, cf. `STABILITE_ACQUISE`), donc éternellement
 * re-proposés au lieu de laisser la place à de nouveaux points. Le « à revoir » reste enseignable
 * car, pour les entités sans ancre, la phase d'apprentissage est le seul endroit qui les re-surface.
 *
 * La leçon en cours est la première (dans l'ordre reçu, déjà trié par `jlpt:order`) qui contient
 * au moins un item enseignable ; on y prend les premiers. Si elle en fournit moins de `n`, on
 * complète avec la suivante : un bloc peut donc chevaucher deux leçons. C'est la frontière, pas
 * le régime courant — mieux vaut un bloc complet qu'un bloc tronqué.
 */
export function nextLessonBlock(
  track: Track, categories: CoursCategory[], m: FsrsMap, today: number, n: number,
): CoursItem[] {
  if (n <= 0) return [];
  const cat = categories.find((c) => c.id === track);
  if (!cat || cat.kind !== "learn") return [];
  const out: CoursItem[] = [];
  for (const g of cat.groups) {
    for (const item of g.items) {
      const st = entityState(m[item.id], today);
      if (st === "acquis" || st === "en-cours") continue;
      out.push(item);
      if (out.length >= n) return out;
    }
  }
  return out;
}
