import { test, expect } from "bun:test";
import { checkQuestion, checkCorpus } from "./integrity.mjs";

const q = (over: Record<string, unknown> = {}) => ({
  "@id": "jlpt:q/1", "@type": "jlpt:Question",
  "jlpt:stem": "「七月」の読み方は？", "jlpt:skill": "kanji", "jlpt:difficulty": 2, "jlpt:ord": 0,
  opts: ["しちがつ", "なながつ", "しちげつ", "ななつき"], "jlpt:answer": 0,
  "jlpt:optionNote": ["a", "b", "c", "d"],
  ...over,
});

test("checkQuestion accepte une question saine", () => {
  expect(checkQuestion(q())).toEqual([]);
});

test("checkQuestion signale une réponse hors bornes", () => {
  expect(checkQuestion(q({ "jlpt:answer": 4 })).join(" ")).toMatch(/answer/);
});

test("checkQuestion signale des options identiques (cas #1381)", () => {
  const dup = q({ opts: ["しちがつ", "なながつ", "しちげつ", "なながつ"] });
  expect(checkQuestion(dup).join(" ")).toMatch(/options identique/i);
});

test("checkQuestion signale un optionNote désaligné", () => {
  expect(checkQuestion(q({ "jlpt:optionNote": ["a", "b"] })).join(" ")).toMatch(/optionNote/);
});

test("checkQuestion accepte l'absence totale d'optionNote", () => {
  const { ["jlpt:optionNote"]: _drop, ...sans } = q();
  expect(checkQuestion(sans)).toEqual([]);
});

test("checkQuestion signale une difficulté hors 1–3 (sh:in numérique impossible)", () => {
  expect(checkQuestion(q({ "jlpt:difficulty": 5 })).join(" ")).toMatch(/difficulty/);
});

test("checkQuestion exige au moins deux options", () => {
  expect(checkQuestion(q({ opts: ["seule"], "jlpt:answer": 0, "jlpt:optionNote": ["a"] })).join(" "))
    .toMatch(/options/);
});

test("checkQuestion distingue deux options que seuls les espaces séparent", () => {
  // La normalisation doit repérer «  しちがつ » et « しちがつ » comme un doublon réel.
  expect(checkQuestion(q({ opts: ["しちがつ", " しちがつ ", "しちげつ", "ななつき"] })).join(" "))
    .toMatch(/options identique/i);
});

// --- invariants portant sur tout le corpus -------------------------------------

const gram = { "@id": "jlpt:gram/tara", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜たら" };
const qq = (id: string, ord: number, over: Record<string, unknown> = {}) => ({
  "@id": id, "@type": "jlpt:Question", "jlpt:ord": ord,
  "jlpt:stem": "家に帰っ___。", opts: ["たら", "なら"], "jlpt:answer": 0,
  "jlpt:skill": "grammaire", "jlpt:difficulty": 1, ...over,
});

test("checkCorpus accepte des ordinaux denses et uniques", () => {
  expect(checkCorpus([qq("jlpt:q/1", 0), qq("jlpt:q/2", 1)])).toEqual([]);
});

test("checkCorpus signale un ordinal en double", () => {
  expect(checkCorpus([qq("jlpt:q/1", 0), qq("jlpt:q/2", 0)]).join(" ")).toMatch(/ord.*double/i);
});

test("checkCorpus signale un trou dans les ordinaux", () => {
  expect(checkCorpus([qq("jlpt:q/1", 0), qq("jlpt:q/2", 2)]).join(" ")).toMatch(/dense/i);
});

test("checkCorpus signale une IRI pendante dans tests", () => {
  const q = qq("jlpt:q/1", 0, { tests: ["jlpt:gram/inexistant"] });
  expect(checkCorpus([q, gram]).join(" ")).toMatch(/pendante/i);
});

test("checkCorpus accepte une IRI qui existe", () => {
  expect(checkCorpus([qq("jlpt:q/1", 0, { tests: ["jlpt:gram/tara"] }), gram])).toEqual([]);
});

test("checkCorpus suit aussi usesKanji et covers", () => {
  const mot = { "@id": "jlpt:word/影", "@type": "jlpt:Word", usesKanji: ["jlpt:kanji/absent"] };
  const lecon = { "@id": "jlpt:lesson/x", "@type": "jlpt:Lesson", covers: ["jlpt:gram/absent"] };
  expect(checkCorpus([mot, lecon]).filter((e) => /pendante/.test(e))).toHaveLength(2);
});

test("checkCorpus signale deux questions identiques à réponse contradictoire", () => {
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "「いる」を漢字で書くと？", opts: ["居る", "要る"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "「いる」を漢字で書くと？", opts: ["居る", "要る"], "jlpt:answer": 1 });
  expect(checkCorpus([a, b]).join(" ")).toMatch(/contradictoire/i);
});

test("checkCorpus tolère le même énoncé avec des options différentes", () => {
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["C", "D"], "jlpt:answer": 0 });
  expect(checkCorpus([a, b])).toEqual([]);
});

test("checkCorpus tolère le même énoncé, mêmes options, MÊME réponse dans un ordre différent", () => {
  // Options permutées : c'est une redondance, pas une contradiction.
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["B", "A"], "jlpt:answer": 1 });
  expect(checkCorpus([a, b])).toEqual([]);
});
