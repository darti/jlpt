/**
 * Passage de paramètres hub → quiz par la query de l'URL (`?min=N`, `?resume=1`).
 *
 * Extrait de `useQuiz.ts` : c'est de l'analyse d'entrée, pure et testable seule, sans rapport
 * avec la machine à états. `sessionParams.test.ts` la testait déjà comme une unité distincte.
 */

/**
 * Résout la durée d'une session : un `minArg` numérique (passage par l'URL) gagne ; tout le
 * reste retombe sur l'état `minutes`.
 *
 * ⚠ La garde de type n'est pas décorative : `start` est câblé en `onStart={quiz.start}`, donc
 * React passe l'événement de clic en premier argument — sans elle, il partirait en NaN.
 */
export function resolveMinutes(minArg: unknown, minutes: number): number {
  return typeof minArg === "number" ? minArg : minutes;
}

/** Analyse pure des paramètres de session. `min` est borné à [1, 45] — le plafond
 *  qu'`allocate` applique de toute façon à une session. */
export function parseSessionParams(search: string): { min?: number; resume: boolean } {
  const p = new URLSearchParams(search);
  if (p.get("resume") === "1") return { resume: true };
  const raw = Number(p.get("min"));
  if (Number.isFinite(raw) && raw > 0) return { min: Math.min(45, Math.max(1, Math.round(raw))), resume: false };
  return { resume: false };
}
