import { test, expect } from "bun:test";
import { dailyGoal, emptyCadence, streakOf, recordMastery, recordAnswer, cadenceModel, TOTAL_QUESTIONS } from "./cadence.ts";
import { setBit, emptyBits } from "./coverage.ts";
import { readdirSync, readFileSync } from "node:fs";

test("dailyGoal = rythme requis, arrondi au supérieur", () => {
  // cible 70 % de 10351 = 7246 ; 0 appris, 134 jours → ⌈7246/134⌉ = 55
  expect(dailyGoal(0, 134)).toBe(55);
});

test("dailyGoal borné à 0 quand la cible est atteinte", () => {
  expect(dailyGoal(TOTAL_QUESTIONS, 134)).toBe(0); // 100 % appris > cible
});

test("dailyGoal = 0 quand l'examen est passé (daysLeft ≤ 0)", () => {
  expect(dailyGoal(0, 0)).toBe(0);
});

test("emptyCadence est un journal vierge", () => {
  expect(emptyCadence()).toEqual({ byDay: {}, goalByDay: {}, best: 0 });
});

test("recordMastery gèle l'objectif du jour puis incrémente le journal", () => {
  const c0 = emptyCadence();
  const c1 = recordMastery(c0, 5, 3);      // jour 5, objectif 3
  expect(c1.byDay[5]).toBe(1);
  expect(c1.goalByDay[5]).toBe(3);
  const c2 = recordMastery(c1, 5, 999);    // même jour : objectif NE change PAS (gelé)
  expect(c2.byDay[5]).toBe(2);
  expect(c2.goalByDay[5]).toBe(3);
  expect(c0.byDay[5]).toBeUndefined();     // pureté : c0 intact
});

test("streakOf compte les jours consécutifs atteints, un trou casse", () => {
  let c = emptyCadence();
  // jours 3,4,5 atteints (objectif 1, une maîtrise chacun), jour 6 non ouvert
  c = recordMastery(c, 3, 1);
  c = recordMastery(c, 4, 1);
  c = recordMastery(c, 5, 1);
  expect(streakOf(c, 5)).toBe(3);          // aujourd'hui = 5, atteint
  expect(streakOf(c, 6)).toBe(3);          // aujourd'hui = 6 pas encore atteint → série vivante = le run 3-4-5
  expect(streakOf(c, 7)).toBe(0);          // jour 6 manqué → cassée
});

test("un jour ouvert mais objectif non atteint ne compte pas", () => {
  let c = emptyCadence();
  c = recordMastery(c, 3, 5); // objectif 5, une seule maîtrise → non atteint
  expect(streakOf(c, 3)).toBe(0);
  expect(c.best).toBe(0);
});

test("best suit le pic de série", () => {
  let c = emptyCadence();
  c = recordMastery(c, 1, 1);
  c = recordMastery(c, 2, 1);
  expect(c.best).toBe(2);
  c = recordMastery(c, 4, 1); // trou en 3
  expect(streakOf(c, 4)).toBe(1);
  expect(c.best).toBe(2);     // record conservé
});

test("recordAnswer n'enregistre que sur une nouvelle maîtrise", () => {
  const c0 = emptyCadence();
  const prev = emptyBits();
  const bad = recordAnswer(c0, prev, 42, false, 5, 134); // mauvaise réponse
  expect(bad).toBe(c0);                                   // même référence : rien écrit
  const already = recordAnswer(c0, setBit(emptyBits(), 42), 42, true, 5, 134); // déjà maîtrisée
  expect(already).toBe(c0);
  const learned = recordAnswer(c0, prev, 42, true, 5, 134); // 1re bonne réponse
  expect(learned.byDay[5]).toBe(1);
  expect(learned.goalByDay[5]).toBe(55);                  // objectif gelé (0 appris, 134 j)
});

test("recordAnswer ne trace plus rien après l'examen (daysLeft ≤ 0)", () => {
  const c0 = emptyCadence();
  // Post-examen : plus de cadence — évite des jours à objectif 0 qui « atteignent » toujours
  // et gonfleraient le record en silence.
  expect(recordAnswer(c0, emptyBits(), 42, true, 5, 0)).toBe(c0);
});

test("cadenceModel : objectif gelé du jour, progrès, série, cible/examen", () => {
  let c = emptyCadence();
  c = recordMastery(c, 10, 54);
  // masteredNow=1000 sépare le gelé (54) du live (dailyGoal(1000,134)=⌈6246/134⌉=47) :
  // ainsi l'assertion prouve VRAIMENT que l'objectif affiché est le gelé, pas le recalculé.
  const m = cadenceModel(c, 1000, 134, 10);
  expect(m.goal).toBe(54);        // gelé (54), et NON le live (47) — l'objectif ne dérive pas en cours de journée
  expect(m.done).toBe(1);
  expect(m.daysLeft).toBe(134);
  expect(m.reached).toBe(false);
  // cible atteinte → reached
  expect(cadenceModel(emptyCadence(), TOTAL_QUESTIONS, 134, 10).reached).toBe(true);
});

test("garde-fou de mesure : TOTAL_QUESTIONS = taille réelle du corpus", () => {
  let n = 0;
  for (const f of readdirSync("data/graph")) {
    if (!/^q-.*\.jsonld$/.test(f)) continue;
    const doc = JSON.parse(readFileSync(`data/graph/${f}`, "utf8"));
    const arr = Array.isArray(doc) ? doc : (Array.isArray(doc["@graph"]) ? doc["@graph"] : []);
    n += arr.filter((e: Record<string, unknown>) => String(e["@type"] ?? "").includes("Question")).length;
  }
  expect(n).toBe(TOTAL_QUESTIONS); // échoue si le corpus grandit → remonter la constante
});
