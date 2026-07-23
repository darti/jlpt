import { test, expect } from "bun:test";
import { isPureKana, normalizeKana, checkReading, isProductionEligible } from "./kana.ts";
import type { Question } from "../types/quiz.ts";

test("isPureKana : hiragana/katakana/ー oui, kanji/espace/latin non", () => {
  expect(isPureKana("やくそく")).toBe(true);
  expect(isPureKana("ヤクソク")).toBe(true);
  expect(isPureKana("コーヒー")).toBe(true);
  expect(isPureKana("ヴァイオリン")).toBe(true); // ヴ/petits kana : même bloc que normalizeKana
  expect(isPureKana("約束")).toBe(false);
  expect(isPureKana("やく そく")).toBe(false);
  expect(isPureKana("abc")).toBe(false);
  expect(isPureKana("")).toBe(false);
});

test("normalizeKana : trim, katakana→hiragana, retrait espaces/・, ー conservé", () => {
  expect(normalizeKana("  やくそく ")).toBe("やくそく");
  expect(normalizeKana("ヤクソク")).toBe("やくそく");
  expect(normalizeKana("や く そ く")).toBe("やくそく");
  expect(normalizeKana("コーヒー")).toBe("こーひー");
  expect(normalizeKana("サ・シ")).toBe("さし");
});

test("checkReading : exact après normalisation", () => {
  expect(checkReading("やくそく", "やくそく")).toBe(true);
  expect(checkReading("ヤクソク", "やくそく")).toBe(true);
  expect(checkReading(" やくそく ", "やくそく")).toBe(true);
  expect(checkReading("やくそぐ", "やくそく")).toBe(false);
  expect(checkReading("", "やくそく")).toBe(false);
  expect(checkReading("なにか", "")).toBe(false);
});

const q = (over: Partial<Question>): Question => ({ id: 1, cat: "vocabulaire", d: 1, q: "…", o: ["やくそく", "X", "Y", "Z"], a: 0, ...over });

test("isProductionEligible : vocab/kanji à réponse kana oui, sinon non", () => {
  expect(isProductionEligible(q({}))).toBe(true);
  expect(isProductionEligible(q({ cat: "kanji" }))).toBe(true);
  expect(isProductionEligible(q({ o: ["約束", "X", "Y", "Z"], a: 0 }))).toBe(false);
  expect(isProductionEligible(q({ cat: "grammaire" }))).toBe(false);
  expect(isProductionEligible(q({ cat: "ecoute" }))).toBe(false);
  expect(isProductionEligible(q({ cat: "lecture" }))).toBe(false);
});
