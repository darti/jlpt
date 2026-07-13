/** Charge le contenu de cours (data/cours-*.json, schéma unifié) au runtime.
 *  null = chargement, [] = échec. */
import { useEffect, useState } from "react";
import type { CoursCategory, CoursCategoryId } from "./coursSchema.ts";
import { isCoursCategory } from "./coursValidate.ts";

const IDS: CoursCategoryId[] = ["gram", "vocab", "kanji", "method"];

export function useCours(): CoursCategory[] | null {
  const [cats, setCats] = useState<CoursCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(
      IDS.map((id) =>
        fetch(`data/cours-${id}.json`).then((r) => r.json() as Promise<unknown>)),
    )
      .then((c) => {
        // Rejette toute donnée périmée/malformée (ex. cache SW d'avant lessons→groups) :
        // mieux vaut « Cours indisponible » qu'un plantage sur `category.groups.map`.
        if (!c.every(isCoursCategory)) throw new Error("cours: forme de données invalide");
        if (alive) setCats(c);
      })
      .catch(() => { if (alive) setCats([]); });
    return () => { alive = false; };
  }, []);
  return cats;
}
