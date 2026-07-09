import { test, expect } from "bun:test";
import { dashboardModel } from "./scoring.ts";
import { BAR_SKILLS } from "../types/progress.ts";
import type { Progress } from "../types/progress.ts";

(globalThis as any).window = globalThis;
// @ts-expect-error progress.js is untyped vanilla JS (window.JLPTProgress); this parity
// test is itself the proof that scoring.ts matches it.
await import("../../progress.js"); // sets globalThis.JLPTProgress
const JP = (globalThis as any).JLPTProgress;

const NOW = new Date("2026-07-10T00:00:00");

const flat = (R: number, total: number, ecouteT = 0): Progress => ({
  total,
  skill: {
    grammaire: { R, t: total },
    vocabulaire: { R, t: total },
    kanji: { R, t: total },
    lecture: { R, t: total },
    ecoute: { R, t: ecouteT },
  },
});

const cases: [string, Progress][] = [
  ["all 5 skills R=1600, ecoute.t=5 (measured listening)", flat(1600, 60, 5)],
  ["all R=1600, ecoute.t=0 (estimated listening)", flat(1600, 60, 0)],
  [
    "uneven: gram/voc/kanji/lecture R=1650 t=10, ecoute R=1450 t=10",
    {
      total: 40,
      skill: {
        grammaire: { R: 1650, t: 10 },
        vocabulaire: { R: 1650, t: 10 },
        kanji: { R: 1650, t: 10 },
        lecture: { R: 1650, t: 10 },
        ecoute: { R: 1450, t: 10 },
      },
    },
  ],
  [
    "missing ecoute key entirely",
    {
      total: 30,
      skill: {
        grammaire: { R: 1580, t: 8 },
        vocabulaire: { R: 1620, t: 8 },
        kanji: { R: 1500, t: 8 },
        lecture: { R: 1560, t: 8 },
      },
    },
  ],
  ["total=3 (low)", flat(1600, 3, 0)],
  [
    "total=120 with mixed R/t",
    {
      total: 120,
      skill: {
        grammaire: { R: 1700, t: 40 },
        vocabulaire: { R: 1350, t: 40 },
        kanji: { R: 1620, t: 40 },
        lecture: { R: 1480, t: 40 },
        ecoute: { R: 1750, t: 4 },
      },
    },
  ],
];

for (const [name, p] of cases) {
  test(`parity: ${name}`, () => {
    const m = dashboardModel(p, NOW);
    const s = JP.successModel(p);
    expect(m.passPct).toBe(Math.round(s.p * 100));
    expect(m.sectionTotal).toBe(Math.round(s.total));
    expect(m.level).toBe(JP.ratingLabel(p));
    expect(m.confidence).toBeCloseTo(s.conf, 12);
    expect(m.days).toBe(JP.daysToExam(NOW));
    for (const c of BAR_SKILLS) expect(m.barMastery[c]).toBe(Math.round(JP.mastery(p, c) * 100));
  });
}
