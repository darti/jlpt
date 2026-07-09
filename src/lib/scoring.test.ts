import { test, expect } from "bun:test";
import type { Progress } from "../types/progress.ts";
import { mastery, dashboardModel, daysUntilExam } from "./scoring.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R }, vocabulaire: { R }, kanji: { R }, lecture: { R } },
});

test("mastery at the pass rating is 0.5", () => {
  expect(mastery(1600)).toBeCloseTo(0.5, 10);
});

test("dashboardModel for all-1600 / 60 answers", () => {
  const m = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  expect(m.answers).toBe(60);
  expect(m.passPct).toBe(17);
  expect(m.sectionTotal).toBe(86);
  expect(m.level).toBe("N3-");
  expect(m.confidence).toBeCloseTo(1, 10);
  expect(m.skillMastery.kanji).toBeCloseTo(0.5, 10);
  expect(m.hasEnough).toBe(true);
});

test("hasEnough is false under 5 answers", () => {
  const p = flat(1600); p.total = 3;
  expect(dashboardModel(p, new Date("2026-07-10T00:00:00")).hasEnough).toBe(false);
});

test("daysUntilExam counts down and floors at 0", () => {
  expect(daysUntilExam(new Date("2026-07-10T00:00:00"))).toBe(150);
  expect(daysUntilExam(new Date("2027-01-01T00:00:00"))).toBe(0);
});
