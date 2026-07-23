import type { Progress, Skill } from "../types/progress.ts";
import { BAR_SKILLS, SKILLS } from "../types/progress.ts";

export const PASS_RATING = 1600;
export const EXAM_DATE = new Date("2026-12-06T09:00:00");
const MS_PER_DAY = 864e5;

function skR(p: Progress, c: Skill): number {
  return p.skill[c]?.R ?? 1450;
}
function skT(p: Progress, c: Skill): number {
  return p.skill[c]?.t ?? 0;
}

/** Elo→probability mastery for one skill (0..1). */
export function masteryOf(p: Progress, c: Skill): number {
  return 1 / (1 + Math.pow(10, (PASS_RATING - skR(p, c)) / 400));
}

const PRIOR_R = 1450;   // neutral rating (= blankSkills)
const SHRINK_M = 10;    // pseudo-count — aligned with the Elo K breakpoint (t < 10)

/** Display mastery (0..1): the rating is shrunk toward the neutral prior by evidence `t`,
 *  then run through the same logistic. At t=0 it equals a blank skill's masteryOf; it
 *  converges to masteryOf(R) as t grows. Used for the dashboard bars ONLY — `masteryOf`
 *  stays raw for `allocate()` and the success model. */
export function displayMastery(p: Progress, c: Skill): number {
  const R = skR(p, c);
  const t = skT(p, c);
  const Reff = (t * R + SHRINK_M * PRIOR_R) / (t + SHRINK_M);
  return 1 / (1 + Math.pow(10, (PASS_RATING - Reff) / 400));
}

export function daysUntilExam(now: Date): number {
  return Math.max(0, Math.ceil((EXAM_DATE.getTime() - now.getTime()) / MS_PER_DAY));
}

function sections(p: Progress) {
  const langage = (masteryOf(p, "vocabulaire") + masteryOf(p, "kanji")) / 2;
  const grammLect = (masteryOf(p, "grammaire") + masteryOf(p, "lecture")) / 2;
  const listening = skT(p, "ecoute") >= 3 ? masteryOf(p, "ecoute") : 0.85 * ((langage + grammLect) / 2);
  return { langage, grammLect, listening };
}

function successModel(p: Progress) {
  const s = sections(p);
  const secScore = { langage: s.langage * 60, grammLect: s.grammLect * 60, listening: s.listening * 60 };
  const total = secScore.langage + secScore.grammLect + secScore.listening;
  const pSec = (v: number) => 1 / (1 + Math.exp(-(v - 22) / 4));
  const pTotal = 1 / (1 + Math.exp(-(total - 95) / 12));
  let prob = pTotal * pSec(secScore.langage) * pSec(secScore.grammLect) * pSec(secScore.listening);
  const n = p.total || 0;
  const conf = Math.min(1, n / 60);
  prob = conf * prob + (1 - conf) * 0.5 * pTotal;
  return { p: prob, total, conf, n };
}

function ratingLabel(p: Progress): string {
  const avg = SKILLS.reduce((a, c) => a + skR(p, c), 0) / SKILLS.length;
  return avg < 1400 ? "N4-"
    : avg < 1520 ? "N4+"
    : avg < 1620 ? "N3-"
    : avg < 1720 ? "N3" : "N3+";
}

export type PassTier = "ok" | "warn" | "bad";

/** Risk color tier for the pass-% figure — mirrors legacy `pct>=70/40` thresholds. */
export function passTier(passPct: number): PassTier {
  return passPct >= 70 ? "ok" : passPct >= 40 ? "warn" : "bad";
}

export interface DashboardModel {
  answers: number;
  passPct: number;
  sectionTotal: number;
  level: string;
  days: number;
  confidence: number;
  barMastery: Record<Skill, number>;
  hasEnough: boolean;
}

export function dashboardModel(p: Progress, now: Date): DashboardModel {
  const s = successModel(p);
  const barMastery = Object.fromEntries(
    BAR_SKILLS.map((c) => [c, Math.round(displayMastery(p, c) * 100)]),
  ) as Record<Skill, number>;

  return {
    answers: p.total,
    passPct: Math.round(s.p * 100),
    sectionTotal: Math.round(s.total),
    level: ratingLabel(p),
    days: daysUntilExam(now),
    confidence: s.conf,
    barMastery,
    hasEnough: p.total >= 5,
  };
}

/**
 * Poids d'allocation prescriptif par compétence : `0.2 + 1.3·valeur_normalisée`, où la valeur est
 * la valeur marginale ∂P/∂question dérivée du `successModel`. Remplace « poids ∝ faiblesse ».
 *
 * value(c) = marginalSection · sectionFactor · dMasteryDR, avec
 *   marginalSection = (1−pTotal)/12 + (1−pSec)/4   (seuil global commun + minimum sectionnel propre)
 *   sectionFactor   = 0.5 (2 compétences/section) ; écoute = 1.0 si mesurée (t≥3), sinon 0
 *   dMasteryDR      = m·(1−m)·ln10/400              (pente logistique, max à R=1600)
 * Le plancher 0.2 garantit la couverture (et le bootstrap de l'écoute non mesurée).
 * Pur. Cf. docs/superpowers/specs/2026-07-23-tableau-prescriptif-design.md.
 */
export function prescriptiveWeights(p: Progress): Record<Skill, number> {
  const m = {
    vocabulaire: masteryOf(p, "vocabulaire"), kanji: masteryOf(p, "kanji"),
    grammaire: masteryOf(p, "grammaire"), lecture: masteryOf(p, "lecture"),
    ecoute: masteryOf(p, "ecoute"),
  };
  const langage = (m.vocabulaire + m.kanji) / 2;
  const grammLect = (m.grammaire + m.lecture) / 2;
  const ecouteMeasured = skT(p, "ecoute") >= 3;
  const listening = ecouteMeasured ? m.ecoute : 0.85 * ((langage + grammLect) / 2);
  const sec = { langage: langage * 60, grammLect: grammLect * 60, listening: listening * 60 };
  const total = sec.langage + sec.grammLect + sec.listening;
  const sig = (x: number) => 1 / (1 + Math.exp(-x));
  const pSec = (v: number) => sig((v - 22) / 4);
  const globalTerm = (1 - sig((total - 95) / 12)) / 12;
  const marginal = {
    langage: globalTerm + (1 - pSec(sec.langage)) / 4,
    grammLect: globalTerm + (1 - pSec(sec.grammLect)) / 4,
    listening: globalTerm + (1 - pSec(sec.listening)) / 4,
  };
  const dDR = (x: number) => (x * (1 - x) * Math.LN10) / 400;
  const value: Record<Skill, number> = {
    vocabulaire: marginal.langage * 0.5 * dDR(m.vocabulaire),
    kanji: marginal.langage * 0.5 * dDR(m.kanji),
    grammaire: marginal.grammLect * 0.5 * dDR(m.grammaire),
    lecture: marginal.grammLect * 0.5 * dDR(m.lecture),
    ecoute: ecouteMeasured ? marginal.listening * 1.0 * dDR(m.ecoute) : 0,
  };
  const maxVal = Math.max(...SKILLS.map((c) => value[c]));
  const w = {} as Record<Skill, number>;
  for (const c of SKILLS) w[c] = 0.2 + 1.3 * (maxVal > 0 ? value[c] / maxVal : 0);
  return w;
}
