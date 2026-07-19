export type Skill = "grammaire" | "vocabulaire" | "kanji" | "lecture" | "ecoute";
export const SKILLS: Skill[] = ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"];
/** The 4 skills shown as dashboard bars — matches the legacy display (no `ecoute` bar). */
export const BAR_SKILLS: Skill[] = ["grammaire", "vocabulaire", "kanji", "lecture"];
/** Libellés FR d'affichage — une seule source, sinon les écrans divergent (« Vocab » vs
 *  « Vocabulaire ») selon celui qui a retapé la table. */
export const SKILL_LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture", ecoute: "Écoute",
};
export interface Progress {
  total: number;
  skill: Partial<Record<Skill, { R: number; t: number }>>;
  seen?: string;      // base64 bitset over global ids — answered ≥ 1×
  mastered?: string;  // base64 bitset — answered correctly ≥ 1× (⊆ seen)
}
