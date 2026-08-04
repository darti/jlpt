import { test, expect, afterEach } from "bun:test";
import {
  allocateLearn, buildLearnQueue, rebuildLearnQueue, selectReprises, TRACK_DE_SKILL,
  GRAM_LEARN_FLOOR,
} from "./learnQueue.ts";
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

// Plancher de grammaire : la grammaire est prioritaire, au moins `min(GRAM_LEARN_FLOOR, total)`
// cartes, quels que soient les poids — c'est ce qui « accélère l'apprentissage de la grammaire ».
test("allocateLearn garantit le plancher de grammaire, meme a poids egaux", () => {
  const poids: Record<string, number> = {
    grammaire: 1, vocabulaire: 1, kanji: 1, lecture: 0, ecoute: 0,
  };
  const a = allocateLearn((c: Skill) => poids[c], 9);
  expect(a.gram).toBeGreaterThanOrEqual(GRAM_LEARN_FLOOR); // ≥ 5 sur un budget de 9
  expect(a.gram + a.vocab + a.kanji).toBe(9);              // total conservé
});

test("allocateLearn : le plancher de grammaire l'emporte meme quand une autre piste pese plus", () => {
  const poids: Record<string, number> = {
    grammaire: 1, vocabulaire: 10, kanji: 10, lecture: 0, ecoute: 0,
  };
  const a = allocateLearn((c: Skill) => poids[c], 8);
  expect(a.gram).toBeGreaterThanOrEqual(GRAM_LEARN_FLOOR); // grammaire priorisée malgré son faible poids
  expect(a.gram + a.vocab + a.kanji).toBe(8);
});

test("allocateLearn : sous le plancher, la grammaire prend tout le budget disponible", () => {
  // budget < GRAM_LEARN_FLOOR : la grammaire prend tout ce qu'il y a, jamais plus que `total`.
  for (const total of [1, 2, 3, 4]) {
    const a = allocateLearn(() => 1, total);
    expect(a.gram).toBe(total);
    expect(a.vocab + a.kanji).toBe(0);
  }
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

// ── Reprises ────────────────────────────────────────────────────────────────────────────────
// La tranche garantie de `composeSession` n'est JAMAIS tronquée (bank.ts:125-131) et
// `sessionPlan` n'a jamais budgété de reprises : sans la borne `place`, une séance dont les
// erreurs / la confusion / la révision saturent déjà le budget rend `alloc.learn` questions de
// TROP (17 au lieu de 15 sur 10 min). La borne est donc la règle, pas une précaution.

const fileDe = (...ids: string[]) => ids.map((id) => ({ item: item(id), anchor: 0 }));

test("selectReprises ne rend rien quand il ne reste aucune place", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/ば"])]);
  expect(selectReprises(fileDe("jlpt:gram/ば"), index, new Set([1]), 0)).toEqual([]);
});

test("selectReprises ne depasse jamais la place disponible", () => {
  const qs = [
    q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/ば"]),
    q(3, ["jlpt:gram/たら"]), q(4, ["jlpt:gram/たら"]),
  ];
  const index = anchorIndex(qs);
  // Deux entités enseignées, leurs ancres (1 et 3) déjà prises : deux reprises possibles…
  const exclude = new Set([1, 3]);
  expect(selectReprises(fileDe("jlpt:gram/ば", "jlpt:gram/たら"), index, exclude, 2)).toEqual([2, 4]);
  // … mais une seule place.
  expect(selectReprises(fileDe("jlpt:gram/ば", "jlpt:gram/たら"), index, exclude, 1)).toEqual([2]);
});

test("selectReprises ne rend jamais un ord deja pris", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/ば"])]);
  const reprises = selectReprises(fileDe("jlpt:gram/ば"), index, new Set([1]), 5);
  expect(reprises).toEqual([2]);
  expect(reprises).not.toContain(1);
});

test("selectReprises ne mute pas le jeu d exclusion recu", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/ば"])]);
  const exclude = new Set([1]);
  selectReprises(fileDe("jlpt:gram/ば"), index, exclude, 5);
  expect([...exclude]).toEqual([1]);
});

// Une entité dont le corpus ne porte qu'UNE question n'a pas de reprise : son ancre l'a déjà
// consommée. On n'invente pas de question, ici pas plus qu'ailleurs.
test("selectReprises saute une entite sans seconde question", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/たら"])]);
  expect(selectReprises(fileDe("jlpt:gram/ば", "jlpt:gram/たら"), index, new Set([1, 2]), 5))
    .toEqual([]);
});

test("selectReprises rend une seule reprise par entite", () => {
  const index = anchorIndex([
    q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/ば"]), q(3, ["jlpt:gram/ば"]),
  ]);
  expect(selectReprises(fileDe("jlpt:gram/ば"), index, new Set([1]), 5)).toEqual([2]);
});

// ── Reprise ─────────────────────────────────────────────────────────────────────────────────
// Les questions d'ancrage OUVRENT la session, dans l'ordre de la file : à la reprise, l'ancre se
// LIT à la position courante. La rejouer par `selectAnchor` rendrait un autre ord — le jeu
// d'exclusion d'origine (erreurs, révision, confusion) n'existe plus.

test("rebuildLearnQueue rattache chaque entite restante a l ancre que la session lui reserve", () => {
  const session = [q(7, ["jlpt:gram/ば"]), q(8, ["jlpt:word/位置"]), q(9, ["jlpt:gram/autre"])];
  const file = rebuildLearnQueue(["jlpt:gram/ば", "jlpt:kanji/位"], cats, session, 0);
  expect(file.map((s) => [s.item.id, s.anchor])).toEqual([
    ["jlpt:gram/ば", 7],
    ["jlpt:kanji/位", 8], // atteint via le mot 位置, comme au premier tirage
  ]);
});

test("rebuildLearnQueue repart de la position courante, pas du debut de la session", () => {
  const session = [q(7, ["jlpt:gram/ば"]), q(8, ["jlpt:gram/たら"])];
  const file = rebuildLearnQueue(["jlpt:gram/たら"], cats, session, 1);
  expect(file.map((s) => [s.item.id, s.anchor])).toEqual([["jlpt:gram/たら", 8]]);
});

// Une entité sans ancre ne consomme pas de question : la suivante doit garder la sienne.
test("rebuildLearnQueue n avance pas la position sur une entite sans ancre", () => {
  const session = [q(7, ["jlpt:gram/たら"])];
  const file = rebuildLearnQueue(["jlpt:gram/ば", "jlpt:gram/たら"], cats, session, 0);
  expect(file.map((s) => s.anchor)).toEqual([null, 7]);
});

// Le blob est de la donnée utilisateur : un IRI que le programme ne connaît plus est ignoré,
// jamais une cause d'échec.
test("rebuildLearnQueue ignore une entite absente du programme", () => {
  const session = [q(7, ["jlpt:gram/ば"])];
  const file = rebuildLearnQueue(["jlpt:gram/disparu", "jlpt:gram/ば"], cats, session, 0);
  expect(file.map((s) => [s.item.id, s.anchor])).toEqual([["jlpt:gram/ば", 7]]);
});

test("rebuildLearnQueue rend une file vide quand il ne reste rien a enseigner", () => {
  expect(rebuildLearnQueue([], cats, [q(7, ["jlpt:gram/ば"])], 0)).toEqual([]);
});
