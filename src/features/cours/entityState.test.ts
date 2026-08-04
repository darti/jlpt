import { test, expect } from "bun:test";
import { fsrsInit, fsrsReview, isDue, type Fsrs } from "../../lib/fsrs.ts";
import {
  declaredKnownCard, entityState, groupStates, categoryStates, STABILITE_ACQUISE,
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

// ── Déclaration « je sais déjà » ────────────────────────────────────────────────────────────
// LE défaut corrigé : le geste posait `fsrsInit(3)` = S 3,7 j. Comme une entité redevient due
// exactement S jours après (R(S,S) = 0,9 par construction), déclarer « je connais » ramenait le
// point QUATRE jours plus tard, et le laissait « en cours » — l'inverse d'une évacuation.

test("declaredKnownCard rend une entite neuve immediatement acquise", () => {
  const c = declaredKnownCard(undefined, 100);
  expect(entityState(c, 100)).toBe("acquis");
});

// La mesure du défaut : l'ancien geste (`fsrsInit(3)`) laissait « en cours » et redevenait dû à
// j+4. Le nouveau tient au moins trois semaines. C'est CE contraste qui motive le changement.
test("declaredKnownCard tient ~3 semaines la ou fsrsInit(3) rendait la main a j+4", () => {
  const c = declaredKnownCard(undefined, 0);
  expect(entityState(c, 4)).toBe("acquis");          // là où l'ancien geste était déjà dû
  expect(entityState(fsrsInit(3, 0), 4)).toBe("a-revoir");
  expect(entityState(c, STABILITE_ACQUISE - 1)).toBe("acquis");
});

// ⚠ Une déclaration ne doit JAMAIS dégrader une mémoire mesurée plus forte : ramener S de 49 à 21
// avancerait l'échéance de quatre semaines — le geste nuirait à l'apprenant qui l'utilise.
test("declaredKnownCard ne dégrade jamais une carte plus forte", () => {
  const fort: Fsrs = [49, 6, 0];
  expect(declaredKnownCard(fort, 30)[0]).toBe(49);
});

test("declaredKnownCard releve une carte plus faible jusqu au seuil", () => {
  const faible: Fsrs = [0.5, 6, 0];
  expect(declaredKnownCard(faible, 30)[0]).toBe(STABILITE_ACQUISE);
});

// La difficulté est une grandeur MESURÉE (elle vient des réponses passées) : une déclaration
// porte sur ce qu'on sait, pas sur ce que ça coûte. Elle est donc conservée telle quelle.
test("declaredKnownCard conserve la difficulte mesuree et horodate au jour du geste", () => {
  const c = declaredKnownCard([0.5, 7.25, 0], 42);
  expect(c[1]).toBe(7.25);
  expect(c[2]).toBe(42);
});

test("declaredKnownCard donne a une entite neuve la difficulte de Good", () => {
  expect(declaredKnownCard(undefined, 0)[1]).toBe(fsrsInit(3, 0)[1]);
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
