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
