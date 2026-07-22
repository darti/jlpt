import { test, expect, beforeEach } from "bun:test";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { asFsrs } from "./revision.ts";

beforeEach(() => localStorage.clear());

// Le risque propre au câblage n'est pas le calcul FSRS (pur, testé à part), c'est la PERTE
// SILENCIEUSE de la carte : writeProgress ne fusionne en profondeur que `skill`, tout le reste
// est remplacé. Une feature qui patcherait le blob sans repasser `fsrs` l'effacerait — sans
// erreur (cf. CLAUDE.md « réécrire le blob entier efface les champs des autres features »).
test("un patch d'une autre feature ne perd pas la carte fsrs", () => {
  writeProgress({ fsrs: { "jlpt:word/a": [10, 5, 200] } });
  writeProgress({ total: 5 });
  writeProgress({ skill: { kanji: { R: 1500, t: 3 } } });
  expect(asFsrs(readRawProgress())).toEqual({ "jlpt:word/a": [10, 5, 200] });
});

test("la carte survit à un aller-retour JSON complet", () => {
  writeProgress({ fsrs: { "jlpt:word/a": [10, 5, 200], "jlpt:kanji/火": [3.1, 6.8, 201] } });
  expect(asFsrs(readRawProgress())["jlpt:kanji/火"]).toEqual([3.1, 6.8, 201]);
});
