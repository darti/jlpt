/** Charge le contenu de cours (data/cours-*.json, schéma unifié) au runtime.
 *  null = chargement, [] = échec. */
import { useEffect, useState } from "react";
import type { CoursCategory, CoursCategoryId } from "./coursSchema.ts";

const IDS: CoursCategoryId[] = ["gram", "vocab", "kanji", "method"];

export function useCours(): CoursCategory[] | null {
  const [cats, setCats] = useState<CoursCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(
      IDS.map((id) =>
        fetch(`data/cours-${id}.json`).then((r) => r.json() as Promise<CoursCategory>)),
    )
      .then((c) => { if (alive) setCats(c); })
      .catch(() => { if (alive) setCats([]); });
    return () => { alive = false; };
  }, []);
  return cats;
}
