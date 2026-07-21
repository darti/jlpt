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

test("un segment enchaînant deux blocs glosés par → rend les DEUX (le 2e n'est plus perdu)", () => {
  // Bug : « 健康 « santé »→健康のために « のために = but » » ne gardait que 健康, le point de
  // grammaire lui-même (のために) disparaissait. On réinjecte une frontière « · » après le 1er gloss.
  const html = visualBreak("健康（けんこう）« santé »→健康のために « のために = but (pour) »", { legend: false });
  expect(html).toContain("santé");
  expect(html).toContain("健康のために");
  expect(html).toContain("のために = but (pour)");
  expect((html.match(/tok-g/g) || []).length).toBe(2); // deux blocs glosés distincts
});

test("un segment DÉJÀ séparé par « · » n'injecte pas de « · » parasite en tête du bloc suivant", () => {
  // Régression : la découpe des blocs enchaînés ne doit pas re-frontièrer un « · » existant,
  // sinon は se rendait « · は » (parasite vu sur ~tout le corpus du corrigé quiz).
  const html = visualBreak("会議（かいぎ）« réunion » · は « thème »", { legend: false });
  expect(html).not.toMatch(/tok-jp">\s*·/); // aucun bloc ne commence par un point médian
  expect((html.match(/tok-g/g) || []).length).toBe(2); // 会議 + は, exactement deux blocs
});

test("la traduction française finale « … » ne devient PAS un bloc", () => {
  // Seul un second bloc JAPONAIS déclenche la découpe ; « → « je cours… » » (français) reste absorbé.
  const html = visualBreak("走る（はしる）→走っている « ている = habituel » → « je cours chaque matin ».", { legend: false });
  expect((html.match(/tok-g/g) || []).length).toBe(1);
  expect(html).not.toContain("je cours chaque matin");
});

test("legend:false suppresses the role legend even with multiple roles", () => {
  const withLegend = visualBreak("朝（あさ） « matin » · を « COD »");
  const noLegend = visualBreak("朝（あさ） « matin » · を « COD »", { legend: false });
  expect(withLegend).toContain("vbleg");
  expect(noLegend).not.toContain("vbleg");
});
