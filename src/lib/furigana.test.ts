import { test, expect } from "bun:test";
import { readFuri, writeFuri, applyFuri } from "./furigana.ts";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    _get: (k: string) => m.get(k),
  };
}

test("readFuri defaults to false (hidden), true only when 'on'", () => {
  expect(readFuri(memStore())).toBe(false);
  expect(readFuri(memStore({ jlptN3_furi: "on" }))).toBe(true);
  expect(readFuri(memStore({ jlptN3_furi: "off" }))).toBe(false);
});

test("writeFuri persists on/off and returns the value", () => {
  const s = memStore();
  expect(writeFuri(true, s)).toBe(true);
  expect(s._get("jlptN3_furi")).toBe("on");
  writeFuri(false, s);
  expect(s._get("jlptN3_furi")).toBe("off");
});

test("applyFuri toggles data-furi on the root", () => {
  const attrs: Record<string, string> = {};
  const root = {
    setAttribute: (k: string, v: string) => { attrs[k] = v; },
    removeAttribute: (k: string) => { delete attrs[k]; },
  } as unknown as HTMLElement;
  applyFuri(root, memStore({ jlptN3_furi: "on" }));
  expect(attrs["data-furi"]).toBe("on");
  applyFuri(root, memStore({ jlptN3_furi: "off" }));
  expect(attrs["data-furi"]).toBeUndefined();
});
