import { test, expect, beforeEach } from "bun:test";
import {
  asFsrs, dueEntities, dueBySkill, fsrsIndex, selectRevision, clearRevisionCache, fsrsPatch,
} from "./revision.ts";
import { fsrsInit, fsrsReview } from "../../lib/fsrs.ts";
import type { Question } from "../../types/quiz.ts";

beforeEach(() => clearRevisionCache());

const q = (id: number, tests?: string[]): Question =>
  ({ id, cat: "vocabulaire", d: 1, q: "?", o: ["a", "b"], a: 0, ...(tests ? { tests } : {}) });

test("asFsrs : blob absent ou malformé → {}", () => {
  expect(asFsrs(null)).toEqual({});
  expect(asFsrs({})).toEqual({});
  expect(asFsrs({ fsrs: "corrompu" })).toEqual({});
  expect(asFsrs({ fsrs: { "jlpt:word/x": [1, 5, 0] } })).toEqual({ "jlpt:word/x": [1, 5, 0] });
});

test("dueEntities : seules les entités dues (R<0.9), triées de la plus en retard à la moins", () => {
  const map = { "jlpt:word/a": fsrsInit(3, 0), "jlpt:kanji/b": fsrsInit(3, 0) };
  // à today=200, très au-delà de la stabilité (S≈3.7) → toutes dues
  const due = dueEntities(map, 200);
  expect(due.map((d) => d.iri).sort()).toEqual(["jlpt:kanji/b", "jlpt:word/a"]);
  for (let i = 1; i < due.length; i++) expect(due[i - 1].r).toBeLessThanOrEqual(due[i].r);
});

test("dueEntities : une entité fraîche (revue à l'instant) n'est PAS due", () => {
  const map = { "jlpt:word/a": fsrsInit(3, 200) };
  expect(dueEntities(map, 200)).toEqual([]);
});

// ⚠ Le test ci-dessus utilise `.sort()` sur les IRIs et des R ex æquo → il ne PROUVE pas le sens
// du tri (un comparateur inversé passerait). Ici les deux entités ont des R DISTINCTS (l'une revue
// au jour 0, l'autre au jour 190 ; à today=200, R = 0.271 vs 0.783) : l'ordre est vérifié sans
// `.sort()`, donc un comparateur inversé (revue Task 2) casse ce test.
test("dueEntities : ordre PROUVÉ — la plus en retard (R le plus bas) en premier", () => {
  const map = { "jlpt:word/recent": fsrsInit(3, 190), "jlpt:word/vieux": fsrsInit(3, 0) };
  const due = dueEntities(map, 200);
  expect(due.map((d) => d.iri)).toEqual(["jlpt:word/vieux", "jlpt:word/recent"]);
  expect(due[0].r).toBeLessThan(due[1].r);
});

// La mémoïsation de fsrsIndex est un état de MODULE : sans ce test, `clearRevisionCache` pourrait
// être un no-op sans qu'aucun cas ne le voie (chaque autre test repart d'un tableau neuf).
test("fsrsIndex : cache hit sur la même identité de tableau, vidé par clearRevisionCache", () => {
  const qs = [q(1, ["jlpt:word/a"])];
  const first = fsrsIndex(qs);
  expect(fsrsIndex(qs)).toBe(first);       // même tableau → même Map (cache hit)
  clearRevisionCache();
  expect(fsrsIndex(qs)).not.toBe(first);   // vidé → nouvelle Map (échouerait si clear était un no-op)
});

test("dueBySkill : ventile par préfixe d'IRI", () => {
  const map = {
    "jlpt:word/a": fsrsInit(3, 0), "jlpt:kanji/b": fsrsInit(3, 0), "jlpt:gram/c": fsrsInit(3, 0),
  };
  const by = dueBySkill(map, 200);
  expect(by).toEqual({ vocab: 1, kanji: 1, gram: 1, autre: 0, total: 3 });
});

test("fsrsIndex : inverse q.tests (IRI → ords), ignore les questions sans arête", () => {
  const idx = fsrsIndex([q(1, ["jlpt:word/a"]), q(2, ["jlpt:word/a"]), q(3)]);
  expect(idx.get("jlpt:word/a")).toEqual([1, 2]);
  expect(idx.has("__aucune")).toBe(false);
});

test("selectRevision : une question par entité due (la plus en retard d'abord), hors exclude, jusqu'à limit", () => {
  const map = { "jlpt:word/a": fsrsInit(3, 0), "jlpt:kanji/b": fsrsInit(3, 0) };
  const qs = [q(1, ["jlpt:word/a"]), q(2, ["jlpt:kanji/b"])];
  const picked = selectRevision(map, 200, qs, new Set(), 5);
  expect(picked.map((x) => x.id).sort()).toEqual([1, 2]);
});

test("selectRevision : respecte limit et exclude, saute une entité due sans question", () => {
  const map = {
    "jlpt:word/a": fsrsInit(3, 0), "jlpt:kanji/b": fsrsInit(3, 0), "jlpt:gram/z": fsrsInit(3, 0),
  };
  const qs = [q(1, ["jlpt:word/a"]), q(2, ["jlpt:kanji/b"])]; // rien ne teste gram/z
  const picked = selectRevision(map, 200, qs, new Set([1]), 5);
  expect(picked.map((x) => x.id)).toEqual([2]); // 1 exclu, gram/z sans question
});

// `fsrsPatch` porte la logique qui vivait dans `choose` (hors de portée des tests : aucun test
// n'invoque le hook). Ces cas verrouillent le mapping du grade, init vs review, la garde vide et
// la pureté — exactement ce que la revue Task 3 ne pouvait vérifier que par lecture.
test("fsrsPatch : pas d'arête → undefined (aucun patch, la carte n'est pas écrasée)", () => {
  expect(fsrsPatch({}, [], true, 200)).toBeUndefined();
  expect(fsrsPatch({ "jlpt:word/a": fsrsInit(3, 0) }, [], false, 200)).toBeUndefined();
});

test("fsrsPatch : entité NOUVELLE → fsrsInit, grade juste=Good vs faux=Again (non inversé)", () => {
  const bon = fsrsPatch({}, ["jlpt:word/x"], true, 200)!;
  const rate = fsrsPatch({}, ["jlpt:word/x"], false, 200)!;
  expect(bon["jlpt:word/x"]).toEqual(fsrsInit(3, 200));
  expect(rate["jlpt:word/x"]).toEqual(fsrsInit(1, 200));
  expect(bon["jlpt:word/x"][0]).toBeGreaterThan(rate["jlpt:word/x"][0]); // Good part plus stable
});

test("fsrsPatch : entité CONNUE → fsrsReview (pas réinitialisée)", () => {
  const avant = fsrsInit(3, 0);
  const apres = fsrsPatch({ "jlpt:word/x": avant }, ["jlpt:word/x"], true, 200)!;
  expect(apres["jlpt:word/x"]).toEqual(fsrsReview(avant, 3, 200));
  expect(apres["jlpt:word/x"]).not.toEqual(fsrsInit(3, 200)); // révisée, pas réinitialisée
});

test("fsrsPatch : plusieurs arêtes → toutes mises à jour, sans altérer la carte d'entrée", () => {
  const map = { "jlpt:word/a": fsrsInit(3, 0) };
  const next = fsrsPatch(map, ["jlpt:word/a", "jlpt:kanji/b"], true, 200)!;
  expect(Object.keys(next).sort()).toEqual(["jlpt:kanji/b", "jlpt:word/a"]);
  expect(map).toEqual({ "jlpt:word/a": fsrsInit(3, 0) }); // pureté : entrée inchangée
});
