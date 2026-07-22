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

// --- jlpt:trapKind ---------------------------------------------------------------

const baseTrap = {
  "@id": "jlpt:q/1",
  "jlpt:skill": "vocabulaire",
  "jlpt:difficulty": 2,
  opts: ["a", "b", "c", "d"],
  "jlpt:answer": 2,
};

test("trapKind valide ne produit aucune erreur", () => {
  expect(checkQuestion({ ...baseTrap, "jlpt:trapKind": ["voisement", "autre", "", "homophone"] })).toEqual([]);
});

test("trapKind de longueur différente des options est une erreur", () => {
  const errs = checkQuestion({ ...baseTrap, "jlpt:trapKind": ["voisement", ""] });
  // Asserter sur « longueur » et pas seulement « trapKind » : un tableau court déclenche AUSSI
  // l'erreur de taxonomie (le `""` à l'index 1 n'est pas la réponse), donc « trapKind » seul
  // passerait même si le contrôle de longueur était retiré (revue finale M1).
  expect(errs.join(" ")).toContain("longueur");
});

test("trapKind non vide à l'index de la réponse est une erreur", () => {
  const errs = checkQuestion({ ...baseTrap, "jlpt:trapKind": ["voisement", "autre", "homophone", "autre"] });
  expect(errs.join(" ")).toContain("réponse");
});

test("un type hors taxonomie est une erreur", () => {
  const errs = checkQuestion({ ...baseTrap, "jlpt:trapKind": ["voisement", "inventé", "", "autre"] });
  expect(errs.join(" ")).toContain("inventé");
});

test("trapKind sur une piste hors périmètre est une erreur", () => {
  const errs = checkQuestion({
    ...baseTrap, "jlpt:skill": "grammaire", "jlpt:trapKind": ["voisement", "autre", "", "autre"],
  });
  expect(errs.join(" ")).toContain("grammaire");
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

test("checkCorpus signale le même énoncé à réponses divergentes MÊME si les options diffèrent", () => {
  // Ce test affirmait l'INVERSE (« tolère ») jusqu'au 2026-07-20. L'hypothèse cachée dans
  // la clé de groupement était que deux questions ne sont comparables que si elles offrent
  // les mêmes choix — vrai pour repérer un doublon mal recopié, faux pour une contradiction
  // pédagogique : l'apprenant ne voit qu'un énoncé, jamais les options de l'autre question.
  // Cette tolérance laissait passer 135 groupes, dont #2569 et #4609 qui demandaient tous
  // deux d'écrire 「あける」 en kanji — 開ける pour l'un, 明ける pour l'autre.
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["C", "D"], "jlpt:answer": 0 });
  expect(checkCorpus([a, b]).join(" ")).toMatch(/contradictoire/i);
});

test("checkCorpus tolère le même énoncé quand la RÉPONSE est identique", () => {
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["A", "C"], "jlpt:answer": 0 });
  expect(checkCorpus([a, b])).toEqual([]);
});

const motGlose = (nom: string, lecture: string, glose: string) => ({
  "@id": `jlpt:word/${nom}`, "@type": "jlpt:Word", "schema:name": nom,
  "jlpt:reading": lecture, "schema:description": glose,
});

test("checkCorpus refuse un distracteur qui partage la lecture de la réponse", () => {
  const q = qq("jlpt:q/4609", 0, {
    "jlpt:stem": "「あける」を漢字で書くと？", opts: ["開ける", "明ける"], "jlpt:answer": 1,
  });
  const mots = [motGlose("明ける", "あける", "(jour) se lever"), motGlose("開ける", "あける", "ouvrir")];
  expect(checkCorpus([q, ...mots]).join(" ")).toMatch(/même lecture|se li/i);
});

test("checkCorpus accepte le même jeu d'options si l'énoncé porte un trou", () => {
  const q = qq("jlpt:q/4609", 0, {
    "jlpt:stem": "夜が___。（あける）", opts: ["開ける", "明ける"], "jlpt:answer": 1,
  });
  const mots = [motGlose("明ける", "あける", "(jour) se lever"), motGlose("開ける", "あける", "ouvrir")];
  expect(checkCorpus([q, ...mots])).toEqual([]);
});

test("checkCorpus ne condamne pas une question dont les rivaux sont des non-mots", () => {
  // word.jsonld porte 約速、役束、約則 : distracteurs fabriqués, lecture de 約束 recopiée,
  // aucune glose. Les compter ferait échouer la CI sur une question parfaitement saine.
  const q = qq("jlpt:q/1", 0, {
    "jlpt:stem": "「やくそく」の漢字は？", opts: ["約束", "約速", "役束"], "jlpt:answer": 0,
  });
  const mots = [
    motGlose("約束", "やくそく", "promesse"),
    { "@id": "jlpt:word/約速", "@type": "jlpt:Word", "schema:name": "約速", "jlpt:reading": "やくそく" },
    { "@id": "jlpt:word/役束", "@type": "jlpt:Word", "schema:name": "役束", "jlpt:reading": "やくそく" },
  ];
  expect(checkCorpus([q, ...mots])).toEqual([]);
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
