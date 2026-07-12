import { test, expect } from "bun:test";
import { visualBreak } from "./dict.ts";

// visualBreak turns a « · »-joined annotation string into role-coloured token chips
// (the grammar-example « analyse en blocs de couleur »). Pure string logic — no DICT/DOM.

test("empty input yields empty string", () => {
  expect(visualBreak("")).toBe("");
});

test("a particle segment is coloured as a particle", () => {
  const html = visualBreak("を « COD »");
  expect(html).toContain("tok-part");
  expect(html).toContain("を");
  expect(html).toContain("COD");
});

test("a noun segment renders furigana ruby from 漢字（かな）", () => {
  const html = visualBreak("朝（あさ） « le matin »");
  expect(html).toContain("tok-noun");
  expect(html).toContain("<ruby>朝<rt>あさ</rt></ruby>");
  expect(html).toContain("le matin");
});

test("a → conjugation segment is coloured as a verb/form", () => {
  expect(visualBreak("出る→出たきり « forme た ＋きり »")).toContain("tok-verb");
});

test("legend:false suppresses the role legend even with multiple roles", () => {
  const withLegend = visualBreak("朝（あさ） « matin » · を « COD »");
  const noLegend = visualBreak("朝（あさ） « matin » · を « COD »", { legend: false });
  expect(withLegend).toContain("vbleg");
  expect(noLegend).not.toContain("vbleg");
});
