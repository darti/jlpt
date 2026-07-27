import type { Skill } from "./progress.ts";

export type Difficulty = 1 | 2 | 3;

export interface SkillState {
  R: number;
  t: number;
  r: number;
}

/** Les quatre formats de textes de l'épreuve 読解 : 短文 (court), 中文 (moyen), 長文 (long),
 *  情報検索 (recherche d'information). Slugs ASCII : métadonnée de code, l'UI en donne le
 *  libellé français. */
export type PassageFormat = "tanbun" | "chubun" | "chobun" | "joho";

/** Un texte de compréhension écrite, partagé par 1 à 4 questions. */
export interface Passage {
  jp: string;
  format: PassageFormat;
  /** Traduction / résumé français, pour le corrigé. */
  fr?: string;
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
  /** IRI du texte que la question interroge (`jlpt:passage/…`). Clé de regroupement : les
   *  questions d'un même texte voyagent ensemble dans une session (`withPassageGroups`). */
  passageId?: string;
  /** Le texte résolu, attaché par `bank.ts#loadCategory` — la projection, elle, est synchrone. */
  passage?: Passage;
  [k: string]: unknown; // ecoute/lecture may carry extra fields — preserved
}
