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

test("une dérivation « A « g1 »→A+suffixe « g2 » » rend A puis le SUFFIXE (pas de recouvrement)", () => {
  // Bug d'origine : « 健康 « santé »→健康のために « のために » » ne gardait que 健康 (のために perdu).
  // Puis, en le rendant en deux blocs 健康 + 健康のために, la concaténation dupliquait 健康
  // (先生先生のおかげで). La bonne partition garde le SUFFIXE ajouté : 健康 | のために.
  const html = visualBreak("健康（けんこう）« santé »→健康のために « のために = but (pour) »", { legend: false });
  expect(html).toContain("santé");
  expect(html).toContain("のために = but (pour)");
  expect(html).not.toContain("健康のために"); // pas de bloc qui reprend 健康 → pas de duplication
  expect((html.match(/tok-g/g) || []).length).toBe(2); // 健康 + のために
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

test("catégorie grammaticale : nom / verbe / adj い / adj な / adverbe reçoivent des rôles distincts", () => {
  const role = (w: string) => (visualBreak(w + "（）« x »", { legend: false }).match(/tok tok-(\w+)"/) || [])[1];
  // い-adjectifs (dont un qui ne finit pas en しい)
  expect(role("安い")).toBe("adj");
  expect(role("高い")).toBe("adj");
  // な-adjectifs — 嫌い finit en い mais reste な-adj (testé AVANT la règle い)
  expect(role("上手")).toBe("adjna");
  expect(role("嫌い")).toBe("adjna");
  // verbes : kana pur (なる) et kanji + terminaison う-段 (咲く)
  expect(role("なる")).toBe("verb");
  expect(role("咲く")).toBe("verb");
  // adverbe
  expect(role("必ず")).toBe("adv");
  // noms qui RESSEMBLENT à d'autres classes ne basculent pas (違い finit en い, 収入 en kanji)
  expect(role("違い")).toBe("noun");
  expect(role("収入")).toBe("noun");
  expect(role("時間")).toBe("noun");
});

test("legend:true expose la clé des couleurs ; défaut = masquée", () => {
  const src = "安い（やすい）« bon marché » · 上手（じょうず）« habile » · なる « devenir »";
  expect(visualBreak(src, { legend: true })).toContain("vbleg");
  expect(visualBreak(src, { legend: false })).not.toContain("vbleg");
});

test("legend:false suppresses the role legend even with multiple roles", () => {
  const withLegend = visualBreak("朝（あさ） « matin » · を « COD »");
  const noLegend = visualBreak("朝（あさ） « matin » · を « COD »", { legend: false });
  expect(withLegend).toContain("vbleg");
  expect(noLegend).not.toContain("vbleg");
});
