import { test, expect } from "bun:test";
import { kanjiExempleJa } from "./coursSpeech.ts";

test("kanjiExempleJa extrait la tête japonaise avant la parenthèse romaji", () => {
  expect(kanjiExempleJa("過去 (kako) passé")).toBe("過去");
  expect(kanjiExempleJa("怒る (okoru) se fâcher")).toBe("怒る");
  expect(kanjiExempleJa("恥ずかしい (hazukashii) gêné")).toBe("恥ずかしい");
});

test("kanjiExempleJa gère une parenthèse pleine largeur （…）", () => {
  expect(kanjiExempleJa("過去（かこ）")).toBe("過去");
});

test("kanjiExempleJa renvoie le mot tel quel sans annotation", () => {
  expect(kanjiExempleJa("たべる")).toBe("たべる");
});

test("kanjiExempleJa renvoie une chaîne vide pour une entrée vide", () => {
  expect(kanjiExempleJa("")).toBe("");
});
