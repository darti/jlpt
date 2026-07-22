import { test, expect } from "bun:test";
import { dayNumber, kindIndex, trapModel, KIND_LABELS, CONF_MAX, asConfusions, appendConfusion, confusionPatch } from "./traps.ts";
import type { Question } from "../../types/quiz.ts";

const q = (id: number, trap: string[]): Question =>
  ({ id, cat: "vocabulaire", d: 1, q: "?", o: ["a", "b", "c", "d"], a: 2, trap });

test("dayNumber compte les jours depuis le 1er janvier 2026 UTC", () => {
  expect(dayNumber(new Date("2026-01-01T00:00:00Z"))).toBe(0);
  expect(dayNumber(new Date("2026-01-02T00:00:00Z"))).toBe(1);
  expect(dayNumber(new Date("2026-07-21T12:00:00Z"))).toBe(201);
});

test("kindIndex n'indexe que les questions PORTANT le champ", () => {
  const idx = kindIndex([q(1, ["voisement", "autre", "", "homophone"]), { ...q(2, []), trap: undefined }]);
  expect(idx.get(1)).toEqual(["voisement", "autre", "", "homophone"]);
  expect(idx.has(2)).toBe(false);
});

const idx = kindIndex([
  q(1, ["voisement", "autre", "", "homophone"]),
  q(2, ["forme-proche", "voisement", "", "autre"]),
]);

test("un ord absent de l'index est hors périmètre, pas une erreur de typage", () => {
  const m = trapModel([[999, 0, 200]], idx, 200);
  expect(m.outOfScope).toBe(1);
  expect(m.untyped).toBe(0);
  expect(m.active).toEqual([]);
});

test("un type « autre » compte comme non typé — la limite du classifieur reste visible", () => {
  const m = trapModel([[1, 1, 200]], idx, 200);
  expect(m.untyped).toBe(1);
  expect(m.outOfScope).toBe(0);
});

test("les événements de la fenêtre alimentent les pièges actifs, triés par fréquence", () => {
  const m = trapModel([[1, 0, 200], [2, 1, 199], [1, 3, 198]], idx, 200);
  expect(m.active).toEqual([{ kind: "voisement", recent: 2 }, { kind: "homophone", recent: 1 }]);
});

test("un type hors fenêtre mais présent dans l'anneau est « résolu »", () => {
  const m = trapModel([[1, 3, 100], [1, 0, 200]], idx, 200, 30);
  expect(m.active).toEqual([{ kind: "voisement", recent: 1 }]);
  expect(m.resolved).toEqual(["homophone"]);
});

test("un type actif n'est jamais listé comme résolu", () => {
  const m = trapModel([[1, 0, 100], [1, 0, 200]], idx, 200, 30);
  expect(m.active).toEqual([{ kind: "voisement", recent: 1 }]);
  expect(m.resolved).toEqual([]);
});

// ⚠ Ne PAS importer `KINDS` depuis tools/graph/trap-kinds.mjs ici : `tsc --noEmit` couvre
// src/ et refuserait un module .mjs sans déclaration de types. La taxonomie est confrontée
// au classifieur côté outil (tools/graph/trap-kinds.test.ts) ; ici on vérifie seulement que
// la table de libellés est complète et cohérente en nombre.
test("la table de libellés couvre les 15 types, autre compris", () => {
  expect(Object.keys(KIND_LABELS).length).toBe(15);
  expect(KIND_LABELS["kanji-hors-contexte"]).toBe("Mauvais kanji pour le contexte");
  expect(KIND_LABELS.autre).toBe("Non classé");
  for (const v of Object.values(KIND_LABELS)) expect(typeof v).toBe("string");
});

test("l'anneau est borné à 300", () => { expect(CONF_MAX).toBe(300); });

test("un blob antérieur au champ ne demande aucune migration", () => {
  expect(asConfusions(null)).toEqual([]);
  expect(asConfusions({})).toEqual([]);
  expect(asConfusions({ confusions: "corrompu" })).toEqual([]);
});

test("appendConfusion ajoute un événement et borne l'anneau", () => {
  expect(appendConfusion([], 1174, 0, 201)).toEqual([[1174, 0, 201]]);
  let ring: [number, number, number][] = [];
  for (let i = 0; i < CONF_MAX + 25; i++) ring = appendConfusion(ring, i, 0, 200);
  expect(ring.length).toBe(CONF_MAX);
  expect(ring[0][0]).toBe(25);                       // les 25 plus anciens ont été évincés
  expect(ring[CONF_MAX - 1][0]).toBe(CONF_MAX + 24);
});

test("confusionPatch n'écrit rien sur une bonne réponse", () => {
  expect(confusionPatch([], 1174, 2, true, 201)).toBeUndefined();
  expect(confusionPatch([], 1174, 0, false, 201)).toEqual([[1174, 0, 201]]);
});
