import { test, expect } from "bun:test";
import { KINDS, trapKind } from "./trap-kinds.mjs";

// Chaque cas est une note RÉELLE du corpus — pas une formule inventée pour l'occasion.
const CAS: [string, string][] = [
  ["影像（えいぞう）« image » : partage 影, lecture différente", "kanji-partage"],
  ["voisement erroné de しゅくだい", "voisement"],
  ["« あきひん » : graphie inexistante, confusion avec 商品", "graphie-inexistante"],
  ["confond avec d'autres kanji (幹 みき) : ne correspond pas à 未来", "kanji-confondu"],
  ["映像（えいぞう）« image vidéo » : 映 ressemble à 影", "forme-proche"],
  ["homophone, sens différent", "homophone"],
  ["lecture on de 生, pas la kun attendue", "lecture-on-kun"],
  ["じゆう = lecture de 自由, pas de 理由", "lecture-autre-mot"],
  ["erreur : 議 se lit ぎ, pas ご", "lecture-erronee"],
  ["りゆ : voyelle finale manquante", "longueur-voyelle"],
  ["« afin de / de sorte que » : exprime un but, pas la simultanéité", "nuance-grammaticale"],
  ["中止 = annulation → autre mot", "sens-different"],
  ["registre trop poli pour un ami", "registre"],
];

test("chaque formule d'auteur tombe sur son type", () => {
  for (const [note, attendu] of CAS) expect(trapKind(note)).toBe(attendu);
});

test("une note qu'aucun motif ne couvre tombe en « autre », jamais sur une devinette", () => {
  expect(trapKind("Le lieu ne change pas, c'est précisé dans l'audio")).toBe("autre");
  expect(trapKind("")).toBe("autre");
  expect(trapKind(undefined as unknown as string)).toBe("autre");
});

test("KINDS énumère exactement les types produits, autre compris", () => {
  expect(KINDS).toContain("autre");
  expect(KINDS.length).toBe(14);
  for (const [, attendu] of CAS) expect(KINDS).toContain(attendu);
});

import { readFileSync } from "node:fs";

/** Couverture du classifieur sur un shard réel : part des notes de DISTRACTEUR typées. */
function couverture(shard: string): { pct: number; n: number } {
  const sujets = JSON.parse(readFileSync(`data/graph/${shard}.jsonld`, "utf8"))["@graph"] ?? [];
  let n = 0, ok = 0;
  for (const s of sujets) {
    const notes = s["jlpt:optionNote"], ans = s["jlpt:answer"];
    if (!Array.isArray(notes)) continue;
    notes.forEach((note, i) => {
      if (i === ans) return;
      n++;
      if (trapKind(note) !== "autre") ok++;
    });
  }
  return { pct: (ok / n) * 100, n };
}

// ⚠ TEST DE MESURE : ces seuils sont un CLIQUET. Dès qu'une passe les dépasse durablement,
// les REMONTER — un cliquet laissé bas ne garde plus rien (cf. CLAUDE.md).
test("le classifieur couvre au moins 93 % des notes de kanji", () => {
  const c = couverture("q-kanji");
  expect(c.n).toBeGreaterThan(9000);
  expect(c.pct).toBeGreaterThan(93);
});

test("le classifieur couvre au moins 74 % des notes de vocabulaire", () => {
  const c = couverture("q-vocabulaire");
  expect(c.n).toBeGreaterThan(17000);
  expect(c.pct).toBeGreaterThan(74);
});
