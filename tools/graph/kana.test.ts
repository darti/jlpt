import { test, expect } from "bun:test";
import { splitOnKun } from "./kana.mjs";

test("splitOnKun sépare les lectures on (katakana) des kun (hiragana)", () => {
  expect(splitOnKun("イ・くらい")).toEqual({ on: ["イ"], kun: ["くらい"] });
});

test("splitOnKun accepte plusieurs lectures de chaque type", () => {
  expect(splitOnKun("ユウ・やさ(しい)・すぐ(れる)")).toEqual({
    on: ["ユウ"], kun: ["やさ(しい)", "すぐ(れる)"],
  });
});

test("splitOnKun garde l'okurigana entre parenthèses avec sa lecture kun", () => {
  expect(splitOnKun("あたら(しい)")).toEqual({ on: [], kun: ["あたら(しい)"] });
});

test("splitOnKun sur une lecture on seule", () => {
  expect(splitOnKun("ザツ")).toEqual({ on: ["ザツ"], kun: [] });
});

test("splitOnKun rend deux listes vides sur une entrée vide ou absente", () => {
  expect(splitOnKun("")).toEqual({ on: [], kun: [] });
  expect(splitOnKun(undefined)).toEqual({ on: [], kun: [] });
});

test("splitOnKun ignore les segments vides d'un séparateur en trop", () => {
  expect(splitOnKun("イ・・くらい")).toEqual({ on: ["イ"], kun: ["くらい"] });
});
