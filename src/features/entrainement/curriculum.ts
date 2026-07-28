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
 * Jusqu'à `n` entités à enseigner sur `track`, dans l'ordre du programme.
 *
 * La leçon en cours est la première (dans l'ordre reçu, déjà trié par `jlpt:order`) qui
 * contient au moins un item non acquis ; on y prend les premiers non acquis. Si elle en fournit
 * moins de `n`, on complète avec la suivante : un bloc peut donc chevaucher deux leçons. C'est
 * la frontière, pas le régime courant — mieux vaut un bloc complet qu'un bloc tronqué.
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
      if (entityState(m[item.id], today) === "acquis") continue;
      out.push(item);
      if (out.length >= n) return out;
    }
  }
  return out;
}
