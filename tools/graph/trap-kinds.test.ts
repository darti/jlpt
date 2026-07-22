import { test, expect } from "bun:test";
import { KINDS, trapKind } from "./trap-kinds.mjs";
import { KIND_LABELS } from "../../src/features/quiz/traps.ts";

// La taxonomie a DEUX sources : `KINDS` (côté outil, ici) et les clés de `KIND_LABELS`
// (côté app, pour l'affichage). tsc ne couvre pas `tools/`, donc rien ne les confronte au
// build — ce test le fait. Renommer un motif sans toucher `KIND_LABELS` dégraderait
// l'affichage vers le slug brut (« kanji-partage » au lieu de « Kanji partagé »). Revue finale M2.
test("chaque type de la taxonomie a un libellé d'affichage, et réciproquement", () => {
  for (const k of KINDS) expect(KIND_LABELS[k], `libellé manquant pour ${k}`).toBeString();
  for (const k of Object.keys(KIND_LABELS)) expect(KINDS, `libellé orphelin ${k}`).toContain(k);
});

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

// Non-régression — troisième revue. Chaque note est VERBATIM du corpus (data/graph/q-*.jsonld),
// vérifiée par grep -F avant écriture. Voir l'en-tête de trap-kinds.mjs pour le détail des
// deux défauts et des deux collisions qu'ils ont révélées.
//
// Défaut 1 : `kanji-confondu` matchait le mot-clé nu `autre kanji`, qui capturait aussi le
// gabarit auteur « erreur : « X » est le sens d'un autre kanji » / « … correspond à un autre
// kanji » — des confusions de SENS, pas des confusions VISUELLES de caractère. Une fois
// exclues de kanji-confondu, elles seraient retombées sur `erreur ?:` (lecture-erronee, un
// type tout aussi faux) sans le garde symétrique ajouté à ce motif. Les deux collisions
// (« valeur » → nuance-grammaticale, « registre » → registre, la glose française citée
// servant aussi de mot-clé à un autre motif) sont couvertes séparément ci-dessous.
test("défaut 1 (troisième revue) : une confusion de SENS de kanji ne matche plus kanji-confondu", () => {
  expect(trapKind("Erreur : « registre » est le sens d'un autre kanji")).toBe("autre");
  expect(trapKind("erreur : « court » correspond à un autre kanji")).toBe("autre");
  expect(trapKind("erreur : « fuir, échapper » est le sens d'un autre kanji")).toBe("autre");
  // Les deux collisions révélées PAR le correctif (la glose citée matchait un mot-clé plus
  // loin dans la liste des motifs) : elles doivent elles aussi tomber en `autre`.
  expect(trapKind("erreur : « valeur » est le sens d'un autre kanji")).toBe("autre");
});

// Défaut 2 : `nuance-grammaticale` matchait le mot-clé nu `nuance`, qui capturait des notes de
// VOCABULAIRE parlant d'une nuance de SENS (« nuance différente », « autre nuance », ou le mot
// cité comme glose « nuance »), pas d'un point de grammaire. Resserré en `nuance grammaticale`
// (phrase explicite requise).
test("défaut 2 (troisième revue) : une nuance de SENS ne matche plus nuance-grammaticale", () => {
  expect(trapKind("ニュアンス « nuance » : début identique")).toBe("autre");
  expect(trapKind("周り（まわり）: graphie voisine (« pourtour »), nuance différente ici")).toBe("autre");
  expect(trapKind("止める（とめる/やめる）: graphie voisine, nuance « arrêter » générale")).toBe("autre");
  expect(trapKind("ともかく « quoi qu'il en soit » : forme très proche, nuance différente")).toBe("autre");
  expect(trapKind("穢す : graphie erronée (lecture けがす, autre nuance)")).toBe("autre");
});

// Non-régression — quatrième revue (correction de cause racine, voir l'en-tête de
// trap-kinds.mjs). Chaque note est VERBATIM du corpus (grep -F vérifié avant écriture).
//
// L'attrape-tout `erreur ?:` de `lecture-erronee` a été retiré — remplacé par un motif POSITIF
// qui exige `lecture` ou `se lit` dans la note (sinon la note est classée par ce qu'elle dit,
// via les motifs plus loin dans la liste). Les deux premiers cas prouvent que les gabarits
// nommés (« signifie », « est le sens d'un autre mot ») atteignent bien `sens-different` une fois
// l'attrape-tout retiré ; le troisième prouve la famille sœur, bien plus large, que le même
// défaut cachait (« sens de X » nu, sans « signifie ») ; le quatrième la collision de
// `longueur-voyelle` ; le cinquième la glose « exprimer » citée qui faisait déraper
// `nuance-grammaticale` ; le sixième une collision RÉVÉLÉE par le retrait lui-même (« valeur »
// citée entre guillemets, masquée jusque-là par l'attrape-tout) ; les deux derniers prouvent
// qu'une VRAIE erreur de lecture reste bien `lecture-erronee` — y compris une qui n'emploie ni
// « se lit » ni un des quatre gabarits déjà positifs, seulement le mot « lecture » nu.
test("quatrième revue : le retrait de l'attrape-tout route les notes par leur contenu, pas leur préfixe", () => {
  expect(trapKind("erreur : いりぐち signifie « entrée » (入口)")).toBe("sens-different");
  expect(trapKind("erreur : « ville, cité » est le sens d'un autre mot")).toBe("sens-different");
  expect(trapKind("erreur : sens de 丈")).toBe("sens-different");
  expect(trapKind("erreur : voyelle longue きゅう manquante")).toBe("longueur-voyelle");
  expect(trapKind("表す（あらわす）« exprimer » : sens proche, lecture différente")).toBe("sens-different");
  expect(trapKind("erreur : 値 « valeur » (ne)")).toBe("autre");
  expect(trapKind("erreur : 議 se lit ぎ, pas ご")).toBe("lecture-erronee");
  expect(trapKind("erreur : lecture standard さんにん")).toBe("lecture-erronee");
});

test("KINDS énumère exactement les types produits, autre compris", () => {
  expect(KINDS).toContain("autre");
  expect(KINDS.length).toBe(14);
  for (const [, attendu] of CAS) expect(KINDS).toContain(attendu);
});

import { readFileSync } from "node:fs";

// Mémoïsé : `couverture()` et le garde permanent plus bas lisent chacun `q-kanji`/`q-vocabulaire`
// (2,6 Mo + 5,0 Mo) — sans cache, un seul `bun test` de ce fichier reparsait les deux shards deux
// fois pour rien.
const shardCache = new Map<string, unknown[]>();
function loadShard(shard: string): unknown[] {
  const cached = shardCache.get(shard);
  if (cached) return cached;
  const sujets = JSON.parse(readFileSync(`data/graph/${shard}.jsonld`, "utf8"))["@graph"] ?? [];
  shardCache.set(shard, sujets);
  return sujets;
}

/** Couverture du classifieur sur un shard réel : part des notes de DISTRACTEUR typées. */
function couverture(shard: string): { pct: number; n: number } {
  const sujets = loadShard(shard);
  let n = 0, ok = 0;
  for (const s of sujets as Record<string, unknown>[]) {
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
// des notes qui n'auraient jamais dû compter comme « couvertes ».
//
// Troisième revue (défauts 1/2, voir l'en-tête de trap-kinds.mjs) — le seuil KANJI BAISSE
// nettement cette fois (88 → 80) : la couverture kanji chute à 81,80 % (7 725 / 9 444, contre
// 89,46 % avant), parce que le défaut 1 n'était pas une collision marginale mais l'attrape-tout
// `autre kanji` lui-même — 238 notes uniques (724 occurrences, comptant les deux apostrophes)
// sur q-kanji, TOUTES de simples confusions de sens (« erreur : « X » est le sens d'un autre
// kanji ») qui n'avaient jamais leur place sous `kanji-confondu`. Ce n'est toujours pas une
// régression : ces notes ne testaient RIEN de correct avant (un type FAUX vaut moins qu'un type
// ABSENT) ; les 238 retombent en `autre`, faute de motif dédié à une confusion de sens de kanji
// isolé. La couverture vocabulaire ne bouge presque pas (74,54 %, -5 notes sur 17 703 pour le
// défaut 2) : le seuil vocabulaire (73) reste valide tel quel. Marge conservée à ~1,5-2 points
// sous la valeur mesurée pour les deux seuils.
//
// Quatrième revue — correction de cause racine (voir l'en-tête de trap-kinds.mjs) : le seuil
// KANJI S'EFFONDRE cette fois (80 → 52), bien plus que les « ~1 point » anticipés au départ. Le
// retrait de l'attrape-tout `erreur ?:` fait chuter la couverture kanji à 54,11 % (5 110 / 9 444,
// contre 81,80 % avant) : l'attrape-tout ne gonflait pas seulement la couverture via les deux
// gabarits nommés (signifie/sens : 53 notes ; voyelle/gémination : 19 notes) mais via une masse
// bien plus large et hétéroclite — confusions kanji-pour-contexte (933 notes), confusions on/kun
// formulées sans les mots-clés de `lecture-on-kun`, gloses françaises en égalité, etc. — 2336
// notes/3105 occurrences en tout, TOUTES sur q-kanji, TOUTES retombées en `autre` faute de motif
// dédié. Ce n'est toujours pas une régression : ces 3105 occurrences ne testaient RIEN de correct
// avant, le cliquet ne faisait que les compter à tort comme « couvertes ». La couverture
// vocabulaire ne bouge quasi pas (74,75 %, contre 74,54 % avant — légère HAUSSE grâce aux
// extensions `sens de`/`gémination`, l'attrape-tout n'ayant jamais pesé sur ce shard) : le seuil
// vocabulaire (73) reste valide tel quel, marge inchangée.
test("le classifieur couvre au moins 52 % des notes de kanji", () => {
  const c = couverture("q-kanji");
  expect(c.n).toBeGreaterThan(9000);
  expect(c.pct).toBeGreaterThan(52);
});

test("le classifieur couvre au moins 73 % des notes de vocabulaire", () => {
  const c = couverture("q-vocabulaire");
  expect(c.n).toBeGreaterThan(17000);
  expect(c.pct).toBeGreaterThan(73);
});

// ⚠ GARDE PERMANENT — pas un cliquet de couverture. `couverture()` ci-dessus ne mesure que
// « type ≠ autre » : c'est exactement ce qui a caché le défaut 1 pendant trois revues (724
// occurrences de confusion de SENS comptées comme « couvertes » sous `kanji-confondu`, un type
// FAUX). Le test suivant mesure autre chose : « pas manifestement faux ». Pour chaque note du
// corpus réel, il applique `trapKind`, regarde le type produit et vérifie que la note ne porte
// aucune des CONTRE-MARQUES de ce type — une sous-chaîne qui, par construction, prouve que ce
// type ne peut pas être le bon (cf. les motifs des trois revues successives ci-dessus). C'est ce
// garde-là, pas un futur relecteur humain, qui doit attraper la prochaine collision de cette
// classe : il tourne à chaque `bun test`, sur les 10 307 questions réelles, sans exemple à jour.
//
// La table est délibérément incomplète : elle ne couvre QUE les types pour lesquels une
// collision a déjà été mesurée (les défauts documentés dans l'en-tête, jusqu'à la correction de
// cause racine de la quatrième revue incluse). Ajouter une entrée sans preuve mesurée irait
// contre le principe « mesuré, jamais deviné » du fichier.
//
// `Partial<...>` (pas `Record<string, RegExp[]>`) : une clé absente est le cas normal (7 des 14
// types n'ont pas de contre-marque connue), pas une erreur — l'accès `CONTRE_MARQUES[type]`
// renvoie honnêtement `RegExp[] | undefined`, gardé par `if (!marques) return;` juste en dessous.
const CONTRE_MARQUES: Partial<Record<string, RegExp[]>> = {
  // Défaut 1 (troisième revue) + collisions qu'il a révélées.
  "kanji-confondu": [/est le sens d['’]un autre kanji/i, /correspond à un autre kanji/i],
  // Quatrième revue (cause racine) : `lecture-erronee` n'utilise plus l'attrape-tout `erreur ?:`,
  // mais le garde reste étendu très large par prudence — une régression future qui réintroduirait
  // un attrape-tout doit être détectée immédiatement. `autre mot` est bornée : elle ne doit PAS
  // signaler les 2 notes du corpus où l'auteur écrit EXPLICITEMENT « lecture erronée » en toutes
  // lettres (« まずまず : autre mot (« passable »), lecture erronée » et l'équivalent pour
  // むすこ) — sa propre résolution de l'ambiguïté, pas une collision.
  "lecture-erronee": [
    /ne signifie pas/i,
    /ne correspond pas/i,
    /\best un sens\b/i,
    /est le sens d['’]un autre kanji/i,
    /correspond à un autre kanji/i,
    /signifie/i,
    /\best le sens\b/i,
    /autre mot(?![\s\S]*(?:lecture erron|lecture fausse|mauvaise lecture|lecture approximative))/i,
    /voyelle longue/i,
    /g[ée]mination/i,
    /allongement/i,
  ],
  // Défaut 2 (troisième revue) : nuance de SENS citée en vocabulaire, pas un point de grammaire.
  // Quatrième revue : une glose « exprimer » citée entre guillemets n'est pas un point de
  // grammaire non plus (même famille de bug, mot-clé `exprime` au lieu de `nuance`).
  "nuance-grammaticale": [/nuance différente/i, /autre nuance/i, /«\s*exprimer\s*»/i],
  // Défaut « registre » v2 (seconde revue) + collision révélée par le défaut 1 : une glose
  // française CITÉE (traduction du kanji) n'est pas le type de piège lui-même.
  "registre": [
    /«\s*(?:registre|poli|neutre|familier|honorifiques?)\s*»\s*:/i,
    /est le sens d['’]un autre kanji/i,
    /correspond à un autre kanji/i,
  ],
  // Défaut C (seconde revue) : une lecture inexistante n'est pas une graphie inexistante.
  "graphie-inexistante": [/lecture[\s\S]*inexistant/i],
  // Défaut post-Task 1 (`manquant` seul) : okurigana/honorifique manquants ne sont pas une
  // longueur de voyelle.
  "longueur-voyelle": [/okurigana/i, /honorifi/i],
};

// Auto-contrôle de la table elle-même : une clé mal orthographiée (ex. `"kanji-confondue"`) ne
// lèverait jamais d'erreur ailleurs — `CONTRE_MARQUES[type]` renverrait juste `undefined` pour
// le VRAI type, et le garde resterait silencieusement désactivé pour ce défaut. Vérifié ici une
// fois pour toutes, plutôt que de compter sur chaque relecture pour repérer la faute de frappe.
test("CONTRE_MARQUES ne porte que des clés qui sont de vrais types de la taxonomie", () => {
  for (const cle of Object.keys(CONTRE_MARQUES)) expect(KINDS).toContain(cle);
});

test("garde permanent : aucun type ne matche une note portant sa propre contre-marque", () => {
  const violations: string[] = [];
  for (const shard of ["q-kanji", "q-vocabulaire"]) {
    const sujets = loadShard(shard);
    for (const sujet of sujets as Record<string, unknown>[]) {
      const notes = sujet["jlpt:optionNote"], ans = sujet["jlpt:answer"];
      if (!Array.isArray(notes)) continue;
      notes.forEach((note: unknown, i: number) => {
        if (i === ans || typeof note !== "string") return;
        const type = trapKind(note);
        const marques = CONTRE_MARQUES[type];
        if (!marques) return;
        const marque = marques.find((re) => re.test(note));
        if (marque) violations.push(`[${shard}] type=${type} contre-marque=${marque} note="${note}"`);
      });
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `${violations.length} note(s) matchent un type dont la contre-marque prouve qu'il est faux :\n` +
        violations.slice(0, 10).join("\n"),
    );
  }
});
