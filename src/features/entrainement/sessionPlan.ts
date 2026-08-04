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

/** Part du budget GARANTIE à l'apprentissage, prélevée avant les autres tranches — au prix de la
 *  révision : en séance saturée à 45 questions, la révision passe de 18 à 10 et l'apprentissage
 *  (11) la dépasse. Arbitrage délibéré, pas un bug à « corriger » : sans ce plancher, un
 *  apprenant assidu n'apprenait plus rien de neuf (1 carte sur 8 questions, cf. sessionPlan.test.ts). */
export const LEARN_FLOOR = 0.25;

/** Nombre PLANCHER de cartes d'apprentissage par séance, en valeur absolue (pas une fraction) :
 *  il finance le plancher de grammaire (`learnQueue.GRAM_LEARN_FLOOR`) — sans un budget
 *  d'apprentissage d'au moins autant de cartes, `allocateLearn` ne pourrait pas garantir 5 cartes
 *  de grammaire. Sur les séances courtes il l'emporte sur `LEARN_FLOOR` (25 %) : accélérer la
 *  grammaire, c'est enseigner du neuf même quand le budget est serré, au prix des autres tranches.
 *  Toujours borné par le budget total et par le nombre d'entités neuves réellement disponibles. */
export const LEARN_MIN = 5;

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

  // Plancher d'apprentissage : prélevé AVANT les autres tranches, sinon leurs plafonds cumulés
  // (0,3 + 0,25 + 0,4 = 0,95) ne laissent que des miettes à l'apprentissage — plus la séance est
  // chargée en erreurs/révisions, moins on enseigne de neuf, ce qui n'est pas soutenable.
  const plancher = caps.learn
    ? Math.min(total, state.newCoursePoints, Math.max(LEARN_MIN, Math.round(LEARN_FLOOR * total)))
    : 0;
  const reste = total - plancher;

  const errors = caps.errors ? Math.min(state.wrongCount, Math.floor(ERRORS_CAP * total), reste) : 0;
  // Confusion : le MOTIF répété, juste après les erreurs (les deux corrigent des fautes). Cap 0,25
  // qui ne comprime pas le cap 0,4 de la révision en session normale (cf. spec §3.2).
  const confusion = caps.confusion
    ? Math.min(state.confusionCount, Math.floor(CONFUSION_CAP * total), Math.max(0, reste - errors))
    : 0;
  // La révision suit : à 4,5 mois de l'examen, l'oubli prime (priorité haute).
  const revision = caps.revision
    ? Math.min(state.revisionDue, Math.floor(REVISION_CAP * total), Math.max(0, reste - errors - confusion))
    : 0;
  // Au-delà du plancher, l'apprentissage peut encore monter jusqu'à son plafond s'il reste de la place.
  const sup = caps.learn
    ? Math.min(
        state.newCoursePoints - plancher,
        Math.floor(LEARN_CAP * total) - plancher,
        Math.max(0, reste - errors - confusion - revision),
      )
    : 0;
  const learn = plancher + Math.max(0, sup);
  const adaptive = Math.max(0, total - errors - confusion - revision - learn);
  return { kind: "composed", alloc: { errors, confusion, revision, learn, adaptive } };
}
