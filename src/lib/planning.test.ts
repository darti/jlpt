import { test, expect } from "bun:test";
import { mondayOf, fmtDay, readPlanStart, currentWeekIdx, daysUntilExam, weekRange } from "./planning.ts";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    _get: (k: string) => m.get(k),
  };
}

test("mondayOf returns the Monday of the week (00:00)", () => {
  expect(mondayOf(new Date("2026-07-08T15:00:00")).toISOString().slice(0, 10)).toBe("2026-07-06"); // Wed → Mon
  expect(mondayOf(new Date("2026-07-06T00:00:00")).toISOString().slice(0, 10)).toBe("2026-07-06"); // Mon → Mon
});

test("fmtDay formats day + short French month", () => {
  expect(fmtDay(new Date("2026-12-06T00:00:00"))).toBe("6 déc.");
});

test("readPlanStart persists the Monday of first use, then stays stable", () => {
  const s = memStore();
  const first = readPlanStart(s, new Date("2026-07-08T10:00:00")); // Wed
  expect(first.toISOString().slice(0, 10)).toBe("2026-07-06");
  expect(s._get("jlptN3_planStart")).toBe("2026-07-06");
  const later = readPlanStart(s, new Date("2026-08-01T10:00:00"));
  expect(later.toISOString().slice(0, 10)).toBe("2026-07-06");
});

test("currentWeekIdx is 0 on the start week and grows weekly", () => {
  const s = memStore({ jlptN3_planStart: "2026-07-06" });
  expect(currentWeekIdx(20, s, new Date("2026-07-08T10:00:00"))).toBe(0);
  expect(currentWeekIdx(20, s, new Date("2026-07-20T10:00:00"))).toBe(2);
});

test("weekRange formats the Mon→Sun span for week i", () => {
  expect(weekRange(new Date("2026-07-06T00:00:00"), 0)).toBe("6 juil. → 12 juil.");
});

test("daysUntilExam counts down to the exam (never negative)", () => {
  expect(daysUntilExam(new Date("2026-12-01T09:00:00"))).toBe(5);
  expect(daysUntilExam(new Date("2027-01-01T00:00:00"))).toBe(0);
});
