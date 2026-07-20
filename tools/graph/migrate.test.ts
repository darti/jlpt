import { test, expect } from "bun:test";
import { slugify, toHiragana, resolveReading } from "../migrate-to-graph.mjs";

test("slugify produit une IRI sûre depuis une forme de grammaire", () => {
  expect(slugify("〜ようだ / 〜みたいだ")).toBe("ようだ-みたいだ");
  expect(slugify("〜たら")).toBe("たら");
});

test("slugify n'émet jamais de séquence interdite par Oku", () => {
  for (const s of ["a--b", "a;b", "a'b", "a\\b", "a/*b", "a  b"]) {
    const out = slugify(s);
    for (const bad of ["--", ";", "'", "\\", "/*", " "]) expect(out.includes(bad)).toBe(false);
  }
});

test("toHiragana replie les katakana sans toucher au reste", () => {
  expect(toHiragana("カイ")).toBe("かい");
  expect(toHiragana("えいきょう")).toBe("えいきょう");
  expect(toHiragana("コーヒー")).toBe("こーひー"); // l'allongement ー est conservé
});

test("resolveReading : la lecture d'auteur l'emporte sur le dictionnaire miné", () => {
  const r = resolveReading("嫌", { author: "いや", dict: "きら" });
  expect(r.reading).toBe("いや");
  expect(r.conflict).toBe(true);
});

test("resolveReading : sans lecture d'auteur, le dictionnaire sert s'il est propre", () => {
  expect(resolveReading("影響", { author: null, dict: "えいきょう" }).reading).toBe("えいきょう");
});

test("resolveReading convertit une lecture de mot en katakana vers l'hiragana", () => {
  // 138 entrées de dict.json sont en katakana pur : rendues telles quelles, elles
  // produiraient des furigana en katakana (階【カイ】) là où 3024 sont en hiragana.
  expect(resolveReading("階", { author: null, dict: "カイ" }).reading).toBe("かい");
});

test("resolveReading : un dictionnaire suspect sans auteur n'est PAS tranché", () => {
  const r = resolveReading("安全", { author: null, dict: "あんぜん / きけん" });
  expect(r.reading).toBeNull();
  expect(r.needsArbitration).toBe(true);
});

test("resolveReading : ni auteur ni dico → pas de lecture, pas d'arbitrage", () => {
  const r = resolveReading("謎", { author: null, dict: null });
  expect(r.reading).toBeNull();
  expect(r.needsArbitration).toBe(false);
});

// --- ce que dict.json contient et qui n'est PAS un mot -------------------------

import { buildEntities } from "../migrate-to-graph.mjs";

test("buildEntities n'importe pas les motifs grammaticaux comme des mots", () => {
  // dict.json est un fourre-tout : 161 de ses entrées sont des motifs (« 〜うちに »,
  // « お〜する »), dont 129 sont déjà des GrammarPoint. Les importer comme Word
  // recréerait la duplication que ce graphe doit supprimer.
  const { word, gram, ecartes } = buildEntities();
  const motifs = word.filter((w) => /[〜～／]/.test(w["schema:name"]));
  expect(motifs).toEqual([]);
  expect(ecartes).toBeGreaterThan(100);
  expect(gram.length).toBeGreaterThan(300);
});

test("buildEntities produit des @id uniques par type", () => {
  const { kanji, word, gram } = buildEntities();
  for (const [nom, liste] of [["kanji", kanji], ["word", word], ["gram", gram]] as const) {
    const ids = liste.map((s) => s["@id"]);
    expect(new Set(ids).size, `doublon d'@id dans ${nom}`).toBe(ids.length);
  }
});

// --- extraction des arêtes depuis l'ancien format -------------------------------

import { subjectOf, gramFormOf } from "../migrate-to-graph.mjs";

test("subjectOf extrait le sujet testé d'un énoncé 「…」", () => {
  expect(subjectOf({ q: "「政治」の読み方は？" })).toBe("政治");
});

test("subjectOf rend null quand l'énoncé n'a pas de 「…」", () => {
  expect(subjectOf({ q: "家に帰っ___、電話します。" })).toBeNull();
});

test("gramFormOf lit la forme du premier <b> du corrigé", () => {
  expect(gramFormOf({ e: "<b>〜たら</b> = « quand »." })).toBe("〜たら");
});

test("gramFormOf ignore le balisage imbriqué", () => {
  expect(gramFormOf({ e: "<b><i>〜ば</i></b> …" })).toBe("〜ば");
});

test("gramFormOf rend null sans <b>", () => {
  expect(gramFormOf({ e: "pas de forme en gras" })).toBeNull();
});

// --- corrections de contenu ----------------------------------------------------

import { applyFixes, isDropped, buildQuestions } from "../migrate-to-graph.mjs";

test("applyFixes remplace l'option dupliquée de la question 1381", () => {
  const q = { q: "「七月」の読み方は？", o: ["しちがつ", "なながつ", "しちげつ", "なながつ"], a: 0, cat: "kanji", d: 1 };
  const out = applyFixes(q, 1381);
  expect(new Set(out.o).size).toBe(4);
  expect(out.o[out.a]).toBe("しちがつ");
});

test("applyFixes désambiguïse les deux énoncés d'une paire homophone", () => {
  const a = applyFixes({ q: "「いる」を漢字で書くと？", o: ["居る", "要る"], a: 0, cat: "vocabulaire", d: 2 }, 5884);
  const b = applyFixes({ q: "「いる」を漢字で書くと？", o: ["居る", "要る"], a: 1, cat: "vocabulaire", d: 2 }, 5886);
  expect(a.q).not.toBe(b.q);
  expect(a.q).toContain("いる");
});

test("applyFixes laisse intacte une question non listée", () => {
  const q = { q: "x", o: ["a", "b"], a: 0, cat: "kanji", d: 1 };
  expect(applyFixes(q, 42)).toEqual(q);
});

test("isDropped n'écarte que les trois doublons purs inter-catégories", () => {
  for (const ord of [4530, 4696, 5108]) expect(isDropped(ord)).toBe(true);
  expect(isDropped(4531)).toBe(false);
});

test("buildQuestions réattribue des ordinaux denses malgré les questions écartées", () => {
  // Une suppression laisserait sinon un trou, et checkCorpus refuse les ordinaux non denses.
  const { bySkill, total } = buildQuestions({ kanji: [], word: [], gram: [] });
  const ords = Object.values(bySkill).flat().map((q) => q["jlpt:ord"]).sort((a, b) => a - b);
  expect(ords).toHaveLength(total);
  expect(ords[0]).toBe(0);
  expect(ords[ords.length - 1]).toBe(total - 1);
  expect(new Set(ords).size).toBe(total);
});

// --- ordinaux groupés : le corpus tient en cinq intervalles -------------------

import { buildCorpus } from "../migrate-to-graph.mjs";

test("buildQuestions groupe les ordinaux par compétence, sans trou", () => {
  const { bySkill, total } = buildQuestions({ kanji: [], word: [], gram: [] });
  let attendu = 0;
  for (const skill of ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"]) {
    const ords = bySkill[skill].map((q) => q["jlpt:ord"]);
    expect(ords[0]).toBe(attendu);                        // contigu avec la précédente
    expect(ords).toEqual(ords.map((_, i) => attendu + i)); // et dense à l'intérieur
    attendu += ords.length;
  }
  expect(attendu).toBe(total);
});

test("buildCorpus décrit exactement les intervalles produits", () => {
  const { bySkill } = buildQuestions({ kanji: [], word: [], gram: [] });
  const corpus = buildCorpus(bySkill);
  expect(corpus).toHaveLength(5);
  for (const r of corpus) {
    const qs = bySkill[r["jlpt:skill"]];
    expect(r["jlpt:count"]).toBe(qs.length);
    expect(r["jlpt:from"]).toBe(qs[0]["jlpt:ord"]);
  }
});

// --- leçons : le cours ORDONNE, il ne recopie plus ------------------------------

import { lessonId, buildLessons } from "../migrate-to-graph.mjs";

test("lessonId préfixe la piste pour éviter les collisions entre cours", () => {
  expect(lessonId("gram", "conditionnel")).toBe("jlpt:lesson/gram-conditionnel");
  expect(lessonId("vocab", "conditionnel")).toBe("jlpt:lesson/vocab-conditionnel");
});

test("buildLessons produit des leçons qui POINTENT au lieu de recopier", () => {
  const entites = buildEntities();
  const { lessons } = buildLessons(entites);
  expect(lessons.length).toBeGreaterThan(20);
  const connus = new Set([...entites.kanji, ...entites.word, ...entites.gram].map((s) => s["@id"]));
  for (const l of lessons) {
    // Aucune leçon ne porte de mot, de lecture ni de sens : ce sont des entités.
    expect(Object.keys(l).some((k) => /reading|description|form\b/.test(k))).toBe(false);
    for (const iri of l.covers ?? []) expect(connus.has(iri)).toBe(true);
  }
});

test("buildLessons ordonne les notions dans une leçon (covers est une @list)", () => {
  const { lessons } = buildLessons(buildEntities());
  const avecPlusieurs = lessons.find((l) => (l.covers ?? []).length > 1);
  expect(Array.isArray(avecPlusieurs.covers)).toBe(true);
  expect(avecPlusieurs["jlpt:order"]).toBeGreaterThanOrEqual(0);
});

test("buildLessons relie les trois pistes, chacune sur SON champ d'item", () => {
  // Régression : le champ diffère par piste (mot / kanji / form). Réutiliser « mot »
  // pour les kanji reliait 0 item sur 551, sans erreur — un taux nul est un bug.
  const { lessons } = buildLessons(buildEntities());
  for (const track of ["gram", "vocab", "kanji"]) {
    const relies = lessons.filter((l) => l["jlpt:track"] === track)
      .reduce((n, l) => n + (l.covers ?? []).length, 0);
    expect(relies, `piste ${track} : aucun item relié`).toBeGreaterThan(0);
  }
});
