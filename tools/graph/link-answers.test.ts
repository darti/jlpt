import { test, expect } from "bun:test";
import { edgeFromAnswer, applyAnswerEdges } from "./link-answers.mjs";

const known = new Set(["jlpt:word/影響", "jlpt:kanji/校", "jlpt:word/約束"]);

const q = (over: Record<string, unknown> = {}) => ({
  "@id": "jlpt:q/1", "@type": "jlpt:Question", "jlpt:ord": 1,
  "jlpt:skill": "vocabulaire", "jlpt:difficulty": 2,
  "jlpt:stem": "「えいきょう」を漢字で書くと？",
  opts: ["影響", "映響", "影郷", "映郷"], "jlpt:answer": 0,
  ...over,
});

test("la réponse d'une question de vocabulaire donne l'entité testée", () => {
  // Ces énoncés portent bien un 「…」, mais il contient la LECTURE (えいきょう), pas le mot.
  // subjectOf cherchait donc jlpt:word/えいきょう et abandonnait : le mot était dans la réponse.
  expect(edgeFromAnswer(q(), known)).toBe("jlpt:word/影響");
});

test("un kanji en réponse résout vers l'entité Kanji", () => {
  const k = q({ "jlpt:skill": "kanji", opts: ["校", "枚"], "jlpt:answer": 0 });
  expect(edgeFromAnswer(k, known)).toBe("jlpt:kanji/校");
});

test("le mot l'emporte sur le kanji à nom égal", () => {
  // 約束 existe comme mot ; on ne veut pas d'un jlpt:kanji/約束 fantôme.
  const k = q({ "jlpt:skill": "kanji", opts: ["約束"], "jlpt:answer": 0 });
  expect(edgeFromAnswer(k, known)).toBe("jlpt:word/約束");
});

test("la GRAMMAIRE est exclue — ses réponses sont des formes conjuguées", () => {
  // 食べられた, お座り, 撮って sont entrés dans word.jsonld par le minage des options.
  // Les lier donnerait un rappel montrant une forme fléchie comme s'il s'agissait d'un mot.
  const g = q({ "jlpt:skill": "grammaire", opts: ["影響"], "jlpt:answer": 0 });
  expect(edgeFromAnswer(g, known)).toBeNull();
});

test("lecture et écoute sont exclues elles aussi", () => {
  for (const skill of ["lecture", "ecoute"]) {
    expect(edgeFromAnswer(q({ "jlpt:skill": skill }), known)).toBeNull();
  }
});

test("une réponse inconnue du graphe ne produit rien", () => {
  expect(edgeFromAnswer(q({ opts: ["存在しない"], "jlpt:answer": 0 }), known)).toBeNull();
});

test("une réponse hors bornes ne fait pas planter", () => {
  expect(edgeFromAnswer(q({ "jlpt:answer": 9 }), known)).toBeNull();
});

// --- application sur un shard ---------------------------------------------------

test("applyAnswerEdges pose l'arête sur les questions qui n'en ont pas", () => {
  const { sujets, poses } = applyAnswerEdges([q()], known);
  expect(sujets[0].tests).toEqual(["jlpt:word/影響"]);
  expect(poses).toBe(1);
});

test("applyAnswerEdges n'ÉCRASE JAMAIS une arête existante", () => {
  // Même invariant que readings.mjs : on ajoute, on ne régénère pas. Une arête déjà posée
  // vient de la migration ou d'une correction à la main ; elle fait autorité.
  const avec = q({ tests: ["jlpt:word/déjà-là"] });
  const { sujets, poses } = applyAnswerEdges([avec], known);
  expect(sujets[0].tests).toEqual(["jlpt:word/déjà-là"]);
  expect(poses).toBe(0);
});

test("applyAnswerEdges est idempotent", () => {
  const un = applyAnswerEdges([q()], known);
  const deux = applyAnswerEdges(un.sujets, known);
  expect(deux.sujets).toEqual(un.sujets);
  expect(deux.poses).toBe(0);
});

test("applyAnswerEdges laisse intact ce qu'il ne sait pas relier", () => {
  const orpheline = q({ opts: ["存在しない"], "jlpt:answer": 0 });
  const { sujets, poses } = applyAnswerEdges([orpheline], known);
  expect(sujets[0].tests).toBeUndefined();
  expect(poses).toBe(0);
});

// --- grammaire : la réponse est un POINT DE GRAMMAIRE, pas un mot ----------------

import { gramIndex } from "./link-answers.mjs";

const gram = [
  { "@id": "jlpt:gram/ところ", "jlpt:form": "〜ところ" },
  { "@id": "jlpt:gram/たらいい", "jlpt:form": "〜たらいい", "jlpt:altForm": ["〜といい"] },
];

test("une réponse de grammaire résout vers le point, pas vers un mot", () => {
  const g = q({ "jlpt:skill": "grammaire", opts: ["ところ"], "jlpt:answer": 0 });
  expect(edgeFromAnswer(g, known, gramIndex(gram))).toBe("jlpt:gram/ところ");
});

test("la forme alternative résout vers le MÊME point", () => {
  const g = q({ "jlpt:skill": "grammaire", opts: ["といい"], "jlpt:answer": 0 });
  expect(edgeFromAnswer(g, known, gramIndex(gram))).toBe("jlpt:gram/たらいい");
});

test("le 〜 de la forme n'empêche pas la résolution", () => {
  const g = q({ "jlpt:skill": "grammaire", opts: ["〜ところ"], "jlpt:answer": 0 });
  expect(edgeFromAnswer(g, known, gramIndex(gram))).toBe("jlpt:gram/ところ");
});

test("une réponse de grammaire ne cherche JAMAIS dans les mots", () => {
  // C'est l'erreur qui avait fait exclure la grammaire : 食べられた, お座り, 撮って sont
  // dans word.jsonld par le minage des options. Les lier montrerait une conjugaison comme
  // s'il s'agissait d'un mot du référentiel.
  const g = q({ "jlpt:skill": "grammaire", opts: ["影響"], "jlpt:answer": 0 });
  expect(edgeFromAnswer(g, known, gramIndex(gram))).toBeNull();
});

test("vocabulaire et kanji ne cherchent JAMAIS dans la grammaire", () => {
  const v = q({ "jlpt:skill": "vocabulaire", opts: ["ところ"], "jlpt:answer": 0 });
  expect(edgeFromAnswer(v, known, gramIndex(gram))).toBeNull();
});
