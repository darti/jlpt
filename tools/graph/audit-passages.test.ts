import { test, expect } from "bun:test";
import { auditPassages } from "./audit-passages.mjs";

const refs = { kanji: new Set(["工", "事", "階", "段", "間", "使"]), motsHorsN3: new Set(["斡旋"]) };
const bon = {
  id: "jlpt:passage/tanbun-01", name: "Note", format: "tanbun",
  jp: "工事の間は階段を使ってください。".repeat(8).slice(0, 120),
  questions: [{
    stem: "何 が 分かりますか。", opts: ["a", "b", "c", "d"], answer: 0, difficulty: 2,
    optionNote: ["x", "y", "z", "w"],
  }],
};

test("auditPassages accepte un passage conforme", () => {
  const r = auditPassages({ passages: [bon] }, refs);
  expect(r.erreurs).toEqual([]);
  expect(r.avertissements).toEqual([]);
});

test("auditPassages avertit d'un kanji hors référentiel SANS bloquer", () => {
  // kanji.jsonld est une liste d'ÉTUDE, pas la liste de ce qu'un lecteur N3 sait lire :
  // 不, 用, 工, 便, 場, 方, 室 en sont absents. Bloquer là-dessus rejetterait des textes sains.
  const ko = { ...bon, jp: bon.jp.slice(0, 119) + "斡" };
  const r = auditPassages({ passages: [ko] }, refs);
  expect(r.avertissements.some((e) => e.includes("斡"))).toBe(true);
  expect(r.erreurs).toEqual([]);
});

test("auditPassages avertit d'un mot hors N3 SANS bloquer", () => {
  const ko = { ...bon, jp: bon.jp.slice(0, 118) + "斡旋" };
  const r = auditPassages({ passages: [ko] }, refs);
  expect(r.avertissements.some((e) => e.includes("斡旋"))).toBe(true);
  expect(r.erreurs).toEqual([]);
});

test("auditPassages bloque sur une longueur hors gabarit", () => {
  const ko = { ...bon, jp: "工事。" };
  expect(auditPassages({ passages: [ko] }, refs).erreurs.some((e) => e.includes("longueur"))).toBe(true);
});

test("auditPassages bloque sur un nombre de questions non conforme au format", () => {
  const ko = { ...bon, format: "chubun" }; // 中文 = 3 questions, une seule fournie
  expect(auditPassages({ passages: [ko] }, refs).erreurs.some((e) => e.includes("questions"))).toBe(true);
});

test("auditPassages bloque sur un optionNote désaligné", () => {
  const ko = { ...bon, questions: [{ ...bon.questions[0], optionNote: ["x", "y"] }] };
  expect(auditPassages({ passages: [ko] }, refs).erreurs.some((e) => e.includes("optionNote"))).toBe(true);
});

test("auditPassages bloque sur une réponse hors bornes", () => {
  const ko = { ...bon, questions: [{ ...bon.questions[0], answer: 9 }] };
  expect(auditPassages({ passages: [ko] }, refs).erreurs.some((e) => e.includes("answer"))).toBe(true);
});
