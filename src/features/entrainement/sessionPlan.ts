/** Moteur de décision de session : mappe l'état de l'apprenant + le budget temps vers un
 *  plan de session. Fonction pure, capability-aware — n'émet un mode que si sa capacité est
 *  construite. Cœur du « next-best-action » du hub Entraînement (sous-projet #1). */

/** Jours depuis le dernier diagnostic au-delà desquels un recalibrage est proposé. */
export const DIAGNOSTIC_INTERVAL_DAYS = 7;

/** Part maximale du budget de questions consacrée au rejeu des erreurs. */
export const ERRORS_CAP = 0.3;

/** Part maximale du budget de questions consacrée aux items inédits (mode Apprendre). */
export const LEARN_CAP = 0.4;

/** Part maximale du budget consacrée à la révision espacée (entités dues FSRS). */
export const REVISION_CAP = 0.4;

/** Part maximale du budget consacrée au drill des confusions actives (types de pièges répétés). */
export const CONFUSION_CAP = 0.25;

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
  /** Nombre d'entités dues à révision aujourd'hui (0 tant que la mémoire ne s'est pas accumulée). */
  revisionDue: number;
  /** Nombre d'événements de confusion récents (proxy de plafond ; 0 tant qu'aucune confusion). */
  confusionCount: number;
}

/** Capacités (modes) réellement construites — gèle les branches non implémentées. */
export interface Caps {
  diagnostic: boolean;
  errors: boolean;
  learn: boolean;
  revision: boolean;
  confusion: boolean;
}

/** Plan de session : deux prises de contrôle totales, ou une composition du budget. */
export type SessionPlan =
  | { kind: "resume" }
  | { kind: "diagnostic" }
  | { kind: "composed"; alloc: { errors: number; confusion: number; revision: number; learn: number; adaptive: number } };

/** Capacités construites à ce jour. */
export const BUILT_CAPS: Caps = { diagnostic: true, errors: true, learn: true, revision: true, confusion: true };

/** Décide le plan de session (premier match gagne). `total` = budget de questions (dérivé du temps). */
export function pickSessionPlan(state: SessionState, total: number, caps: Caps): SessionPlan {
  if (state.resume) return { kind: "resume" };

  const diagnosticDue =
    state.daysSinceDiagnostic == null || state.daysSinceDiagnostic >= DIAGNOSTIC_INTERVAL_DAYS;
  if (caps.diagnostic && diagnosticDue) return { kind: "diagnostic" };

  const errors = caps.errors ? Math.min(state.wrongCount, Math.floor(ERRORS_CAP * total)) : 0;
  // Confusion : le MOTIF répété, juste après les erreurs (les deux corrigent des fautes). Cap 0,25
  // qui ne comprime pas le cap 0,4 de la révision en session normale (cf. spec §3.2).
  const confusion = caps.confusion
    ? Math.min(state.confusionCount, Math.floor(CONFUSION_CAP * total), Math.max(0, total - errors))
    : 0;
  // La révision suit : à 4,5 mois de l'examen, l'oubli prime (priorité haute).
  const revision = caps.revision
    ? Math.min(state.revisionDue, Math.floor(REVISION_CAP * total), Math.max(0, total - errors - confusion))
    : 0;
  const learn = caps.learn
    ? Math.min(state.newCoursePoints, Math.floor(LEARN_CAP * total), Math.max(0, total - errors - confusion - revision))
    : 0;
  const adaptive = Math.max(0, total - errors - confusion - revision - learn);
  return { kind: "composed", alloc: { errors, confusion, revision, learn, adaptive } };
}
