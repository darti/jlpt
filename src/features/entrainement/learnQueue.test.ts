import { test, expect, afterEach } from "bun:test";
import { allocateLearn, buildLearnQueue, TRACK_DE_SKILL } from "./learnQueue.ts";
import { anchorIndex, clearAnchorCache } from "../quiz/anchor.ts";
import type { Question } from "../../types/quiz.ts";
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import type { Skill } from "../../types/progress.ts";

afterEach(() => { clearAnchorCache(); });

test("TRACK_DE_SKILL relie les trois pistes enseignables", () => {
  expect(TRACK_DE_SKILL).toEqual({ gram: "grammaire", vocab: "vocabulaire", kanji: "kanji" });
});

// ⚠ `allocateCount` distribue sur les CINQ compétences ; lecture et écoute n'ont aucune entité
// à enseigner. Tout ce qui leur écherrait doit être rapatrié, sinon le budget d'apprentissage
// fuit vers des pistes qui ne peuvent rien en faire.
test("allocateLearn ne donne jamais rien a lecture ni ecoute", () => {
  const poids: Record<string, number> = {
    grammaire: 1, vocabulaire: 1, kanji: 1, lecture: 5, ecoute: 5,
  };
  const a = allocateLearn((c: Skill) => poids[c], 6);
  expect(a.gram + a.vocab + a.kanji).toBe(6);
});

test("allocateLearn conserve le total exact", () => {
  for (const total of [0, 1, 2, 3, 5, 7, 12]) {
    const a = allocateLearn(() => 1, total);
    expect(a.gram + a.vocab + a.kanji).toBe(total);
  }
});

test("allocateLearn favorise la piste au plus fort poids", () => {
  const poids: Record<string, number> = {
    grammaire: 10, vocabulaire: 1, kanji: 1, lecture: 0, ecoute: 0,
  };
  const a = allocateLearn((c: Skill) => poids[c], 6);
  expect(a.gram).toBeGreaterThan(a.vocab);
  expect(a.gram).toBeGreaterThan(a.kanji);
});

// RÉGRESSION : quand les trois pistes enseignables ont un poids nul, `allocateCount` bascule
// dans sa branche `sum === 0` et répartit en tournante sur les CINQ compétences. Compter une
// piste enseignable comme « orpheline » sur la foi de son poids réinjectait sa part en double.
test("allocateLearn conserve le total meme quand tous les poids sont nuls", () => {
  for (const total of [0, 1, 3, 7]) {
    const a = allocateLearn(() => 0, total);
    expect(a.gram + a.vocab + a.kanji).toBe(total);
  }
});

const item = (id: string): CoursItem => ({ id, form: id }) as CoursItem;
const cats: CoursCategory[] = [
  { id: "gram", title: "文法", kind: "learn",
    groups: [{ id: "g1", title: "L1", items: [item("jlpt:gram/ば"), item("jlpt:gram/たら")] }] },
  { id: "kanji", title: "漢字", kind: "learn",
    groups: [{ id: "k1", title: "K1", items: [item("jlpt:kanji/位")] }] },
];
const q = (id: number, tests: string[]): Question =>
  ({ id, cat: "kanji", d: 1, q: "", o: [], a: 0, tests }) as Question;

test("buildLearnQueue rend une etape par entite, avec son ancre", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:word/位置"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 1, vocab: 0, kanji: 1 }, index, exclude: new Set(),
  });
  expect(file.map((s) => [s.item.id, s.anchor])).toEqual([
    ["jlpt:gram/ば", 1],
    ["jlpt:kanji/位", 2], // atteint via le mot 位置
  ]);
});

// Les mini-blocs restent CONTIGUS par piste : on n'alterne pas grammaire / kanji / grammaire.
test("buildLearnQueue garde les pistes en blocs contigus", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/たら"]), q(3, ["jlpt:kanji/位"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 2, vocab: 0, kanji: 1 }, index, exclude: new Set(),
  });
  expect(file.map((s) => s.item.id))
    .toEqual(["jlpt:gram/ば", "jlpt:gram/たら", "jlpt:kanji/位"]);
});

// Une entité SANS ancre est quand même enseignée : 38 kanji et ~14 % du reste n'ont aucune
// question. On n'invente pas de question — la carte propose l'auto-évaluation et passe.
test("buildLearnQueue enseigne une entite meme sans ancre", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/autre"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 1, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  expect(file).toHaveLength(1);
  expect(file[0].anchor).toBeNull();
});

// Deux entités ne peuvent pas partager la même question d'ancrage.
test("buildLearnQueue ne reutilise jamais la meme question", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば", "jlpt:gram/たら"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 2, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  expect(file[0].anchor).toBe(1);
  expect(file[1].anchor).toBeNull();
});

test("buildLearnQueue respecte les questions deja reservees par la session", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 1, vocab: 0, kanji: 0 }, index, exclude: new Set([1]),
  });
  expect(file[0].anchor).toBeNull();
});

test("buildLearnQueue rend une file vide quand rien n est alloue", () => {
  const index = anchorIndex([]);
  expect(buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 0, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  })).toEqual([]);
});
