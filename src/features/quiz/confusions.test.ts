import { test, expect, beforeEach } from "bun:test";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { asConfusions } from "./traps.ts";

beforeEach(() => { localStorage.clear(); });

// ⚠ Le risque propre au câblage n'est pas le calcul de l'anneau (pur et testé à part), c'est
// la PERTE SILENCIEUSE de l'historique : `writeProgress` ne fusionne en profondeur que `skill`,
// tout le reste est remplacé tel quel. Une feature qui patcherait le blob sans repasser les
// confusions les effacerait — sans erreur, sans trace. C'est exactement l'accident contre
// lequel CLAUDE.md met en garde (« réécrire le blob entier efface les champs des autres
// features »), et il ne se voit qu'ici.
test("un patch venu d'une autre feature ne perd pas les confusions", () => {
  writeProgress({ confusions: [[1174, 0, 201]] });
  writeProgress({ total: 5 });
  writeProgress({ skill: { kanji: { R: 1500, t: 3 } } });
  expect(asConfusions(readRawProgress())).toEqual([[1174, 0, 201]]);
});

test("le champ survit à un aller-retour JSON complet", () => {
  writeProgress({ confusions: [[1174, 0, 201], [4609, 3, 203]] });
  const relu = asConfusions(readRawProgress());
  expect(relu).toEqual([[1174, 0, 201], [4609, 3, 203]]);
  expect(relu[0][0]).toBe(1174);            // et reste bien un tuple de nombres
});
