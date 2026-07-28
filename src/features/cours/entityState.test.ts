import { test, expect } from "bun:test";
import { fsrsInit, fsrsReview, isDue, type Fsrs } from "../../lib/fsrs.ts";
import {
  entityState, groupStates, categoryStates, STABILITE_ACQUISE,
} from "./entityState.ts";
import type { CoursGroup, LearnCategory } from "./coursSchema.ts";

test("entityState sans carte rend neuf", () => {
  expect(entityState(undefined, 10)).toBe("neuf");
});

// RÉGRESSION (spec §3) : `isDue` seul ne suffit PAS. fsrsInit(1) rend S = 0,49 j avec R = 1
// le jour même — l'item serait « acquis » quelques heures après avoir été raté.
test("entityState juste apres une reponse fausse n est pas acquis", () => {
  expect(entityState(fsrsInit(1, 0), 0)).toBe("en-cours");
});

test("entityState le lendemain d une reponse fausse rend a-revoir", () => {
  expect(entityState(fsrsInit(1, 0), 1)).toBe("a-revoir");
});

test("entityState avec stabilite haute et carte fraiche rend acquis", () => {
  const st: Fsrs = [30, 5, 0];
  expect(entityState(st, 0)).toBe("acquis");
});

// L'échéance l'emporte sur la stabilité : une carte stable mais oubliée est à revoir.
test("entityState avec stabilite haute mais carte due rend a-revoir", () => {
  const st: Fsrs = [30, 5, 0];
  expect(isDue(st, 100)).toBe(true);
  expect(entityState(st, 100)).toBe("a-revoir");
});

// TEST DE MESURE (spec §3) : fige la PROPRIÉTÉ du seuil — « acquis » se gagne en deux succès
// espacés — sans dépendre de la valeur des 17 poids FSRS.
test("le seuil d acquisition tombe entre la premiere et la deuxieme revision reussie", () => {
  let st = fsrsInit(3, 0);
  let jour = 0;
  const stabilites: number[] = [];
  for (let i = 0; i < 2; i++) {
    while (!isDue(st, jour)) jour++;
    st = fsrsReview(st, 3, jour);
    stabilites.push(st[0]);
  }
  expect(stabilites[0]).toBeLessThan(STABILITE_ACQUISE);
  expect(stabilites[1]).toBeGreaterThanOrEqual(STABILITE_ACQUISE);
});

const groupe: CoursGroup = {
  id: "g1",
  title: "Conditionnels",
  items: [
    { id: "jlpt:gram/ば", form: "〜ば" },
    { id: "jlpt:gram/たら", form: "〜たら" },
    { id: "jlpt:gram/なら", form: "〜なら" },
  ],
};

test("groupStates compte les quatre etats", () => {
  const m = { "jlpt:gram/ば": [30, 5, 0] as Fsrs, "jlpt:gram/たら": fsrsInit(1, 0) };
  expect(groupStates(groupe, m, 0)).toEqual({
    acquis: 1, enCours: 1, aRevoir: 0, neufs: 1, total: 3,
  });
});

test("categoryStates additionne les groupes", () => {
  const cat: LearnCategory = {
    id: "gram", title: "文法", kind: "learn", groups: [groupe, groupe],
  };
  expect(categoryStates(cat, {}, 0)).toEqual({
    acquis: 0, enCours: 0, aRevoir: 0, neufs: 6, total: 6,
  });
});
