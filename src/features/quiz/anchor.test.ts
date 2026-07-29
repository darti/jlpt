import { test, expect, afterEach } from "bun:test";
import { anchorIndex, isAnchor, selectAnchor, clearAnchorCache } from "./anchor.ts";
import type { Question } from "../../types/quiz.ts";

afterEach(() => { clearAnchorCache(); });

const q = (id: number, tests?: string[]): Question =>
  ({ id, cat: "kanji", d: 1, q: "", o: [], a: 0, ...(tests ? { tests } : {}) }) as Question;

test("selectAnchor resout une arete tests directe", () => {
  const qs = [q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/たら"])];
  expect(selectAnchor("jlpt:gram/ば", anchorIndex(qs), new Set())).toBe(1);
});

test("selectAnchor rend le plus petit ord quand plusieurs questions testent l entite", () => {
  const qs = [q(9, ["jlpt:gram/ば"]), q(3, ["jlpt:gram/ば"])];
  expect(selectAnchor("jlpt:gram/ば", anchorIndex(qs), new Set())).toBe(3);
});

test("selectAnchor saute une question deja exclue", () => {
  const qs = [q(3, ["jlpt:gram/ば"]), q(9, ["jlpt:gram/ば"])];
  expect(selectAnchor("jlpt:gram/ば", anchorIndex(qs), new Set([3]))).toBe(9);
});

// LE PONT : un kanji enseigné n'est presque jamais testé directement (les 551 kanji du cours et
// les 124 kanji testés sont des ensembles DISJOINTS, mesuré). Il l'est via les MOTS qui le
// contiennent — c'est ce qui fait passer la piste kanji de 0 % à 93 % d'ancrage.
test("selectAnchor atteint un kanji via un mot testé qui le contient", () => {
  const qs = [q(7, ["jlpt:word/位置"])];
  expect(selectAnchor("jlpt:kanji/位", anchorIndex(qs), new Set())).toBe(7);
});

test("l arete directe l emporte sur le pont par le mot", () => {
  const qs = [q(7, ["jlpt:word/位置"]), q(8, ["jlpt:kanji/位"])];
  expect(selectAnchor("jlpt:kanji/位", anchorIndex(qs), new Set())).toBe(8);
});

test("le pont ne s applique qu aux IRIs de kanji", () => {
  // 影響 contient 影, mais on cherche un MOT : pas de décomposition en caractères.
  const qs = [q(7, ["jlpt:word/影響"])];
  expect(selectAnchor("jlpt:word/影", anchorIndex(qs), new Set())).toBeNull();
});

test("selectAnchor rend null quand rien ne teste l entite", () => {
  expect(selectAnchor("jlpt:kanji/仁", anchorIndex([q(1, ["jlpt:gram/ば"])]), new Set())).toBeNull();
});

test("une question sans arete tests n entre pas dans l index", () => {
  expect(selectAnchor("jlpt:gram/ば", anchorIndex([q(1)]), new Set())).toBeNull();
});

test("anchorIndex est memoise sur l identite du tableau", () => {
  const qs = [q(1, ["jlpt:gram/ば"])];
  expect(anchorIndex(qs)).toBe(anchorIndex(qs));
});

// `isAnchor` répond sur un ord IMPOSÉ : c'est ce qui permet à une reprise de LIRE l'ancre que la
// session persistée réserve à une carte, au lieu de la rechoisir sans son jeu d'exclusion.
test("isAnchor reconnait l arete directe et refuse une autre question", () => {
  const index = anchorIndex([q(3, ["jlpt:gram/ば"]), q(4, ["jlpt:gram/たら"])]);
  expect(isAnchor("jlpt:gram/ば", 3, index)).toBe(true);
  expect(isAnchor("jlpt:gram/ば", 4, index)).toBe(false);
});

test("isAnchor suit le pont kanji vers le mot", () => {
  const index = anchorIndex([q(7, ["jlpt:word/位置"])]);
  expect(isAnchor("jlpt:kanji/位", 7, index)).toBe(true);
  expect(isAnchor("jlpt:kanji/仁", 7, index)).toBe(false);
});

// Contrairement à `selectAnchor`, `isAnchor` ne choisit pas : un ord plus grand reste une ancre
// valable si c'est celui que la session a réservé.
test("isAnchor accepte un ord qui n est pas le plus petit", () => {
  const index = anchorIndex([q(3, ["jlpt:gram/ば"]), q(9, ["jlpt:gram/ば"])]);
  expect(isAnchor("jlpt:gram/ば", 9, index)).toBe(true);
});
