import { test, expect } from "bun:test";
import { readSessionScores } from "./history.ts";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null) };
}

test("readSessionScores returns each history entry's numeric score in order", () => {
  const s = memStore({ jlptN3adapt_v2: JSON.stringify({ history: [{ score: 80 }, { score: 110 }] }) });
  expect(readSessionScores(s)).toEqual([80, 110]);
});

test("readSessionScores returns [] for missing or empty history", () => {
  expect(readSessionScores(memStore())).toEqual([]);
  expect(readSessionScores(memStore({ jlptN3adapt_v2: JSON.stringify({ total: 5 }) }))).toEqual([]);
  expect(readSessionScores(memStore({ jlptN3adapt_v2: JSON.stringify({ history: [] }) }))).toEqual([]);
});

test("readSessionScores filters non-numeric scores", () => {
  const s = memStore({ jlptN3adapt_v2: JSON.stringify({ history: [{ score: 80 }, { score: "x" }, { nope: 1 }, { score: 110 }] }) });
  expect(readSessionScores(s)).toEqual([80, 110]);
});
