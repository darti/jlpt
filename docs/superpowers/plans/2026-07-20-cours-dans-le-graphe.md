# Les cours dans le graphe — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `/cours` lit `data/graph/`, les 4 `data/cours-*.json` disparaissent, et `data/` ne contient plus que le graphe.

**Architecture :** deux types nouveaux (`jlpt:Example`, `jlpt:MethodNote`), les entités kanji gagnent leurs lectures, et **une seule** couche (`coursFromGraph.ts`) reconstitue le type `CoursCategory` existant depuis le graphe — les composants de `src/features/cours/` et leurs tests ne bougent pas. Le script de migration naît et meurt dans le même commit.

**Tech stack :** React + TS bundlé par Bun ; `tools/*.mjs` reste Node-compatible.

**Spec :** `docs/superpowers/specs/2026-07-20-cours-dans-le-graphe-design.md`

## Global Constraints

- **Le script de migration est JETABLE.** Il est écrit, exécuté, puis supprimé **dans le commit de la Task 6**. Ne jamais le laisser dans `tools/` à la fin. Ce dépôt s'est fait avoir deux fois (`transform-cours.mjs`, `migrate-to-graph.mjs`).
- **Aucun composant de `src/features/cours/` ne doit être modifié**, ni ses tests, à l'exception de `useCours.ts`, `coursGramIndex.ts` et `coursValidate.ts`. Si un autre composant doit changer, c'est le signe que `coursFromGraph.ts` ne rend pas exactement la forme `CoursCategory` : s'arrêter et remonter.
- **Zéro champ perdu.** `lecture`, `sens`, `niv`, `examples`, `exemple` doivent tous survivre à la migration. La Task 5 en fait un test.
- **TROIS inventaires de fichiers livrés** (cf. CLAUDE.md) : `tools/copy-static.mjs`, `scripts/dev.ts` `STATIC_FILES`, `sw.js` `GRAPH`. Les tests de `tools/copy-static.test.ts` les gardent — ils échoueront tant que les trois ne sont pas synchro.
- **Bumper `CACHE` dans `sw.js`** (`jlpt-n3-v107` → `v108`).
- **`tools/*.mjs` = Node pur.** Aucune API `Bun.*` : la CI exécute `node`.
- Le graphe fait autorité sur le cours pour les lectures : **on comble, on n'écrase jamais.**

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `tools/graph/kana.mjs` | **nouveau** — `splitOnKun(lecture)` : découpe `イ・くらい` en on/kun par script |
| `tools/migrate-cours.mjs` | **nouveau puis SUPPRIMÉ (Task 6)** — lit `cours-*.json`, écrit le graphe |
| `data/graph/example.jsonld` | **nouveau** — 227 `jlpt:Example` |
| `data/graph/method.jsonld` | **nouveau** — 2 `jlpt:MethodNote` |
| `src/features/cours/coursFromGraph.ts` | **nouveau** — projection graphe → `CoursCategory` |
| `src/features/cours/useCours.ts` | fetche le graphe au lieu des 4 JSON |
| `src/features/cours/coursGramIndex.ts` | l'index forme→point vient de `gram.jsonld` |

---

### Task 1 : `splitOnKun` — découper une lecture kanji

**Files:**
- Create: `tools/graph/kana.mjs`, `tools/graph/kana.test.ts`

**Interfaces:**
- Produit : `splitOnKun(lecture) -> { on: string[], kun: string[] }`

**Pourquoi.** `cours-kanji.json` porte `lecture: "イ・くらい"` et `kanji.jsonld` ne porte aucune lecture. Sans cette reprise, migrer `/cours` vers le graphe supprimerait la lecture de 551 kanji, en silence. Le découpage est déterministe : séparateur `・`, katakana → on, hiragana → kun (mesuré : 551/551 propres).

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `tools/graph/kana.test.ts` :

```ts
import { test, expect } from "bun:test";
import { splitOnKun } from "./kana.mjs";

test("splitOnKun sépare les lectures on (katakana) des kun (hiragana)", () => {
  expect(splitOnKun("イ・くらい")).toEqual({ on: ["イ"], kun: ["くらい"] });
});

test("splitOnKun accepte plusieurs lectures de chaque type", () => {
  expect(splitOnKun("ユウ・やさ(しい)・すぐ(れる)")).toEqual({
    on: ["ユウ"], kun: ["やさ(しい)", "すぐ(れる)"],
  });
});

test("splitOnKun garde l'okurigana entre parenthèses avec sa lecture kun", () => {
  expect(splitOnKun("あたら(しい)")).toEqual({ on: [], kun: ["あたら(しい)"] });
});

test("splitOnKun sur une lecture on seule", () => {
  expect(splitOnKun("ザツ")).toEqual({ on: ["ザツ"], kun: [] });
});

test("splitOnKun rend deux listes vides sur une entrée vide ou absente", () => {
  expect(splitOnKun("")).toEqual({ on: [], kun: [] });
  expect(splitOnKun(undefined)).toEqual({ on: [], kun: [] });
});

test("splitOnKun ignore les segments vides d'un séparateur en trop", () => {
  expect(splitOnKun("イ・・くらい")).toEqual({ on: ["イ"], kun: ["くらい"] });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `bun test tools/graph/kana.test.ts`
Expected: FAIL — `Cannot find module './kana.mjs'`

- [ ] **Step 3 : Implémenter**

Créer `tools/graph/kana.mjs` :

```js
// Découpage d'une lecture de kanji telle que l'écrit le cours : « イ・くらい ».
//
// La convention japonaise sépare on (katakana) et kun (hiragana) ; le cours les met dans un
// seul champ, séparés par « ・ ». Le graphe les veut distincts (jlpt:onReading / kunReading,
// déjà déclarés dans KanjiShape mais jamais alimentés jusqu'ici).
//
// Node pur : la CI exécute `node`, jamais `bun`.

// L'okurigana est écrit entre parenthèses — « やさ(しい) » — et appartient à la lecture kun.
const KATAKANA = /^[ァ-ヶー]+$/;

/** Sépare une lecture « on・kun » en deux listes, par script. */
export function splitOnKun(lecture) {
  const on = [];
  const kun = [];
  for (const brut of String(lecture ?? "").split("・")) {
    const seg = brut.trim();
    if (!seg) continue;
    if (KATAKANA.test(seg)) on.push(seg);
    else kun.push(seg);
  }
  return { on, kun };
}
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/kana.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5 : Commit**

```bash
git add tools/graph/kana.mjs tools/graph/kana.test.ts
git commit -m "feat(graph): découpage des lectures on/kun d'un kanji"
```

---

### Task 2 : Les shapes et les contrôles d'intégrité

**Files:**
- Modify: `data/graph/context.jsonld`, `data/graph/shapes.jsonld`
- Modify: `tools/graph/integrity.mjs`
- Modify: `tools/graph/shapes.test.ts`, `tools/graph/integrity.test.ts`

**Interfaces:**
- Produit : `checkLessonCoverage(subjects) -> string[]`, appelé par `checkCorpus`.

⚠ **Correction d'auto-relecture.** Le contrôle « zéro orphelin » de la spec ne peut pas vivre
dans le validateur sous la forme « un item de cours sans entité » : après migration il n'y a
plus d'items de cours, seulement des IRIs, et une IRI pendante est **déjà** attrapée par
`REF_PREDICATES`. Le contrôle durable équivalent est : **une leçon sans aucun `covers` est une
erreur** — elle rendrait un groupe vide dans la vue. C'est ce que `checkLessonCoverage`
implémente, et c'est lui qui garantit qu'une édition future ne vide pas une leçon en silence.

**Pourquoi.** Écrire les contrôles AVANT de générer les données : c'est ce qui fera échouer la validation si la migration de la Task 3 perd quelque chose, au lieu de le découvrir au navigateur.

- [ ] **Step 1 : Écrire les tests qui échouent**

Dans `tools/graph/shapes.test.ts`, remplacer le test des six types :

```ts
test("shapes.jsonld se parse et couvre les huit types du domaine", () => {
  const classes = shapes().map((s) => s.targetClass.split("#").pop()).sort();
  expect(classes).toEqual([
    "Example", "GrammarPoint", "Kanji", "Lesson", "MethodNote", "Question", "SkillRange", "Word",
  ]);
});

test("la shape Example impose illustrates et le japonais", () => {
  const e = shapes().find((s) => s.targetClass.endsWith("#Example"));
  const paths = e.properties.map((p) => p.path.split("#").pop());
  for (const p of ["illustrates", "jp"]) expect(paths).toContain(p);
  expect(e.properties.find((p) => p.path.endsWith("#jp")).minCount).toBe(1);
});
```

Dans `tools/graph/integrity.test.ts`, ajouter :

```ts
test("checkCorpus refuse un Example dont illustrates ne pointe vers rien", () => {
  const ex = {
    "@id": "jlpt:example/x", "@type": "jlpt:Example",
    illustrates: "jlpt:gram/inexistant", "jlpt:jp": "文",
  };
  expect(checkCorpus([ex]).join(" ")).toMatch(/référence pendante/);
});

test("checkCorpus refuse une leçon dont un covers ne pointe vers rien", () => {
  const l = {
    "@id": "jlpt:lesson/gram-g1", "@type": "jlpt:Lesson",
    "schema:name": "L", "jlpt:order": 0, "jlpt:track": "gram",
    covers: ["jlpt:gram/absent"],
  };
  expect(checkCorpus([l]).join(" ")).toMatch(/référence pendante/);
});

test("checkCorpus refuse une leçon qui ne couvre rien", () => {
  // Une leçon sans covers rend un groupe VIDE dans la vue : du contenu disparu en silence.
  const l = {
    "@id": "jlpt:lesson/gram-g9", "@type": "jlpt:Lesson",
    "schema:name": "L", "jlpt:order": 0, "jlpt:track": "gram",
  };
  expect(checkCorpus([l]).join(" ")).toMatch(/ne couvre aucune entité/);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `bun test tools/graph/shapes.test.ts tools/graph/integrity.test.ts`
Expected: FAIL — les shapes ne comptent que 6 types ; `illustrates` n'est pas dans `REF_PREDICATES` donc la référence pendante n'est pas signalée.

- [ ] **Step 3 : Déclarer l'alias `illustrates` dans le contexte**

Dans `data/graph/context.jsonld`, à l'intérieur de `"@context"`, après la ligne `"covers"` :

```json
    "illustrates": { "@id": "jlpt:illustrates", "@type": "@id" },
```

- [ ] **Step 4 : Ajouter les deux shapes**

Dans `data/graph/shapes.jsonld`, dans `@graph`, avant `jlpt:LessonShape` :

```json
    {
      "@id": "jlpt:ExampleShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:Example",
      "sh:property": [
        { "sh:path": "jlpt:illustrates", "sh:nodeKind": "sh:IRI", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:jp", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:romaji", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "schema:description", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:analysis", "sh:datatype": "xsd:string" }
      ]
    },
    {
      "@id": "jlpt:MethodNoteShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:MethodNote",
      "sh:property": [
        { "sh:path": "schema:name", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:order", "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:tip", "sh:datatype": "xsd:string", "sh:minCount": 1 }
      ]
    },
```

Et dans `jlpt:KanjiShape`, ajouter après `jlpt:kunReading` :

```json
        { "sh:path": "jlpt:compound", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
```

- [ ] **Step 5 : Étendre `REF_PREDICATES` et ajouter `checkLessonCoverage`**

Dans `tools/graph/integrity.mjs`, remplacer :

```js
const REF_PREDICATES = ["tests", "usesKanji", "covers"];
```

par :

```js
const REF_PREDICATES = ["tests", "usesKanji", "covers", "illustrates"];

/** Une leçon doit couvrir au moins une entité. Sinon elle rend un groupe VIDE dans la vue :
 *  du contenu disparu sans la moindre erreur. C'est le garde-fou durable qui remplace le
 *  décompte d'orphelins de la migration — celui-ci n'avait de sens que face à cours-*.json. */
export function checkLessonCoverage(subjects) {
  const errs = [];
  for (const s of subjects) {
    if (!arr(s["@type"]).includes("jlpt:Lesson")) continue;
    if (!arr(s.covers).length) errs.push(`${s["@id"]} : la leçon ne couvre aucune entité`);
  }
  return errs;
}
```

et, dans `checkCorpus`, juste avant `return errs;` :

```js
  errs.push(...checkLessonCoverage(subjects));
```

- [ ] **Step 6 : Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/`
Expected: PASS — tous les fichiers du répertoire.

- [ ] **Step 7 : Vérifier que le graphe actuel reste valide**

Run: `node tools/validate-graph.mjs`
Expected: `✓ graphe valide` — les deux shapes nouvelles ne ciblent aucun sujet existant, donc rien ne change encore.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "feat(graph): shapes Example et MethodNote, illustrates dans les références"
```

---

### Task 3 : Le script de migration (jetable)

**Files:**
- Create: `tools/migrate-cours.mjs`, `tools/migrate-cours.test.ts`
- Modify: `data/graph/kanji.jsonld`, `word.jsonld`, `lesson.jsonld` (régénérés)
- Create: `data/graph/example.jsonld`, `data/graph/method.jsonld`

**Interfaces:**
- Produit : `buildExamples(coursGram, gramByForm) -> object[]` ; `buildMethod(coursMethod) -> object[]` ; `enrichKanji(kanjiSujets, coursKanji) -> { sujets, crees, lectures }` ; `fillWordReadings(wordSujets, coursVocab) -> { sujets, comblees, divergences }` ; `rebuildLessons(cours, known) -> { lessons, orphelins }`.

**Pourquoi.** ⚠ **Ce fichier sera SUPPRIMÉ à la Task 6.** Il existe le temps de produire les documents, et ses tests meurent avec lui — sauf `splitOnKun`, déjà extrait en Task 1 parce que la règle, elle, est durable.

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `tools/migrate-cours.test.ts` :

```ts
import { test, expect } from "bun:test";
import {
  buildExamples, buildMethod, enrichKanji, fillWordReadings, normalizeMot,
} from "./migrate-cours.mjs";

const gramByForm = new Map([["ために", "jlpt:gram/ために"]]);

test("buildExamples rattache l'exemple à l'ENTITÉ du point de grammaire", () => {
  const cours = { groups: [{ id: "g3", items: [{
    id: "gram:ために", form: "〜ために",
    examples: [{ jp: "健康のために走る。", ro: "kenkō no tame ni hashiru.", fr: "Je cours pour ma santé.", an: ["健康 « santé »"] }],
  }] }] };
  const [ex] = buildExamples(cours, gramByForm);
  expect(ex["@type"]).toBe("jlpt:Example");
  expect(ex.illustrates).toBe("jlpt:gram/ために");
  expect(ex["jlpt:jp"]).toBe("健康のために走る。");
  expect(ex["jlpt:romaji"]).toBe("kenkō no tame ni hashiru.");
  expect(ex["schema:description"]).toBe("Je cours pour ma santé.");
  expect(ex["jlpt:analysis"]).toEqual(["健康 « santé »"]);
});

test("buildExamples numérote les exemples multiples d'un même point", () => {
  const cours = { groups: [{ id: "g3", items: [{
    form: "〜ために",
    examples: [{ jp: "A" }, { jp: "B" }],
  }] }] };
  const ids = buildExamples(cours, gramByForm).map((e) => e["@id"]);
  expect(new Set(ids).size).toBe(2); // @id unique, sinon checkCorpus refuse le doublon
});

test("buildExamples ignore un item dont la forme ne résout aucune entité", () => {
  const cours = { groups: [{ id: "g9", items: [{ form: "〜inconnu", examples: [{ jp: "A" }] }] }] };
  expect(buildExamples(cours, gramByForm)).toEqual([]);
});

test("buildMethod projette une section en jlpt:MethodNote", () => {
  const src = { sections: [{ title: "読解 — Méthode", tips: ["Lis les questions.", "Repère."] }] };
  const [m] = buildMethod(src);
  expect(m["@type"]).toBe("jlpt:MethodNote");
  expect(m["schema:name"]).toBe("読解 — Méthode");
  expect(m["jlpt:order"]).toBe(0);
  expect(m["jlpt:tip"]).toEqual(["Lis les questions.", "Repère."]);
});

test("enrichKanji pose les lectures on/kun sur une entité existante", () => {
  const sujets = [{ "@id": "jlpt:kanji/位", "@type": "jlpt:Kanji", "schema:name": "位", "schema:description": "rang" }];
  const cours = { groups: [{ items: [{ kanji: "位", lecture: "イ・くらい", sens: "rang, position" }] }] };
  const { sujets: out, lectures } = enrichKanji(sujets, cours);
  expect(out[0]["jlpt:onReading"]).toEqual(["イ"]);
  expect(out[0]["jlpt:kunReading"]).toEqual(["くらい"]);
  expect(lectures).toBe(1);
});

test("enrichKanji crée l'entité d'un kanji absent du référentiel", () => {
  const cours = { groups: [{ items: [{ kanji: "優", lecture: "ユウ・やさ(しい)", sens: "supérieur" }] }] };
  const { sujets, crees } = enrichKanji([], cours);
  expect(crees).toBe(1);
  expect(sujets[0]["@id"]).toBe("jlpt:kanji/優");
  expect(sujets[0]["schema:description"]).toBe("supérieur");
  expect(sujets[0]["jlpt:kunReading"]).toEqual(["やさ(しい)"]);
});

test("enrichKanji reporte le champ exemple en jlpt:compound, verbatim", () => {
  const cours = { groups: [{ items: [{ kanji: "働", lecture: "ドウ", sens: "travail", exemple: "労働 (rōdō) travail" }] }] };
  const { sujets } = enrichKanji([], cours);
  expect(sujets[0]["jlpt:compound"]).toBe("労働 (rōdō) travail");
});

test("enrichKanji n'écrase JAMAIS une description déjà dans le graphe", () => {
  const sujets = [{ "@id": "jlpt:kanji/位", "@type": "jlpt:Kanji", "schema:name": "位", "schema:description": "du graphe" }];
  const cours = { groups: [{ items: [{ kanji: "位", lecture: "イ", sens: "du cours" }] }] };
  expect(enrichKanji(sujets, cours).sujets[0]["schema:description"]).toBe("du graphe");
});

test("normalizeMot retire le suffixe entre parenthèses et prend la 1re forme", () => {
  expect(normalizeMot("予防(する)")).toBe("予防");
  expect(normalizeMot("最初 / 最後")).toBe("最初");
  expect(normalizeMot("味")).toBe("味");
});

test("fillWordReadings comble un trou sans toucher aux lectures existantes", () => {
  const sujets = [
    { "@id": "jlpt:word/味", "@type": "jlpt:Word", "schema:name": "味", "jlpt:reading": "あじ" },
    { "@id": "jlpt:word/謎", "@type": "jlpt:Word", "schema:name": "謎" },
  ];
  const cours = { groups: [{ items: [
    { mot: "味", lecture: "あぢ" },   // divergence : le graphe fait autorité
    { mot: "謎", lecture: "なぞ" },   // trou : le cours comble
  ] }] };
  const { sujets: out, comblees, divergences } = fillWordReadings(sujets, cours);
  expect(out[0]["jlpt:reading"]).toBe("あじ");
  expect(out[1]["jlpt:reading"]).toBe("なぞ");
  expect(comblees).toBe(1);
  expect(divergences).toEqual(["味"]);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `bun test tools/migrate-cours.test.ts`
Expected: FAIL — `Cannot find module './migrate-cours.mjs'`

- [ ] **Step 3 : Implémenter le script**

Créer `tools/migrate-cours.mjs` :

```js
#!/usr/bin/env node
// Script de migration ONE-SHOT : absorbe data/cours-*.json dans data/graph/.
//
// ⚠ SUPPRIMÉ dans le commit de la Task 6, une fois son résultat commité. Il ne doit JAMAIS
// devenir un générateur permanent — c'est ce qui a tué transform-cours.mjs et migrate-to-graph.mjs.
// Le graphe est la source ; rien ne le régénère.
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { readFileSync, writeFileSync } from "node:fs";
import { splitOnKun } from "./graph/kana.mjs";

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const G = (n) => J(`data/graph/${n}`);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const doc = (subjects) =>
  JSON.stringify({ "@context": "context.jsonld", "@graph": subjects }, null, 1) + "\n";

/** Slug d'une forme de grammaire → segment d'IRI. Même règle que le graphe existant. */
const slugify = (form) =>
  String(form ?? "").replace(/〜/g, "").replace(/\s*\/\s*/g, "-")
    .replace(/[\s'\\;*]/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

/** Mot du cours → nom d'entité : retire le suffixe entre parenthèses (« 予防(する) ») et
 *  prend la première forme d'une cellule « A / B ». 63 des 66 items non résolus le sont
 *  par cette seule normalisation. */
export function normalizeMot(mot) {
  return norm(norm(mot).split(" / ")[0].replace(/[（(].*?[)）]/g, ""));
}

/** Les exemples du cours de grammaire, rattachés à l'ENTITÉ qu'ils illustrent. */
export function buildExamples(coursGram, gramByForm) {
  const out = [];
  for (const g of coursGram.groups ?? []) {
    for (const it of g.items ?? []) {
      const iri = gramByForm.get(slugify(String(it.form ?? "").split(" / ")[0]));
      if (!iri) continue;
      (it.examples ?? []).forEach((ex, i) => {
        out.push({
          "@id": `jlpt:example/${slugify(it.form)}-${i + 1}`,
          "@type": "jlpt:Example",
          illustrates: iri,
          "jlpt:jp": norm(ex.jp),
          ...(norm(ex.ro) ? { "jlpt:romaji": norm(ex.ro) } : {}),
          ...(norm(ex.fr) ? { "schema:description": norm(ex.fr) } : {}),
          ...(ex.an?.length ? { "jlpt:analysis": ex.an.map(norm) } : {}),
        });
      });
    }
  }
  return out;
}

/** Les sections de méthode. Nœuds isolés, sans arête : c'est de la prose. */
export function buildMethod(coursMethod) {
  return (coursMethod.sections ?? []).map((s, i) => ({
    "@id": `jlpt:method/${i === 0 ? "dokkai" : "choukai"}`,
    "@type": "jlpt:MethodNote",
    "schema:name": norm(s.title),
    "jlpt:order": i,
    "jlpt:tip": (s.tips ?? []).map(norm),
  }));
}

/** Pose les lectures on/kun et le composé sur les kanji, et CRÉE les 179 absents.
 *  N'écrase jamais une valeur déjà portée par le graphe : il fait autorité. */
export function enrichKanji(sujets, coursKanji) {
  const parNom = new Map(sujets.map((s) => [s["schema:name"], { ...s }]));
  let crees = 0;
  let lectures = 0;
  for (const g of coursKanji.groups ?? []) {
    for (const it of g.items ?? []) {
      const k = norm(it.kanji);
      if (!k) continue;
      let s = parNom.get(k);
      if (!s) {
        s = { "@id": `jlpt:kanji/${k}`, "@type": "jlpt:Kanji", "schema:name": k };
        parNom.set(k, s);
        crees++;
      }
      if (!s["schema:description"] && norm(it.sens)) s["schema:description"] = norm(it.sens);
      const { on, kun } = splitOnKun(it.lecture);
      if (!s["jlpt:onReading"] && on.length) { s["jlpt:onReading"] = on; lectures++; }
      if (!s["jlpt:kunReading"] && kun.length) s["jlpt:kunReading"] = kun;
      if (!s["jlpt:compound"] && norm(it.exemple)) s["jlpt:compound"] = norm(it.exemple);
    }
  }
  return { sujets: [...parNom.values()], crees, lectures };
}

/** Comble les lectures de mots absentes du graphe. Le graphe fait autorité : une divergence
 *  est LISTÉE, jamais appliquée. Même règle que tools/graph/readings.mjs. */
export function fillWordReadings(sujets, coursVocab) {
  const parNom = new Map(sujets.map((s) => [s["schema:name"], { ...s }]));
  let comblees = 0;
  const divergences = [];
  for (const g of coursVocab.groups ?? []) {
    for (const it of g.items ?? []) {
      const nom = normalizeMot(it.mot);
      const lecture = norm(it.lecture);
      const s = parNom.get(nom);
      if (!s || !lecture) continue;
      if (!s["jlpt:reading"]) { s["jlpt:reading"] = lecture; comblees++; }
      else if (s["jlpt:reading"] !== lecture) divergences.push(nom);
    }
  }
  return { sujets: [...parNom.values()], comblees, divergences };
}

/** Régénère les leçons. Après enrichKanji + normalizeMot, il ne doit rester AUCUN orphelin. */
export function rebuildLessons(cours, known, gramByForm) {
  const lessons = [];
  const orphelins = [];
  for (const track of ["gram", "vocab", "kanji"]) {
    (cours[track].groups ?? []).forEach((grp, order) => {
      const covers = [];
      for (const it of grp.items ?? []) {
        let iris = [];
        if (track === "gram" && it.form) {
          const iri = gramByForm.get(slugify(String(it.form).split(" / ")[0]));
          if (iri) iris = [iri];
        } else if (track === "vocab" && it.mot) {
          // Une cellule « A / B » énumère plusieurs mots : chacun devient une arête.
          iris = norm(it.mot).split(" / ").map((m) => `jlpt:word/${normalizeMot(m)}`);
        } else if (track === "kanji" && it.kanji) {
          iris = [`jlpt:kanji/${norm(it.kanji)}`];
        }
        const bons = iris.filter((i) => known.has(i));
        if (!bons.length) orphelins.push(`${track}: ${it.mot ?? it.kanji ?? it.form}`);
        covers.push(...bons);
      }
      lessons.push({
        "@id": `jlpt:lesson/${track}-${slugify(grp.id)}`,
        "@type": "jlpt:Lesson",
        "schema:name": norm(grp.title) || grp.id,
        "jlpt:order": order,
        "jlpt:track": track,
        ...(covers.length ? { covers: [...new Set(covers)] } : {}),
      });
    });
  }
  return { lessons, orphelins };
}

if (process.argv[1]?.endsWith("migrate-cours.mjs")) {
  const cours = {
    gram: J("data/cours-gram.json"),
    vocab: J("data/cours-vocab.json"),
    kanji: J("data/cours-kanji.json"),
    method: J("data/cours-method.json"),
  };

  const gram = G("gram.jsonld")["@graph"];
  const gramByForm = new Map();
  for (const g of gram) {
    gramByForm.set(slugify(g["jlpt:form"]), g["@id"]);
    for (const alt of [].concat(g["jlpt:altForm"] ?? [])) gramByForm.set(slugify(alt), g["@id"]);
  }

  const k = enrichKanji(G("kanji.jsonld")["@graph"], cours.kanji);
  writeFileSync("data/graph/kanji.jsonld", doc(k.sujets));
  const w = fillWordReadings(G("word.jsonld")["@graph"], cours.vocab);
  writeFileSync("data/graph/word.jsonld", doc(w.sujets));

  const examples = buildExamples(cours.gram, gramByForm);
  writeFileSync("data/graph/example.jsonld", doc(examples));
  writeFileSync("data/graph/method.jsonld", doc(buildMethod(cours.method)));

  const known = new Set([...k.sujets, ...w.sujets, ...gram].map((s) => s["@id"]));
  const { lessons, orphelins } = rebuildLessons(cours, known, gramByForm);
  writeFileSync("data/graph/lesson.jsonld", doc(lessons));

  console.log(`kanji : ${k.crees} créés, ${k.lectures} lectures posées (total ${k.sujets.length})`);
  console.log(`mots : ${w.comblees} lectures comblées, ${w.divergences.length} divergences (graphe prioritaire)`);
  if (w.divergences.length) console.log(`  ${w.divergences.join(", ")}`);
  console.log(`exemples ${examples.length} · leçons ${lessons.length}`);
  if (orphelins.length) {
    console.error(`✗ ${orphelins.length} item(s) de cours sans entité :`);
    for (const o of orphelins.slice(0, 40)) console.error(`  ${o}`);
    process.exit(1);
  }
  console.log("✓ zéro orphelin");
}
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/migrate-cours.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5 : Exécuter la migration**

Run: `node tools/migrate-cours.mjs`
Expected: `✓ zéro orphelin`, avec `kanji : 179 créés`, `exemples 227`, `leçons 92`.

⚠ Si des orphelins subsistent, le script sort en erreur : **ne pas les contourner**. Chaque orphelin est un item de cours qui disparaîtrait. Corriger `normalizeMot` ou créer l'entité, et remonter le cas.

- [ ] **Step 6 : Valider le graphe**

Run: `node tools/validate-graph.mjs`
Expected: `✓ graphe valide`, avec `jlpt:Example 227`, `jlpt:MethodNote 2`, `jlpt:Kanji 810`.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat(graph): les cours entrent dans le graphe (exemples, méthode, lectures kanji)"
```

---

### Task 4 : `coursFromGraph.ts` — la projection

**Files:**
- Create: `src/features/cours/coursFromGraph.ts`, `src/features/cours/coursFromGraph.test.ts`

**Interfaces:**
- Consomme : les types `CoursCategory`, `LearnCategory`, `MethodCategory`, `CoursGroup`, `GramItem`, `VocabItem`, `KanjiItem`, `CoursExample` de `./coursSchema.ts` (inchangés).
- Produit : `buildCours(docs) -> CoursCategory[]` où `docs = { lesson, gram, kanji, word, example, method }`, chacun un `Record<string, unknown>[]`.

**Pourquoi.** **Seul** module qui connaisse le JSON-LD côté cours — même rôle que `src/lib/graph.ts` pour le quiz. Les composants reçoivent exactement le `CoursCategory` qu'ils recevaient, donc leurs tests passent inchangés : c'est ce qui prouvera que la bascule n'a pas touché aux vues.

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `src/features/cours/coursFromGraph.test.ts` :

```ts
import { test, expect } from "bun:test";
import { buildCours } from "./coursFromGraph.ts";
import type { LearnCategory, MethodCategory, GramItem, KanjiItem, VocabItem } from "./coursSchema.ts";

const docs = {
  lesson: [
    { "@id": "jlpt:lesson/gram-g3", "@type": "jlpt:Lesson", "schema:name": "Cause & but",
      "jlpt:order": 0, "jlpt:track": "gram", covers: ["jlpt:gram/ために"] },
    { "@id": "jlpt:lesson/kanji-k1", "@type": "jlpt:Lesson", "schema:name": "Kanji 1",
      "jlpt:order": 0, "jlpt:track": "kanji", covers: ["jlpt:kanji/位"] },
    { "@id": "jlpt:lesson/vocab-v1", "@type": "jlpt:Lesson", "schema:name": "Vocab 1",
      "jlpt:order": 0, "jlpt:track": "vocab", covers: ["jlpt:word/味"] },
  ],
  gram: [{ "@id": "jlpt:gram/ために", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜ために",
           "jlpt:structure": "辞書形＋ために", "schema:description": "« afin de »", "jlpt:level": "N3" }],
  kanji: [{ "@id": "jlpt:kanji/位", "@type": "jlpt:Kanji", "schema:name": "位",
            "schema:description": "rang", "jlpt:onReading": ["イ"], "jlpt:kunReading": ["くらい"] }],
  word: [{ "@id": "jlpt:word/味", "@type": "jlpt:Word", "schema:name": "味",
           "jlpt:reading": "あじ", "schema:description": "goût", "jlpt:level": "N3" }],
  example: [{ "@id": "jlpt:example/ために-1", "@type": "jlpt:Example",
              illustrates: "jlpt:gram/ために", "jlpt:jp": "健康のために走る。",
              "jlpt:romaji": "kenkō no tame ni hashiru.", "schema:description": "Je cours.",
              "jlpt:analysis": ["健康 « santé »"] }],
  method: [{ "@id": "jlpt:method/dokkai", "@type": "jlpt:MethodNote",
             "schema:name": "読解", "jlpt:order": 0, "jlpt:tip": ["Lis les questions."] }],
};

test("buildCours rend les quatre catégories, dans l'ordre attendu par la vue", () => {
  expect(buildCours(docs).map((c) => c.id)).toEqual(["gram", "vocab", "kanji", "method"]);
});

test("un item de grammaire porte forme, structure, sens, niveau et ses exemples", () => {
  const gram = buildCours(docs).find((c) => c.id === "gram") as LearnCategory;
  const it = gram.groups[0].items[0] as GramItem;
  expect(it.id).toBe("jlpt:gram/ために");
  expect(it.form).toBe("〜ために");
  expect(it.struct).toBe("辞書形＋ために");
  expect(it.mean).toBe("« afin de »");
  expect(it.niv).toBe("N3");
  expect(it.examples).toEqual([
    { jp: "健康のために走る。", ro: "kenkō no tame ni hashiru.", fr: "Je cours.", an: ["健康 « santé »"] },
  ]);
});

test("un item kanji recompose la lecture on・kun du cours", () => {
  const cat = buildCours(docs).find((c) => c.id === "kanji") as LearnCategory;
  const it = cat.groups[0].items[0] as KanjiItem;
  expect(it.kanji).toBe("位");
  expect(it.lecture).toBe("イ・くらい"); // exactement la forme d'avant migration
  expect(it.sens).toBe("rang");
});

test("un item de vocabulaire porte mot, lecture et sens", () => {
  const cat = buildCours(docs).find((c) => c.id === "vocab") as LearnCategory;
  const it = cat.groups[0].items[0] as VocabItem;
  expect(it.mot).toBe("味");
  expect(it.lecture).toBe("あじ");
  expect(it.sens).toBe("goût");
});

test("la méthode devient une MethodCategory avec ses conseils", () => {
  const m = buildCours(docs).find((c) => c.id === "method") as MethodCategory;
  expect(m.kind).toBe("method");
  expect(m.sections).toEqual([{ title: "読解", tips: ["Lis les questions."] }]);
});

test("les leçons sont triées par jlpt:order", () => {
  const deux = {
    ...docs,
    lesson: [
      { "@id": "jlpt:lesson/gram-b", "@type": "jlpt:Lesson", "schema:name": "B", "jlpt:order": 1, "jlpt:track": "gram", covers: [] },
      { "@id": "jlpt:lesson/gram-a", "@type": "jlpt:Lesson", "schema:name": "A", "jlpt:order": 0, "jlpt:track": "gram", covers: [] },
    ],
  };
  const gram = buildCours(deux).find((c) => c.id === "gram") as LearnCategory;
  expect(gram.groups.map((g) => g.title)).toEqual(["A", "B"]);
});

test("une entité référencée mais absente est ignorée sans planter", () => {
  const cassé = { ...docs, gram: [] };
  const gram = buildCours(cassé).find((c) => c.id === "gram") as LearnCategory;
  expect(gram.groups[0].items).toEqual([]);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `bun test src/features/cours/coursFromGraph.test.ts`
Expected: FAIL — `Cannot find module './coursFromGraph.ts'`

- [ ] **Step 3 : Implémenter**

Créer `src/features/cours/coursFromGraph.ts` :

```ts
/**
 * Projette les documents du graphe vers le type `CoursCategory` de la vue.
 *
 * C'est le SEUL module du cours qui connaisse le vocabulaire JSON-LD : les composants
 * (`CategoryIndex`, `GroupDetail`, la progression) reçoivent exactement ce qu'ils recevaient
 * de `data/cours-*.json`, et leurs tests passent inchangés — c'est ce qui prouve que la
 * bascule n'a pas touché aux vues. Même rôle que `src/lib/graph.ts` pour le quiz.
 */
import type {
  CoursCategory, CoursExample, CoursGroup, CoursItem,
  GramItem, KanjiItem, LearnCategory, MethodCategory, VocabItem,
} from "./coursSchema.ts";

export type Sujet = Record<string, unknown>;
export interface CoursDocs {
  lesson: Sujet[]; gram: Sujet[]; kanji: Sujet[]; word: Sujet[]; example: Sujet[]; method: Sujet[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : (typeof v === "string" ? [v] : []);

const TITRES: Record<string, string> = {
  gram: "文法 — Grammaire N3 par leçons",
  vocab: "語彙 — Vocabulaire par thèmes",
  kanji: "漢字 — Kanji N3 par thèmes",
};

/** Exemples d'un point de grammaire, indexés par l'IRI qu'ils illustrent. */
function examplesByIri(sujets: Sujet[]): Map<string, CoursExample[]> {
  const out = new Map<string, CoursExample[]>();
  for (const e of sujets) {
    const cible = str(e.illustrates);
    if (!cible) continue;
    const ex: CoursExample = {
      jp: str(e["jlpt:jp"]), ro: str(e["jlpt:romaji"]), fr: str(e["schema:description"]),
    };
    const an = list(e["jlpt:analysis"]);
    if (an.length) ex.an = an;
    if (!out.has(cible)) out.set(cible, []);
    out.get(cible)!.push(ex);
  }
  return out;
}

/** Une entité → l'item de cours correspondant, selon la piste. `null` si l'entité manque. */
function toItem(track: string, iri: string, entites: Map<string, Sujet>, ex: Map<string, CoursExample[]>): CoursItem | null {
  const s = entites.get(iri);
  if (!s) return null;
  if (track === "gram") {
    const it: GramItem = { id: iri, form: str(s["jlpt:form"]) };
    const struct = str(s["jlpt:structure"]); if (struct) it.struct = struct;
    const mean = str(s["schema:description"]); if (mean) it.mean = mean;
    const niv = str(s["jlpt:level"]); if (niv) it.niv = niv;
    const exs = ex.get(iri); if (exs?.length) it.examples = exs;
    return it;
  }
  if (track === "kanji") {
    // La vue attend la lecture telle que le cours l'écrivait : « イ・くらい ».
    const lecture = [...list(s["jlpt:onReading"]), ...list(s["jlpt:kunReading"])].join("・");
    const it: KanjiItem = { id: iri, kanji: str(s["schema:name"]), lecture, sens: str(s["schema:description"]) };
    const comp = str(s["jlpt:compound"]); if (comp) it.exemple = comp;
    return it;
  }
  const it: VocabItem = {
    id: iri, mot: str(s["schema:name"]), lecture: str(s["jlpt:reading"]), sens: str(s["schema:description"]),
  };
  const niv = str(s["jlpt:level"]); if (niv) it.niv = niv;
  return it;
}

/** Documents du graphe → les quatre catégories de la route /cours. */
export function buildCours(docs: CoursDocs): CoursCategory[] {
  const entites = new Map<string, Sujet>();
  for (const s of [...docs.gram, ...docs.kanji, ...docs.word]) entites.set(str(s["@id"]), s);
  const ex = examplesByIri(docs.example);

  const cats: CoursCategory[] = [];
  for (const track of ["gram", "vocab", "kanji"] as const) {
    const groups: CoursGroup[] = docs.lesson
      .filter((l) => str(l["jlpt:track"]) === track)
      .sort((a, b) => (a["jlpt:order"] as number) - (b["jlpt:order"] as number))
      .map((l) => ({
        id: str(l["@id"]).split("/").pop() ?? "",
        title: str(l["schema:name"]),
        items: list(l.covers).map((iri) => toItem(track, iri, entites, ex)).filter((i): i is CoursItem => i !== null),
      }));
    cats.push({ id: track, title: TITRES[track], kind: "learn", groups } as LearnCategory);
  }

  const method: MethodCategory = {
    id: "method", title: "読解・聴解 — Méthode", kind: "method",
    sections: docs.method
      .slice()
      .sort((a, b) => (a["jlpt:order"] as number) - (b["jlpt:order"] as number))
      .map((m) => ({ title: str(m["schema:name"]), tips: list(m["jlpt:tip"]) })),
  };
  cats.push(method);
  return cats;
}
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

Run: `bun test src/features/cours/coursFromGraph.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5 : Commit**

```bash
git add src/features/cours/coursFromGraph.ts src/features/cours/coursFromGraph.test.ts
git commit -m "feat(cours): projection du graphe vers le type CoursCategory"
```

---

### Task 5 : Brancher le runtime + prouver qu'aucun champ n'est perdu

**Files:**
- Modify: `src/features/cours/useCours.ts`, `src/features/cours/coursGramIndex.ts`, `src/features/cours/coursValidate.ts`
- Modify: `src/features/cours/useCours.test.tsx`, `src/features/cours/coursGramIndex.test.ts`
- Create: `src/features/cours/coursParite.test.ts`

**Interfaces:**
- `useCours()` garde sa signature : `() => CoursCategory[] | null`.
- `loadCoursGramIndex(fetchImpl?)` garde sa signature ; sa source devient `data/graph/gram.jsonld`.

**Pourquoi.** Le test de parité est le garde-fou de la migration : il compare la vue reconstituée aux `cours-*.json` **encore présents**, item par item. Il ne peut exister qu'ici — à la Task 6 les JSON auront disparu, et lui avec.

- [ ] **Step 1 : Écrire le test de parité (il échoue)**

Créer `src/features/cours/coursParite.test.ts` :

```ts
import { test, expect } from "bun:test";
import { buildCours, type CoursDocs } from "./coursFromGraph.ts";
import type { LearnCategory, GramItem, KanjiItem, VocabItem } from "./coursSchema.ts";

// ⚠ Ce fichier meurt avec data/cours-*.json (Task 6). Il n'existe que pour prouver, une fois,
// que la migration n'a perdu aucun champ. Comparer le graphe à sa source est le SEUL moment
// où c'est possible.
const G = async (n: string) => (await Bun.file(`data/graph/${n}`).json())["@graph"] as CoursDocs["lesson"];
const C = (n: string) => Bun.file(`data/cours-${n}.json`).json();

test("chaque item de cours survit à la migration, avec ses champs", async () => {
  const docs: CoursDocs = {
    lesson: await G("lesson.jsonld"), gram: await G("gram.jsonld"), kanji: await G("kanji.jsonld"),
    word: await G("word.jsonld"), example: await G("example.jsonld"), method: await G("method.jsonld"),
  };
  const vue = buildCours(docs);

  // --- kanji : lecture et sens, les deux champs que le graphe ne portait pas ---
  const kanjiVue = new Map(
    ((vue.find((c) => c.id === "kanji") as LearnCategory).groups.flatMap((g) => g.items) as KanjiItem[])
      .map((i) => [i.kanji, i]),
  );
  for (const g of (await C("kanji")).groups) {
    for (const it of g.items) {
      const v = kanjiVue.get(it.kanji);
      expect(v, `kanji ${it.kanji} absent de la vue`).toBeTruthy();
      expect(v!.lecture, `lecture de ${it.kanji}`).toBe(it.lecture);
      expect(v!.sens, `sens de ${it.kanji}`).toBe(it.sens);
    }
  }

  // --- grammaire : les exemples et leur analyse ---
  const gramVue = new Map(
    ((vue.find((c) => c.id === "gram") as LearnCategory).groups.flatMap((g) => g.items) as GramItem[])
      .map((i) => [i.form, i]),
  );
  let exVus = 0;
  for (const g of (await C("gram")).groups) {
    for (const it of g.items) {
      if (!it.examples?.length) continue;
      const v = gramVue.get(it.form);
      expect(v, `point ${it.form} absent de la vue`).toBeTruthy();
      expect(v!.examples?.length, `nb d'exemples de ${it.form}`).toBe(it.examples.length);
      exVus += it.examples.length;
    }
  }
  expect(exVus).toBe(227); // tous les exemples du cours sont rendus

  // --- vocabulaire : lecture et sens ---
  const vocabVue = new Set(
    ((vue.find((c) => c.id === "vocab") as LearnCategory).groups.flatMap((g) => g.items) as VocabItem[])
      .map((i) => i.mot),
  );
  expect(vocabVue.size).toBeGreaterThan(550);
});

test("les 12 conseils de méthode survivent", async () => {
  const docs: CoursDocs = {
    lesson: await G("lesson.jsonld"), gram: await G("gram.jsonld"), kanji: await G("kanji.jsonld"),
    word: await G("word.jsonld"), example: await G("example.jsonld"), method: await G("method.jsonld"),
  };
  const vue = buildCours(docs).find((c) => c.id === "method");
  const src = await C("method");
  expect(vue!.kind).toBe("method");
  const total = (s: { sections: { tips: string[] }[] }) => s.sections.reduce((n, x) => n + x.tips.length, 0);
  expect(total(vue as never)).toBe(total(src));
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `bun test src/features/cours/coursParite.test.ts`
Expected: FAIL — `data/graph/example.jsonld` existe déjà (Task 3), donc l'échec porte sur les items : la vue est construite mais `useCours` n'est pas encore branché. Si ce test passe déjà, tant mieux : la Task 3 était juste. Passer au Step 3.

- [ ] **Step 3 : Brancher `useCours`**

Remplacer le corps de `src/features/cours/useCours.ts` :

```ts
/** Charge le contenu de cours depuis le graphe (data/graph/*.jsonld) au runtime.
 *  null = chargement, [] = échec. La projection vit dans coursFromGraph.ts. */
import { useEffect, useState } from "react";
import type { CoursCategory } from "./coursSchema.ts";
import { buildCours, type CoursDocs, type Sujet } from "./coursFromGraph.ts";

const DOCS = ["lesson", "gram", "kanji", "word", "example", "method"] as const;

export function useCours(): CoursCategory[] | null {
  const [cats, setCats] = useState<CoursCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    // En parallèle : six documents chargés au fil d'une boucle `await` sérialiseraient
    // six allers-retours au premier affichage.
    Promise.all(
      DOCS.map((n) => fetch(`data/graph/${n}.jsonld`)
        .then((r) => r.json() as Promise<{ "@graph"?: Sujet[] }>)
        .then((d) => d["@graph"] ?? [])),
    )
      .then((docs) => {
        if (!alive) return;
        const par = Object.fromEntries(DOCS.map((n, i) => [n, docs[i]])) as unknown as CoursDocs;
        setCats(buildCours(par));
      })
      .catch(() => { if (alive) setCats([]); });
    return () => { alive = false; };
  }, []);
  return cats;
}
```

- [ ] **Step 4 : Adapter le test de `useCours`**

Dans `src/features/cours/useCours.test.tsx`, remplacer la table d'URL simulées (les quatre `data/cours-*.json`) par les six documents du graphe :

```tsx
const DOCS: Record<string, unknown> = {
  "data/graph/lesson.jsonld": { "@graph": [
    { "@id": "jlpt:lesson/gram-g1", "@type": "jlpt:Lesson", "schema:name": "G1",
      "jlpt:order": 0, "jlpt:track": "gram", covers: ["jlpt:gram/ば"] },
  ] },
  "data/graph/gram.jsonld": { "@graph": [
    { "@id": "jlpt:gram/ば", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜ば" },
  ] },
  "data/graph/kanji.jsonld": { "@graph": [] },
  "data/graph/word.jsonld": { "@graph": [] },
  "data/graph/example.jsonld": { "@graph": [] },
  "data/graph/method.jsonld": { "@graph": [] },
};
```

et faire répondre le `fetch` simulé depuis cette table (`json: async () => DOCS[url] ?? { "@graph": [] }`). Le cas « forme périmée » du second test devient : un document dont `@graph` est absent — la projection doit rendre des catégories vides, pas planter.

- [ ] **Step 5 : Brancher `coursGramIndex` sur le graphe**

⚠ **Correction d'auto-relecture — un piège qui aurait cassé le lien profond.**
`GrammarRappel.group` n'est pas décoratif : `coursDeepLink.ts:27` fait
`coursItemHref("gram", rappel.group, rappel.id, …)`. Le remplir avec une constante produirait
une URL morte. Or `gram.jsonld` **ne sait pas** dans quelle leçon vit un point — seule
`lesson.jsonld` le sait. L'index doit donc lire **les deux** documents.

Dans `src/features/cours/coursGramIndex.ts`, remplacer `buildCoursGramIndex` et
`loadCoursGramIndex` :

```ts
type Sujet = Record<string, unknown>;
const s = (v: unknown): string => (typeof v === "string" ? v : "");
const l = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : (typeof v === "string" ? [v] : []);

/** Build the form→point index from the graph. A form may be a compound "〜A / 〜B"
 *  (e.g. "〜ようだ / 〜みたいだ") — each alternative is indexed separately so a quiz testing
 *  either one resolves to the same rappel ; `jlpt:altForm` l'est de même.
 *
 *  ⚠ Les leçons sont nécessaires : `group` alimente le lien profond `/cours/gram/<group>`,
 *  et seule la leçon sait où vit un point de grammaire. */
export function buildCoursGramIndex(gram: Sujet[], lessons: Sujet[]): CoursGramIndex {
  const groupOf = new Map<string, string>();
  for (const les of lessons) {
    if (s(les["jlpt:track"]) !== "gram") continue;
    const gid = s(les["@id"]).split("/").pop() ?? "";
    for (const iri of l(les.covers)) if (!groupOf.has(iri)) groupOf.set(iri, gid);
  }

  const index: CoursGramIndex = new Map();
  for (const p of gram) {
    const iri = s(p["@id"]);
    const form = s(p["jlpt:form"]);
    if (!form) continue;
    for (const f of [...form.split(" / "), ...l(p["jlpt:altForm"])]) {
      const key = normalizeForm(f);
      if (!key) continue;
      index.set(key, {
        forme: f.trim(), niv: s(p["jlpt:level"]), sens: s(p["schema:description"]),
        id: iri, group: groupOf.get(iri) ?? "",
      });
    }
  }
  return index;
}

let cache: Promise<CoursGramIndex> | null = null;

/** Clears the memoized index (test isolation). */
export function clearCoursGramCache(): void { cache = null; }

const graph = (fetchImpl: FetchLike, n: string): Promise<Sujet[]> =>
  fetchImpl(`data/graph/${n}.jsonld`)
    .then((r) => r.json() as Promise<{ "@graph"?: Sujet[] }>)
    .then((d) => d["@graph"] ?? []);

/** Load + memoize the index depuis le graphe. Échec → index vide (chaque corrigé de grammaire
 *  retombe sur le lien simple). */
export function loadCoursGramIndex(fetchImpl: FetchLike = fetch as FetchLike): Promise<CoursGramIndex> {
  if (!cache) {
    cache = Promise.all([graph(fetchImpl, "gram"), graph(fetchImpl, "lesson")])
      .then(([g, les]) => buildCoursGramIndex(g, les))
      .catch(() => new Map<string, GrammarRappel>());
  }
  return cache;
}
```

Le test à ajouter dans `coursGramIndex.test.ts`, qui garde précisément ce piège :

```ts
test("buildCoursGramIndex résout le groupe depuis la leçon (lien profond)", () => {
  const gram = [{ "@id": "jlpt:gram/ために", "jlpt:form": "〜ために", "jlpt:level": "N3",
                  "schema:description": "but" }];
  const lessons = [{ "@id": "jlpt:lesson/gram-g3", "jlpt:track": "gram",
                     covers: ["jlpt:gram/ために"] }];
  const r = buildCoursGramIndex(gram, lessons).get("ために");
  expect(r?.group).toBe("gram-g3");   // sinon coursItemHref produit une URL morte
  expect(r?.id).toBe("jlpt:gram/ために");
});
```

Adapter les cas existants : ils passaient une `LearnCategory`, ils passent désormais deux
tableaux de sujets ; l'URL attendue par le test de chargement devient `data/graph/gram.jsonld`
(le premier des deux fetch).

- [ ] **Step 6 : Purger la progression du cours (D5)**

Les ids d'item passent de `gram:ために` à `jlpt:gram/ために` : la progression stockée devient
illisible, et `groupProgress` compterait 0 partout sans la moindre erreur. La spec tranche :
on repart de zéro.

Dans `src/lib/keys.ts`, bumper la clé :

```ts
export const COURS_KEY = "jlptN3_cours_v2"; // v1 = ids d'avant le graphe (gram:X), illisibles
```

Le test à ajouter dans `src/features/cours/coursProgress.test.ts` :

```ts
test("la clé de progression du cours a changé avec les ids du graphe", () => {
  // Régression : garder jlptN3_cours_v1 aurait fait lire des ids « gram:X » alors que la vue
  // parle en IRIs « jlpt:gram/X » — 0 % de progression partout, sans erreur.
  expect(COURS_KEY).toBe("jlptN3_cours_v2");
});
```

⚠ `COURS_KEY` porte le préfixe `jlptN3`, donc `gist.ts#collectData` la balaie : l'ancienne clé
`jlptN3_cours_v1` continuerait d'être synchronisée pour rien. La supprimer une fois, au montage
de `AppShell` (`localStorage.removeItem("jlptN3_cours_v1")`), suffit et ne coûte rien.

- [ ] **Step 7 : Simplifier `coursValidate.ts`**

`isCoursCategory` gardait contre un cache SW servant l'ancien schéma `lessons`. La donnée ne vient plus d'un JSON livré mais de `buildCours`, qui construit la forme : le garde-fou n'a plus d'objet. Supprimer `src/features/cours/coursValidate.ts` et son test s'il existe, et retirer son import de `useCours.ts` (déjà fait au Step 3).

Run: `grep -rn "coursValidate\|isCoursCategory" src/`
Expected: aucune occurrence.

- [ ] **Step 8 : Lancer toute la suite**

Run: `bun test && bun run typecheck`
Expected: PASS. ⚠ **Aucun fichier de `src/features/cours/` autre que `useCours`, `coursGramIndex`, `coursValidate` et leurs tests ne doit avoir été modifié.** Vérifier : `git diff --stat src/features/cours/`. Si `GroupDetail.tsx` ou `CategoryIndex.tsx` a dû changer, c'est que `coursFromGraph` ne rend pas la bonne forme — s'arrêter et remonter.

- [ ] **Step 9 : Commit**

```bash
git add -A
git commit -m "feat(cours): la route /cours et le rappel de cours lisent le graphe"
```

---

### Task 6 : Supprimer l'ancien modèle

**Files:**
- Delete: `data/cours-{gram,vocab,kanji,method}.json`, `tools/migrate-cours.mjs`, `tools/migrate-cours.test.ts`, `src/features/cours/coursParite.test.ts`, `tools/validate.mjs`, `tools/copy-static.test.ts` (partiellement)
- Modify: `tools/copy-static.mjs`, `scripts/dev.ts`, `sw.js`, `.github/workflows/validate.yml`, `CLAUDE.md`

**Pourquoi.** Le script de migration et le test de parité ont fait leur travail : ils meurent avec leur source. `tools/validate.mjs` n'aurait plus rien à valider — `data/` = `graph/` seul, donc **un seul validateur**.

- [ ] **Step 1 : Supprimer les données et les outils jetables**

```bash
git rm data/cours-gram.json data/cours-vocab.json data/cours-kanji.json data/cours-method.json \
       tools/migrate-cours.mjs tools/migrate-cours.test.ts \
       src/features/cours/coursParite.test.ts tools/validate.mjs
```

- [ ] **Step 2 : Mettre à jour les trois inventaires**

Dans `tools/copy-static.mjs`, `isServedData` ne garde que les `.jsonld` :

```js
// Données chargées au runtime par le React : les documents du graphe, et rien d'autre.
// data/ ne contient plus que data/graph/ — cf. CLAUDE.md.
export const isServedData = (f) => /\.jsonld$/.test(f);
```

Dans `scripts/dev.ts` `STATIC_FILES`, retirer les quatre `"/data/cours-*.json"` et ajouter :

```ts
  "/data/graph/example.jsonld", "/data/graph/method.jsonld",
```

Dans `sw.js`, ajouter au tableau `GRAPH` :

```js
  'data/graph/example.jsonld',
  'data/graph/method.jsonld',
```

et bumper la version : `const CACHE = 'jlpt-n3-v108';`

- [ ] **Step 3 : Adapter les tests d'inventaire**

Dans `tools/copy-static.test.ts`, remplacer les deux tests qui citent `cours-*.json` :

```ts
test("isServedData ne livre que les documents du graphe", () => {
  for (const f of ["q-kanji.jsonld", "corpus.jsonld", "example.jsonld", "method.jsonld"]) {
    expect(isServedData(f), `${f} doit être livré`).toBe(true);
  }
});

test("isServedData ne livre plus le contenu de cours en JSON", () => {
  // Régression : data/cours-*.json a été absorbé par le graphe. Les re-livrer servirait
  // un contenu que plus personne ne lit.
  for (const f of ["cours-gram.json", "cours-method.json", "bank-grammaire.json", "dict.json"]) {
    expect(isServedData(f), `${f} ne doit plus être livré`).toBe(false);
  }
});
```

- [ ] **Step 4 : Retirer l'étape CI du validateur supprimé**

Dans `.github/workflows/validate.yml`, supprimer l'étape « Valider le contenu de cours » et son `run: node tools/validate.mjs`, et corriger l'en-tête : il ne reste qu'un validateur, `validate-graph.mjs`.

⚠ `tools/*.mjs` doit rester exécutable sous `node` : cet invariant était vérifié par l'exécution de `validate.mjs` en CI. Il l'est désormais par `validate-graph.mjs`, lancé sous `node` — vérifier que l'étape le fait bien.

- [ ] **Step 5 : Mettre à jour CLAUDE.md**

Dans la table « Données », supprimer la ligne `data/cours-*.json` et écrire que `data/` ne contient plus que `graph/`. Dans « Commandes », supprimer la ligne `bun tools/validate.mjs`. Dans « Architecture », le contenu devient `data/graph/*.jsonld` seul.

- [ ] **Step 6 : Vérifier**

```bash
bun run typecheck && bun test && node tools/validate-graph.mjs && bun run build && ls _site/data/
```

Expected : typecheck propre, suite verte, `✓ graphe valide`, et `_site/data/` ne contient **que** `graph/`.

- [ ] **Step 7 : Vérifier qu'aucune référence morte ne subsiste**

```bash
grep -rn "cours-gram\|cours-vocab\|cours-kanji\|cours-method\|migrate-cours\|validate\.mjs" \
  --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.yml" --include="*.md" \
  src tools scripts .github package.json CLAUDE.md
```

Expected : aucune occurrence hors `validate-graph.mjs`.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "chore(cours): data/ ne contient plus que le graphe"
```

---

### Task 7 : Vérification dans un vrai navigateur

**Pourquoi.** `bun test` ne prouve pas qu'une app servie sur HTTP fonctionne : le service worker, les fetch relatifs et le cache ne s'exercent que là. Et c'est le seul endroit où l'on voit vraiment les 227 exemples et les lectures on·kun.

- [ ] **Step 1 : Servir le build**

```bash
bun run build && bunx serve _site
```

- [ ] **Step 2 : Vérifier à la main, dans l'ordre**

1. **Cours › Grammaire** : une leçon liste ses points ; une fiche affiche `struct`, `mean`, `niv` **et ses phrases d'exemple avec l'analyse**.
2. **Cours › Kanji** : un item affiche sa lecture on·kun (`イ・くらい`) et son sens. C'est ce que la migration a failli perdre.
3. **Cours › Vocabulaire** : mot, lecture, sens.
4. **Cours › Méthode** : les deux sections et leurs 12 conseils.
5. **Entraînement** : sur un corrigé de grammaire, le « Rappel de cours » apparaît toujours (il vient maintenant de `gram.jsonld`).
6. **Hors ligne** : recharger réseau coupé — `example.jsonld` et `method.jsonld` sont précachés.

⚠ Changer le hash (`#/x`) NE recharge PAS la page : faire un vrai `location.reload()`.

- [ ] **Step 3 : Commit du constat**

Consigner ce qui a été vérifié dans le plan ou le message de commit. Ne pas pousser sans cette étape.

---

## Fin

`data/` ne contient plus que `data/graph/`. Un seul validateur. Les exemples sont rattachés aux entités, donc consommables par le corrigé du quiz — ce que le lot 3 pourra faire en s'appuyant sur les arêtes `tests` déjà présentes.
