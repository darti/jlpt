import { expect, test } from "bun:test";
import { applyStrokes, countsFromKanjidic, countsFromKanjivg, reconcilier } from "./traits.mjs";

// --- lecture des deux sources ----------------------------------------------

const kanjidic = (blocs: string) => `<kanjidic2>${blocs}</kanjidic2>`;
const character = (literal: string, ...comptes: number[]) =>
  `<character><literal>${literal}</literal><misc>` +
  comptes.map((n) => `<stroke_count>${n}</stroke_count>`).join("") +
  `</misc></character>`;

test("countsFromKanjidic ne retient que le PREMIER stroke_count", () => {
  // La DTD de KANJIDIC est explicite : « The first stroke_count in the character is the
  // accepted count. Subsequent ones are common miscounts. » Prendre le dernier verserait
  // dans le graphe l'erreur que KANJIDIC recensait justement pour la signaler.
  const xml = kanjidic(character("政", 9, 8) + character("関", 14));
  expect([...countsFromKanjidic(xml, ["政", "関"])]).toEqual([
    ["政", 9],
    ["関", 14],
  ]);
});

test("countsFromKanjidic ignore les caractères hors du graphe", () => {
  // KANJIDIC porte 13 000 caractères pour 810 fiches : sans filtre, la table déborderait
  // largement le corpus et la question « 810 comptes ? » cesserait de vouloir dire quelque chose.
  const xml = kanjidic(character("政", 9) + character("龘", 48));
  expect([...countsFromKanjidic(xml, ["政"])]).toEqual([["政", 9]]);
});

test("countsFromKanjidic ne mélange pas deux caractères voisins", () => {
  // Le découpage par `<character>` est ce qui l'empêche : chercher `<stroke_count>` sur le
  // fichier entier attribuerait au premier literal le compte du dernier bloc.
  const xml = kanjidic(character("一", 1) + character("驚", 22));
  expect(countsFromKanjidic(xml, ["一", "驚"]).get("一")).toBe(1);
});

test("countsFromKanjivg compte les tracés du bon caractère", () => {
  // `<kanji id="kvg:kanji_04e00">` — l'identifiant est le codepoint hexadécimal sur cinq
  // chiffres, et les variantes (`…-Kaisho`) ne doivent pas être confondues avec la forme
  // de référence.
  const xml =
    `<kanjivg><kanji id="kvg:kanji_04e00"><path d="M1"/></kanji>` +
    `<kanji id="kvg:kanji_04e8c"><path d="M1"/><path d="M2"/></kanji></kanjivg>`;
  expect([...countsFromKanjivg(xml, ["一", "二"])]).toEqual([
    ["一", 1],
    ["二", 2],
  ]);
});

test("countsFromKanjivg omet un caractère absent plutôt que d'en compter zéro", () => {
  // Un zéro rangerait le caractère AVANT 一 dans le cahier — la place du plus simple.
  // Ne rien rendre laisse `reconcilier` puis `applyStrokes` le signaler comme manquant.
  const xml = `<kanjivg><kanji id="kvg:kanji_04e00"><path d="M1"/></kanji></kanjivg>`;
  expect(countsFromKanjivg(xml, ["一", "驚"]).has("驚")).toBe(false);
});

// --- confrontation des sources ---------------------------------------------

const releve = (nom: string, o: Record<string, number>) => ({ nom, counts: new Map(Object.entries(o)) });

test("reconcilier retient un compte que les deux sources donnent identique", () => {
  const r = reconcilier([releve("A", { 一: 1, 二: 2 }), releve("B", { 一: 1, 二: 2 })]);
  expect(r.table).toEqual({ 一: 1, 二: 2 });
  expect(r.desaccords).toEqual([]);
  expect(r.sources).toEqual(["A", "B"]);
});

test("reconcilier ÉCARTE un glyphe sur lequel les sources divergent", () => {
  // C'est tout l'intérêt de lire deux corpus : un compte que rien ne confirme ne doit pas
  // entrer dans le graphe. On ne choisit pas — on refuse, et l'appelant s'arrête.
  const r = reconcilier([releve("A", { 一: 1, 弓: 3 }), releve("B", { 一: 1, 弓: 4 })]);
  expect(r.table).toEqual({ 一: 1 });
  expect(r.desaccords).toEqual(["弓 : A=3, B=4"]);
});

test("reconcilier tolère une source unique, et le dit par `sources`", () => {
  // Une seule chaîne récupérée doit rester utilisable : c'est l'appelant qui avertit que la
  // table n'est alors vérifiée par rien.
  const r = reconcilier([releve("A", { 一: 1 }), releve("B", {})]);
  expect(r.table).toEqual({ 一: 1 });
  expect(r.sources).toEqual(["A"]);
});

// --- application au graphe -------------------------------------------------

const kanji = (nom: string, extra: Record<string, unknown> = {}) => ({
  "@id": `jlpt:kanji/${nom}`,
  "@type": "jlpt:Kanji",
  "schema:name": nom,
  "schema:description": "sens",
  ...extra,
});

test("applyStrokes pose le compte APRÈS schema:description", () => {
  // L'ordre des clés est l'ordre de sérialisation : une place fixe garde le diff des 810
  // sujets lisible ligne à ligne, là où une insertion en fin d'objet le disperserait.
  const { subjects } = applyStrokes([kanji("政", { "jlpt:level": "N3" })], { 政: 9 });
  expect(Object.keys(subjects[0])).toEqual([
    "@id",
    "@type",
    "schema:name",
    "schema:description",
    "jlpt:strokeCount",
    "jlpt:level",
  ]);
});

test("applyStrokes n'écrase JAMAIS un compte existant et signale le désaccord", () => {
  // Même invariant que readings.mjs : le graphe fait autorité, un désaccord se regarde et
  // ne se résout pas en silence.
  const r = applyStrokes([kanji("政", { "jlpt:strokeCount": 8 })], { 政: 9 });
  expect(r.subjects[0]["jlpt:strokeCount"]).toBe(8);
  expect(r.poses).toEqual([]);
  expect(r.conflits).toEqual(["政 : graphe=8, table=9"]);
});

test("applyStrokes est idempotent : rejouer ne pose rien", () => {
  const une = applyStrokes([kanji("政")], { 政: 9 });
  const deux = applyStrokes(une.subjects, { 政: 9 });
  expect(une.poses).toEqual(["政"]);
  expect(deux.poses).toEqual([]);
  expect(deux.subjects).toEqual(une.subjects);
});

test("applyStrokes refuse une valeur qui ne peut pas être un compte de traits", () => {
  // 0, un flottant, une chaîne, un compte délirant : tous laissent le sujet intact et
  // remontent dans `absents`. Un 0 accepté ferait remonter le kanji en tête de volume.
  for (const mauvais of [0, -3, 9.5, "9", 35, null]) {
    const r = applyStrokes([kanji("政")], { 政: mauvais } as Record<string, number>);
    expect(r.subjects[0]["jlpt:strokeCount"]).toBeUndefined();
    expect(r.absents).toEqual(["政"]);
  }
});

test("applyStrokes ne touche pas aux sujets qui ne sont pas des kanji", () => {
  const mot = { "@id": "jlpt:word/政治", "@type": "jlpt:Word", "schema:name": "政治" };
  const { subjects } = applyStrokes([mot], { 政治: 17 });
  expect(subjects[0]).toEqual(mot);
});

// --- l'état du dépôt -------------------------------------------------------

test("la table couvre les 810 kanji du graphe, dans la plage attendue", () => {
  // Invariant, pas mesure : la shape impose désormais `strokeCount` sur chaque kanji, et
  // c'est ce compte qui ordonne le cahier. Un trou n'y est plus tolérable.
  const racine = new URL("../..", import.meta.url).pathname;
  const table: Record<string, number> = JSON.parse(
    require("node:fs").readFileSync(`${racine}/data/traits-kanji.json`, "utf8"),
  );
  const graphe = JSON.parse(
    require("node:fs").readFileSync(`${racine}/data/graph/kanji.jsonld`, "utf8"),
  )["@graph"].filter((k: Record<string, unknown>) => k["@type"] === "jlpt:Kanji");

  expect(graphe.length).toBe(810);
  const hors = graphe.filter((k: Record<string, number>) => table[k["schema:name"]] === undefined);
  expect(hors).toEqual([]);

  const ecarts = graphe.filter(
    (k: Record<string, unknown>) => k["jlpt:strokeCount"] !== table[k["schema:name"] as string],
  );
  expect(ecarts).toEqual([]);

  const comptes = Object.values(table);
  expect(Math.min(...comptes)).toBe(1);
  expect(Math.max(...comptes)).toBe(22);
});
