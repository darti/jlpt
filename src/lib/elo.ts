import { SKILLS, type Skill } from "../types/progress.ts";
import type { Difficulty, SkillState } from "../types/quiz.ts";

export const DRATING: Record<Difficulty, number> = { 1: 1400, 2: 1600, 3: 1800 };

/** Elo update for one skill after answering a difficulty-`d` question. Pure. */
export function updateRating(sk: SkillState, d: Difficulty, correct: boolean): SkillState {
  const Q = DRATING[d];
  const exp = 1 / (1 + Math.pow(10, (Q - sk.R) / 400));
  const K = sk.t < 10 ? 40 : 24;
  let R = sk.R + K * ((correct ? 1 : 0) - exp);
  R = Math.max(1200, Math.min(2000, R));
  return { R, t: sk.t + 1, r: sk.r + (correct ? 1 : 0) };
}

export function blankSkills(): Record<Skill, SkillState> {
  return Object.fromEntries(
    SKILLS.map((c) => [c, { R: 1450, t: 0, r: 0 }])
  ) as Record<Skill, SkillState>;
}
