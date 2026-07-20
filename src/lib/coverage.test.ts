import { test, expect } from "bun:test";
import {
  emptyBits, setBit, hasBit, encodeBits, decodeBits, coverageBySkill, countUnseen,
} from "./coverage.ts";
import type { Skill } from "../types/progress.ts";

test("setBit/hasBit round-trip including growth beyond current capacity", () => {
  let b = emptyBits();
  b = setBit(b, 3);
  b = setBit(b, 10000); // forces the array to grow
  expect(hasBit(b, 3)).toBe(true);
  expect(hasBit(b, 10000)).toBe(true);
  expect(hasBit(b, 4)).toBe(false);
  expect(hasBit(b, 99999)).toBe(false); // out of range → false, no throw
});

test("encodeBits then decodeBits preserves every set bit", () => {
  let b = emptyBits();
  const ids = [0, 7, 8, 255, 4406];
  for (const id of ids) b = setBit(b, id);
  const round = decodeBits(encodeBits(b));
  for (const id of ids) expect(hasBit(round, id)).toBe(true);
});

test("decodeBits is best-effort on empty and garbage input", () => {
  expect(hasBit(decodeBits(""), 0)).toBe(false);
  expect(hasBit(decodeBits("@@@ not base64 @@@"), 0)).toBe(false);
});

test("coverageBySkill compte vu/appris par compétence via les intervalles", () => {
  const ranges = [
    { skill: "grammaire" as const, from: 0, count: 2 },
    { skill: "kanji" as const, from: 2, count: 2 },
  ];
  let seen = emptyBits(); seen = setBit(seen, 0); seen = setBit(seen, 2);
  let mastered = emptyBits(); mastered = setBit(mastered, 0);
  const c = coverageBySkill(seen, mastered, ranges);
  expect(c.grammaire).toEqual({ seen: 50, mastered: 50, seenN: 1, masteredN: 1, total: 2 });
  expect(c.kanji.seenN).toBe(1);
  expect(c.kanji.masteredN).toBe(0);
});

test("coverageBySkill rend 0 % sur un intervalle vide sans diviser par zéro", () => {
  const c = coverageBySkill(emptyBits(), emptyBits(), [{ skill: "ecoute", from: 0, count: 0 }]);
  expect(c.ecoute).toEqual({ seen: 0, mastered: 0, seenN: 0, masteredN: 0, total: 0 });
});

test("countUnseen compte les ordinaux du corpus dont le bit seen est absent", () => {
  const ranges = [{ skill: "kanji" as const, from: 0, count: 4 }];
  let seen = emptyBits(); seen = setBit(seen, 1);
  expect(countUnseen(seen, ranges)).toBe(3);
});

test("countUnseen ignore les bits vus hors du corpus", () => {
  // Un bit posé au-delà des intervalles (corpus rétréci depuis) ne doit pas se soustraire
  // du décompte : seuls les ordinaux réellement décrits comptent.
  const ranges = [{ skill: "kanji" as const, from: 0, count: 2 }];
  const seen = setBit(emptyBits(), 99);
  expect(countUnseen(seen, ranges)).toBe(2);
});
