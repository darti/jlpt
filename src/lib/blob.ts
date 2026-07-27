/**
 * Le SCHÉMA du blob de progression : ce que `jlptN3adapt_v2` contient, et comment le lire.
 *
 * `storage.ts` possède l'accès au store (lire/écrire la chaîne) ; ce module possède
 * l'INTERPRÉTATION de ce qu'on en tire. Les deux étaient séparés en pratique mais pas en
 * intention : les décodeurs vivaient dans `useQuiz.ts` (un hook React), `useCadence.ts`,
 * `useCoverage.ts` et `history.ts`, chacun retapant ses gardes. La garde des bitsets —
 * `typeof raw?.seen === "string" ? raw.seen : ""` — était écrite CINQ fois.
 *
 * ⚠ Tolérant par construction. Le blob est de la donnée utilisateur vieille de plusieurs
 * versions, éventuellement rapatriée d'un Gist : un champ manquant, d'un mauvais type ou
 * carrément corrompu doit dégrader vers un défaut, jamais jeter. Un `throw` ici viderait
 * l'écran d'accueil.
 *
 * ⚠ Les décodeurs de FEATURE restent chez elles : `asConfusions` (`quiz/traps.ts`) et
 * `asFsrs` (`quiz/revision.ts`) portent des types définis par leur feature. Les rapatrier
 * ici créerait une arête de `lib/` vers `features/` — l'inverse du sens des dépendances.
 */

import type { Progress, Skill } from "../types/progress.ts";
import type { SkillState } from "../types/quiz.ts";
import { decodeBits } from "./coverage.ts";

/** Le blob tel que `readRawProgress` le rend : un objet non typé, ou `null`. */
export type RawProgress = Record<string, unknown> | null;

/** Rating neutre d'une compétence jamais rencontrée — aligné sur `blankSkills()`. */
const PRIOR_R = 1450;

/** Les deux champs bitset du blob, en base64 sur les ordinaux globaux. */
export type BitsField = "seen" | "mastered";

/** Assez large pour accepter le blob brut ET un `Progress` typé (`useCoverage` passe `p`). */
type BitsSource = { seen?: unknown; mastered?: unknown };

/** Un champ numérique du blob, ou 0. `0` et les négatifs sont des valeurs, pas des absences. */
export function asNum(raw: RawProgress, key: string): number {
  const v = raw?.[key];
  return typeof v === "number" ? v : 0;
}

/** La table `skill` du blob, ou `{}` si absente / malformée (tableau, scalaire…). */
export function asSkillMap(raw: RawProgress): Record<string, unknown> {
  const s = raw?.skill;
  return s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
}

/** La vue `Progress` minimale que lit `scoring.ts#masteryOf` — total + table des compétences. */
export function asProgress(raw: RawProgress): Progress {
  return { total: asNum(raw, "total"), skill: asSkillMap(raw) as Progress["skill"] };
}

/** L'état `{R,t,r}` complet d'une compétence, chaque champ retombant seul sur son défaut.
 *  Une compétence absente vaut un état vierge (R=1450) : c'est le contrat historique du
 *  blob, qui ne stocke que les compétences déjà rencontrées. */
export function asSkillState(raw: RawProgress, cat: Skill): SkillState {
  const s = asSkillMap(raw)[cat];
  if (s && typeof s === "object") {
    const o = s as Record<string, unknown>;
    return {
      R: typeof o.R === "number" ? o.R : PRIOR_R,
      t: typeof o.t === "number" ? o.t : 0,
      r: typeof o.r === "number" ? o.r : 0,
    };
  }
  return { R: PRIOR_R, t: 0, r: 0 };
}

/** Les ids des erreurs récentes (anneau borné à 80), ou `[]`. */
export function asWrong(raw: RawProgress): number[] {
  return Array.isArray(raw?.wrong) ? (raw.wrong as number[]) : [];
}

/** Le journal des sessions (anneau borné à 40), ou `[]`. */
export function asHistory(raw: RawProgress): unknown[] {
  return Array.isArray(raw?.history) ? (raw.history as unknown[]) : [];
}

/** Un champ bitset en base64 BRUT, ou `""`. Rendu tel quel — et pas décodé — parce que
 *  `useCoverage` mémoïse dessus : un `Uint8Array` serait une référence neuve à chaque rendu
 *  et invaliderait le `useMemo` en permanence. */
export function asBitsB64(src: BitsSource | null | undefined, field: BitsField): string {
  const v = src?.[field];
  return typeof v === "string" ? v : "";
}

/** Un champ bitset DÉCODÉ. Base64 invalide → bitset vide (cf. `decodeBits`), jamais d'exception. */
export function asBits(src: BitsSource | null | undefined, field: BitsField): Uint8Array {
  return decodeBits(asBitsB64(src, field));
}
