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

// Non-régression — seconde revue. Chaque note est VERBATIM du corpus (data/graph/q-*.jsonld).
//
// Défaut A : le garde v1 de `registre` (exclure devant une parenthèse/un guillemet fermants)
// écartait aussi l'annotation de registre elle-même — format « « X (registre) » = distracteur »
// — qui EST le signal du piège, pas une glose de kanji. Les deux notes ci-dessous tombaient en
// `autre` avant correctif ; elles doivent désormais matcher `registre`, au même titre que les
// gloses fautives connues (帳, 籍, レコーダー) qui, elles, doivent rester en `autre`.
test("défaut A (seconde revue) : l'annotation de registre « X (registre) » = distracteur matche registre", () => {
  expect(trapKind("« où (neutre) » = どこ")).toBe("registre");
  expect(trapKind("« j'ai compris (neutre) » = わかりました")).toBe("registre");
});

// Défaut B : `but\b` matchait aussi « début » (et « tribut ») — `\b` ne traite pas les lettres
// accentuées comme des caractères de mot, donc `é|début` crée une frontière fictive juste avant
// « but ». Les deux notes suivantes matchaient à tort `nuance-grammaticale` via ce bug ; la
// troisième est le SEUL vrai « but » du corpus et doit continuer à matcher après correctif.
test("défaut B (seconde revue) : but\\b ne matche plus dans début, mais matche toujours un vrai but", () => {
  expect(trapKind("カレー « curry » : début identique")).toBe("autre");
  expect(trapKind("ノック « toc-toc, frapper » : début identique")).toBe("autre");
  expect(trapKind("« but, arrivée » = ゴール")).toBe("nuance-grammaticale");
});

// Défaut C : le mot-clé nu `inexistant` de `graphie-inexistante` (placé tôt dans l'ordre des
// motifs) capturait aussi des notes de LECTURE inexistante — une lecture qui n'existe pas n'est
// pas une graphie qui n'existe pas. Sur des notes VERBATIM du corpus : une retombe sur son motif
// le plus proche (`lecture-erronee` via « erreur ?: », `lecture-on-kun` via « lecture on »),
// l'autre en `autre` faute de motif dédié à une lecture inexistante.
test("défaut C (seconde revue) : une lecture inexistante n'est plus classée graphie-inexistante", () => {
  expect(trapKind("erreur : さん lecture inexistante ici")).toBe("lecture-erronee");
  expect(trapKind("あん : lecture on inexistante pour 愛")).toBe("lecture-on-kun");
  expect(trapKind("はてる : lecture inexistante ici")).toBe("autre");
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
// justement ce qui a caché le défaut 1 : 535 occurrences/482 notes uniques de SENS classées
// `lecture-erronee` passaient le cliquet sans être correctement typées). Après le resserrement
// de `lecture-erronee` (défaut 1), `registre` (défaut 2) et `longueur-voyelle` (collision
// trouvée en même temps, voir l'en-tête de trap-kinds.mjs), la couverture mesurée après la
// revue post-Task 1 était 89,46 % (kanji) et 74,60 % (vocabulaire).
//
// Seconde revue (défauts A/B/C, voir l'en-tête de trap-kinds.mjs) : la couverture kanji ne
// bouge pas (89,46 %, aucun des trois défauts ne touche q-kanji hors une note qui reste
// couverte en changeant de type). La couverture vocabulaire baisse légèrement à 74,57 %
// (13 201 / 17 703, contre 13 207 avant) — +7 notes de registre correctement récupérées
// (défaut A), -6 notes de nuance-grammaticale fautives qui retombent en `autre` (défaut B),
// -7 notes de graphie-inexistante fautives qui retombent en `autre` (défaut C, sur 9 notes
// concernées, 2 restant couvertes sous un autre type). Toujours pas une régression : ce sont
// des notes qui n'auraient jamais dû compter comme « couvertes ». Les seuils (88 / 73) restent
// valides avec la même marge qu'à l'origine (~1,5 point sous la valeur mesurée) : inutile de
// les remonter pour une variation de 0,03 point.
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
