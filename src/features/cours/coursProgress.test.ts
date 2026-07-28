import { test, expect } from "bun:test";
import { loadCoursProgress, migrateCoursProgress } from "./coursProgress.ts";
import { fsrsInit, type Fsrs } from "../../lib/fsrs.ts";

test("loadCoursProgress : round-trip, JSON invalide → {}, valeurs inconnues filtrées", () => {
  const mem: Record<string, string> = {};
  const store = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v; },
  };
  store.setItem("jlptN3_cours_v2", JSON.stringify({ a: "known", b: "review" }));
  expect(loadCoursProgress(store)).toEqual({ a: "known", b: "review" });
  mem["jlptN3_cours_v2"] = "{pas du json";
  expect(loadCoursProgress(store)).toEqual({});
  mem["jlptN3_cours_v2"] = JSON.stringify({ a: "known", c: "bidon" });
  expect(loadCoursProgress(store)).toEqual({ a: "known" }); // "bidon" ignoré
});

test("migrateCoursProgress amorce known en Good et review en Again", () => {
  const out = migrateCoursProgress(
    { "jlpt:gram/ば": "known", "jlpt:gram/たら": "review" }, {}, 7,
  );
  expect(out).toEqual({
    "jlpt:gram/ば": fsrsInit(3, 7),
    "jlpt:gram/たら": fsrsInit(1, 7),
  });
});

// Le modèle de mémoire fait autorité — même invariant que toutes les chaînes d'outils du
// projet : un applicateur n'écrase jamais une donnée déjà posée.
test("migrateCoursProgress n ecrase jamais une carte existante", () => {
  const deja: Fsrs = [99, 5, 3];
  const out = migrateCoursProgress(
    { "jlpt:gram/ば": "known" }, { "jlpt:gram/ば": deja }, 7,
  );
  expect(out).toBeNull();
});

test("migrateCoursProgress rend null quand il n y a rien a migrer", () => {
  expect(migrateCoursProgress({}, {}, 7)).toBeNull();
});

test("migrateCoursProgress conserve les cartes non concernees", () => {
  const autre: Fsrs = [12, 4, 1];
  const out = migrateCoursProgress(
    { "jlpt:gram/ば": "known" }, { "jlpt:word/影響": autre }, 7,
  );
  expect(out).toEqual({
    "jlpt:word/影響": autre,
    "jlpt:gram/ば": fsrsInit(3, 7),
  });
});
