import { test, expect } from "bun:test";
import type { Progress } from "../types/progress.ts";
import { masteryOf, displayMastery, dashboardModel, daysUntilExam, passTier, prescriptiveWeights } from "./scoring.ts";

const flat = (R: number, total: number, ecouteT = 0): Progress => ({
  total,
  skill: {
    grammaire: { R, t: total },
    vocabulaire: { R, t: total },
    kanji: { R, t: total },
    lecture: { R, t: total },
    ecoute: { R, t: ecouteT },
  },
});

test("masteryOf at the pass rating is 0.5", () => {
  expect(masteryOf(flat(1600, 60), "grammaire")).toBeCloseTo(0.5, 10);
});

test("displayMastery with t=0 equals the blank-skill masteryOf (no discontinuity)", () => {
  const p: Progress = { total: 0, skill: {} };
  expect(displayMastery(p, "vocabulaire")).toBeCloseTo(masteryOf(p, "vocabulaire"), 10);
});

test("displayMastery is shrunk below raw when R is high but t is small", () => {
  const p: Progress = { total: 8, skill: { vocabulaire: { R: 1800, t: 8 } } };
  expect(displayMastery(p, "vocabulaire")).toBeLessThan(masteryOf(p, "vocabulaire"));
});

test("displayMastery converges toward raw as t grows", () => {
  const lo: Progress = { total: 5, skill: { kanji: { R: 1800, t: 5 } } };
  const hi: Progress = { total: 500, skill: { kanji: { R: 1800, t: 500 } } };
  const raw = masteryOf(hi, "kanji");
  const dLo = Math.abs(displayMastery(lo, "kanji") - raw);
  const dHi = Math.abs(displayMastery(hi, "kanji") - raw);
  expect(dHi).toBeLessThan(dLo);
});

test("dashboardModel for all-1600 / 60 answers, estimated listening (ecoute.t<3)", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  expect(m.answers).toBe(60);
  expect(m.passPct).toBe(17);
  expect(m.sectionTotal).toBe(86);
  expect(m.level).toBe("N3-");
  expect(m.confidence).toBeCloseTo(1, 10);
  // barMastery uses displayMastery: R=1600,t=60 shrinks toward the 1450 prior → 47 (not raw 50).
  expect(m.barMastery.kanji).toBe(47);
  expect(m.hasEnough).toBe(true);
});

test("dashboardModel switches to measured listening once ecoute.t>=3", () => {
  const m = dashboardModel(flat(1600, 60, 60), new Date("2026-07-10T00:00:00"));
  // measured listening = masteryOf(ecoute) = 0.5, vs. estimated 0.85*0.5 = 0.425 above,
  // so the section/total/pass% differ from the estimated-listening fixture.
  expect(m.sectionTotal).toBe(90);
  expect(m.passPct).toBe(27);
});

test("hasEnough is false under 5 answers", () => {
  expect(dashboardModel(flat(1600, 3), new Date("2026-07-10T00:00:00")).hasEnough).toBe(false);
});

test("daysUntilExam counts down and floors at 0", () => {
  expect(daysUntilExam(new Date("2026-07-10T00:00:00"))).toBe(150);
  expect(daysUntilExam(new Date("2027-01-01T00:00:00"))).toBe(0);
});

test("passTier thresholds match legacy pct>=70/40 buckets", () => {
  expect(passTier(70)).toBe("ok");
  expect(passTier(40)).toBe("warn");
  expect(passTier(39)).toBe("bad");
});

// Construit une progression avec un R par compétence (t=10 par défaut → écoute mesurée).
const prog = (R: Partial<Record<string, number>>, tEcoute = 10): Progress => ({
  total: 100,
  skill: {
    vocabulaire: { R: R.vocabulaire ?? 1600, t: 10 },
    kanji: { R: R.kanji ?? 1600, t: 10 },
    grammaire: { R: R.grammaire ?? 1600, t: 10 },
    lecture: { R: R.lecture ?? 1600, t: 10 },
    ecoute: { R: R.ecoute ?? 1600, t: tEcoute },
  } as Progress["skill"],
});

test("une section sous son minimum pèse PLUS qu'une section saturée (le cœur)", () => {
  // langage (vocab+kanji) très faible → sous le minimum sectionnel ; grammaire+lecture saturés.
  const w = prescriptiveWeights(prog({ vocabulaire: 1350, kanji: 1350, grammaire: 1950, lecture: 1950 }));
  expect(w.vocabulaire).toBeGreaterThan(w.grammaire);
  expect(w.kanji).toBeGreaterThan(w.lecture);
});

test("chaque poids reste dans [0.2, 1.5] et le max vaut exactement 1.5", () => {
  const w = prescriptiveWeights(prog({ vocabulaire: 1350, kanji: 1350, grammaire: 1950, lecture: 1950 }));
  for (const c of Object.keys(w)) {
    expect(w[c as keyof typeof w]).toBeGreaterThanOrEqual(0.2);
    expect(w[c as keyof typeof w]).toBeLessThanOrEqual(1.5 + 1e-9);
  }
  expect(Math.max(...Object.values(w))).toBeCloseTo(1.5, 9);
});

test("une compétence saturée est DÉ-priorisée (poids faible, sous une compétence au seuil)", () => {
  // écoute très forte (2000), les autres au seuil (1600) → écoute a la plus petite valeur.
  // ⚠ Une compétence MESURÉE n'atteint jamais EXACTEMENT 0.2 (sa valeur n'est pas nulle) — on
  // asserte donc la DÉ-priorisation relative, pas un plancher exact (ça, c'est l'écoute non mesurée).
  const w = prescriptiveWeights(prog({ ecoute: 2000 }));
  expect(w.ecoute).toBeLessThan(w.vocabulaire);
  expect(w.ecoute).toBeGreaterThan(0.2); // au-dessus du plancher : mesurée, valeur > 0
});

test("écoute t<3 (estimée) : poids = plancher EXACT (bootstrap), pas piloté par une valeur fausse", () => {
  const w = prescriptiveWeights(prog({}, 2)); // t_ecoute = 2 < 3
  expect(w.ecoute).toBeCloseTo(0.2, 9);
});

test("démarrage à froid (tous R=1450, t_ecoute<3) : 4 compétences à 1.5, écoute au plancher", () => {
  const cold = prescriptiveWeights(prog(
    { vocabulaire: 1450, kanji: 1450, grammaire: 1450, lecture: 1450, ecoute: 1450 }, 0,
  ));
  expect(cold.vocabulaire).toBeCloseTo(1.5, 6);
  expect(cold.kanji).toBeCloseTo(1.5, 6);
  expect(cold.grammaire).toBeCloseTo(1.5, 6);
  expect(cold.lecture).toBeCloseTo(1.5, 6);
  expect(cold.ecoute).toBeCloseTo(0.2, 6);
});

// Vecteur golden : un état fixe (R distincts par compétence) → les 5 poids figés. Verrou de
// non-régression. Les valeurs sont celles de l'implémentation validée au Step 1, et sont
// cross-validées en revue par une transcription indépendante des formules du § 2 (méthode FSRS).
test("vecteur golden : R distincts → 5 poids figés (verrou de régression)", () => {
  const w = prescriptiveWeights(prog({
    vocabulaire: 1500, kanji: 1600, grammaire: 1400, lecture: 1700, ecoute: 1550,
  }));
  expect(w.vocabulaire).toBeCloseTo(0.8067, 4);
  expect(w.kanji).toBeCloseTo(0.8583, 4);
  expect(w.grammaire).toBeCloseTo(0.6546, 4);
  expect(w.lecture).toBeCloseTo(0.7738, 4);
  expect(w.ecoute).toBeCloseTo(1.5, 4);
  // Ancres exactes indépendantes de l'arithmétique :
  expect(Math.max(...Object.values(w))).toBeCloseTo(1.5, 9); // normalisation
  expect(Math.min(...Object.values(w))).toBeGreaterThanOrEqual(0.2); // plancher
});
