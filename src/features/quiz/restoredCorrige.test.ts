import { test, expect } from "bun:test";
import { restoredCorrige, type ResumeState } from "./useQuiz.ts";

const base = { kind: "quiz" as const, ids: [1, 2, 3], qi: 1, right: 0, t: 0 };

test("QCM corrigé (chosen numérique) → rouvre le corrigé, option restaurée", () => {
  const r: ResumeState = { ...base, phase: "corrige", chosen: 2 };
  expect(restoredCorrige(r)).toEqual({ answered: true, chosen: 2 });
});

test("corrigé de production erronée (chosen absent) → rouvre le corrigé SANS re-répondre", () => {
  // Régression I2 : exiger un chosen numérique rouvrirait la question → recomptage Elo/FSRS/total.
  const r: ResumeState = { ...base, phase: "corrige" };
  expect(restoredCorrige(r)).toEqual({ answered: true, chosen: null });
});

test("reprise sur la question → ni answered ni chosen", () => {
  const r: ResumeState = { ...base, phase: "question" };
  expect(restoredCorrige(r)).toEqual({ answered: false, chosen: null });
});

test("vieux blob sans phase → question (compat)", () => {
  const r: ResumeState = { ...base };
  expect(restoredCorrige(r)).toEqual({ answered: false, chosen: null });
});
