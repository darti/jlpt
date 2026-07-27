/**
 * Reprise de session : la forme persistée sous `jlptN3quiz_resume`, sa lecture validée, son
 * écriture et sa purge.
 *
 * Extrait de `useQuiz.ts` — c'est de la PERSISTANCE, pas de la machine à états, et le hub
 * Entraînement en dépend autant que le moteur. Port de `saveResume`/`getResume` du vanilla
 * (app-n3.html:430-446).
 */

import { RESUME_KEY } from "../../lib/keys.ts";

const DAY_MS = 864e5;
/** 2 jours — reprend la règle de péremption du vanilla `getResume()`. */
export const RESUME_MAX_AGE_MS = 2 * DAY_MS;

/** Forme persistée. `phase`/`chosen` sont optionnels pour qu'une session interrompue SUR le
 *  corrigé (l'utilisateur a tapé « voir le point de grammaire ») rouvre ce même corrigé au
 *  lieu de la question nue — un blob ancien, sans ces champs, reprend en question comme avant. */
export interface ResumeState {
  kind: "quiz";
  ids: number[];
  qi: number;
  right: number;
  t: number;
  phase?: "question" | "corrige";
  chosen?: number;
}

/**
 * À la reprise : faut-il rouvrir le corrigé (vs la question nue) et quelle option restaurer.
 *
 * ⚠ Se base sur la SEULE phase. Un corrigé de production erronée persiste `chosen: undefined`
 * (aucun distracteur coché) : exiger `typeof chosen === "number"` le rouvrirait comme une
 * question, la ferait re-répondre et recompter (Elo/FSRS/total en double). Pur → testé.
 */
export function restoredCorrige(r: ResumeState): { answered: boolean; chosen: number | null } {
  const onCorrige = r.phase === "corrige";
  return { answered: onCorrige, chosen: onCorrige && typeof r.chosen === "number" ? r.chosen : null };
}

/** Lit + valide la session persistée, et la PURGE si elle a plus de 2 jours. La lecture et la
 *  règle de péremption ne vivent qu'ici : la carte de session du hub reçoit le `ResumeState`
 *  en prop depuis le moteur, elle ne relit pas le store de son côté. */
export function readResumeState(): ResumeState | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as ResumeState;
    if (!r || r.kind !== "quiz" || !Array.isArray(r.ids)) return null;
    if (typeof r.t !== "number" || Date.now() - r.t > RESUME_MAX_AGE_MS) {
      localStorage.removeItem(RESUME_KEY);
      return null;
    }
    return r;
  } catch {
    return null;
  }
}

/** Persiste la session en réhorodatant `t`. Best-effort (miroir du `saveResume` vanilla). */
export function persistResumeState(r: ResumeState): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ ...r, t: Date.now() }));
  } catch { /* best-effort */ }
}

export function clearResumeState(): void {
  try { localStorage.removeItem(RESUME_KEY); } catch { /* best-effort */ }
}
