import { test, expect } from "bun:test";
import {
  buildExamples, buildMethod, enrichKanji, fillWordReadings, normalizeMot,
} from "./migrate-cours.mjs";

// ⚠ Ce fichier meurt avec tools/migrate-cours.mjs (Task 6). Ce qui porte une règle DURABLE
// a été extrait avant : splitOnKun vit dans tools/graph/kana.mjs, avec ses propres tests.

const gramByForm = new Map([["ために", "jlpt:gram/ために"]]);

test("buildExamples rattache l'exemple à l'ENTITÉ du point de grammaire", () => {
  const cours = { groups: [{ id: "g3", items: [{
    id: "gram:ために", form: "〜ために",
    examples: [{ jp: "健康のために走る。", ro: "kenkō no tame ni hashiru.", fr: "Je cours pour ma santé.", an: ["健康 « santé »"] }],
  }] }] };
  const [ex] = buildExamples(cours, gramByForm);
  expect(ex["@type"]).toBe("jlpt:Example");
  expect(ex.illustrates).toBe("jlpt:gram/ために");
  expect(ex["jlpt:jp"]).toBe("健康のために走る。");
  expect(ex["jlpt:romaji"]).toBe("kenkō no tame ni hashiru.");
  expect(ex["schema:description"]).toBe("Je cours pour ma santé.");
  expect(ex["jlpt:analysis"]).toEqual(["健康 « santé »"]);
});

test("buildExamples numérote les exemples multiples d'un même point", () => {
  const cours = { groups: [{ id: "g3", items: [{
    form: "〜ために", examples: [{ jp: "A" }, { jp: "B" }],
  }] }] };
  const ids = buildExamples(cours, gramByForm).map((e) => e["@id"]);
  expect(new Set(ids).size).toBe(2); // @id unique, sinon checkCorpus refuse le doublon
});

test("buildExamples ignore un item dont la forme ne résout aucune entité", () => {
  const cours = { groups: [{ id: "g9", items: [{ form: "〜inconnu", examples: [{ jp: "A" }] }] }] };
  expect(buildExamples(cours, gramByForm)).toEqual([]);
});

test("buildMethod projette une section en jlpt:MethodNote", () => {
  const src = { sections: [{ title: "読解 — Méthode", tips: ["Lis les questions.", "Repère."] }] };
  const [m] = buildMethod(src);
  expect(m["@type"]).toBe("jlpt:MethodNote");
  expect(m["schema:name"]).toBe("読解 — Méthode");
  expect(m["jlpt:order"]).toBe(0);
  expect(m["jlpt:tip"]).toEqual(["Lis les questions.", "Repère."]);
});

test("enrichKanji pose les lectures on/kun sur une entité existante", () => {
  const sujets = [{ "@id": "jlpt:kanji/位", "@type": "jlpt:Kanji", "schema:name": "位", "schema:description": "rang" }];
  const cours = { groups: [{ items: [{ kanji: "位", lecture: "イ・くらい", sens: "rang, position" }] }] };
  const { sujets: out, lectures } = enrichKanji(sujets, cours);
  expect(out[0]["jlpt:onReading"]).toEqual(["イ"]);
  expect(out[0]["jlpt:kunReading"]).toEqual(["くらい"]);
  expect(lectures).toBe(1);
});

test("enrichKanji crée l'entité d'un kanji absent du référentiel", () => {
  const cours = { groups: [{ items: [{ kanji: "優", lecture: "ユウ・やさ(しい)", sens: "supérieur" }] }] };
  const { sujets, crees } = enrichKanji([], cours);
  expect(crees).toBe(1);
  expect(sujets[0]["@id"]).toBe("jlpt:kanji/優");
  expect(sujets[0]["schema:description"]).toBe("supérieur");
  expect(sujets[0]["jlpt:kunReading"]).toEqual(["やさ(しい)"]);
});

test("enrichKanji reporte le champ exemple en jlpt:compound, verbatim", () => {
  const cours = { groups: [{ items: [{ kanji: "働", lecture: "ドウ", sens: "travail", exemple: "労働 (rōdō) travail" }] }] };
  const { sujets } = enrichKanji([], cours);
  expect(sujets[0]["jlpt:compound"]).toBe("労働 (rōdō) travail");
});

test("enrichKanji n'écrase JAMAIS une description déjà dans le graphe", () => {
  const sujets = [{ "@id": "jlpt:kanji/位", "@type": "jlpt:Kanji", "schema:name": "位", "schema:description": "du graphe" }];
  const cours = { groups: [{ items: [{ kanji: "位", lecture: "イ", sens: "du cours" }] }] };
  expect(enrichKanji(sujets, cours).sujets[0]["schema:description"]).toBe("du graphe");
});

test("normalizeMot retire le suffixe entre parenthèses et prend la 1re forme", () => {
  expect(normalizeMot("予防(する)")).toBe("予防");
  expect(normalizeMot("最初 / 最後")).toBe("最初");
  expect(normalizeMot("味")).toBe("味");
});

test("fillWordReadings comble un trou sans toucher aux lectures existantes", () => {
  const sujets = [
    { "@id": "jlpt:word/味", "@type": "jlpt:Word", "schema:name": "味", "jlpt:reading": "あじ" },
    { "@id": "jlpt:word/謎", "@type": "jlpt:Word", "schema:name": "謎" },
  ];
  const cours = { groups: [{ items: [
    { mot: "味", lecture: "あぢ" },   // divergence : le graphe fait autorité
    { mot: "謎", lecture: "なぞ" },   // trou : le cours comble
  ] }] };
  const { sujets: out, comblees, divergences } = fillWordReadings(sujets, cours);
  expect(out[0]["jlpt:reading"]).toBe("あじ");
  expect(out[1]["jlpt:reading"]).toBe("なぞ");
  expect(comblees).toBe(1);
  expect(divergences).toEqual(["味"]);
});
