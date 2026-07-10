import { test, expect } from "bun:test";
import { updateRating, DRATING, blankSkills } from "./elo.ts";

test("DRATING maps difficulty to question rating", () => {
  expect(DRATING).toEqual({ 1: 1400, 2: 1600, 3: 1800 });
});

test("correct answer at even rating raises R by K*(1-0.5)=20 (t<10 → K=40)", () => {
  // R=1600, Q=1600 → exp=0.5; K=40; delta=40*(1-0.5)=20
  const next = updateRating({ R: 1600, t: 0, r: 0 }, 2, true);
  expect(next.R).toBeCloseTo(1620, 6);
  expect(next.t).toBe(1);
  expect(next.r).toBe(1);
});

test("wrong answer lowers R; K drops to 24 after 10 trials; r unchanged", () => {
  // t=10 → K=24; R=1600,Q=1600,exp=0.5; delta=24*(0-0.5)=-12
  const next = updateRating({ R: 1600, t: 10, r: 5 }, 2, false);
  expect(next.R).toBeCloseTo(1588, 6);
  expect(next.t).toBe(11);
  expect(next.r).toBe(5);
});

test("R is clamped to [1200, 2000]", () => {
  expect(updateRating({ R: 1990, t: 0, r: 0 }, 3, true).R).toBeLessThanOrEqual(2000);
  expect(updateRating({ R: 1210, t: 0, r: 0 }, 1, false).R).toBeGreaterThanOrEqual(1200);
});

test("updateRating is pure (does not mutate input)", () => {
  const sk = { R: 1600, t: 0, r: 0 };
  updateRating(sk, 2, true);
  expect(sk).toEqual({ R: 1600, t: 0, r: 0 });
});

test("blankSkills seeds all 5 skills at R:1450, t:0, r:0", () => {
  const b = blankSkills();
  expect(Object.keys(b).sort()).toEqual(["ecoute", "grammaire", "kanji", "lecture", "vocabulaire"]);
  expect(b.kanji).toEqual({ R: 1450, t: 0, r: 0 });
});
