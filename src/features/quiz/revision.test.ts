import { test, expect, beforeEach } from "bun:test";
import {
  asFsrs, dueEntities, dueBySkill, fsrsIndex, selectRevision, clearRevisionCache,
} from "./revision.ts";
import { fsrsInit } from "../../lib/fsrs.ts";
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
