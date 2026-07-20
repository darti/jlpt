/** Charge le contenu de cours depuis le graphe (data/graph/*.jsonld) au runtime.
 *  null = chargement, [] = échec. La projection vit dans coursFromGraph.ts — ce hook ne fait
 *  que l'alimenter. */
import { useEffect, useState } from "react";
import type { CoursCategory } from "./coursSchema.ts";
import { buildCours, type CoursDocs, type Sujet } from "./coursFromGraph.ts";

const DOCS = ["lesson", "gram", "kanji", "word", "example", "method"] as const;

export function useCours(): CoursCategory[] | null {
  const [cats, setCats] = useState<CoursCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    // En parallèle : six documents chargés au fil d'une boucle `await` sérialiseraient six
    // allers-retours au premier affichage. Le SW les précache depuis le lot 2.
    Promise.all(
      DOCS.map((n) => fetch(`data/graph/${n}.jsonld`)
        .then((r) => r.json() as Promise<{ "@graph"?: Sujet[] }>)
        .then((d) => d["@graph"] ?? [])),
    )
      .then((docs) => {
        if (!alive) return;
        const par = Object.fromEntries(DOCS.map((n, i) => [n, docs[i]])) as unknown as CoursDocs;
        setCats(buildCours(par));
      })
      .catch(() => { if (alive) setCats([]); });
    return () => { alive = false; };
  }, []);
  return cats;
}
