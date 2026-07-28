/**
 * Adapte un `Rappel` (résolu par l'arête `tests` d'une question) vers le `CoursItem` qu'attend
 * `EntityCard`. Pur.
 *
 * Les deux types décrivent la même entité vue de deux côtés : `rappel.ts` la projette pour le
 * corrigé, `coursFromGraph.ts` pour le cours. Cet adaptateur est ce qui permet au corrigé de
 * rendre EXACTEMENT la carte que l'apprenant reverra dans le paquet — une seule apparence pour
 * une même notion.
 */
import type { Rappel } from "./rappel.ts";
import type { CoursItem } from "../cours/coursSchema.ts";

export function itemFromRappel(r: Rappel): CoursItem {
  if (r.kind === "gram") {
    return {
      id: r.iri,
      form: r.titre,
      ...(r.sens ? { mean: r.sens } : {}),
      ...(r.niv ? { niv: r.niv } : {}),
      ...(r.exemple
        ? { examples: [{ jp: r.exemple.jp, ro: r.exemple.ro, fr: r.exemple.fr, ...(r.exemple.an ? { an: r.exemple.an } : {}) }] }
        : {}),
    };
  }
  if (r.kind === "kanji") {
    return { id: r.iri, kanji: r.titre, lecture: r.lecture, sens: r.sens };
  }
  return {
    id: r.iri, mot: r.titre, lecture: r.lecture, sens: r.sens,
    ...(r.niv ? { niv: r.niv } : {}),
  };
}
