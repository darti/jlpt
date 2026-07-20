import { test, expect } from "bun:test";
import { proposePurge, applyPurge } from "./purge-words.mjs";

const mot = (nom: string, over: Record<string, unknown> = {}) => ({
  "@id": `jlpt:word/${nom}`, "@type": "jlpt:Word", "schema:name": nom, ...over,
});
const q = (ord: number, opts: string[], answer: number, over: Record<string, unknown> = {}) => ({
  "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question", "jlpt:ord": ord,
  "jlpt:stem": "「やくそく」を漢字で書くと？", "jlpt:skill": "vocabulaire",
  "jlpt:difficulty": 2, opts, "jlpt:answer": answer, ...over,
});

// --- proposition : ce qui ressemble à une fabrication ------------------------------

test("proposePurge repère une entrée dont la lecture est recopiée de la réponse", () => {
  // Signature de la fabrication : le distracteur 約速 porte やくそく, la lecture de 約束,
  // et aucune glose. Il n'est un mot dans aucun sens du terme.
  const sujets = [
    q(0, ["約束", "約速"], 0),
    mot("約束", { "jlpt:reading": "やくそく", "schema:description": "promesse" }),
    mot("約速", { "jlpt:reading": "やくそく" }),
  ];
  expect(proposePurge(sujets).map((c) => c.nom)).toEqual(["約速"]);
});

test("proposePurge épargne une entrée GLOSÉE, même homophone et jamais réponse", () => {
  // C'est la seule protection des vrais mots : 謝り est un mot, il porte un sens.
  const sujets = [
    q(0, ["誤り", "謝り"], 0),
    mot("誤り", { "jlpt:reading": "あやまり", "schema:description": "erreur" }),
    mot("謝り", { "jlpt:reading": "あやまり", "schema:description": "excuse" }),
  ];
  expect(proposePurge(sujets)).toEqual([]);
});

test("proposePurge ignore une entrée SANS lecture kana", () => {
  // Régression : 517 entrées n'ont aucune lecture. Comparer deux `undefined` les rendait
  // toutes suspectes dès que la réponse était elle aussi absente du dictionnaire — c'est
  // ainsi que « ぐ » s'est retrouvé proposé à la suppression.
  const sujets = [q(0, ["ク", "ぐ"], 0), mot("ぐ")];
  expect(proposePurge(sujets)).toEqual([]);
});

test("proposePurge ignore une entrée qui est la RÉPONSE d'une question", () => {
  const sujets = [
    q(0, ["約束", "約速"], 0),
    q(1, ["約速", "約束"], 0, { "jlpt:ord": 1 }), // ici 約速 est la bonne réponse
    mot("約束", { "jlpt:reading": "やくそく", "schema:description": "promesse" }),
    mot("約速", { "jlpt:reading": "やくそく" }),
  ];
  expect(proposePurge(sujets)).toEqual([]);
});

test("proposePurge ignore un mot qui n'apparaît dans aucune question", () => {
  const sujets = [mot("孤立", { "jlpt:reading": "こりつ" })];
  expect(proposePurge(sujets)).toEqual([]);
});

// --- application : suppression et glosage ------------------------------------------

const DECISION = { supprimer: ["jlpt:word/約速"], gloser: {} };

test("applyPurge retire exactement les @id listés", () => {
  const sujets = [mot("約束", { "jlpt:reading": "やくそく" }), mot("約速", { "jlpt:reading": "やくそく" })];
  const { sujets: out, retires } = applyPurge(sujets, DECISION);
  expect(out.map((s) => s["schema:name"])).toEqual(["約束"]);
  expect(retires).toEqual(["jlpt:word/約速"]);
});

test("applyPurge REFUSE de retirer une entrée que quelque chose référence", () => {
  // Supprimer une cible d'arête fabriquerait une référence pendante, que checkCorpus
  // signalerait ensuite sans dire d'où elle vient. Mieux vaut refuser à la source.
  const sujets = [
    { "@id": "jlpt:q/1", "@type": "jlpt:Question", tests: ["jlpt:word/約速"] },
    mot("約速", { "jlpt:reading": "やくそく" }),
  ];
  const { sujets: out, retires, refuses } = applyPurge(sujets, DECISION);
  expect(out).toHaveLength(2);
  expect(retires).toEqual([]);
  expect(refuses).toEqual(["jlpt:word/約速"]);
});

test("applyPurge est idempotent : un second passage ne retire plus rien", () => {
  const sujets = [mot("約束", { "jlpt:reading": "やくそく" }), mot("約速", { "jlpt:reading": "やくそく" })];
  const un = applyPurge(sujets, DECISION);
  const deux = applyPurge(un.sujets, DECISION);
  expect(deux.sujets).toEqual(un.sujets);
  expect(deux.retires).toEqual([]);
});

test("applyPurge pose une glose sur un mot qui n'en a pas", () => {
  const sujets = [mot("始め", { "jlpt:reading": "はじめ" })];
  const { sujets: out, gloses } = applyPurge(sujets, { supprimer: [], gloser: { "始め": "début, commencement" } });
  expect(out[0]["schema:description"]).toBe("début, commencement");
  expect(gloses).toEqual(["始め"]);
});

test("applyPurge n'ÉCRASE JAMAIS une glose existante", () => {
  // Même invariant que readings.mjs : le graphe fait autorité, un désaccord se signale.
  const sujets = [mot("初め", { "jlpt:reading": "はじめ", "schema:description": "début" })];
  const { sujets: out, gloses, conflits } = applyPurge(sujets, { supprimer: [], gloser: { "初め": "autre chose" } });
  expect(out[0]["schema:description"]).toBe("début");
  expect(gloses).toEqual([]);
  expect(conflits).toEqual(["初め"]);
});

// --- correction des lectures placeholder ---------------------------------------------

test("applyPurge remplace une lecture qui n'est pas du kana", () => {
  // 今年 portait « ことし（特別な読み） » : une note d'auteur logée dans un champ de donnée.
  const sujets = [mot("今年", { "jlpt:reading": "ことし（特別な読み）", "schema:description": "cette année" })];
  const { sujets: out, lectures } = applyPurge(sujets, { supprimer: [], gloser: {}, lectures: { "今年": "ことし" } });
  expect(out[0]["jlpt:reading"]).toBe("ことし");
  expect(lectures).toEqual(["今年"]);
});

test("applyPurge REFUSE de remplacer une lecture déjà en kana", () => {
  // L'invariant qui rend cet outil sûr : il ne peut corriger QUE ce qui n'est
  // manifestement pas une lecture. Il ne peut donc pas servir à en réécrire une bonne.
  const sujets = [mot("明ける", { "jlpt:reading": "あける", "schema:description": "se lever" })];
  const { sujets: out, lectures, conflits } = applyPurge(
    sujets, { supprimer: [], gloser: {}, lectures: { "明ける": "あく" } });
  expect(out[0]["jlpt:reading"]).toBe("あける");
  expect(lectures).toEqual([]);
  expect(conflits).toEqual(["明ける"]);
});

test("applyPurge refuse une correction qui n'est pas elle-même du kana", () => {
  const sujets = [mot("差", { "jlpt:reading": "さ / ちがい", "schema:description": "différence" })];
  const { sujets: out, lectures } = applyPurge(
    sujets, { supprimer: [], gloser: {}, lectures: { "差": "さ / ちがい (au choix)" } });
  expect(out[0]["jlpt:reading"]).toBe("さ / ちがい");
  expect(lectures).toEqual([]);
});

test("applyPurge est idempotent sur les corrections de lecture", () => {
  const sujets = [mot("最大", { "jlpt:reading": "さいだい / さいしょう", "schema:description": "maximum" })];
  const dec = { supprimer: [], gloser: {}, lectures: { "最大": "さいだい" } };
  const un = applyPurge(sujets, dec);
  const deux = applyPurge(un.sujets, dec);
  expect(deux.sujets).toEqual(un.sujets);
  expect(deux.lectures).toEqual([]);
  expect(deux.conflits).toEqual([]); // déjà corrigé n'est pas un conflit
});

test("applyPurge signale une décision qui ne vise aucune entrée", () => {
  const { retires, inconnus } = applyPurge([mot("約束")], { supprimer: ["jlpt:word/absent"], gloser: {} });
  expect(retires).toEqual([]);
  expect(inconnus).toEqual(["jlpt:word/absent"]);
});

test("applyPurge ne touche pas aux sujets qui ne sont pas des mots", () => {
  const kanji = { "@id": "jlpt:word/約速", "@type": "jlpt:Kanji", "schema:name": "約速" };
  const { sujets: out, retires } = applyPurge([kanji], DECISION);
  expect(out).toEqual([kanji]);
  expect(retires).toEqual([]);
});
