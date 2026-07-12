import { test, expect } from "bun:test";
import type { Progress } from "../types/progress.ts";
import { masteryOf, displayMastery, dashboardModel, daysUntilExam, passTier } from "./scoring.ts";

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

test("masteryOf at the pass rating is 0.5", () => {
  expect(masteryOf(flat(1600, 60), "grammaire")).toBeCloseTo(0.5, 10);
});

test("displayMastery with t=0 equals the blank-skill masteryOf (no discontinuity)", () => {
  const p: Progress = { total: 0, skill: {} };
  expect(displayMastery(p, "vocabulaire")).toBeCloseTo(masteryOf(p, "vocabulaire"), 10);
});

test("displayMastery is shrunk below raw when R is high but t is small", () => {
  const p: Progress = { total: 8, skill: { vocabulaire: { R: 1800, t: 8 } } };
  expect(displayMastery(p, "vocabulaire")).toBeLessThan(masteryOf(p, "vocabulaire"));
});

test("displayMastery converges toward raw as t grows", () => {
  const lo: Progress = { total: 5, skill: { kanji: { R: 1800, t: 5 } } };
  const hi: Progress = { total: 500, skill: { kanji: { R: 1800, t: 500 } } };
  const raw = masteryOf(hi, "kanji");
  const dLo = Math.abs(displayMastery(lo, "kanji") - raw);
  const dHi = Math.abs(displayMastery(hi, "kanji") - raw);
  expect(dHi).toBeLessThan(dLo);
});

test("dashboardModel for all-1600 / 60 answers, estimated listening (ecoute.t<3)", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  expect(m.answers).toBe(60);
  expect(m.passPct).toBe(17);
  expect(m.sectionTotal).toBe(86);
  expect(m.level).toBe("N3-");
  expect(m.confidence).toBeCloseTo(1, 10);
  // barMastery uses displayMastery: R=1600,t=60 shrinks toward the 1450 prior → 47 (not raw 50).
  expect(m.barMastery.kanji).toBe(47);
  expect(m.hasEnough).toBe(true);
});

test("dashboardModel switches to measured listening once ecoute.t>=3", () => {
  const m = dashboardModel(flat(1600, 60, 60), new Date("2026-07-10T00:00:00"));
  // measured listening = masteryOf(ecoute) = 0.5, vs. estimated 0.85*0.5 = 0.425 above,
  // so the section/total/pass% differ from the estimated-listening fixture.
  expect(m.sectionTotal).toBe(90);
  expect(m.passPct).toBe(27);
});

test("hasEnough is false under 5 answers", () => {
  expect(dashboardModel(flat(1600, 3), new Date("2026-07-10T00:00:00")).hasEnough).toBe(false);
});

test("daysUntilExam counts down and floors at 0", () => {
  expect(daysUntilExam(new Date("2026-07-10T00:00:00"))).toBe(150);
  expect(daysUntilExam(new Date("2027-01-01T00:00:00"))).toBe(0);
});

test("passTier thresholds match legacy pct>=70/40 buckets", () => {
  expect(passTier(70)).toBe("ok");
  expect(passTier(40)).toBe("warn");
  expect(passTier(39)).toBe("bad");
});
