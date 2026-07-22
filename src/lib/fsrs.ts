/**
 * FSRS-4.5 — courbe d'oubli par entité (stabilité, difficulté).
 *
 * Modèle de rappel espacé moderne (celui d'Anki). Chaque entité porte un état
 * `[stabilité, difficulté, dernierJour]` ; une révision le met à jour depuis le grade et le
 * temps écoulé. « Dû » = rétrievabilité sous la rétention cible (0,9).
 *
 * ⚠ Mode BINAIRE : le quiz ne produit que juste/faux → `Good(3)` / `Again(1)`. Les branches
 * Hard(2)/Easy(4) (poids w15/w16) ne se déclenchent jamais — conservées pour rester fidèle aux
 * 17 poids publiés.
 *
 * ⚠ Les 17 poids par défaut proviennent de la référence FSRS-4.5 publiée (Open Spaced
 * Repetition / ts-fsrs), reproduits verbatim. NE PAS les modifier : les tests d'invariant
 * (R(S,S)=0.9) valident la transposition des FORMULES, pas ces constantes.
 *
 * Module PUR : `today` est toujours injecté, jamais lu d'une horloge.
 */

/** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. En binaire, seuls 1 et 3 sont émis. */
export type Grade = 1 | 2 | 3 | 4;

/** État de mémoire d'une entité : `[stabilité (jours), difficulté (1..10), dernier jour]`. */
export type Fsrs = [number, number, number];

// Poids par défaut FSRS-4.5 (17), verbatim de la référence publiée.
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // garantit R(S, S) = 0.9
const S_MIN = 0.01;
const clampD = (d: number) => Math.min(10, Math.max(1, d));

/** Difficulté initiale pour le grade « Good » — cible de la réversion à la moyenne. */
const D0_GOOD = W[4];

/** Rétrievabilité après `t` jours pour une stabilité `s`. */
function r(t: number, s: number): number {
  return Math.pow(1 + FACTOR * (t / s), DECAY);
}

export function retrievability(state: Fsrs, today: number): number {
  const t = Math.max(0, today - state[2]);
  return r(t, state[0]);
}

export function isDue(state: Fsrs, today: number, retention = 0.9): boolean {
  return retrievability(state, today) < retention;
}

export function fsrsInit(grade: Grade, today: number): Fsrs {
  const s = Math.max(S_MIN, W[grade - 1]);           // S0(G) = w_{G-1}
  const d = clampD(W[4] - (grade - 3) * W[5]);        // D0(G) = w4 - (G-3)*w5
  return [s, d, today];
}

export function fsrsReview(state: Fsrs, grade: Grade, today: number): Fsrs {
  const [s, d] = state;
  const t = Math.max(0, today - state[2]);
  const rr = r(t, s);
  // Difficulté suivante, avec réversion à la moyenne vers D0(Good).
  const dNext = clampD(W[7] * D0_GOOD + (1 - W[7]) * (d - W[6] * (grade - 3)));
  let sNext: number;
  if (grade === 1) {
    // Post-lapse : la stabilité retombe.
    sNext = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - rr));
  } else {
    const hard = grade === 2 ? W[15] : 1;
    const easy = grade === 4 ? W[16] : 1;
    sNext = s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - rr)) - 1) * hard * easy + 1);
  }
  return [Math.max(S_MIN, sNext), dNext, today];
}
