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

test("checkCorpus refuse un @id non sûr ou absent", () => {
  // Aucune shape ne contraint le @id — sh:nodeKind ne porte que sur les valeurs de
  // prédicats. Ces IRIs partent pourtant dans un store adossé à SQL.
  expect(checkCorpus([{ "@id": "jlpt:gram/a;b", "@type": "jlpt:GrammarPoint" }]).join(" "))
    .toMatch(/@id absent ou non sûr/);
  expect(checkCorpus([{ "@type": "jlpt:Word" }]).join(" ")).toMatch(/@id absent ou non sûr/);
});

test("checkCorpus refuse deux sujets partageant le même @id", () => {
  const a = { "@id": "jlpt:word/影", "@type": "jlpt:Word" };
  expect(checkCorpus([a, { ...a }]).join(" ")).toMatch(/@id en double/);
});

// --- exemples et couverture des leçons ------------------------------------------

test("checkCorpus refuse un Example dont illustrates ne pointe vers rien", () => {
  const ex = {
    "@id": "jlpt:example/x", "@type": "jlpt:Example",
    illustrates: "jlpt:gram/inexistant", "jlpt:jp": "文",
  };
  expect(checkCorpus([ex]).join(" ")).toMatch(/référence pendante/);
});

test("checkCorpus refuse une leçon dont un covers ne pointe vers rien", () => {
  const l = {
    "@id": "jlpt:lesson/gram-g1", "@type": "jlpt:Lesson",
    "schema:name": "L", "jlpt:order": 0, "jlpt:track": "gram",
    covers: ["jlpt:gram/absent"],
  };
  expect(checkCorpus([l]).join(" ")).toMatch(/référence pendante/);
});

test("checkCorpus refuse une leçon qui ne couvre rien", () => {
  // Une leçon sans covers rend un groupe VIDE dans la vue : du contenu disparu en silence.
  const l = {
    "@id": "jlpt:lesson/gram-g9", "@type": "jlpt:Lesson",
    "schema:name": "L", "jlpt:order": 0, "jlpt:track": "gram",
  };
  expect(checkCorpus([l]).join(" ")).toMatch(/ne couvre aucune entité/);
});

// --- cohérence des SkillRange ---------------------------------------------------

const qr = (ord: number, skill: string) => ({
  "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question", "jlpt:ord": ord,
  "jlpt:stem": `x${ord}`, opts: ["a", "b"], "jlpt:answer": 0,
  "jlpt:skill": skill, "jlpt:difficulty": 1,
});
const range = (skill: string, from: number, count: number) => ({
  "@id": `jlpt:corpus/${skill}`, "@type": "jlpt:SkillRange",
  "jlpt:skill": skill, "jlpt:from": from, "jlpt:count": count,
});

test("checkCorpus refuse un SkillRange qui ment sur les questions réelles", () => {
  // corpus.jsonld remplace bank-index.json : s'il ment, l'app résout les ids vers la
  // mauvaise compétence SANS la moindre erreur. C'est ce contrôle qui rend la
  // désynchronisation impossible, et non seulement improbable.
  expect(checkCorpus([qr(0, "kanji"), range("kanji", 0, 99)]).join(" ")).toMatch(/SkillRange/);
});

test("checkCorpus refuse un SkillRange dont la borne de départ est fausse", () => {
  const sujets = [qr(0, "grammaire"), qr(1, "kanji"), qr(2, "kanji"), range("kanji", 0, 2)];
  expect(checkCorpus(sujets).join(" ")).toMatch(/SkillRange kanji/);
});

test("checkCorpus accepte des SkillRange fidèles au corpus", () => {
  const sujets = [
    qr(0, "grammaire"), qr(1, "grammaire"), qr(2, "kanji"),
    range("grammaire", 0, 2), range("kanji", 2, 1),
  ];
  expect(checkCorpus(sujets)).toEqual([]);
});
