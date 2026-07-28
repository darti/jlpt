/**
 * Vestige de la progression de cours manuelle : lecture seule + migration vers la mémoire.
 *
 * L'état d'un item n'est plus stocké, il se dérive (`entityState.ts`). Ce module ne sert plus
 * qu'à verser une fois l'ancien cochage dans la carte FSRS. ⚠ `COURS_KEY` n'est PAS supprimée :
 * elle reste la preuve du travail manuel déjà fait et permet de rejouer la migration si elle
 * est perdue. Elle n'est simplement plus jamais écrite.
 */
import { COURS_KEY } from "../../lib/keys.ts";
import { fsrsInit } from "../../lib/fsrs.ts";
import type { FsrsMap } from "../quiz/revision.ts";

export type ItemState = "known" | "review";
export type CoursProgress = Record<string, ItemState>;

export function loadCoursProgress(
  store: Pick<Storage, "getItem"> = globalThis.localStorage
): CoursProgress {
  let raw: string | null;
  try { raw = store.getItem(COURS_KEY); } catch { return {}; }
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: CoursProgress = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === "known" || v === "review") out[k] = v;
    }
    return out;
  } catch { return {}; }
}

/**
 * La carte FSRS après versement de l'ancien cochage — `null` s'il n'y a rien à écrire.
 *
 * `known` → `fsrsInit(3)` (Good), `review` → `fsrsInit(1)` (Again). **N'écrase jamais** une
 * carte existante : la mémoire mesurée fait autorité sur une déclaration manuelle. Pure.
 */
export function migrateCoursProgress(
  legacy: CoursProgress, m: FsrsMap, today: number,
): FsrsMap | null {
  const next: FsrsMap = { ...m };
  let touche = false;
  for (const [iri, etat] of Object.entries(legacy)) {
    if (next[iri]) continue; // la carte existante gagne
    next[iri] = fsrsInit(etat === "known" ? 3 : 1, today);
    touche = true;
  }
  return touche ? next : null;
}
