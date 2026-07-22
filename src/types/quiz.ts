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
  /** Type de piège de CHAQUE option (`""` à l'index de la réponse). Présent sur les seules
   *  pistes kanji et vocabulaire : son absence signifie « hors périmètre », à distinguer de
   *  la valeur `"autre"` qui signifie « dans le périmètre, mais non classé ». */
  trap?: string[];
  [k: string]: unknown; // ecoute/lecture may carry extra fields — preserved
}
