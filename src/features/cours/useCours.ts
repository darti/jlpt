/** Charge le contenu de cours depuis le graphe (data/graph/*.jsonld) au runtime.
 *  null = chargement, [] = échec. La projection vit dans coursFromGraph.ts — ce hook ne fait
 *  que l'alimenter.
 *
 *  ⚠ N'utilise volontairement PAS `useAsyncOnce` malgré la forme identique : ce hook distingue
 *  « en cours » (`null`) de « échec » (`[]`) pour que la page affiche un message plutôt qu'un
 *  chargement infini. `useAsyncOnce` replie les deux sur `null` — passer par lui perdrait
 *  précisément l'information qui justifie ce hook. */
import { useEffect, useState } from "react";
import type { CoursCategory } from "./coursSchema.ts";
import { buildCours, type CoursDocs, type Sujet } from "./coursFromGraph.ts";

const DOCS = ["lesson", "gram", "kanji", "word", "example", "method"] as const;

let cache: Promise<CoursCategory[]> | null = null;

/** Vide la mémoïsation (isolation des tests, cf. `clearGraphCache` / `clearRappelCache`). */
export function clearCoursCache(): void { cache = null; }

/**
 * Charge et mémoïse le programme, AU MODULE — deux consommateurs le partagent désormais (la
 * route `/cours` et le moteur de séance, qui a besoin du programme pour savoir quoi enseigner).
 *
 * ⚠ La mémoïsation n'est pas une micro-optimisation : sans elle, chaque montage refetchait les
 * six documents, dont `word.jsonld` (978 Ko). Ouvrir `/entrainement` en retéléchargeait ~1,44 Mo
 * — et chaque aller-retour `/cours` ↔ `/entrainement` recommençait. Même patron que
 * `loadRappelIndex` (`rappel.ts`), y compris la **purge en cas d'échec** : une promesse rejetée
 * gardée en cache condamnerait le programme pour toute la session.
 */
export function loadCours(): Promise<CoursCategory[]> {
  if (!cache) {
    // En parallèle : six documents chargés au fil d'une boucle `await` sérialiseraient six
    // allers-retours au premier affichage. Le SW les précache depuis le lot 2.
    cache = Promise.all(
      DOCS.map((n) => fetch(`data/graph/${n}.jsonld`)
        .then((r) => r.json() as Promise<{ "@graph"?: Sujet[] }>)
        .then((d) => d["@graph"] ?? [])),
    )
      .then((docs) =>
        buildCours(Object.fromEntries(DOCS.map((n, i) => [n, docs[i]])) as unknown as CoursDocs))
      .catch(() => { cache = null; return []; });
  }
  return cache;
}

export function useCours(): CoursCategory[] | null {
  const [cats, setCats] = useState<CoursCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCours().then((c) => { if (alive) setCats(c); });
    return () => { alive = false; };
  }, []);
  return cats;
}
