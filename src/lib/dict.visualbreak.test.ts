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
  expect(html).toContain(`<span class="furi"><span class="furi-rt">あさ</span>朝</span>`);
  expect(html).toContain("le matin");
});

test("a → conjugation segment is coloured as a verb/form", () => {
  expect(visualBreak("出る→出たきり « forme た ＋きり »")).toContain("tok-verb");
});

test("furigana systématiques : un mot à okurigana （少しずつ, 良い） devient aussi un ruby", () => {
  // avant, seuls les mots finissant par un kanji étaient rubifiés → 少しずつ（すこしずつ） restait
  // en parenthèses littérales. Désormais la lecture inline couvre le mot entier.
  const a = visualBreak("少しずつ（すこしずつ） « peu à peu »");
  expect(a).toContain(`<span class="furi"><span class="furi-rt">すこしずつ</span>少しずつ</span>`);
  expect(a).not.toContain("（すこしずつ）");
  const b = visualBreak("良い（よい）→良くなり « s'améliorer »");
  expect(b).toContain(`<span class="furi"><span class="furi-rt">よい</span>良い</span>`);
  expect(b).not.toContain("（よい）");
});

test("legend:false suppresses the role legend even with multiple roles", () => {
  const withLegend = visualBreak("朝（あさ） « matin » · を « COD »");
  const noLegend = visualBreak("朝（あさ） « matin » · を « COD »", { legend: false });
  expect(withLegend).toContain("vbleg");
  expect(noLegend).not.toContain("vbleg");
});
