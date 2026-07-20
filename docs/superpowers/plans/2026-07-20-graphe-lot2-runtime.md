# Graphe JSON-LD — Lot 2 : bascule de la lecture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** L'app lit `data/graph/` au lieu de `bank-*.json` et `dict.json`, sans que les couches pures du moteur changent d'une ligne.

**Architecture :** `loadCategory` fetche `q-<compétence>.jsonld` et projette les sujets vers le type `Question` interne. Les couches pures (`pickAdaptive`, `allocateCount`, `composeSession`, `selectDiagnostic`, `elo`, `scoring`) reçoivent exactement ce qu'elles recevaient : leurs tests passent inchangés, et c'est ce qui prouve que la migration n'a pas touché aux règles du moteur.

**Tech stack :** React + TS bundlé par Bun ; `tools/*.mjs` reste Node-compatible.

## Global Constraints

- **C'est le SEUL lot à risque runtime.** Il se valide en servant le build localement (`bun run build && bunx serve _site`) avant tout push — pas seulement par `bun test`.
- **Les couches pures ne changent pas.** Si un test de `bank.test.ts`, `elo.test.ts` ou `scoring.test.ts` doit être modifié, c'est le signe d'une erreur : arrêter et remonter.
- **TROIS inventaires de fichiers livrés à garder synchro** (cf. CLAUDE.md) : `tools/copy-static.mjs` (`isServedData`), `scripts/dev.ts` (`STATIC_FILES`), `sw.js` (`SHELL`). En rater un donne une panne silencieuse et locale à un seul contexte.
- **Bumper `CACHE` dans `sw.js`** : les fichiers livrés changent, les clients doivent recharger.
- **Ne rien supprimer.** `bank-*.json`, `dict.json` et l'ancien `validate.mjs` restent en place jusqu'au lot 4. On bascule la lecture, on ne fait pas le ménage.
- **`ord` groupé par compétence** — décision de ce lot, cf. Task 1. Possible uniquement parce que la progression est remise à zéro.

## Amendements du 2026-07-20 (relecture avant exécution)

Six écarts entre le plan et le code réel, arbitrés avant la première ligne. Le plan ci-dessous
est amendé en conséquence ; ces notes disent **pourquoi**.

1. **`sw.js#isData` ne reconnaît pas `.jsonld`.** Le prédicat est
   `pathname.includes('/data/') && pathname.endsWith('.json')` : un `.jsonld` tombe dans la
   branche **cache-first**, celle des icônes — le corpus serait figé à vie chez un client.
   C'est exactement la panne que le commentaire d'en-tête de `sw.js` décrit avoir déjà coûté un
   plantage. Task 5 étend le prédicat. **Non négociable, ce n'est pas un choix de politique.**

2. **Précache : `SHELL` atomique + `GRAPH` best-effort.** Le précache complet du graphe est
   demandé (hors ligne dès la première visite). Mais `cache.addAll()` est **atomique** : un seul
   404 ou une coupure au milieu des 4,7 Mo de `q-vocabulaire` rejette la promesse → `install`
   échoue → **aucun** service worker activé, donc plus de hors ligne du tout. Avec 8 petits
   fichiers le risque était théorique ; avec 10 Mo il ne l'est plus. Deux listes donc :
   `SHELL` (coquille, `addAll`, échouer est correct si l'index manque) et `GRAPH` (contenu,
   `allSettled` — un document manquant dégrade le hors ligne, il ne tue pas le SW).

3. **Le poids n'est pas un problème : +18 % sur le fil, pas +55 %.** Brut, le graphe pèse
   9,82 Mo contre 6,33 Mo pour l'ancien modèle. **Gzippé, 1,26 Mo contre 1,07 Mo** — le JSON-LD
   verbeux (`"jlpt:difficulty"` × 10 307) est précisément ce que LZ77 mange. Et GitHub Pages
   compresse bien `application/ld+json` (vérifié sur `w3c.github.io/json-ld-api/tests/*.jsonld` :
   `content-encoding: gzip`). **Aucune compression applicative** : servir des `.jsonld.gz`
   décompressés par `DecompressionStream` remplacerait un mécanisme natif et négocié
   (`Accept-Encoding`, brotli à 0,97 Mo si le serveur le propose) par du code figé. On ne minifie
   pas non plus : les documents restent relisibles en diff, ce qui compte pour les corrections
   de contenu. Le vrai coût du graphe est le parse et la mémoire, pas la bande passante.

4. **Task 3 : cinq fichiers de test manquent dans la liste `Files`.** `useCoverage.test.tsx` et
   `EntrainementApp.{start,recording,learn,diagnostic}.test.tsx` importent `clearBankIndexCache`
   et simulent l'URL `bank-index.json` ; ils cassent tous. Ce ne sont pas des couches pures —
   les modifier est légitime — mais l'omission devait être dite plutôt que découverte.

5. **Task 5 Step 1 se contredisait.** Le test exige `isServedData("q-kanji.jsonld") === true`,
   la note dessous demande d'énumérer `data/graph` séparément — auquel cas `isServedData` ne voit
   jamais ces noms et le test ne garde plus rien. Résolution : `isServedData` accepte aussi les
   `.jsonld` **et** `copyStatic` énumère `data/graph` avec ce même prédicat. Un seul inventaire,
   un test qui mord.

6. **Task 6 décrivait des vérifications hors périmètre.** `src/features/cours` n'est pas migré
   dans ce lot (il lit toujours `data/cours-*.json`) et `toQuestion` ne projette pas `tests` :
   le « Rappel de cours » reste l'ancien mécanisme, par parsing du corrigé. Ces deux points
   deviennent des contrôles de **non-régression**, pas des nouveautés à constater.

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `data/graph/corpus.jsonld` | 5 sujets `jlpt:SkillRange` : borne et effectif par compétence |
| `src/lib/graph.ts` | **nouveau** — fetch + projection JSON-LD → `Question`, index mémoire |
| `src/lib/bank.ts` | `loadCategory` / `loadBankIndex` passent par `graph.ts` |
| `src/lib/dict.ts` | `furi()` interroge l'index des mots du graphe |
| `tools/migrate-to-graph.mjs` | attribue les `ord` groupés, émet `corpus.jsonld` |
| `tools/graph/integrity.mjs` | vérifie que `corpus.jsonld` correspond aux questions réelles |

---

### Task 1: Ordinaux groupés par compétence + `corpus.jsonld`

**Files:**
- Modify: `tools/migrate-to-graph.mjs`
- Modify: `tools/graph/integrity.mjs`
- Modify: `data/graph/shapes.jsonld`
- Test: `tools/graph/migrate.test.ts`, `tools/graph/integrity.test.ts`

**Interfaces:**
- Produit : `buildQuestions()` attribue les `ord` groupés par compétence, dans l'ordre de `SKILLS` ; `buildCorpus(bySkill) -> object[]` émet les 5 `jlpt:SkillRange`.

**Pourquoi.** `bank-index.json` (190 Ko) mappe id → compétence. Avec des ordinaux groupés, cette information tient en 5 intervalles. Le fichier disparaît au lieu d'être remplacé par un dérivé qui pourrait se désynchroniser — et `checkCorpus` vérifie les intervalles contre les questions réelles, donc la dérive est impossible, pas seulement improbable.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
test("buildQuestions groupe les ordinaux par compétence, sans trou", () => {
  const { bySkill, total } = buildQuestions({ kanji: [], word: [], gram: [] });
  let attendu = 0;
  for (const skill of ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"]) {
    const ords = bySkill[skill].map((q) => q["jlpt:ord"]);
    expect(ords[0]).toBe(attendu);                       // contigu avec la précédente
    expect(ords).toEqual(ords.map((_, i) => attendu + i)); // et dense à l'intérieur
    attendu += ords.length;
  }
  expect(attendu).toBe(total);
});

test("buildCorpus décrit exactement les intervalles produits", () => {
  const { bySkill } = buildQuestions({ kanji: [], word: [], gram: [] });
  const corpus = buildCorpus(bySkill);
  expect(corpus).toHaveLength(5);
  for (const r of corpus) {
    const qs = bySkill[r["jlpt:skill"]];
    expect(r["jlpt:count"]).toBe(qs.length);
    expect(r["jlpt:from"]).toBe(qs[0]["jlpt:ord"]);
  }
});
```

Et dans `integrity.test.ts` :

```ts
test("checkCorpus refuse un SkillRange qui ment sur les questions réelles", () => {
  const q = (ord: number, skill: string) => ({
    "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question", "jlpt:ord": ord,
    "jlpt:stem": "x", opts: ["a", "b"], "jlpt:answer": 0,
    "jlpt:skill": skill, "jlpt:difficulty": 1,
  });
  const faux = {
    "@id": "jlpt:corpus/kanji", "@type": "jlpt:SkillRange",
    "jlpt:skill": "kanji", "jlpt:from": 0, "jlpt:count": 99,
  };
  expect(checkCorpus([q(0, "kanji"), faux]).join(" ")).toMatch(/SkillRange/);
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun test tools/graph/migrate.test.ts tools/graph/integrity.test.ts`
Expected: FAIL — `buildCorpus is not a function`, et les ordinaux ne sont pas groupés.

- [ ] **Step 3: Grouper les ordinaux dans `buildQuestions`**

Remplacer l'attribution `ord` par un premier passage qui range les questions par compétence, puis numérote compétence après compétence dans l'ordre de `SKILLS` :

```js
  // Deux passes : on range d'abord par compétence, on numérote ensuite. L'ordinal
  // groupé permet à corpus.jsonld de décrire tout le corpus en 5 intervalles au lieu
  // d'un index de 190 Ko — et un index absent ne peut pas se désynchroniser.
  const brut = Object.fromEntries(SKILLS.map((s) => [s, []]));
  for (const [source, q0] of bank.entries()) {
    if (isDropped(source)) continue;
    brut[q0.cat].push({ source, q: applyFixes(q0, source) });
  }

  const bySkill = Object.fromEntries(SKILLS.map((s) => [s, []]));
  let ord = 0;
  let linked = 0;
  for (const skill of SKILLS) {
    for (const { q } of brut[skill]) {
      const tests = edgesFor(q, { known, gramByForm });
      if (tests.length) linked++;
      bySkill[skill].push(sujetQuestion(q, ord, tests));
      ord++;
    }
  }
  return { bySkill, linkRate: ord ? linked / ord : 0, total: ord };
```

Extraire au passage `edgesFor(q, ctx)` et `sujetQuestion(q, ord, tests)` depuis le corps actuel de la boucle — même code, déplacé, pour que la double boucle reste lisible.

- [ ] **Step 4: Ajouter `buildCorpus`**

```js
/** Décrit le corpus en 5 intervalles. Remplace bank-index.json (190 Ko) : avec des
 *  ordinaux groupés, « à quelle compétence appartient l'id N » est une comparaison de
 *  bornes. checkCorpus vérifie ces intervalles contre les questions réelles — c'est ce
 *  qui rend la désynchronisation impossible, et non seulement improbable. */
export function buildCorpus(bySkill) {
  const out = [];
  for (const skill of SKILLS) {
    const qs = bySkill[skill];
    if (!qs.length) continue;
    out.push({
      "@id": `jlpt:corpus/${skill}`, "@type": "jlpt:SkillRange",
      "jlpt:skill": skill,
      "jlpt:from": qs[0]["jlpt:ord"],
      "jlpt:count": qs.length,
    });
  }
  return out;
}
```

Et dans le bloc d'exécution, après l'écriture des shards :

```js
  writeFileSync("data/graph/corpus.jsonld", doc(buildCorpus(bySkill)));
```

- [ ] **Step 5: Déclarer la shape**

Ajouter à `data/graph/shapes.jsonld`, dans `@graph` :

```json
    {
      "@id": "jlpt:SkillRangeShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:SkillRange",
      "sh:property": [
        { "sh:path": "jlpt:skill", "sh:in": ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"], "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:from", "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:count", "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 }
      ]
    }
```

Et corriger le test `shapes.jsonld se parse et couvre les cinq types du domaine` : il y en a six désormais (`SkillRange` s'ajoute).

- [ ] **Step 6: Vérifier les intervalles dans `checkCorpus`**

Ajouter, après le contrôle des ordinaux :

```js
  // --- cohérence des SkillRange ---
  // corpus.jsonld décrit le corpus ; s'il ment, l'app résout les ids vers la mauvaise
  // compétence sans la moindre erreur. On le confronte donc aux questions réelles.
  const ranges = subjects.filter((s) => arr(s["@type"]).includes("jlpt:SkillRange"));
  if (ranges.length) {
    const parSkill = new Map();
    for (const q of questions) {
      const s = q["jlpt:skill"];
      if (!parSkill.has(s)) parSkill.set(s, []);
      parSkill.get(s).push(q["jlpt:ord"]);
    }
    for (const r of ranges) {
      const ords = (parSkill.get(r["jlpt:skill"]) ?? []).sort((a, b) => a - b);
      const from = r["jlpt:from"];
      const count = r["jlpt:count"];
      if (ords.length !== count) {
        errs.push(`SkillRange ${r["jlpt:skill"]} : count ${count}, mais ${ords.length} questions`);
      } else if (ords.length && (ords[0] !== from || ords[ords.length - 1] !== from + count - 1)) {
        errs.push(`SkillRange ${r["jlpt:skill"]} : intervalle [${from}, ${from + count - 1}] ≠ réel [${ords[0]}, ${ords[ords.length - 1]}]`);
      }
    }
  }
```

- [ ] **Step 7: Régénérer et valider**

Run: `bun tools/migrate-to-graph.mjs && bun tools/validate-graph.mjs`
Expected: `✓ graphe valide`, avec `jlpt:SkillRange 5` dans le décompte par type.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(graph): ordinaux groupés par compétence + corpus.jsonld"
```

---

### Task 2: `src/lib/graph.ts` — fetch et projection

**Files:**
- Create: `src/lib/graph.ts`, `src/lib/graph.test.ts`

**Interfaces:**
- Produit : `toQuestion(subject) -> Question` ; `loadSkill(skill, fetchImpl?) -> Promise<Question[]>` (mémoïsé) ; `loadCorpus(fetchImpl?) -> Promise<SkillRange[]>` ; `skillOfOrd(ord, ranges) -> Skill | null` ; `clearGraphCache()`.

**Pourquoi.** Le moteur travaille sur le type `Question` interne. La projection vit ici, en un seul endroit, pour que les couches pures ne sachent rien du JSON-LD.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { test, expect } from "bun:test";
import { toQuestion, skillOfOrd, loadSkill, clearGraphCache } from "./graph.ts";

const sujet = {
  "@id": "jlpt:q/7", "@type": "jlpt:Question",
  "jlpt:skill": "kanji", "jlpt:difficulty": 2, "jlpt:ord": 7,
  "jlpt:stem": "「政治」の読み方は？",
  opts: ["せいじ", "せいち", "しょうじ", "しょうち"], "jlpt:answer": 0,
  "schema:description": "<b>政治</b> = politique.",
  "jlpt:gloss": "政治（せいじ）",
  "jlpt:optionNote": ["a", "b", "c", "d"],
  tests: ["jlpt:word/政治"],
};

test("toQuestion projette un sujet vers le type interne du moteur", () => {
  const q = toQuestion(sujet);
  expect(q.id).toBe(7);
  expect(q.cat).toBe("kanji");
  expect(q.d).toBe(2);
  expect(q.q).toBe("「政治」の読み方は？");
  expect(q.o).toHaveLength(4);
  expect(q.a).toBe(0);
  expect(q.e).toContain("politique");
  expect(q.g).toBe("政治（せいじ）");
  expect(q.od).toHaveLength(4);
});

test("toQuestion conserve script et passage quand ils existent", () => {
  const q = toQuestion({ ...sujet, "jlpt:script": "音声", "jlpt:passage": "文章" });
  expect(q.script).toBe("音声");
  expect(q.passage).toBe("文章");
});

test("toQuestion n'invente pas les champs optionnels absents", () => {
  const q = toQuestion({
    "@id": "jlpt:q/0", "jlpt:skill": "lecture", "jlpt:difficulty": 1, "jlpt:ord": 0,
    "jlpt:stem": "x", opts: ["a", "b"], "jlpt:answer": 1,
  });
  expect(q.e).toBeUndefined();
  expect(q.od).toBeUndefined();
  expect(q.a).toBe(1);
});

test("skillOfOrd résout un ordinal via les intervalles", () => {
  const ranges = [
    { skill: "grammaire", from: 0, count: 3 },
    { skill: "kanji", from: 3, count: 2 },
  ];
  expect(skillOfOrd(0, ranges)).toBe("grammaire");
  expect(skillOfOrd(2, ranges)).toBe("grammaire");
  expect(skillOfOrd(3, ranges)).toBe("kanji");
  expect(skillOfOrd(4, ranges)).toBe("kanji");
  expect(skillOfOrd(5, ranges)).toBeNull(); // hors corpus
});

test("loadSkill mémoïse : deux appels, un seul fetch", async () => {
  clearGraphCache();
  let n = 0;
  const fetchImpl = async () => { n++; return { json: async () => ({ "@graph": [sujet] }) }; };
  await loadSkill("kanji", fetchImpl);
  await loadSkill("kanji", fetchImpl);
  expect(n).toBe(1);
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun test src/lib/graph.test.ts`
Expected: FAIL — `Cannot find module './graph.ts'`

- [ ] **Step 3: Implémenter `src/lib/graph.ts`**

```ts
import type { Skill } from "../types/progress.ts";
import type { Difficulty, Question } from "../types/quiz.ts";

export type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;
export interface SkillRange { skill: Skill; from: number; count: number }

type Sujet = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const list = (v: unknown): string[] | undefined => (Array.isArray(v) ? (v as string[]) : undefined);

/**
 * Projette un sujet JSON-LD vers le type `Question` du moteur.
 *
 * C'est le SEUL endroit qui connaît le vocabulaire du graphe : les couches pures
 * (`pickAdaptive`, `allocateCount`, `composeSession`…) continuent de recevoir exactement
 * ce qu'elles recevaient, et leurs tests passent inchangés — c'est ce qui prouve que la
 * bascule n'a pas touché aux règles.
 */
export function toQuestion(s: Sujet): Question {
  const q: Question = {
    id: s["jlpt:ord"] as number,
    cat: s["jlpt:skill"] as Skill,
    d: s["jlpt:difficulty"] as Difficulty,
    q: String(s["jlpt:stem"] ?? ""),
    o: (list(s.opts) ?? []),
    a: s["jlpt:answer"] as number,
  };
  const e = str(s["schema:description"]); if (e !== undefined) q.e = e;
  const g = str(s["jlpt:gloss"]); if (g !== undefined) q.g = g;
  const od = list(s["jlpt:optionNote"]); if (od !== undefined) q.od = od;
  const script = str(s["jlpt:script"]); if (script !== undefined) q.script = script;
  const passage = str(s["jlpt:passage"]); if (passage !== undefined) q.passage = passage;
  return q;
}

const cache = new Map<Skill, Promise<Question[]>>();
let corpusPromise: Promise<SkillRange[]> | null = null;

/** Vide les mémoïsations. Les tests partagent le module (cf. CLAUDE.md, happy-dom
 *  préchargé pour toute la suite) : sans ça, un test pollue le suivant. */
export function clearGraphCache(): void {
  cache.clear();
  corpusPromise = null;
}

export function loadSkill(skill: Skill, fetchImpl: FetchLike = fetch as FetchLike): Promise<Question[]> {
  let p = cache.get(skill);
  if (!p) {
    p = fetchImpl(`data/graph/q-${skill}.jsonld`)
      .then((r) => r.json() as Promise<{ "@graph"?: Sujet[] }>)
      .then((doc) => (doc["@graph"] ?? []).map(toQuestion));
    cache.set(skill, p);
  }
  return p;
}

export function loadCorpus(fetchImpl: FetchLike = fetch as FetchLike): Promise<SkillRange[]> {
  if (!corpusPromise) {
    corpusPromise = fetchImpl("data/graph/corpus.jsonld")
      .then((r) => r.json() as Promise<{ "@graph"?: Sujet[] }>)
      .then((doc) => (doc["@graph"] ?? []).map((s) => ({
        skill: s["jlpt:skill"] as Skill,
        from: s["jlpt:from"] as number,
        count: s["jlpt:count"] as number,
      })));
  }
  return corpusPromise;
}

/** Compétence d'un ordinal, par comparaison de bornes. Remplace la lecture d'un index
 *  de 190 Ko : les ordinaux étant groupés par compétence, 5 intervalles suffisent. */
export function skillOfOrd(ord: number, ranges: SkillRange[]): Skill | null {
  for (const r of ranges) {
    if (ord >= r.from && ord < r.from + r.count) return r.skill;
  }
  return null;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test src/lib/graph.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph.ts src/lib/graph.test.ts
git commit -m "feat(graph): projection JSON-LD → Question et index par intervalles"
```

---

### Task 3: `bank.ts` lit le graphe

**Files:**
- Modify: `src/lib/bank.ts`
- Modify: `src/lib/bank.test.ts` (uniquement les tests de CHARGEMENT ; ceux des couches pures ne bougent pas)
- Modify: `src/features/dashboard/useCoverage.ts`, `src/features/quiz/useQuiz.ts`, `src/lib/coverage.ts`
- Modify (amendement 4, absents du plan initial) : `src/features/dashboard/useCoverage.test.tsx`,
  `src/EntrainementApp.start.test.tsx`, `src/EntrainementApp.recording.test.tsx`,
  `src/EntrainementApp.learn.test.tsx`, `src/EntrainementApp.diagnostic.test.tsx` — tous
  simulent `bank-index.json` et/ou importent `clearBankIndexCache`.

**Interfaces:**
- `loadCategory(cat, fetchImpl?)` délègue à `graph.loadSkill`.
- `loadBankIndex` **disparaît** ; `coverageBySkill` et `countUnseen` prennent des `SkillRange[]` au lieu d'un `Record<number, Skill>`.

**Pourquoi.** `bank-index.json` n'existe plus. `coverage.ts` bucketait les ids via cet index ; il le fait désormais par comparaison de bornes, ce qui supprime une lecture de 190 Ko au démarrage.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/lib/coverage.test.ts`, remplacer les cas qui construisent un `Record<number, Skill>` par des intervalles :

```ts
test("coverageBySkill compte vu/appris par compétence via les intervalles", () => {
  const ranges = [
    { skill: "grammaire" as const, from: 0, count: 2 },
    { skill: "kanji" as const, from: 2, count: 2 },
  ];
  let seen = emptyBits(); seen = setBit(seen, 0); seen = setBit(seen, 2);
  let mastered = emptyBits(); mastered = setBit(mastered, 0);
  const c = coverageBySkill(seen, mastered, ranges);
  expect(c.grammaire).toEqual({ seen: 50, mastered: 50, seenN: 1, masteredN: 1, total: 2 });
  expect(c.kanji.seenN).toBe(1);
  expect(c.kanji.masteredN).toBe(0);
});

test("countUnseen compte les ordinaux du corpus dont le bit seen est absent", () => {
  const ranges = [{ skill: "kanji" as const, from: 0, count: 4 }];
  let seen = emptyBits(); seen = setBit(seen, 1);
  expect(countUnseen(seen, ranges)).toBe(3);
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun test src/lib/coverage.test.ts`
Expected: FAIL — signature incompatible.

- [ ] **Step 3: Réécrire `coverageBySkill` et `countUnseen` sur les intervalles**

Remplacer la boucle sur les entrées de l'index par une boucle sur les intervalles :

```ts
export function coverageBySkill(
  seen: Uint8Array, mastered: Uint8Array, ranges: SkillRange[],
): Record<Skill, SkillCoverage> {
  const out = {} as Record<Skill, SkillCoverage>;
  for (const r of ranges) {
    let seenN = 0, masteredN = 0;
    for (let ord = r.from; ord < r.from + r.count; ord++) {
      if (hasBit(seen, ord)) seenN++;
      if (hasBit(mastered, ord)) masteredN++;
    }
    const pct = (n: number) => (r.count ? Math.round((n / r.count) * 100) : 0);
    out[r.skill] = { seen: pct(seenN), mastered: pct(masteredN), seenN, masteredN, total: r.count };
  }
  return out;
}

export function countUnseen(seen: Uint8Array, ranges: SkillRange[]): number {
  let n = 0;
  for (const r of ranges) {
    for (let ord = r.from; ord < r.from + r.count; ord++) if (!hasBit(seen, ord)) n++;
  }
  return n;
}
```

- [ ] **Step 4: Brancher `bank.ts` et les appelants**

Dans `bank.ts` : `loadCategory` délègue à `loadSkill`, `loadBankIndex`/`clearBankIndexCache` disparaissent, `clearCategoryCache` délègue à `clearGraphCache`. Dans `useCoverage.ts` : `useAsyncOnce(loadCorpus)` au lieu de `loadBankIndex`. Dans `useQuiz.ts` : `ensureBankIndex` fetche `data/graph/corpus.jsonld` et `questionsForIds` résout via `skillOfOrd`.

- [ ] **Step 5: Vérifier que les couches pures n'ont pas bougé**

Run: `bun test src/lib/elo.test.ts src/lib/scoring.test.ts src/features/entrainement/sessionPlan.test.ts`
Expected: PASS sans qu'aucun de ces fichiers ait été modifié. **Si l'un a dû l'être, s'arrêter et remonter** — c'est le signe que la bascule a touché aux règles du moteur.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(graph): bank.ts et la couverture lisent le graphe"
```

---

### Task 4: `dict.ts` interroge le graphe

**Files:**
- Modify: `src/lib/dict.ts`, `src/AppShell.tsx`
- Modify: `src/lib/dict.runtime.test.ts`

**Interfaces:**
- `setupDict` charge `data/graph/word.jsonld` et alimente l'index de `furi()`.

**Pourquoi.** `dict.json` est absorbé par `word.jsonld`. La contradiction `dict` ↔ `vocab` n'a plus de support : il n'y a qu'un nœud par mot.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
test("setupDict alimente furi() depuis word.jsonld", async () => {
  applyDictData({});
  globalThis.fetch = (async () => new Response(JSON.stringify({
    "@graph": [{ "@id": "jlpt:word/本", "@type": "jlpt:Word",
                 "schema:name": "本", "jlpt:reading": "ほん", "schema:description": "livre" }],
  }))) as unknown as typeof fetch;
  await setupDict("data/graph/word.jsonld");
  expect(furi("本")).toContain("<rt>ほん</rt>");
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun test src/lib/dict.runtime.test.ts`
Expected: FAIL — le format attendu par `applyDictData` est l'ancien.

- [ ] **Step 3: Adapter `applyDictData` au format graphe**

Ajouter une projection `wordsToDict(subjects)` qui produit la `Dict` interne (`{mot: {r, m}}`) depuis les sujets `jlpt:Word`, et faire pointer `setupDict` sur `data/graph/word.jsonld`. Mettre à jour l'URL par défaut dans `AppShell.tsx`.

- [ ] **Step 4: Lancer les tests furigana**

Run: `bun test src/lib/dict.test.ts src/lib/dict.runtime.test.ts src/lib/dict.visualbreak.test.ts`
Expected: PASS. ⚠ `CLEAN_FURI_RE` doit continuer de rejeter les vidages on/kun (cf. CLAUDE.md, régression Q#1180) — ces tests le gardent.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(graph): dict.ts lit word.jsonld"
```

---

### Task 5: Les trois inventaires + le cache

**Files:**
- Modify: `tools/copy-static.mjs`, `scripts/dev.ts`, `sw.js`
- Modify: `tools/copy-static.test.ts`

**Pourquoi.** En rater un donne une panne **silencieuse et locale à un seul contexte** : 404 en dev seulement, ou absence hors ligne seulement, ou `_site` périmé en prod seulement.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
test("isServedData livre les documents du graphe", () => {
  for (const f of ["q-kanji.jsonld", "corpus.jsonld", "word.jsonld", "context.jsonld"]) {
    expect(isServedData(f), `${f} doit être livré`).toBe(true);
  }
});
```

⚠ `isServedData` reçoit des noms de fichiers de `readdirSync("data")`, pas des chemins : `data/graph/` est un **répertoire**. **Amendement 5** — le plan initial se contredisait ici (le test exige que `isServedData` accepte `q-kanji.jsonld`, la note demandait de l'en dispenser). Retenu : `isServedData` accepte aussi les `.jsonld`, **et** `copyStatic` énumère `data/graph` avec ce même prédicat. Un seul inventaire, un test qui mord.

- [ ] **Step 2 à 4: Implémenter, tester, vérifier les trois inventaires**

`copy-static.mjs` copie `data/graph/*.jsonld` ; `scripts/dev.ts` ajoute les chemins à `STATIC_FILES` ; `sw.js` bumpe `CACHE` (`jlpt-n3-vN` → `vN+1`) et, **amendements 1 et 2** :

- `isData` doit reconnaître `.jsonld` — sinon les documents du graphe passent en **cache-first** et le corpus est figé à vie chez le client ;
- le précache complet du graphe se fait en **deux listes** : `SHELL` (coquille, `addAll`, atomique) et `GRAPH` (contenu, `allSettled`, best-effort). `addAll` sur 10 Mo ferait échouer toute l'installation du SW sur une seule requête ratée — et sans SW, plus de hors ligne du tout.

Run: `bun test tools/copy-static.test.ts && bun run build && ls _site/data/graph/`
Expected: les 10 documents présents dans `_site/data/graph/`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "build(graph): livre data/graph/ (trois inventaires + bump du cache SW)"
```

---

### Task 6: Vérification dans un vrai navigateur

**Pourquoi.** C'est le seul lot à risque runtime, et `bun test` ne prouve pas qu'une app servie sur HTTP fonctionne : le service worker, les `fetch` relatifs et le cache ne s'exercent que là.

- [ ] **Step 1: Servir le build**

```bash
bun run build && bunx serve _site
```

- [ ] **Step 2: Vérifier à la main, dans l'ordre**

1. Accueil : le tableau de bord et les anneaux de couverture s'affichent (ils dépendent de `corpus.jsonld`).
2. Entraînement : démarrer une session, répondre, voir le corrigé. **Non-régression** (amendement 6) : le « Rappel de cours » repose toujours sur l'ancien mécanisme — `toQuestion` ne projette pas les arêtes `tests`, qui ne seront consommées qu'au lot 3. On vérifie qu'il n'a pas *disparu*, pas qu'il s'est amélioré.
3. Cours : une leçon affiche ses items. **Non-régression** : `src/features/cours` lit encore `data/cours-*.json`, il n'est pas migré dans ce lot.
4. Furigana : taper un mot ouvre le popup avec lecture et sens.
5. Hors ligne : recharger après avoir coupé le réseau.

⚠ Changer le hash (`#/x`) NE recharge PAS la page : faire un vrai `location.reload()` pour charger le nouveau bundle.

- [ ] **Step 3: Commit du constat**

Consigner ce qui a été vérifié dans le message de commit ou le ledger. Ne pas pousser sans cette étape.

#### Constat du 2026-07-20 — Chromium 143 headless, build servi sur `http://localhost:4173`

L'extension Chrome n'était pas connectée et Playwright ne trouvait pas de canal `chrome` :
vérification menée en pilotant **directement en CDP** le Chromium installé par Playwright
(`chromium-1200`). Vraie origine HTTP, vrai service worker, vrai cache.

| Contrôle | Résultat |
|---|---|
| Accueil — anneaux de couverture | dénominateurs **1174 / 5901 / 3148 / 52**, soit exactement les 5 `SkillRange` de `corpus.jsonld` |
| Entraînement — session | démarre, question affichée (`#405`, `Question 1 / 15`) |
| Entraînement — réponse | corrigé affiché avec explication et « Analyse de la phrase » |
| Progression écrite | `total: 1`, `skill: ["grammaire"]`, bit `seen` posé sur l'**ordinal 405** |
| **Boucle fermée** | 405 ∈ intervalle grammaire [0, 1173] selon `corpus.jsonld` **et** compétence écrite = `grammaire` |
| Ordinaux groupés en vrai | une question d'écoute est sortie en `#10293` ∈ [10275, 10306] |
| Furigana depuis `word.jsonld` | `<ruby>` posés (`駅えき`, `女おんな`, `人ひと`) ; 4690 mots, 影響 → えいきょう |
| Cours (non-régression) | les trois pistes s'affichent (222 / 618 / 551 items) |
| Service worker | cache `jlpt-n3-v107`, **11 documents du graphe précachés**, 28 entrées au total |
| Hors ligne (`Network.emulateNetworkConditions`) | rechargement OK ; `corpus.jsonld` → 5 sujets, `q-kanji.jsonld` → 3148 sujets **servis depuis le cache** |
| Console | **aucune erreur ni exception** (seuls les messages React DevTools) |

Non vérifié : le « Rappel de cours » sur une question de grammaire reliée — `toQuestion` ne
projette pas les arêtes `tests` (lot 3), le mécanisme reste celui d'avant et n'a pas été touché.

---

## Fin du lot 2

L'app lit le graphe. `bank-*.json`, `bank-index.json` et `dict.json` sont encore là mais plus personne ne les lit — le lot 4 les supprimera. Le lot 3 (axes de navigation) peut alors s'appuyer sur `graph.ts`.
