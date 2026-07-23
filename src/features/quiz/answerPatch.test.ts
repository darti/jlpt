import { test, expect } from "bun:test";
import { answerPatch } from "./useQuiz.ts";
import type { Question } from "../../types/quiz.ts";

const q: Question = { id: 5, cat: "vocabulaire", d: 2, q: "…", o: ["やくそく", "X", "Y", "Z"], a: 0, tests: ["jlpt:word/約束"] };
const RAW = null; // progression vierge

test("réponse juste : right +1, bit mastered posé, pas de wrong", () => {
  const p = answerPatch(RAW, q, true, 0, 100, 1_000, false);
  expect(p.right).toBe(1);
  expect(p.total).toBe(1);
  expect(Array.isArray(p.wrong) ? (p.wrong as number[]) : []).not.toContain(5);
  expect(typeof p.mastered).toBe("string");
});

test("réponse fausse en QCM (chosen index) : wrong contient l'id ET confusions présent", () => {
  const p = answerPatch(RAW, q, false, 1, 100, 1_000, false);
  expect((p.wrong as number[])).toContain(5);
  expect(p.right).toBe(0);
  expect(p.mastered).toBeUndefined();
  expect(p).toHaveProperty("confusions"); // un distracteur a été coché → arête de confusion
});

test("réponse fausse en PRODUCTION (chosen null) : wrong présent mais AUCUN confusions", () => {
  const p = answerPatch(RAW, q, false, null, 100, 1_000, false);
  expect((p.wrong as number[])).toContain(5);
  expect(p).not.toHaveProperty("confusions"); // rappel ≠ reconnaissance : pas de graphe de confusion
});

test("réponse juste en production (chosen = index correct) : pas de confusions non plus", () => {
  const p = answerPatch(RAW, q, true, 0, 100, 1_000, false);
  expect(p).not.toHaveProperty("confusions"); // confusionPatch ne pose rien sur une bonne réponse
});

test("dernière du diagnostic : diagAt = nowMs", () => {
  const p = answerPatch(RAW, q, true, 0, 100, 42_000, true);
  expect(p.diagAt).toBe(42_000);
});

test("production correcte → la carte FSRS de l'entité testée est plus stable qu'en QCM (Easy > Good)", () => {
  const stab = (patch: Record<string, unknown>) =>
    (patch.fsrs as Record<string, [number, number, number]>)["jlpt:word/約束"][0];
  const prod = answerPatch(RAW, q, true, 0, 100, 1_000, false, true);  // production=true
  const qcm = answerPatch(RAW, q, true, 0, 100, 1_000, false, false);  // QCM
  expect(stab(prod)).toBeGreaterThan(stab(qcm)); // intervalle de révision plus long
});
