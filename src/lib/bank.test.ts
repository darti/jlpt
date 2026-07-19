import { test, expect } from "bun:test";
import {
  shuffle, pickAdaptive, allocate, allocateCount, questionCount, loadCategory, loadBankIndex,
  clearBankIndexCache, clearCategoryCache, selectRecentErrors, composeSession, questionsForIds,
  selectDiagnostic, loadAllCategories,
} from "./bank.ts";
import type { FetchLike } from "./bank.ts";
import type { Question } from "../types/quiz.ts";
import type { Skill } from "../types/progress.ts";

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

test("allocateCount distributes exactly `total` across skills", () => {
  const alloc = allocateCount(() => 0.5, 11);
  const sum = Object.values(alloc).reduce((a, b) => a + b, 0);
  expect(sum).toBe(11); // no over/under-pick — this is what preserves the weighting under a reduced budget
});

test("questionCount clamps minutes to [4,45] at ~1.5/min", () => {
  expect(questionCount(10)).toBe(15);
  expect(questionCount(1)).toBe(4);   // floor
  expect(questionCount(999)).toBe(45); // ceil
});

test("loadCategory fetches the split file and memoizes", async () => {
  let calls = 0;
  const fetchImpl = async (_url: string) => { calls++; return { json: async () => [q(0, 1)] }; };
  const a = await loadCategory("kanji", fetchImpl as any);
  const b = await loadCategory("kanji", fetchImpl as any);
  expect(a).toBe(b);        // same memoized array
  expect(calls).toBe(1);    // fetched once
});

test("loadBankIndex fetches bank-index.json and memoizes", async () => {
  clearBankIndexCache();
  let calls = 0;
  const fetchImpl = async (_url: string) => { calls++; return { json: async () => ({ 0: "grammaire", 2: "kanji" }) }; };
  const a = await loadBankIndex(fetchImpl as any);
  const b = await loadBankIndex(fetchImpl as any);
  expect(a).toBe(b);
  expect(calls).toBe(1);
  expect(a[0]).toBe("grammaire");
});

test("selectRecentErrors returns [] for empty wrong or non-positive n", () => {
  expect(selectRecentErrors([], 3)).toEqual([]);
  expect(selectRecentErrors([1, 2, 3], 0)).toEqual([]);
  expect(selectRecentErrors([1, 2, 3], -1)).toEqual([]);
});

test("selectRecentErrors takes the tail (most recent), newest first", () => {
  // wrong is chronological: 10 oldest ... 40 newest
  expect(selectRecentErrors([10, 20, 30, 40], 2)).toEqual([40, 30]);
});

test("selectRecentErrors returns all (reversed) when n >= length", () => {
  expect(selectRecentErrors([10, 20, 30], 5)).toEqual([30, 20, 10]);
});

test("composeSession keeps all errorQs and fills adaptive up to total", () => {
  const rng = () => 0; // deterministic shuffle
  const errorQs = [q(1, 1), q(2, 1), q(3, 1)];
  const adaptive = [q(10, 1), q(11, 1), q(12, 1), q(13, 1), q(14, 1)];
  const out = composeSession(errorQs, adaptive, 6, rng);
  expect(out).toHaveLength(6);
  for (const id of [1, 2, 3]) expect(out.map((x) => x.id)).toContain(id);
  expect(new Set(out.map((x) => x.id)).size).toBe(6); // no duplicates
});

test("composeSession short errors slice: adaptive covers the remainder to total", () => {
  const errorQs = [q(1, 1)];
  const adaptive = [q(10, 1), q(11, 1), q(12, 1), q(13, 1)];
  const out = composeSession(errorQs, adaptive, 4, () => 0);
  expect(out).toHaveLength(4);
  expect(out.map((x) => x.id)).toContain(1);
});

test("composeSession clamps adaptiveTarget to 0 when errors already exceed total", () => {
  const errorQs = [q(1, 1), q(2, 1), q(3, 1)];
  const out = composeSession(errorQs, [q(10, 1)], 2, () => 0);
  expect(out).toHaveLength(3); // all errorQs kept, no adaptive added
  expect(out.map((x) => x.id).sort()).toEqual([1, 2, 3]);
});

test("questionsForIds resolves ids across categories, preserves order, drops unknowns", async () => {
  clearCategoryCache();
  const idx: Record<number, Skill> = { 1: "kanji", 2: "grammaire", 3: "kanji" };
  const kanjiPool: Question[] = [q(1, 1), q(3, 1)];
  const grammairePool: Question[] = [{ id: 2, cat: "grammaire", d: 1, q: "", o: [], a: 0 }];
  const fetchImpl: FetchLike = async (url) => ({
    json: async () => (url.includes("kanji") ? kanjiPool : grammairePool),
  });
  const out = await questionsForIds([3, 2, 1, 99], idx, fetchImpl);
  expect(out.map((x) => x.id)).toEqual([3, 2, 1]); // order preserved, 99 (unknown) dropped
});

test("questionsForIds returns [] for no ids", async () => {
  const idx: Record<number, Skill> = {};
  const fetchImpl: FetchLike = async () => ({ json: async () => [] });
  expect(await questionsForIds([], idx, fetchImpl)).toEqual([]);
});

test("selectDiagnostic spreads across skills and difficulties, no duplicates", () => {
  const mk = (cat: Skill, base: number): Question[] =>
    [1, 2, 3].flatMap((d) => [0, 1].map((k) => ({ id: base + d * 10 + k, cat, d: d as 1 | 2 | 3, q: "", o: [], a: 0 })));
  const pools: Record<Skill, Question[]> = {
    grammaire: mk("grammaire", 100), vocabulaire: mk("vocabulaire", 200), kanji: mk("kanji", 300),
    lecture: mk("lecture", 400), ecoute: mk("ecoute", 500),
  };
  const out = selectDiagnostic(pools, 15, () => 0);
  expect(out).toHaveLength(15);
  expect(new Set(out.map((x) => x.id)).size).toBe(15); // no duplicates
  for (const cat of ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"] as Skill[]) {
    expect(out.filter((x) => x.cat === cat)).toHaveLength(3); // ~3 per skill (15/5)
  }
});

// MAJOR #4: prove the difficulty spread against a BALANCED pool with a deterministic rng —
// asking 3 from {2×d1, 2×d2, 2×d3} must yield exactly one of each (round-robin d1→d2→d3).
test("selectDiagnostic yields a balanced difficulty spread when the pool allows", () => {
  const mk = (cat: Skill): Question[] =>
    [1, 2, 3].flatMap((d) => [0, 1].map((k) => ({ id: d * 100 + k, cat, d: d as 1 | 2 | 3, q: "", o: [], a: 0 })));
  const pools: Record<Skill, Question[]> = {
    grammaire: mk("grammaire"), vocabulaire: [], kanji: [], lecture: [], ecoute: [],
  };
  const out = selectDiagnostic(pools, 3, () => 0);
  expect(out.map((x) => x.d).sort()).toEqual([1, 2, 3]); // one of each difficulty
});

// MAJOR #4: skewed pool (only d1 available) — the spread degrades gracefully to what exists.
test("selectDiagnostic degrades to available difficulties on a skewed pool", () => {
  const only1: Question[] = [0, 1, 2, 3, 4].map((k) => ({ id: k, cat: "kanji" as Skill, d: 1 as const, q: "", o: [], a: 0 }));
  const pools: Record<Skill, Question[]> = { grammaire: [], vocabulaire: [], kanji: only1, lecture: [], ecoute: [] };
  const out = selectDiagnostic(pools, 3, () => 0);
  expect(out).toHaveLength(3);
  expect(out.every((x) => x.d === 1)).toBe(true); // no d2/d3 exist → all d1, no crash
});

test("selectDiagnostic skips empty skills and never exceeds total", () => {
  const one: Question[] = [{ id: 1, cat: "kanji", d: 1, q: "", o: [], a: 0 }];
  const pools: Partial<Record<Skill, Question[]>> = { kanji: one };
  const out = selectDiagnostic(pools, 15, () => 0);
  expect(out.length).toBeLessThanOrEqual(15);
  expect(out.every((x) => x.cat === "kanji")).toBe(true);
});

test("selectDiagnostic returns [] for total<=0", () => {
  expect(selectDiagnostic({}, 0, () => 0)).toEqual([]);
});

test("loadAllCategories charge les cinq pools et les indexe par compétence", async () => {
  clearCategoryCache();
  const fetchImpl: FetchLike = async (url) => ({
    json: async () => [{ id: url.includes("kanji") ? 42 : 1, cat: "kanji", d: 1, q: "", o: [], a: 0 }],
  });
  const pools = await loadAllCategories(fetchImpl);
  expect(Object.keys(pools).sort()).toEqual(
    ["ecoute", "grammaire", "kanji", "lecture", "vocabulaire"],
  );
  expect(pools.kanji[0].id).toBe(42); // chaque compétence reçoit BIEN son propre pool
  clearCategoryCache();
});

test("loadAllCategories lance les cinq fetch en parallèle, pas en cascade", async () => {
  clearCategoryCache();
  let inFlight = 0, peak = 0;
  const fetchImpl: FetchLike = async () => {
    peak = Math.max(peak, ++inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return { json: async () => [] };
  };
  await loadAllCategories(fetchImpl);
  // En cascade le pic vaudrait 1 : c'est exactement la régression que ce test garde.
  expect(peak).toBe(5);
  clearCategoryCache();
});
