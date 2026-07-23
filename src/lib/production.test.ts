import { test, expect } from "bun:test";
import { readProduction, writeProduction } from "./production.ts";
import { PROD_KEY } from "./keys.ts";

function fakeStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    _map: m,
  };
}

test("readProduction : défaut false", () => {
  expect(readProduction(fakeStore())).toBe(false);
});

test("writeProduction puis readProduction : round-trip", () => {
  const s = fakeStore();
  writeProduction(true, s);
  expect(readProduction(s)).toBe(true);
  expect(s._map.get(PROD_KEY)).toBe("1");
  writeProduction(false, s);
  expect(readProduction(s)).toBe(false);
});

test("readProduction : store en échec → false", () => {
  const bad = { getItem: () => { throw new Error("blocked"); } };
  expect(readProduction(bad)).toBe(false);
});
