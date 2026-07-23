import { test, expect } from "bun:test";
import { RATES, readRate, writeRate } from "./audioRate.ts";
import { RATE_KEY } from "./keys.ts";

// Store en mémoire injectable — pas de dépendance au localStorage global.
function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

test("les trois débits sont 0.7 / 0.9 / 1.0", () => {
  expect([...RATES]).toEqual([0.7, 0.9, 1.0]);
});

test("readRate : défaut 0.9 quand rien n'est stocké", () => {
  expect(readRate(memStore())).toBe(0.9);
});

test("writeRate puis readRate : la valeur persiste", () => {
  const s = memStore();
  writeRate(0.7, s);
  expect(readRate(s)).toBe(0.7);
  writeRate(1.0, s);
  expect(readRate(s)).toBe(1.0);
});

test("readRate : rabat une valeur hors des trois crans sur 0.9", () => {
  expect(readRate(memStore({ [RATE_KEY]: "0.85" }))).toBe(0.9);
  expect(readRate(memStore({ [RATE_KEY]: "abc" }))).toBe(0.9);
  expect(readRate(memStore({ [RATE_KEY]: "2" }))).toBe(0.9);
});

test("readRate : un getItem qui jette → défaut, aucune exception", () => {
  const bad = { getItem: () => { throw new Error("boom"); } };
  expect(readRate(bad)).toBe(0.9);
});
