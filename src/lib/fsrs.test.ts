import { test, expect } from "bun:test";
import { fsrsInit, fsrsReview, retrievability, isDue, type Fsrs } from "./fsrs.ts";

// Les invariants de FSRS-4.5 sont des ancres exactes, indépendantes de toute arithmétique à la
// main : R(S,S)=0.9 par construction, R(0)=1, décroissance monotone. Ils prouvent la fidélité
// bien mieux qu'un nombre attendu recopié (qui figerait une éventuelle erreur de calcul).

test("R(0) = 1 : aucun temps écoulé, rappel certain", () => {
  const s: Fsrs = [10, 5, 100];
  expect(retrievability(s, 100)).toBeCloseTo(1, 10);
});

test("R(S, S) = 0.9 : rétention de 90 % après une durée = stabilité (contrainte FSRS)", () => {
  const s: Fsrs = [10, 5, 100];         // stabilité 10
  expect(retrievability(s, 110)).toBeCloseTo(0.9, 6); // écoulé = 10 = S
});

test("R décroît strictement avec le temps", () => {
  const s: Fsrs = [10, 5, 100];
  const r5 = retrievability(s, 105), r10 = retrievability(s, 110), r20 = retrievability(s, 120);
  expect(r5).toBeGreaterThan(r10);
  expect(r10).toBeGreaterThan(r20);
});

test("temps écoulé négatif (horloge/import) borné à 0 → R = 1, jamais NaN", () => {
  const s: Fsrs = [10, 5, 100];
  expect(retrievability(s, 90)).toBeCloseTo(1, 10);
});

test("isDue : dû quand R < 0.9 (au-delà de la stabilité), pas avant", () => {
  const s: Fsrs = [10, 5, 100];
  expect(isDue(s, 109)).toBe(false); // écoulé 9 < S → R > 0.9
  expect(isDue(s, 111)).toBe(true);  // écoulé 11 > S → R < 0.9
});

// Vecteurs de référence : valeurs INITIALES, calculables sans ambiguïté depuis les poids
// (S0 = poids brut, D0 = combinaison linéaire). Ils figent la transposition des formules d'init.
test("init Good(3) = [w2, w4, jour]", () => {
  expect(fsrsInit(3, 200)).toEqual([3.7145, 5.1618, 200]);
});

test("init Again(1) : D0 = w4 + 2·w5 (plus difficile), S0 = w0", () => {
  const [s, d, day] = fsrsInit(1, 200);
  expect(s).toBeCloseTo(0.4872, 6);
  expect(d).toBeCloseTo(5.1618 + 2 * 1.2298, 6); // 7.6214
  expect(day).toBe(200);
});

// Propriétés de la révision (le sens du modèle), sans figer un nombre calculé à la main.
test("succès après un délai : la stabilité CROÎT, la date avance", () => {
  const before: Fsrs = [10, 5, 100];
  const [sAfter, , dayAfter] = fsrsReview(before, 3, 130); // écoulé 30
  expect(sAfter).toBeGreaterThan(10);
  expect(dayAfter).toBe(130);
});

test("succès le MÊME jour (écoulé 0) : stabilité inchangée (e^0−1 = 0)", () => {
  const before: Fsrs = [10, 5, 100];
  const [sAfter] = fsrsReview(before, 3, 100);
  expect(sAfter).toBeCloseTo(10, 6);
});

test("échec : la difficulté augmente, et reste ≤ 10", () => {
  const before: Fsrs = [10, 5, 100];
  const [, dAfter] = fsrsReview(before, 1, 130);
  expect(dAfter).toBeGreaterThan(5);
  expect(dAfter).toBeLessThanOrEqual(10);
});

test("répétés Again : la difficulté sature à 10 sans dépasser", () => {
  let st: Fsrs = fsrsInit(1, 0);
  for (let i = 1; i <= 20; i++) st = fsrsReview(st, 1, i * 5);
  expect(st[1]).toBeLessThanOrEqual(10);
  expect(st[1]).toBeGreaterThan(9);
});

test("la stabilité ne descend jamais sous S_MIN", () => {
  const [s] = fsrsReview([0.02, 9, 100], 1, 101);
  expect(s).toBeGreaterThanOrEqual(0.01);
});
