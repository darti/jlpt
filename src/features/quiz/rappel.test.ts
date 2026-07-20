import { test, expect } from "bun:test";
import { buildRappelIndex, resolveRappel, type RappelDocs } from "./rappel.ts";
import type { Question } from "../../types/quiz.ts";

const docs: RappelDocs = {
  gram: [{ "@id": "jlpt:gram/ために", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜ために",
           "schema:description": "« afin de »", "jlpt:level": "N3" }],
  word: [{ "@id": "jlpt:word/政治", "@type": "jlpt:Word", "schema:name": "政治",
           "jlpt:reading": "せいじ", "schema:description": "politique", "jlpt:level": "N3" }],
  kanji: [{ "@id": "jlpt:kanji/校", "@type": "jlpt:Kanji", "schema:name": "校",
            "schema:description": "école", "jlpt:onReading": ["コウ"], "jlpt:kunReading": [] }],
  example: [{ "@id": "jlpt:example/ために-1", "@type": "jlpt:Example",
              illustrates: "jlpt:gram/ために", "jlpt:jp": "健康のために走る。",
              "schema:description": "Je cours pour ma santé." }],
  lesson: [
    { "@id": "jlpt:lesson/gram-g3", "@type": "jlpt:Lesson", "jlpt:track": "gram",
      covers: ["jlpt:gram/ために"] },
    { "@id": "jlpt:lesson/kanji-k1", "@type": "jlpt:Lesson", "jlpt:track": "kanji",
      covers: ["jlpt:kanji/校"] },
    { "@id": "jlpt:lesson/vocab-v1", "@type": "jlpt:Lesson", "jlpt:track": "vocab",
      covers: ["jlpt:word/政治"] },
  ],
};

const q = (cat: Question["cat"], tests?: string[]): Question =>
  ({ id: 1, cat, d: 1, q: "", o: [], a: 0, ...(tests ? { tests } : {}) });

test("un point de grammaire donne forme, niveau, sens et son exemple", () => {
  const r = resolveRappel(q("grammaire", ["jlpt:gram/ために"]), buildRappelIndex(docs));
  expect(r?.kind).toBe("gram");
  expect(r?.titre).toBe("〜ために");
  expect(r?.niv).toBe("N3");
  expect(r?.sens).toBe("« afin de »");
  expect(r?.exemple).toEqual({ jp: "健康のために走る。", fr: "Je cours pour ma santé." });
  expect(r?.group).toBe("g3");      // pour le lien profond
  expect(r?.coursCat).toBe("gram"); // catégorie lue sur la LEÇON, pas déduite du type
});

test("un mot donne sa lecture et son sens", () => {
  const r = resolveRappel(q("vocabulaire", ["jlpt:word/政治"]), buildRappelIndex(docs));
  expect(r?.kind).toBe("word");
  expect(r?.titre).toBe("政治");
  expect(r?.lecture).toBe("せいじ");
  expect(r?.sens).toBe("politique");
  expect(r?.group).toBe("v1");
  expect(r?.coursCat).toBe("vocab");
});

test("un kanji recompose sa lecture on・kun", () => {
  const avecKun: RappelDocs = {
    ...docs,
    kanji: [{ ...docs.kanji[0], "jlpt:kunReading": ["まなや"] }],
  };
  const r = resolveRappel(q("kanji", ["jlpt:kanji/校"]), buildRappelIndex(avecKun));
  expect(r?.kind).toBe("kanji");
  expect(r?.titre).toBe("校");
  expect(r?.lecture).toBe("コウ・まなや");
  expect(r?.sens).toBe("école");
});

test("une question sans arête ne résout rien", () => {
  expect(resolveRappel(q("grammaire"), buildRappelIndex(docs))).toBeNull();
});

test("une arête pendante ne résout rien plutôt que de planter", () => {
  expect(resolveRappel(q("grammaire", ["jlpt:gram/absent"]), buildRappelIndex(docs))).toBeNull();
});

test("resolveRappel sur un index absent rend null", () => {
  expect(resolveRappel(q("grammaire", ["jlpt:gram/ために"]), null)).toBeNull();
});

test("la première arête résoluble l'emporte", () => {
  const r = resolveRappel(q("kanji", ["jlpt:kanji/inconnu", "jlpt:kanji/校"]), buildRappelIndex(docs));
  expect(r?.titre).toBe("校");
});

test("un point sans exemple rend un rappel sans exemple, pas une erreur", () => {
  const sansEx: RappelDocs = { ...docs, example: [] };
  const r = resolveRappel(q("grammaire", ["jlpt:gram/ために"]), buildRappelIndex(sansEx));
  expect(r?.exemple).toBeUndefined();
  expect(r?.titre).toBe("〜ために");
});

test("une entité qu'aucune leçon ne couvre rend un rappel SANS lien profond", () => {
  // Le lien profond mènerait à une page inexistante : mieux vaut pas de lien qu'un lien mort.
  const orpheline: RappelDocs = { ...docs, lesson: [] };
  const r = resolveRappel(q("vocabulaire", ["jlpt:word/政治"]), buildRappelIndex(orpheline));
  expect(r?.group).toBe("");
  expect(r?.sens).toBe("politique"); // le contenu reste utile
});
