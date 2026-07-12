/** Moteur de décision de session : mappe l'état de l'apprenant + le budget temps vers un
 *  plan de session. Fonction pure, capability-aware — n'émet un mode que si sa capacité est
 *  construite. Cœur du « next-best-action » du hub Entraînement (sous-projet #1). */

/** Jours depuis le dernier diagnostic au-delà desquels un recalibrage est proposé. */
export const DIAGNOSTIC_INTERVAL_DAYS = 7;

/** Part maximale du budget de questions consacrée au rejeu des erreurs. */
export const ERRORS_CAP = 0.3;

/** État de l'apprenant lu depuis la progression + la session reprenable. */
export interface SessionState {
  /** Une session en cours (< 2 j) existe. */
  resume: boolean;
  /** Jours depuis le dernier diagnostic ; `null` = jamais évalué. */
  daysSinceDiagnostic: number | null;
  /** Nombre d'items actuellement dans `wrong[]`. */
  wrongCount: number;
  /** Points de cours non encore travaillés (0 tant que le mode Apprendre n'est pas construit). */
  newCoursePoints: number;
}

/** Capacités (modes) réellement construites — gèle les branches non implémentées. */
export interface Caps {
  diagnostic: boolean;
  errors: boolean;
  learn: boolean;
}

/** Plan de session : deux prises de contrôle totales, ou une composition du budget. */
export type SessionPlan =
  | { kind: "resume" }
  | { kind: "diagnostic" }
  | { kind: "composed"; alloc: { errors: number; learn: number; adaptive: number } };

/** Capacités construites à ce jour. Sous-projet #4 : passer `learn` à `true` ici. */
export const BUILT_CAPS: Caps = { diagnostic: true, errors: true, learn: false };

/** Décide le plan de session (premier match gagne). `total` = budget de questions (dérivé du temps). */
export function pickSessionPlan(state: SessionState, total: number, caps: Caps): SessionPlan {
  if (state.resume) return { kind: "resume" };

  const diagnosticDue =
    state.daysSinceDiagnostic == null || state.daysSinceDiagnostic >= DIAGNOSTIC_INTERVAL_DAYS;
  if (caps.diagnostic && diagnosticDue) return { kind: "diagnostic" };

  const errors = caps.errors ? Math.min(state.wrongCount, Math.floor(ERRORS_CAP * total)) : 0;
  const learn = caps.learn ? Math.min(state.newCoursePoints, Math.max(0, total - errors)) : 0;
  const adaptive = Math.max(0, total - errors - learn);
  return { kind: "composed", alloc: { errors, learn, adaptive } };
}
