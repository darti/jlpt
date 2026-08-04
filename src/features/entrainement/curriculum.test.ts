import { test, expect } from "bun:test";
import { nextLessonBlock } from "./curriculum.ts";
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import type { Fsrs } from "../../lib/fsrs.ts";

const it = (id: string): CoursItem => ({ id, form: id }) as CoursItem;
const ACQUIS: Fsrs = [30, 5, 0]; // S ≥ 21 et non due → « acquis »

const cats: CoursCategory[] = [{
  id: "gram", title: "文法", kind: "learn",
  groups: [
    { id: "g1", title: "L1", items: [it("a"), it("b")] },
    { id: "g2", title: "L2", items: [it("c"), it("d"), it("e")] },
  ],
}];

test("nextLessonBlock rend les n premiers items de la premiere lecon", () => {
  expect(nextLessonBlock("gram", cats, {}, 0, 2).map((i) => i.id)).toEqual(["a", "b"]);
});

test("nextLessonBlock saute les items acquis", () => {
  const m = { a: ACQUIS };
  expect(nextLessonBlock("gram", cats, m, 0, 2).map((i) => i.id)).toEqual(["b", "c"]);
});

// La FRONTIÈRE de leçon : un bloc peut chevaucher deux leçons. C'est accepté (c'est la
// frontière, pas le régime courant) — mieux vaut un bloc complet qu'un bloc tronqué.
test("nextLessonBlock complete sur la lecon suivante en fin de lecon", () => {
  expect(nextLessonBlock("gram", cats, {}, 0, 3).map((i) => i.id)).toEqual(["a", "b", "c"]);
});

test("nextLessonBlock saute une lecon entierement acquise", () => {
  const m = { a: ACQUIS, b: ACQUIS };
  expect(nextLessonBlock("gram", cats, m, 0, 2).map((i) => i.id)).toEqual(["c", "d"]);
});

test("nextLessonBlock rend un tableau vide quand la piste est epuisee", () => {
  const m = { a: ACQUIS, b: ACQUIS, c: ACQUIS, d: ACQUIS, e: ACQUIS };
  expect(nextLessonBlock("gram", cats, m, 0, 2)).toEqual([]);
});

test("nextLessonBlock rend un tableau vide pour une piste absente", () => {
  expect(nextLessonBlock("kanji", cats, {}, 0, 2)).toEqual([]);
});

test("nextLessonBlock rend un tableau vide quand n vaut zero", () => {
  expect(nextLessonBlock("gram", cats, {}, 0, 0)).toEqual([]);
});

// LA correction : un item « en cours » (déjà introduit, pas encore dû) a quitté la phase
// d'apprentissage. Une seconde séance le même jour propose donc de NOUVEAUX points au lieu de
// ré-enseigner ceux tout juste vus (jamais « acquis » avant deux succès espacés).
test("nextLessonBlock saute un item en cours et propose le suivant", () => {
  const m = { a: [3.7, 5, 0] as Fsrs }; // introduit aujourd'hui, non dû → « en-cours »
  expect(nextLessonBlock("gram", cats, m, 0, 1).map((i) => i.id)).toEqual(["b"]);
});

// Un item DÛ (« à revoir ») reste enseignable : pour les entités sans ancre, la phase
// d'apprentissage est le seul endroit qui puisse les re-surfacer.
test("nextLessonBlock reprend un item du (a revoir)", () => {
  const m = { a: [0.5, 5, -10] as Fsrs }; // révisé il y a 10 j, rétrievabilité < 0,9 → « a-revoir »
  expect(nextLessonBlock("gram", cats, m, 0, 1).map((i) => i.id)).toEqual(["a"]);
});
