import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupDict, applyDictData, initDefs } from "./dict.ts";

type W = Record<string, unknown>;
const origFetch = globalThis.fetch;

beforeEach(() => {
  const w = window as unknown as W;
  for (const k of ["furi", "visualBreak", "initDefs", "hideDef", "jlptSay"]) delete w[k];
});
afterEach(() => { globalThis.fetch = origFetch; });

test("setupDict exposes the dict globals and loads data from JSON (window.furi renders furigana)", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ "本": { r: "ほん", m: "livre" } }))) as unknown as typeof fetch;
  await setupDict("data/dict.json");
  const w = window as unknown as W;
  expect(typeof w.furi).toBe("function");
  expect(typeof w.visualBreak).toBe("function");
  expect(typeof w.initDefs).toBe("function");
  expect((w.furi as (s: string) => string)("本")).toContain("<rt>ほん</rt>"); // data came from the fetch
});

test("initDefs attaches gesture handlers without throwing and creates the popup", () => {
  applyDictData({ "本": { r: "ほん", m: "livre" } });
  expect(() => initDefs({ singleTap: true })).not.toThrow();
  expect(document.getElementById("defPop")).not.toBeNull();
});

test("setupDict degrades gracefully when the fetch fails (globals still exposed)", async () => {
  globalThis.fetch = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  await setupDict("data/dict.json");
  expect(typeof (window as unknown as W).furi).toBe("function");
});
