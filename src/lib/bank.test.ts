import { test, expect } from "bun:test";
import { shuffle, pickAdaptive, allocate, loadCategory } from "./bank.ts";
import type { Question } from "../types/quiz.ts";

const q = (id: number, d: 1 | 2 | 3): Question =>
  ({ id, cat: "kanji", d, q: "", o: [], a: 0 });

test("shuffle returns a permutation without mutating input (seeded rng)", () => {
  const src = [1, 2, 3, 4, 5];
  const rng = (() => { let i = 0; const seq = [0.1, 0.9, 0.3, 0.7]; return () => seq[i++ % seq.length]; })();
  const out = shuffle(src, rng);
  expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  expect(src).toEqual([1, 2, 3, 4, 5]);
});

test("pickAdaptive prefers the difficulty closest to R (rng=0)", () => {
  const pool = [q(0, 1), q(1, 2), q(2, 3)]; // ratings 1400/1600/1800
  const out = pickAdaptive(pool, 1600, new Set(), [], () => 0);
  expect(out[0].id).toBe(1); // d=2 (1600) closest to R=1600
});

test("pickAdaptive boosts previously-wrong questions", () => {
  const pool = [q(0, 1), q(5, 1)]; // both same closeness
  const out = pickAdaptive(pool, 1400, new Set(), [5], () => 0);
  expect(out[0].id).toBe(5); // +150 boost wins
});

test("pickAdaptive excludes ids in the exclude set", () => {
  const out = pickAdaptive([q(0, 2), q(1, 2)], 1600, new Set([0]), [], () => 0);
  expect(out.map((x) => x.id)).toEqual([1]);
});

test("allocate distributes ~1.5 questions/min, weighting weaker skills", () => {
  const { total } = allocate(() => 0.5, 10);
  expect(total).toBe(15); // clamp(4, round(10*1.5), 45)
});

test("loadCategory fetches the split file and memoizes", async () => {
  let calls = 0;
  const fetchImpl = async (_url: string) => { calls++; return { json: async () => [q(0, 1)] }; };
  const a = await loadCategory("kanji", fetchImpl as any);
  const b = await loadCategory("kanji", fetchImpl as any);
  expect(a).toBe(b);        // same memoized array
  expect(calls).toBe(1);    // fetched once
});
