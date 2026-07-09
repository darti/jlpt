import { test, expect } from "bun:test";
import { readProgress } from "./storage.ts";

const fake = (v: string | null) => ({ getItem: (_k: string) => v });

test("reads a valid progress blob", () => {
  const raw = JSON.stringify({ total: 12, skill: { grammaire: { R: 1600 }, vocabulaire: { R: 1500 }, kanji: { R: 1550 }, lecture: { R: 1620 } } });
  const p = readProgress(fake(raw));
  expect(p?.total).toBe(12);
  expect(p?.skill.lecture?.R).toBe(1620);
});

test("returns null when absent", () => {
  expect(readProgress(fake(null))).toBeNull();
});

test("returns null on malformed JSON", () => {
  expect(readProgress(fake("{not json"))).toBeNull();
});

test("returns the blob even with incomplete skill data (progress.js defaults missing skills)", () => {
  const raw = JSON.stringify({ total: 5, skill: { grammaire: { R: 1600 } } });
  const p = readProgress(fake(raw));
  expect(p?.total).toBe(5);
  expect(p?.skill.grammaire?.R).toBe(1600);
});

test("returns null when getItem throws", () => {
  const badStore = { getItem: () => { throw new Error("storage error"); } };
  expect(readProgress(badStore)).toBeNull();
});
