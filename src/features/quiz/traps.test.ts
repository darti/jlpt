import { test, expect } from "bun:test";
import { dayNumber, kindIndex, trapModel, KIND_LABELS, CONF_MAX, asConfusions, appendConfusion, confusionPatch, activeConfusionCount, selectConfusion } from "./traps.ts";
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

test("activeConfusionCount : compte les événements dans la fenêtre, ignore les vieux", () => {
  // [ord, choix, jour] ; today=100, fenêtre 30 → garde jour>70
  const conf: [number, number, number][] = [[1, 0, 90], [2, 1, 80], [3, 0, 50], [4, 2, 100]];
  expect(activeConfusionCount(conf, 100, 30)).toBe(3); // 90,80,100 dedans ; 50 dehors
  expect(activeConfusionCount([], 100, 30)).toBe(0);
});

test("selectConfusion : pioche les questions exerçant un type actif, plus fréquent d'abord", () => {
  const active = [{ kind: "homophone", recent: 5 }, { kind: "kanji-partage", recent: 2 }];
  const pool = [
    q(10, ["", "kanji-partage", "", ""]),          // exerce kanji-partage (poids 2)
    q(11, ["homophone", "", "", ""]),              // exerce homophone (poids 5)
    q(12, ["", "", "", ""]),                       // n'exerce aucun type actif
    q(13, ["sens-different", "", "", ""]),         // type non actif
  ];
  const out = selectConfusion(active, pool, new Set(), 5, () => 0);
  expect(out.map((x) => x.id)).toEqual([11, 10]); // 11 (poids 5) avant 10 (poids 2) ; 12/13 exclus
});

test("selectConfusion : respecte exclude et le budget n", () => {
  const active = [{ kind: "homophone", recent: 3 }];
  const pool = [q(10, ["homophone", "", "", ""]), q(11, ["homophone", "", "", ""]), q(12, ["homophone", "", "", ""])];
  expect(selectConfusion(active, pool, new Set([11]), 1, () => 0).map((x) => x.id)).toEqual([10]); // exclut 11, limite à 1
});

test("selectConfusion : graceful zero (active vide ou n<=0 → [])", () => {
  const pool = [q(10, ["homophone", "", "", ""])];
  expect(selectConfusion([], pool, new Set(), 5, () => 0)).toEqual([]);
  expect(selectConfusion([{ kind: "homophone", recent: 1 }], pool, new Set(), 0, () => 0)).toEqual([]);
});

test("selectConfusion : l'index de la réponse ne compte jamais comme un type exercé", () => {
  // a=2 → q.trap[2]="" ; mettre un type actif SEULEMENT à l'index réponse ne doit pas matcher.
  const active = [{ kind: "homophone", recent: 4 }];
  const pool = [{ id: 20, cat: "vocabulaire" as const, d: 1 as const, q: "?", o: ["a", "b", "c", "d"], a: 2, trap: ["", "", "homophone", ""] }];
  //                                                                                    ^ index 2 = réponse
  expect(selectConfusion(active, pool, new Set(), 5, () => 0)).toEqual([]);
});
