export type Skill = "grammaire" | "vocabulaire" | "kanji" | "lecture";
export const SKILLS: Skill[] = ["grammaire", "vocabulaire", "kanji", "lecture"];
export interface Progress {
  total: number;
  skill: Record<Skill, { R: number }>;
}
