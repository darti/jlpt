import type { Progress, Skill } from "../types/progress.ts";
import { SKILLS } from "../types/progress.ts";

export const PASS_RATING = 1600;
export const EXAM_DATE = new Date("2026-12-06T09:00:00");
const MS_PER_DAY = 864e5;

/** Elo→probability mastery for one rating (0..1). */
export function mastery(rating: number): number {
  return 1 / (1 + Math.pow(10, (PASS_RATING - rating) / 400));
}

export function daysUntilExam(now: Date): number {
  return Math.max(0, Math.ceil((EXAM_DATE.getTime() - now.getTime()) / MS_PER_DAY));
}

function level(avgRating: number): string {
  return avgRating < 1400 ? "N4-"
    : avgRating < 1520 ? "N4+"
    : avgRating < 1620 ? "N3-"
    : avgRating < 1720 ? "N3" : "N3+";
}

export interface DashboardModel {
  answers: number;
  passPct: number;
  sectionTotal: number;
  level: string;
  days: number;
  confidence: number;
  skillMastery: Record<Skill, number>;
  hasEnough: boolean;
}

export function dashboardModel(p: Progress, now: Date): DashboardModel {
  const m = (c: Skill) => mastery(p.skill[c].R);
  const lang = (m("vocabulaire") + m("kanji")) / 2;
  const gram = (m("grammaire") + m("lecture")) / 2;
  const list = 0.85 * ((lang + gram) / 2);
  const sec = { lang: lang * 60, gram: gram * 60, list: list * 60 };
  const sectionTotal = sec.lang + sec.gram + sec.list;

  const pSec = (v: number) => 1 / (1 + Math.exp(-(v - 22) / 4));
  const pTot = 1 / (1 + Math.exp(-(sectionTotal - 95) / 12));
  const confidence = Math.min(1, p.total / 60);
  let prob = pTot * pSec(sec.lang) * pSec(sec.gram) * pSec(sec.list);
  prob = confidence * prob + (1 - confidence) * 0.5 * pTot;

  const avg = SKILLS.reduce((a, c) => a + p.skill[c].R, 0) / SKILLS.length;
  const skillMastery = Object.fromEntries(SKILLS.map((c) => [c, m(c)])) as Record<Skill, number>;

  return {
    answers: p.total,
    passPct: Math.round(prob * 100),
    sectionTotal: Math.round(sectionTotal),
    level: level(avg),
    days: daysUntilExam(now),
    confidence,
    skillMastery,
    hasEnough: p.total >= 5,
  };
}
