import { test, expect } from "bun:test";
import {
  groupProgress, categoryProgress, cycleState, setItemState,
  loadCoursProgress, saveCoursProgress, type CoursProgress,
} from "./coursProgress.ts";
import type { CoursGroup, LearnCategory } from "./coursSchema.ts";

const g = (id: string, ...ids: string[]): CoursGroup =>
  ({ id, title: id, items: ids.map((x) => ({ id: x, mot: x, lecture: "", sens: "" })) });

test("groupProgress compte known/review/total, ignore les états manquants", () => {
  const group = g("grp", "a", "b", "c");
  const p: CoursProgress = { a: "known", b: "review" };
  expect(groupProgress(group, p)).toEqual({ known: 1, review: 1, total: 3 });
});

test("categoryProgress additionne sur tous les groupes", () => {
  const cat: LearnCategory = {
    id: "vocab",
    title: "V",
    kind: "learn",
    groups: [g("x", "a", "b"), g("y", "c")],
  };
  const p: CoursProgress = { a: "known", c: "known" };
  expect(categoryProgress(cat, p)).toEqual({ known: 2, review: 0, total: 3 });
});

test("cycleState : neuf → known → review → neuf", () => {
  expect(cycleState(undefined)).toBe("known");
  expect(cycleState("known")).toBe("review");
  expect(cycleState("review")).toBe(undefined);
});

test("setItemState pose un état, supprime la clé quand undefined, sans muter l'entrée", () => {
  const p: CoursProgress = { a: "known" };
  expect(setItemState(p, "b", "review")).toEqual({ a: "known", b: "review" });
  expect(setItemState(p, "a", undefined)).toEqual({});
  expect(p).toEqual({ a: "known" }); // pas de mutation
});

test("load/save : round-trip, JSON invalide → {}, valeurs inconnues filtrées", () => {
  const mem: Record<string, string> = {};
  const store = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v; },
  };
  saveCoursProgress({ a: "known", b: "review" }, store);
  expect(loadCoursProgress(store)).toEqual({ a: "known", b: "review" });
  mem["jlptN3_cours_v1"] = "{pas du json";
  expect(loadCoursProgress(store)).toEqual({});
  mem["jlptN3_cours_v1"] = JSON.stringify({ a: "known", c: "bidon" });
  expect(loadCoursProgress(store)).toEqual({ a: "known" }); // "bidon" ignoré
});
