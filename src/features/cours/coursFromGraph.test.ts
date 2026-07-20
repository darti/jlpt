import { test, expect } from "bun:test";
import { buildCours, type CoursDocs } from "./coursFromGraph.ts";
import type { LearnCategory, MethodCategory, GramItem, KanjiItem, VocabItem } from "./coursSchema.ts";

const docs: CoursDocs = {
  lesson: [
    { "@id": "jlpt:lesson/gram-g3", "@type": "jlpt:Lesson", "schema:name": "Cause & but",
      "jlpt:order": 0, "jlpt:track": "gram", covers: ["jlpt:gram/ために"] },
    { "@id": "jlpt:lesson/kanji-k1", "@type": "jlpt:Lesson", "schema:name": "Kanji 1",
      "jlpt:order": 0, "jlpt:track": "kanji", covers: ["jlpt:kanji/位"] },
    { "@id": "jlpt:lesson/vocab-v1", "@type": "jlpt:Lesson", "schema:name": "Vocab 1",
      "jlpt:order": 0, "jlpt:track": "vocab", covers: ["jlpt:word/味"] },
  ],
  gram: [{ "@id": "jlpt:gram/ために", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜ために",
           "jlpt:structure": "辞書形＋ために", "schema:description": "« afin de »", "jlpt:level": "N3" }],
  kanji: [{ "@id": "jlpt:kanji/位", "@type": "jlpt:Kanji", "schema:name": "位",
            "schema:description": "rang", "jlpt:onReading": ["イ"], "jlpt:kunReading": ["くらい"] }],
  word: [{ "@id": "jlpt:word/味", "@type": "jlpt:Word", "schema:name": "味",
           "jlpt:reading": "あじ", "schema:description": "goût", "jlpt:level": "N3" }],
  example: [{ "@id": "jlpt:example/ために-1", "@type": "jlpt:Example",
              illustrates: "jlpt:gram/ために", "jlpt:jp": "健康のために走る。",
              "jlpt:romaji": "kenkō no tame ni hashiru.", "schema:description": "Je cours.",
              "jlpt:analysis": ["健康 « santé »"] }],
  method: [{ "@id": "jlpt:method/dokkai", "@type": "jlpt:MethodNote",
             "schema:name": "読解", "jlpt:order": 0, "jlpt:tip": ["Lis les questions."] }],
};

test("buildCours rend les quatre catégories, dans l'ordre attendu par la vue", () => {
  expect(buildCours(docs).map((c) => c.id)).toEqual(["gram", "vocab", "kanji", "method"]);
});

test("un item de grammaire porte forme, structure, sens, niveau et ses exemples", () => {
  const gram = buildCours(docs).find((c) => c.id === "gram") as LearnCategory;
  const it = gram.groups[0].items[0] as GramItem;
  expect(it.id).toBe("jlpt:gram/ために");
  expect(it.form).toBe("〜ために");
  expect(it.struct).toBe("辞書形＋ために");
  expect(it.mean).toBe("« afin de »");
  expect(it.niv).toBe("N3");
  expect(it.examples).toEqual([
    { jp: "健康のために走る。", ro: "kenkō no tame ni hashiru.", fr: "Je cours.", an: ["健康 « santé »"] },
  ]);
});

test("un item kanji recompose la lecture on・kun du cours", () => {
  const cat = buildCours(docs).find((c) => c.id === "kanji") as LearnCategory;
  const it = cat.groups[0].items[0] as KanjiItem;
  expect(it.kanji).toBe("位");
  expect(it.lecture).toBe("イ・くらい"); // exactement la forme d'avant migration
  expect(it.sens).toBe("rang");
});

test("un item de vocabulaire porte mot, lecture et sens", () => {
  const cat = buildCours(docs).find((c) => c.id === "vocab") as LearnCategory;
  const it = cat.groups[0].items[0] as VocabItem;
  expect(it.mot).toBe("味");
  expect(it.lecture).toBe("あじ");
  expect(it.sens).toBe("goût");
});

test("la méthode devient une MethodCategory avec ses conseils", () => {
  const m = buildCours(docs).find((c) => c.id === "method") as MethodCategory;
  expect(m.kind).toBe("method");
  expect(m.sections).toEqual([{ title: "読解", tips: ["Lis les questions."] }]);
});

test("les leçons sont triées par jlpt:order", () => {
  const deux: CoursDocs = {
    ...docs,
    lesson: [
      { "@id": "jlpt:lesson/gram-b", "@type": "jlpt:Lesson", "schema:name": "B", "jlpt:order": 1, "jlpt:track": "gram", covers: [] },
      { "@id": "jlpt:lesson/gram-a", "@type": "jlpt:Lesson", "schema:name": "A", "jlpt:order": 0, "jlpt:track": "gram", covers: [] },
    ],
  };
  const gram = buildCours(deux).find((c) => c.id === "gram") as LearnCategory;
  expect(gram.groups.map((g) => g.title)).toEqual(["A", "B"]);
});

test("une entité référencée mais absente est ignorée sans planter", () => {
  const cassé: CoursDocs = { ...docs, gram: [] };
  const gram = buildCours(cassé).find((c) => c.id === "gram") as LearnCategory;
  expect(gram.groups[0].items).toEqual([]);
});

test("un motif de vocabulaire pointant vers la grammaire rend un item lisible", () => {
  // « なかなか〜ない » est rangé dans le cours de vocabulaire mais EST un point de grammaire :
  // la vue doit l'afficher avec son sens, pas une case vide.
  const avecMotif: CoursDocs = {
    ...docs,
    lesson: [{ "@id": "jlpt:lesson/vocab-v2", "@type": "jlpt:Lesson", "schema:name": "Adverbes",
               "jlpt:order": 0, "jlpt:track": "vocab", covers: ["jlpt:gram/なかなかない"] }],
    gram: [{ "@id": "jlpt:gram/なかなかない", "@type": "jlpt:GrammarPoint",
             "jlpt:form": "なかなか〜ない", "schema:description": "avoir du mal à" }],
  };
  const cat = buildCours(avecMotif).find((c) => c.id === "vocab") as LearnCategory;
  const it = cat.groups[0].items[0] as VocabItem;
  expect(it.mot).toBe("なかなか〜ない");
  expect(it.sens).toBe("avoir du mal à");
});
