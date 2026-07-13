/** Helpers pour la synthèse vocale des contenus du Cours. */

/** Tête japonaise d'un exemple de kanji (« 過去 (kako) passé » → « 過去 »).
 *  Découpe sur le premier espace ou parenthèse (mi- ou pleine largeur). Pur. */
export function kanjiExempleJa(exemple: string): string {
  if (!exemple) return "";
  return exemple.split(/[\s(（]/)[0]!.trim();
}
