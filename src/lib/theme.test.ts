import { test, expect } from "bun:test";
import { readTheme, otherTheme, applyTheme } from "./theme.ts";

function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    _dump: () => Object.fromEntries(m),
  };
}

test("readTheme defaults to dark", () => {
  expect(readTheme(fakeStore())).toBe("dark");
});

test("readTheme reads a stored light preference", () => {
  expect(readTheme(fakeStore({ jlptN3_theme: "light" }))).toBe("light");
});

test("otherTheme flips", () => {
  expect(otherTheme("dark")).toBe("light");
  expect(otherTheme("light")).toBe("dark");
});

test("applyTheme sets the attribute and persists both keys", () => {
  const store = fakeStore();
  const root = { setAttribute: (() => {}) as unknown as HTMLElement["setAttribute"], attr: "" };
  const fakeRoot = { setAttribute: (_n: string, v: string) => { root.attr = v; } } as unknown as HTMLElement;
  applyTheme("light", fakeRoot, store);
  expect(root.attr).toBe("light");
  const dump = store._dump();
  expect(dump.jlptN3_theme).toBe("light");
  expect(typeof dump.jlptN3_updatedAt).toBe("string");
});
