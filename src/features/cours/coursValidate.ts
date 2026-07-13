/** Garde-fou de forme pour le contenu de cours chargé au runtime (data/cours-*.json).
 *  Une donnée périmée (cache SW d'avant la migration lessons→groups) ne doit jamais
 *  atteindre les vues : sans `groups`, `CategoryIndex` plantait sur `category.groups.map`. */
import type { CoursCategory } from "./coursSchema.ts";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Vrai si `x` a la forme d'une catégorie de cours du schéma courant (learn|method). */
export function isCoursCategory(x: unknown): x is CoursCategory {
  if (!isRecord(x)) return false;
  if (typeof x.id !== "string" || typeof x.title !== "string") return false;
  if (x.kind === "method") return Array.isArray(x.sections);
  if (x.kind === "learn") return Array.isArray(x.groups);
  return false; // pas de `kind` reconnu → forme périmée/inconnue
}
