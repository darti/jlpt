import { test, expect } from "bun:test";
import { progressOf, weekDone } from "./usePlanning.ts";
import type { Week } from "./weeks.ts";

const WEEKS: Week[] = [
  { p: "p1", t: "A", items: ["a", "b"] },
  { p: "p1", t: "B", items: ["c"] },
];

test("progressOf counts checked items over the total", () => {
  expect(progressOf({}, WEEKS)).toEqual({ done: 0, total: 3, pct: 0 });
  expect(progressOf({ "1_0": true, "2_0": true }, WEEKS)).toEqual({ done: 2, total: 3, pct: 67 });
});

test("weekDone counts checked items in one week (1-based week number)", () => {
  expect(weekDone({ "1_0": true, "1_1": true }, 1, 2)).toBe(2);
  expect(weekDone({ "1_0": true }, 1, 2)).toBe(1);
  expect(weekDone({ "2_0": true }, 1, 2)).toBe(0);
});
