import type { Skill } from "./progress.ts";

export type Difficulty = 1 | 2 | 3;

export interface SkillState {
  R: number;
  t: number;
  r: number;
}

export interface Question {
  id: number;
  cat: Skill;
  d: Difficulty;
  q: string;
  o: string[];
  a: number;
  e?: string;
  g?: string;
  od?: string[];
  /** IRIs des entités testées (`jlpt:gram/…`, `jlpt:word/…`, `jlpt:kanji/…`) — alimentent le
   *  « Rappel » du corrigé sans parser l'explication. Absent si la question n'est pas reliée. */
  tests?: string[];
  [k: string]: unknown; // ecoute/lecture may carry extra fields — preserved
}
