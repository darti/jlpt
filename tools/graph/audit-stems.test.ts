import { test, expect } from "bun:test";
import { auditStems, isDisambiguated, readingIndex, sameReadingConflicts } from "./audit-stems.mjs";

const q = (id: string, ord: number, extra: Record<string, unknown>) => ({
  "@id": id, "@type": "jlpt:Question", "jlpt:skill": "vocabulaire",
  "jlpt:difficulty": 2, "jlpt:ord": ord, ...extra,
});

/** Mot ATTESTÉ : lecture + glose. C'est la glose qui distingue un mot d'un distracteur
 *  fabriqué importé jadis dans word.jsonld. */
const mot = (nom: string, lecture: string, glose = "sens quelconque") => ({
  "@id": `jlpt:word/${nom}`, "@type": "jlpt:Word", "schema:name": nom,
  "jlpt:reading": lecture, "schema:description": glose,
});

/** Entrée fabriquée : un distracteur de quiz importé comme mot — lecture recopiée de la
 *  bonne réponse, aucune glose. Il en existe des dizaines dans word.jsonld. */
const nonMot = (nom: string, lecture: string) => ({
  "@id": `jlpt:word/${nom}`, "@type": "jlpt:Word", "schema:name": nom, "jlpt:reading": lecture,
});

// --- contradictions : preuve, aucun jugement -----------------------------------------

test("auditStems groupe deux questions au même énoncé et réponses divergentes", () => {
  // Cas réel : #2569 et #4609 partagent 「あける」を漢字で書くと？ mais se corrigent
  // l'une l'autre à tort. Les jeux d'options DIFFÈRENT — c'est précisément pour ça que
  // checkCorpus les ratait.
  const a = q("jlpt:q/2569", 2569, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["閉ける", "明ける", "開ける", "開く"], "jlpt:answer": 2,
  });
  const b = q("jlpt:q/4609", 4609, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
  });
  const { contradictions } = auditStems([a, b]);
  expect(contradictions).toHaveLength(1);
  expect(contradictions[0].stem).toBe("「あける」を漢字で書くと？");
  expect(contradictions[0].questions.map((x) => x.answer).sort()).toEqual(["明ける", "開ける"]);
});

test("auditStems ne groupe pas deux questions au même énoncé et MÊME réponse", () => {
  const a = q("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = q("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["A", "C"], "jlpt:answer": 0 });
  expect(auditStems([a, b]).contradictions).toEqual([]);
});

test("auditStems groupe deux questions de shards DIFFÉRENTS au même énoncé", () => {
  // Cas réel 「一月」の読み方は？ : ひとつき en vocabulaire, いちがつ en kanji. Les deux
  // lectures sont correctes. Une détection shard par shard ne peut pas la voir.
  const a = q("jlpt:q/3302", 3302, {
    "jlpt:stem": "「一月」の読み方は？", opts: ["ひとつき", "いちがつ"], "jlpt:answer": 0,
  });
  const b = q("jlpt:q/7168", 7168, {
    "jlpt:stem": "「一月」の読み方は？", opts: ["いちがつ", "ひとつき"], "jlpt:answer": 0,
  });
  expect(auditStems([a, b]).contradictions).toHaveLength(1);
});

// --- même lecture : preuve tirée de word.jsonld ---------------------------------------

test("readingIndex n'indexe que les jlpt:Word porteurs d'une lecture", () => {
  const sujets = [
    mot("明ける", "あける"),
    { "@id": "jlpt:word/空ける", "@type": "jlpt:Word", "schema:name": "空ける" }, // sans lecture
    { "@id": "jlpt:kanji/明", "@type": "jlpt:Kanji", "schema:name": "明", "jlpt:reading": "めい" },
  ];
  const idx = readingIndex(sujets);
  expect(idx.get("明ける")).toBe("あける");
  expect(idx.has("空ける")).toBe(false);
  expect(idx.has("明")).toBe(false); // un kanji n'est pas un mot
});

test("readingIndex écarte les entrées SANS GLOSE — distracteurs fabriqués", () => {
  // Régression : word.jsonld porte 約速、役束、約則 avec la lecture やくそく recopiée de
  // 約束 et aucune glose. Les indexer faisait passer 「やくそく」の漢字は？ pour ambiguë
  // alors qu'une seule de ses quatre options est un mot.
  const idx = readingIndex([mot("約束", "やくそく", "promesse"), nonMot("約速", "やくそく")]);
  expect(idx.get("約束")).toBe("やくそく");
  expect(idx.has("約速")).toBe(false);
});

test("sameReadingConflicts ne signale PAS une question dont les rivaux sont fabriqués", () => {
  const question = q("jlpt:q/1", 0, {
    "jlpt:stem": "「やくそく」の漢字は？",
    opts: ["約束", "約速", "役束", "約則"], "jlpt:answer": 0,
  });
  const sujets = [question, mot("約束", "やくそく", "promesse"),
    nonMot("約速", "やくそく"), nonMot("役束", "やくそく"), nonMot("約則", "やくそく")];
  expect(sameReadingConflicts(sujets, readingIndex(sujets))).toEqual([]);
});

test("sameReadingConflicts prouve l'ambiguïté quand un distracteur partage la lecture", () => {
  const question = q("jlpt:q/4609", 4609, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
  });
  const sujets = [question, mot("明ける", "あける"), mot("開ける", "あける")];
  const conflits = sameReadingConflicts(sujets, readingIndex(sujets));
  expect(conflits).toHaveLength(1);
  expect(conflits[0].jumeaux).toEqual(["開ける"]);
  expect(conflits[0].lecture).toBe("あける");
});

test("sameReadingConflicts ne PRÉSUME PAS distinct un mot absent du dictionnaire", () => {
  // word.jsonld ne couvre qu'une partie du vocabulaire : l'index prouve la présence
  // d'ambiguïté, jamais son absence. Un mot inconnu doit être ignoré, pas déclaré sûr.
  const question = q("jlpt:q/1", 0, { "jlpt:stem": "x", opts: ["開ける", "明ける"], "jlpt:answer": 1 });
  const sujets = [question, mot("明ける", "あける")]; // 開ける absent
  expect(sameReadingConflicts(sujets, readingIndex(sujets))).toEqual([]);
});

test("sameReadingConflicts ignore une question dont la RÉPONSE est absente du dictionnaire", () => {
  const question = q("jlpt:q/1", 0, { "jlpt:stem": "x", opts: ["開ける", "昭ける"], "jlpt:answer": 1 });
  const sujets = [question, mot("開ける", "あける")];
  expect(sameReadingConflicts(sujets, readingIndex(sujets))).toEqual([]);
});

// --- suspects : heuristique, et ses deux pièges ---------------------------------------

test("auditStems suspecte un distracteur noté homophone en sens ÉCRITURE", () => {
  const a = q("jlpt:q/4609", 4609, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
    "jlpt:optionNote": [
      "開ける（あける）« ouvrir » : homophone, kanji différent",
      "空ける（あける）« vider » : homophone, kanji différent",
      "Correct : 明ける",
      "昭ける : graphie inexistante",
    ],
  });
  expect(auditStems([a]).suspects.map((x) => x.id)).toEqual(["jlpt:q/4609"]);
});

test("auditStems NE suspecte PAS une question de sens LECTURE notée homophone", () => {
  // Régression : 36 faux positifs. En 「X」の読み方は？, « homophone » désigne la lecture
  // d'un AUTRE mot (いっぱん = 一般), pas une seconde lecture de 一番. La question est saine.
  const a = q("jlpt:q/1494", 1494, {
    "jlpt:stem": "「一番」の読み方は？",
    opts: ["いちばん", "いちまん", "にばん", "いっぱん"], "jlpt:answer": 0,
    "jlpt:optionNote": [
      "Correct : いちばん",
      "いちまん : confusion 番/万",
      "にばん = lecture de 二番",
      "いっぱん = lecture de 一般 (homophone proche)",
    ],
  });
  expect(auditStems([a]).suspects).toEqual([]);
});

test("auditStems ignore une note « homophone » portée par la BONNE réponse", () => {
  // La note de la réponse décrit la réponse, pas un piège : elle ne rend rien ambigu.
  const a = q("jlpt:q/1", 0, {
    "jlpt:stem": "「かんじ」を漢字で書くと？", opts: ["感じ", "漢字"], "jlpt:answer": 1,
    "jlpt:optionNote": ["感じ : autre mot", "Correct : 漢字, homophone de 感じ"],
  });
  expect(auditStems([a]).suspects).toEqual([]);
});

test("auditStems ne suspecte pas ce qui est déjà PROUVÉ par la lecture", () => {
  // Sinon la même question apparaît deux fois dans le rapport, et le décompte ment.
  const a = q("jlpt:q/4609", 4609, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["開ける", "明ける"], "jlpt:answer": 1,
    "jlpt:optionNote": ["開ける : homophone", "Correct : 明ける"],
  });
  const r = auditStems([a, mot("明ける", "あける"), mot("開ける", "あける")]);
  expect(r.memeLecture.map((x) => x.id)).toEqual(["jlpt:q/4609"]);
  expect(r.suspects).toEqual([]);
});

// --- désambiguïsation : les deux formes reconnues --------------------------------------

test("isDisambiguated reconnaît le trou et la glose de sens, pas un énoncé nu", () => {
  expect(isDisambiguated("夜が___。（あける）")).toBe(true);
  expect(isDisambiguated("「おさめる」を漢字で書くと（「gouverner un pays」の意味）？")).toBe(true);
  expect(isDisambiguated("「あける」を漢字で書くと？")).toBe(false);
});

test("isDisambiguated reconnaît AUSSI le trou en pleine chasse ＿", () => {
  // Régression : 256 énoncés de grammaire écrivent leur trou en U+FF3F, souvent doublé
  // seulement (この部屋（へや）は＿＿です。). Une détection limitée au souligné ASCII les
  // réclamait à l'arbitrage alors qu'ils sont déjà des phrases à trou.
  expect(isDisambiguated("この部屋（へや）は＿＿です。")).toBe(true);
  expect(isDisambiguated("家に帰っ＿、電話します。")).toBe(true);
});

test("auditStems considère un énoncé à trou comme déjà arbitré, même lecture partagée", () => {
  const a = q("jlpt:q/1", 0, {
    "jlpt:stem": "夜が___。（あける）",
    opts: ["開ける", "明ける"], "jlpt:answer": 1,
    "jlpt:optionNote": ["開ける : homophone", "Correct : 明ける"],
  });
  const r = auditStems([a, mot("明ける", "あける"), mot("開ける", "あける")]);
  expect(r.memeLecture).toEqual([]);
  expect(r.suspects).toEqual([]);
});

test("auditStems ignore les sujets qui ne sont pas des questions", () => {
  expect(auditStems([mot("明ける", "あける")]))
    .toEqual({ contradictions: [], memeLecture: [], suspects: [] });
});
