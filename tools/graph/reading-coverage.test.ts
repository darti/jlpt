import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Cliquet de couverture des lectures. Pas un unit-test d'un outil : une MESURE sur le graphe
 * livré, pour qu'une régression silencieuse (chaîne `readings.mjs` cassée, purge malheureuse,
 * import qui écrase des lectures) échoue en CI. Seuils calés JUSTE sous le réel — à REMONTER dès
 * qu'on comble le trou, sinon le cliquet cesse de garder (cf. gotcha « test de mesure », CLAUDE.md).
 */
const graph = (f: string): Record<string, unknown>[] => {
  const doc = JSON.parse(readFileSync(`data/graph/${f}`, "utf8"));
  return (doc["@graph"] ?? []) as Record<string, unknown>[];
};
const KANA = /^[ぁ-ゖァ-ヶー・]+$/;
const hasKanji = (s: string): boolean => /[一-鿿々]/.test(s);

test("couverture : ≥ 95 % des mots À KANJI portent une lecture kana", () => {
  const words = graph("word.jsonld").filter((n) => String(n["@type"] ?? "").includes("Word"));
  const aKanji = words.filter((w) => hasKanji(String(w["schema:name"] ?? "")));
  const avec = aKanji.filter((w) => {
    const r = w["jlpt:reading"];
    return typeof r === "string" && KANA.test(r);
  });
  const ratio = avec.length / aKanji.length;
  // Actuel ~95,8 %. Le reste (~172) = entrées MONO-KANJI dont la lecture de « mot » est ambiguë
  // (別 = べつ/わかれ selon l'emploi) ET déjà portée par kanji.jsonld → volontairement non comblé
  // (l'arbitrage manuel n'étant pas praticable). Un plancher à 0,95 attrape une VRAIE perte.
  expect(ratio).toBeGreaterThanOrEqual(0.95);
});

test("couverture : AUCUN kanji sans lecture on NI kun (invariant — le trou est comblé)", () => {
  // 4 kanji sont kun-SEULS (kanji « nationaux » 和製 sans lecture on, ex. 峠) — c'est légitime.
  // L'invariant est donc « au moins UNE lecture », pas « une lecture on ».
  const has = (v: unknown): boolean => v != null && (Array.isArray(v) ? v.length > 0 : String(v).length > 0);
  const kanji = graph("kanji.jsonld").filter((n) => String(n["@type"] ?? "").includes("Kanji"));
  const sansLecture = kanji.filter((k) => !has(k["jlpt:onReading"]) && !has(k["jlpt:kunReading"]));
  expect(sansLecture.length).toBe(0);
});
