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
