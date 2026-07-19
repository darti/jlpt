import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupDict, applyDictData, initDefs, furi } from "./dict.ts";

type W = Record<string, unknown>;
const origFetch = globalThis.fetch;

beforeEach(() => {
  const w = window as unknown as W;
  for (const k of ["furi", "visualBreak", "initDefs", "hideDef", "jlptSay"]) delete w[k];
});
afterEach(() => { globalThis.fetch = origFetch; });

test("setupDict loads data from JSON and feeds the imported furi()", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ "本": { r: "ほん", m: "livre" } }))) as unknown as typeof fetch;
  await setupDict("data/dict.json");
  expect(furi("本")).toContain("<rt>ほん</rt>"); // data came from the fetch
});

test("setupDict n'expose en globales que les handlers inline du popup", async () => {
  globalThis.fetch = (async () => new Response("{}")) as unknown as typeof fetch;
  await setupDict("data/dict.json");
  const w = window as unknown as W;
  // Le popup de définition est du HTML brut avec des `onclick="hideDef()"` / `jlptSay()`.
  expect(typeof w.hideDef).toBe("function");
  expect(typeof w.jlptSay).toBe("function");
  // furi/visualBreak/initDefs sont importés directement par les composants — plus de globale.
  expect(w.furi).toBeUndefined();
  expect(w.visualBreak).toBeUndefined();
  expect(w.initDefs).toBeUndefined();
});

test("initDefs attaches gesture handlers without throwing and creates the popup", () => {
  applyDictData({ "本": { r: "ほん", m: "livre" } });
  expect(() => initDefs({ singleTap: true })).not.toThrow();
  expect(document.getElementById("defPop")).not.toBeNull();
});

test("setupDict degrades gracefully when the fetch fails (handlers still installed)", async () => {
  applyDictData({}); // le DICT est un état de module partagé par tout le fichier — l'isoler
  globalThis.fetch = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  await setupDict("data/dict.json");
  expect(typeof (window as unknown as W).hideDef).toBe("function");
  expect(furi("本")).toBe("本"); // hors ligne : dico vide → texte brut, sans planter
});
