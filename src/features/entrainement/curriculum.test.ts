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

// Un item « à revoir » ou « en cours » n'est PAS acquis : il reste enseignable. C'est voulu —
// une notion vacillante mérite d'être ré-exposée, pas seulement re-testée.
test("nextLessonBlock reprend un item non acquis mais deja rencontre", () => {
  const m = { a: [0.5, 5, 0] as Fsrs }; // stabilité faible → « en-cours »
  expect(nextLessonBlock("gram", cats, m, 0, 1).map((i) => i.id)).toEqual(["a"]);
});
