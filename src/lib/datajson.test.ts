import { test, expect } from "bun:test";
import { exportJson, importJson, resetProgress } from "./datajson.ts";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
           setItem: (k: string, v: string) => void m.set(k, v),
           removeItem: (k: string) => void m.delete(k),
           key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; }, _dump: () => Object.fromEntries(m) };
}

test("exportJson round-trips progress but NEVER carries the GitHub token (C1)", () => {
  const src = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 7, skill: {} }), jlptN3_theme: "dark", jlptN3_gh: JSON.stringify({ token: "SECRET" }) });
  const json = exportJson(src);
  expect(json).not.toContain("SECRET");            // token excluded by design (collectData)
  const dst = memStore();
  expect(importJson(json, dst, () => true)).toBe(true);
  expect(JSON.parse((dst as any).getItem("jlptN3adapt_v2")).total).toBe(7);
});

test("importJson strips a jlptN3_gh injected into a hostile file (M1)", () => {
  const hostile = JSON.stringify({ app: "jlpt-n3", store: { jlptN3adapt_v2: JSON.stringify({ total: 3, skill: {} }), jlptN3_gh: JSON.stringify({ token: "STOLEN" }) } });
  const dst = memStore();
  expect(importJson(hostile, dst, () => true)).toBe(true);
  expect((dst as any).getItem("jlptN3_gh")).toBeNull();   // token NOT imported
  expect(JSON.parse((dst as any).getItem("jlptN3adapt_v2")).total).toBe(3); // progress imported
});

test("importJson returns false (no write) when confirm declines", () => {
  const src = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 1, skill: {} }) });
  const dst = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 99, skill: {} }) });
  expect(importJson(exportJson(src), dst, () => false)).toBe(false);
  expect(JSON.parse((dst as any).getItem("jlptN3adapt_v2")).total).toBe(99); // unchanged
});

test("importJson returns false on malformed / missing store", () => {
  expect(importJson("{not json", memStore(), () => true)).toBe(false);
  expect(importJson(JSON.stringify({ nope: 1 }), memStore(), () => true)).toBe(false);
});

test("resetProgress writes a blank progress blob, leaves theme/gist untouched", () => {
  const s = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 50 }), jlptN3_theme: "light", jlptN3_gh: "keep" });
  resetProgress(s);
  const blob = JSON.parse((s as any).getItem("jlptN3adapt_v2"));
  expect(blob.total).toBe(0);
  expect(blob.skill.kanji).toEqual({ R: 1450, t: 0, r: 0 });
  expect(blob.gram).toEqual({});                    // M3: gram preserved in blank shape
  expect((s as any).getItem("jlptN3_theme")).toBe("light");
  expect((s as any).getItem("jlptN3_gh")).toBe("keep");
});

test("resetProgress clears the coverage bitsets (seen/mastered)", () => {
  const s = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 9, skill: {}, seen: "AAA", mastered: "BBB" }) });
  resetProgress(s);
  const blob = JSON.parse((s as any).getItem("jlptN3adapt_v2"));
  expect(blob.seen).toBe("");
  expect(blob.mastered).toBe("");
});
