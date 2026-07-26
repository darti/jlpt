import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

// Le risque propre au câblage n'est pas la règle de regroupement (pure, testée dans bank.ts),
// c'est qu'un chemin de session l'OUBLIE : la session part alors avec les questions d'un même
// texte dispersées par le mélange, sans la moindre erreur.
const src = readFileSync("src/features/quiz/useQuiz.ts", "utf8");

test("chaque construction de session passe par withPassageGroups", () => {
  const constructions = (src.match(/\b(composeSession|selectDiagnostic)\s*\(/g) ?? []).length;
  const regroupements = (src.match(/\bwithPassageGroups\s*\(/g) ?? []).length;
  expect(constructions).toBeGreaterThan(0);
  expect(regroupements).toBe(constructions);
});
