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

// Non-régression — revue de fiabilité post-Task 1. Chaque note ci-dessous est VERBATIM du
// corpus et a été mal classée avant correctif (voir l'en-tête de trap-kinds.mjs) :
// - les deux premières matchaient `lecture-erronee` via l'attrape-tout `erreur ?:`, alors
//   qu'elles portent sur le SENS d'un kanji, pas sur sa lecture (défaut 1) ;
// - les trois suivantes matchaient `registre` par sous-chaîne (« politique » → poli,
//   « enregistreur » → registre) ou par glose française citée (« registre » = traduction du
//   kanji, pas type de piège) (défaut 2). Un type FAUX valant moins qu'un type ABSENT, ces
//   trois retombent en `autre` — pas de motif ne les décrit correctement, et forcer une
//   correspondance serait revenir au défaut qu'on corrige.
test("régression : les notes de sens de kanji et les faux positifs de registre ne matchent plus le mauvais type", () => {
  expect(trapKind("erreur : 長 ne signifie pas « court »")).toBe("sens-different");
  expect(trapKind("erreur : « école » ne correspond pas à 高校")).toBe("autre");
  expect(trapKind("政権（せいけん）« pouvoir politique » : lecture proche, écriture différente")).toBe("autre");
  expect(trapKind("帳（ちょう）« registre » : confusion visuelle 張/帳")).toBe("autre");
  expect(trapKind("レコーダー « enregistreur » : forme abrégée, sens plus large")).toBe("autre");
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
//
// Seuils BAISSÉS ici (93 → 88, 74 → 73) suite à la revue de fiabilité post-Task 1 : les
// chiffres précédents (93,64 % / 74,82 %) comptaient des notes mal classées comme
// « couvertes » — `couverture()` ne mesure que « type ≠ autre », pas « type juste » (c'est
// justement ce qui a caché le défaut 1 : 427 notes de SENS classées `lecture-erronee`
// passaient le cliquet sans être correctement typées). Après le resserrement de
// `lecture-erronee` (défaut 1), `registre` (défaut 2) et `longueur-voyelle` (collision
// trouvée en même temps, voir l'en-tête de trap-kinds.mjs), la couverture RÉELLEMENT juste
// mesurée est 89,46 % (kanji) et 74,60 % (vocabulaire) — en baisse, mais désormais sans les
// faux positifs identifiés. Ce n'est pas une régression : c'est le cliquet qui rattrape son
// retard sur la qualité réelle du classifieur. Marge d'environ 1 point sous la valeur mesurée,
// comme pour les seuils d'origine.
test("le classifieur couvre au moins 88 % des notes de kanji", () => {
  const c = couverture("q-kanji");
  expect(c.n).toBeGreaterThan(9000);
  expect(c.pct).toBeGreaterThan(88);
});

test("le classifieur couvre au moins 73 % des notes de vocabulaire", () => {
  const c = couverture("q-vocabulaire");
  expect(c.n).toBeGreaterThan(17000);
  expect(c.pct).toBeGreaterThan(73);
});
