/**
 * Cadence quotidienne : objectif du jour = rythme requis pour atteindre CIBLE_PCT de maîtrise
 * avant l'examen, série de jours consécutifs atteints, journal par jour. Module PUR (aucun
 * effet ; `now`/`today` injectés) — les effets vivent dans `storage.ts`/`useQuiz`/`useCadence`.
 */
import { hasBit, masteredCount } from "./coverage.ts";

/** Cible de maîtrise visée (fraction du corpus). */
export const CIBLE_PCT = 0.70;
/** Taille du corpus — gardée par un test de mesure (cf. cadence.test.ts). */
export const TOTAL_QUESTIONS = 10307;

/** Journal persisté sous `jlptN3_cadence`. `byDay`/`goalByDay` indexés par `dayNumber`. */
export interface Cadence {
  byDay: Record<number, number>;     // jour → questions nouvellement apprises
  goalByDay: Record<number, number>; // jour → objectif gelé ce jour-là
  best: number;                      // record de série
}

/** Journal vierge (nouvel objet à chaque appel). */
export function emptyCadence(): Cadence {
  return { byDay: {}, goalByDay: {}, best: 0 };
}

/** Objectif du jour = ⌈(cible − appris) / jours⌉, borné ≥ 0. Pur. */
export function dailyGoal(
  masteredNow: number,
  daysLeft: number,
  total: number = TOTAL_QUESTIONS,
  pct: number = CIBLE_PCT,
): number {
  if (daysLeft <= 0) return 0;                       // examen passé : plus de rythme
  const remaining = Math.round(pct * total) - masteredNow;
  if (remaining <= 0) return 0;                      // cible atteinte
  return Math.ceil(remaining / daysLeft);
}

/** Un jour est « atteint » ssi il a un objectif gelé et le progrès l'égale ou le dépasse. */
function isMet(c: Cadence, day: number): boolean {
  const done = c.byDay[day];
  const goal = c.goalByDay[day];
  return done !== undefined && goal !== undefined && done >= goal;
}

/** Série courante : run de jours atteints finissant à `today`, ou à `today-1` si aujourd'hui
 *  n'est pas encore atteint (la série reste vivante jusqu'à la fin de la journée). Pur. */
export function streakOf(c: Cadence, today: number): number {
  let n = 0;
  for (let d = isMet(c, today) ? today : today - 1; isMet(c, d); d--) n++;
  return n;
}

/** Journal après une nouvelle maîtrise. Gèle l'objectif du jour la 1re fois, incrémente le
 *  compteur du jour, met à jour le record. Retourne un nouveau `Cadence`. Pur. */
export function recordMastery(c: Cadence, day: number, goalToday: number, k = 1): Cadence {
  const goalByDay = day in c.goalByDay ? c.goalByDay : { ...c.goalByDay, [day]: goalToday };
  const byDay = { ...c.byDay, [day]: (c.byDay[day] ?? 0) + k };
  const next: Cadence = { byDay, goalByDay, best: c.best };
  next.best = Math.max(c.best, streakOf(next, day));
  return next;
}

/** Règle d'intégration : enregistre une maîtrise SSI la réponse est juste ET la question
 *  n'était pas déjà apprise. Sinon retourne `c` inchangé (même référence → l'appelant peut
 *  éviter une écriture). Pur — `prevMastered` = bitset AVANT la réponse. */
export function recordAnswer(
  c: Cadence,
  prevMastered: Uint8Array,
  qId: number,
  correct: boolean,
  day: number,
  daysLeft: number,
): Cadence {
  if (!correct || hasBit(prevMastered, qId)) return c;
  return recordMastery(c, day, dailyGoal(masteredCount(prevMastered), daysLeft));
}

/** Modèle d'affichage du panneau. Aujourd'hui : objectif GELÉ s'il existe, sinon `dailyGoal`
 *  live (les deux coïncident avant toute maîtrise). Pur. */
export interface CadenceModel {
  goal: number;
  done: number;
  streak: number;
  best: number;
  reached: boolean;   // cible de maîtrise atteinte
  daysLeft: number;   // 0 = examen passé
}

export function cadenceModel(
  c: Cadence,
  masteredNow: number,
  daysLeft: number,
  today: number,
): CadenceModel {
  const goal = c.goalByDay[today] ?? dailyGoal(masteredNow, daysLeft);
  const remaining = Math.round(CIBLE_PCT * TOTAL_QUESTIONS) - masteredNow;
  return {
    goal,
    done: c.byDay[today] ?? 0,
    streak: streakOf(c, today),
    best: c.best,
    reached: remaining <= 0,
    daysLeft,
  };
}
