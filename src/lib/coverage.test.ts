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

test("coverageBySkill buckets denominators and numerators per skill", () => {
  const idx: Record<number, Skill> = { 0: "grammaire", 1: "grammaire", 2: "kanji" };
  let seen = emptyBits(); seen = setBit(seen, 0); seen = setBit(seen, 2);
  let mastered = emptyBits(); mastered = setBit(mastered, 0);
  const cov = coverageBySkill(seen, mastered, idx);
  expect(cov.grammaire).toEqual({ seen: 50, mastered: 50, seenN: 1, masteredN: 1, total: 2 });
  expect(cov.kanji).toEqual({ seen: 100, mastered: 0, seenN: 1, masteredN: 0, total: 1 });
});

test("countUnseen counts bank-index ids whose seen bit is 0", () => {
  const idx = { 1: "kanji", 2: "grammaire", 5: "kanji" } as Record<number, Skill>;
  expect(countUnseen(emptyBits(), idx)).toBe(3); // none seen
  let seen = setBit(emptyBits(), 2);
  seen = setBit(seen, 5);
  expect(countUnseen(seen, idx)).toBe(1); // only id 1 still unseen
  seen = setBit(setBit(setBit(emptyBits(), 1), 2), 5);
  expect(countUnseen(seen, idx)).toBe(0); // all seen
});

test("countUnseen ignores seen bits for ids not in the index", () => {
  const idx = { 3: "kanji" } as Record<number, Skill>;
  const seen = setBit(emptyBits(), 99); // 99 not in idx
  expect(countUnseen(seen, idx)).toBe(1); // id 3 still unseen
});
