# 読解 — passages (chaîne n°6) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter la compétence « lecture » de vrais textes d'examen (20 passages, 44 questions, quatre formats) — le trou de 60 points du corpus.

**Architecture:** Trois couches indépendantes. (1) Le corpus devient extensible ailleurs qu'à sa fin : plusieurs `SkillRange` par compétence. (2) Le passage devient le neuvième type du graphe (`jlpt:Passage` + arête `readsPassage`), résolu au chargement du pool. (3) Une règle pure garde ensemble les questions d'un même texte dans une session. Puis la chaîne d'outillage n°6 (audit de périmètre + applicateur idempotent) pose le contenu.

**Tech Stack:** TypeScript + React, bundlé et exécuté par **bun** (jamais `node`). Tests `bun:test` côte à côte. Graphe JSON-LD validé par `bun tools/validate-graph.mjs`. Zéro dépendance nouvelle.

**Spec:** `docs/superpowers/specs/2026-07-26-lecture-passages-design.md`

## Global Constraints

- **Worktree obligatoire** : `.worktrees/lecture-passages`, branche `feat/lecture-passages`. Jamais dans la racine du dépôt.
- **`bun` exclusivement**, y compris pour `tools/*.mjs` : `bun tools/validate-graph.mjs`, `bun test`, `bun run typecheck`. Jamais `node`, jamais `npm`.
- **Commits** : conventional commits, **en français**, **message COURT à UNE ligne** (un hook de revue bloque le multi-lignes). **JAMAIS de `Co-Authored-By`**.
- **Zéro dépendance nouvelle.** Pas de linter dans le projet : `bun run typecheck` + `bun test` font foi.
- **`jlpt:ord` ne se renumérote JAMAIS** : il indexe les bitsets `seen`/`mastered`, `wrong[]` et `resume.ids` persistés en localStorage. On ajoute en fin de corpus, point.
- **Ne jamais supprimer un fichier de décisions** (`data/*-arbitres.json`), même appliqué.
- **Ne pas scripter les éditions de texte en `bun -e '…'`** : le contenu est en français, une apostrophe casse le quoting zsh. Utiliser l'outil d'édition de fichiers.
- Format d'écriture des documents du graphe : `JSON.stringify(doc, null, 1) + "\n"` (convention `traps.mjs`).
- Après chaque tâche : `bun test` et `bun run typecheck` verts avant de commiter.

---

### Task 1: Couverture — plusieurs intervalles par compétence

`coverageBySkill` fait `out[r.skill] = {…}` : un second intervalle pour une même compétence **écrase** le premier, et les 52 questions historiques de lecture disparaîtraient du calcul sans la moindre erreur. C'est le défaut le plus silencieux du lot.

**Files:**
- Modify: `src/lib/coverage.ts:62-78`
- Test: `src/lib/coverage.test.ts`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: `coverageBySkill(seen, mastered, ranges)` accepte désormais plusieurs `SkillRange` de même `skill` et **somme** `seenN` / `masteredN` / `total`, les pourcentages étant calculés sur le total agrégé.

- [ ] **Step 1: Write the failing test**

Ajouter à la fin de `src/lib/coverage.test.ts` :

```ts
test("coverageBySkill agrège deux intervalles d'une même compétence", () => {
  // lecture occupe [0,1] puis, après ajout en fin de corpus, [10,13] : 6 questions au total.
  const ranges = [
    { skill: "lecture" as const, from: 0, count: 2 },
    { skill: "lecture" as const, from: 10, count: 4 },
  ];
  let seen = emptyBits();
  seen = setBit(seen, 0);   // 1 vue dans le premier intervalle
  seen = setBit(seen, 11);  // 1 vue dans le second
  seen = setBit(seen, 12);  // 1 vue dans le second
  let mastered = emptyBits();
  mastered = setBit(mastered, 11);

  const cov = coverageBySkill(seen, mastered, ranges)["lecture"];
  expect(cov.total).toBe(6);
  expect(cov.seenN).toBe(3);
  expect(cov.masteredN).toBe(1);
  expect(cov.seen).toBe(50);      // 3/6 — et non 2/4 (second intervalle seul)
  expect(cov.mastered).toBe(17);  // 1/6 arrondi
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/coverage.test.ts -t "agrège deux intervalles"`
Expected: FAIL — `cov.total` vaut 4 (le second intervalle a écrasé le premier).

- [ ] **Step 3: Write minimal implementation**

Remplacer le corps de `coverageBySkill` dans `src/lib/coverage.ts` :

```ts
/** Couverture par compétence depuis les bitsets vu/appris, bucketée par les intervalles du
 *  corpus (`corpus.jsonld`).
 *
 *  ⚠ Une compétence peut occuper PLUSIEURS intervalles : le corpus n'est extensible qu'à sa
 *  fin (renuméroter corromprait les bitsets persistés), donc toute question ajoutée à une
 *  compétence qui n'est pas la dernière ouvre un second intervalle. Les compteurs s'ACCUMULENT
 *  et les pourcentages ne se calculent qu'une fois tous les intervalles vus. */
export function coverageBySkill(
  seen: Uint8Array,
  mastered: Uint8Array,
  ranges: SkillRange[],
): Record<Skill, SkillCoverage> {
  const out = {} as Record<Skill, SkillCoverage>;
  for (const r of ranges) {
    const acc = out[r.skill] ?? { seen: 0, mastered: 0, seenN: 0, masteredN: 0, total: 0 };
    for (let ord = r.from; ord < r.from + r.count; ord++) {
      if (hasBit(seen, ord)) acc.seenN++;
      if (hasBit(mastered, ord)) acc.masteredN++;
    }
    acc.total += r.count;
    out[r.skill] = acc;
  }
  for (const c of Object.keys(out) as Skill[]) {
    const a = out[c];
    const pct = (n: number) => (a.total ? Math.round((n / a.total) * 100) : 0);
    a.seen = pct(a.seenN);
    a.mastered = pct(a.masteredN);
  }
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test src/lib/coverage.test.ts` puis `bun run typecheck`
Expected: PASS — le nouveau test **et** les tests de couverture existants (un intervalle par compétence reste le cas courant).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coverage.ts src/lib/coverage.test.ts
git commit -m "fix(couverture): agreger plusieurs intervalles d une meme competence"
```

---

### Task 2: `checkCorpus` — union des intervalles, et aucun ordinal revendiqué deux fois

Le validateur compare **tous** les ordinaux d'une compétence à **un** intervalle : deux intervalles « lecture » le feraient échouer alors que le graphe est sain. Il doit confronter l'union — et, tant qu'on y est, refuser qu'un ordinal soit revendiqué par deux intervalles (un chevauchement lecture/écoute ferait résoudre `skillOfOrd` vers la mauvaise compétence, en silence).

**Files:**
- Modify: `tools/graph/integrity.mjs:136-154`
- Test: `tools/graph/integrity.test.ts`

**Interfaces:**
- Consumes: rien de Task 1 (module distinct — le validateur est en `.mjs`, l'app en `.ts`).
- Produces: `checkCorpus(subjects)` accepte N `SkillRange` par compétence ; messages d'erreur : `SkillRange <skill> : <n> ordinaux déclarés, mais <m> questions`, `SkillRange <skill> : ord <o> hors des intervalles déclarés`, `ord <o> revendiqué par deux SkillRange : <a> et <b>`.

- [ ] **Step 1: Write the failing test**

Ajouter à `tools/graph/integrity.test.ts` :

```ts
const qOrd = (ord: number, skill: string) => ({
  "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question",
  "jlpt:stem": `énoncé ${ord}`, "jlpt:skill": skill, "jlpt:difficulty": 1, "jlpt:ord": ord,
  opts: ["a", "b"], "jlpt:answer": 0,
});
const range = (skill: string, from: number, count: number) => ({
  "@id": `jlpt:corpus/${skill}-${from}`, "@type": "jlpt:SkillRange",
  "jlpt:skill": skill, "jlpt:from": from, "jlpt:count": count,
});

test("checkCorpus accepte deux intervalles disjoints pour une même compétence", () => {
  const subjects = [
    qOrd(0, "lecture"), qOrd(1, "ecoute"), qOrd(2, "lecture"),
    range("lecture", 0, 1), range("ecoute", 1, 1), range("lecture", 2, 1),
  ];
  expect(checkCorpus(subjects)).toEqual([]);
});

test("checkCorpus signale deux intervalles qui revendiquent le même ordinal", () => {
  const subjects = [
    qOrd(0, "lecture"), qOrd(1, "ecoute"),
    range("lecture", 0, 2), range("ecoute", 1, 1),
  ];
  const errs = checkCorpus(subjects);
  expect(errs.some((e: string) => e.includes("revendiqué par deux SkillRange"))).toBe(true);
});

test("checkCorpus signale un ordinal hors des intervalles déclarés", () => {
  const subjects = [
    qOrd(0, "lecture"), qOrd(1, "lecture"),
    range("lecture", 0, 1), // ne couvre pas l'ord 1
  ];
  const errs = checkCorpus(subjects);
  expect(errs.some((e: string) => e.includes("mais 2 questions"))).toBe(true);
});

test("checkCorpus signale un SkillRange sans aucune question", () => {
  // Le cas que boucler sur les seules compétences À QUESTIONS rendrait muet : un intervalle
  // fantôme ne collisionne avec rien, donc seule l'union des deux côtés le voit.
  const subjects = [
    qOrd(0, "lecture"),
    range("lecture", 0, 1), range("ecoute", 5, 3), // « ecoute » n'a aucune question
  ];
  const errs = checkCorpus(subjects);
  expect(errs.some((e: string) => e.includes("ecoute") && e.includes("mais 0 questions"))).toBe(true);
});
```

> ⚠ `integrity.test.ts` déclare déjà un helper `range` plus haut dans le fichier : nommer les
> deux helpers ci-dessus `qOrd` / `rangeMulti` pour éviter la redéclaration (`SyntaxError`).

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/graph/integrity.test.ts -t "checkCorpus"`
Expected: FAIL — le premier test rapporte `SkillRange lecture : count 1, mais 2 questions` (l'implémentation actuelle confronte tous les ords de la compétence à chaque intervalle pris isolément).

- [ ] **Step 3: Write minimal implementation**

Dans `tools/graph/integrity.mjs`, remplacer la boucle `for (const r of ranges) { … }` du bloc « cohérence des SkillRange » par :

```js
    // Une compétence peut occuper PLUSIEURS intervalles : le corpus n'est extensible qu'à sa
    // fin (renuméroter corromprait les bitsets persistés), donc une question ajoutée à une
    // compétence qui n'est pas la dernière ouvre un second intervalle. On confronte l'UNION.
    // Et on refuse qu'un ordinal soit revendiqué deux fois : skillOfOrd rend le PREMIER
    // intervalle qui matche, donc un chevauchement résout vers la mauvaise compétence en silence.
    const claim = new Map();        // ord → compétence qui le revendique
    const declares = new Map();     // compétence → nombre d'ordinaux déclarés
    let chevauchementSignale = false;
    for (const r of ranges) {
      const skill = r["jlpt:skill"], from = r["jlpt:from"], count = r["jlpt:count"];
      declares.set(skill, (declares.get(skill) ?? 0) + count);
      for (let o = from; o < from + count; o++) {
        if (claim.has(o)) {
          if (!chevauchementSignale) {
            errs.push(`ord ${o} revendiqué par deux SkillRange : ${claim.get(o)} et ${skill}`);
            chevauchementSignale = true; // un seul message : un chevauchement en produirait des milliers
          }
        } else claim.set(o, skill);
      }
    }
    // ⚠ Itérer sur l'UNION des compétences vues côté questions ET côté intervalles. Boucler sur
    // `parSkill` seul rendrait MUET un SkillRange fantôme (compétence mal orthographiée dans
    // corpus.jsonld, ou intervalle resté après suppression de ses questions) : il ne collisionne
    // avec aucun ordinal, donc rien ne le signalerait — alors que c'est précisément le mensonge
    // que ce contrôle existe pour empêcher, et que l'ancien code attrapait.
    for (const skill of new Set([...parSkill.keys(), ...declares.keys()])) {
      const ords = parSkill.get(skill) ?? [];
      const n = declares.get(skill) ?? 0;
      if (n !== ords.length) {
        errs.push(`SkillRange ${skill} : ${n} ordinaux déclarés, mais ${ords.length} questions`);
        continue;
      }
      const orphelin = ords.find((o) => claim.get(o) !== skill);
      if (orphelin !== undefined) {
        errs.push(`SkillRange ${skill} : ord ${orphelin} hors des intervalles déclarés`);
      }
    }
```

- [ ] **Step 4: Run the tests and the real graph**

Run: `bun test tools/graph/integrity.test.ts` puis `bun tools/validate-graph.mjs`
Expected: PASS, et le graphe réel (5 intervalles, un par compétence) reste **valide** — la généralisation ne change rien au cas d'aujourd'hui.

- [ ] **Step 5: Commit**

```bash
git add tools/graph/integrity.mjs tools/graph/integrity.test.ts
git commit -m "feat(validateur): checkCorpus accepte N intervalles par competence et refuse les chevauchements"
```

---

### Task 3: Le neuvième type — contexte, shape, document, trois inventaires

Le schéma et le document (vide pour l'instant) arrivent avant tout code de lecture, pour que la tâche suivante s'écrive contre un vrai fichier. `jlpt:passage` (chaîne) est retiré **maintenant** : zéro question l'utilise, donc aucun shim.

**Files:**
- Modify: `data/graph/context.jsonld`
- Modify: `data/graph/shapes.jsonld:36-49`
- Create: `data/graph/passage.jsonld`
- Modify: `scripts/dev.ts:12-27` (`STATIC_FILES`)
- Modify: `sw.js:9` (`CACHE`) et son tableau `GRAPH`
- Test: `tools/copy-static.test.ts` (aucune modification — ses tests « inventaire 1/2/3 » énumèrent déjà `data/graph/*.jsonld` et passeront au rouge tout seuls)

**Interfaces:**
- Consumes: rien.
- Produces: le type `jlpt:Passage` (`schema:name!`, `jlpt:jp!`, `jlpt:format!` ∈ `tanbun|chubun|chobun|joho`, `schema:description?`, `jlpt:tests*`), l'arête `readsPassage` (alias de contexte, IRI simple), et le document servi `data/graph/passage.jsonld`.

- [ ] **Step 1: Voir les inventaires passer au rouge**

Créer `data/graph/passage.jsonld` :

```json
{
 "@context": "context.jsonld",
 "@graph": []
}
```

Run: `bun test tools/copy-static.test.ts`
Expected: FAIL sur « inventaire 2 » (`passage.jsonld absent de STATIC_FILES → 404 en dev`) et « inventaire 3 » (`absent du GRAPH du SW → manquant hors ligne`). « Inventaire 1 » reste vert : `isServedData` matche `.jsonld` par motif.

- [ ] **Step 2: Déclarer l'alias de contexte**

Dans `data/graph/context.jsonld`, ajouter après la ligne `illustrates` :

```json
    "readsPassage": { "@id": "jlpt:readsPassage", "@type": "@id" },
```

- [ ] **Step 3: Déclarer la shape et retirer `jlpt:passage`**

Dans `data/graph/shapes.jsonld` : supprimer la ligne `{ "sh:path": "jlpt:passage", … }` de `jlpt:QuestionShape` et la remplacer par

```json
        { "sh:path": "jlpt:readsPassage", "sh:nodeKind": "sh:IRI", "sh:maxCount": 1 },
```

puis ajouter la shape du nouveau type dans `@graph` (après `jlpt:ExampleShape`) :

```json
    {
      "@id": "jlpt:PassageShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:Passage",
      "sh:property": [
        { "sh:path": "schema:name", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:jp", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:format", "sh:in": ["tanbun", "chubun", "chobun", "joho"], "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "schema:description", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:tests", "sh:nodeKind": "sh:IRI" }
      ]
    },
```

- [ ] **Step 4: Compléter les deux inventaires manuels**

Dans `scripts/dev.ts`, ajouter `"/data/graph/passage.jsonld"` à `STATIC_FILES` (à côté de `"/data/graph/example.jsonld"`).

Dans `sw.js`, ajouter `'data/graph/passage.jsonld'` au tableau `GRAPH`, et **bumper le cache** : `const CACHE = 'jlpt-n3-v117'` → `'jlpt-n3-v118'`.

- [ ] **Step 5: Vérifier**

Run: `bun test tools/copy-static.test.ts && bun tools/validate-graph.mjs`
Expected: PASS — les trois inventaires sont verts et le graphe (avec un `passage.jsonld` vide) est valide.

- [ ] **Step 6: Commit**

```bash
git add data/graph/context.jsonld data/graph/shapes.jsonld data/graph/passage.jsonld scripts/dev.ts sw.js
git commit -m "feat(graphe): type Passage, arete readsPassage, document livre (retrait de jlpt:passage)"
```

---

### Task 4: Projection — `passageId` sur la question, `loadPassages` mémoïsé

La projection est **synchrone** (`toQuestion`) et la résolution **asynchrone** (un second document) : d'où deux champs distincts. `passageId` est la clé de regroupement de la Task 6 ; `passage` est l'objet résolu de la Task 5.

**Files:**
- Modify: `src/types/quiz.ts:11-29`
- Modify: `src/lib/graph.ts:23-46` (`toQuestion`), `:48-56` (`clearGraphCache`), `:83-95` (à la suite de `loadCorpus`)
- Test: `src/lib/graph.test.ts`

**Interfaces:**
- Consumes: le document `data/graph/passage.jsonld` (Task 3).
- Produces:
  - `export type PassageFormat = "tanbun" | "chubun" | "chobun" | "joho"` et `export interface Passage { jp: string; format: PassageFormat; fr?: string }` dans `src/types/quiz.ts` ;
  - `Question.passageId?: string` et `Question.passage?: Passage` ;
  - `loadPassages(fetchImpl?): Promise<Map<string, Passage>>` dans `src/lib/graph.ts` (clé = IRI).

- [ ] **Step 1: Write the failing test**

Ajouter à `src/lib/graph.test.ts` :

```ts
test("toQuestion projette readsPassage vers passageId", () => {
  const q = toQuestion({
    "@id": "jlpt:q/10307", "@type": "jlpt:Question",
    "jlpt:ord": 10307, "jlpt:skill": "lecture", "jlpt:difficulty": 2,
    "jlpt:stem": "この お知らせ に よると、何 が 分かりますか。",
    opts: ["a", "b"], "jlpt:answer": 0,
    readsPassage: "jlpt:passage/tanbun-01",
  });
  expect(q.passageId).toBe("jlpt:passage/tanbun-01");
  expect(q.passage).toBeUndefined(); // la résolution n'est PAS le rôle de la projection
});

test("loadPassages indexe par IRI et ne fetch qu'une fois", async () => {
  clearGraphCache();
  let appels = 0;
  const fetchImpl = async () => {
    appels++;
    return {
      json: async () => ({
        "@graph": [{
          "@id": "jlpt:passage/tanbun-01", "@type": "jlpt:Passage",
          "schema:name": "Note de service", "jlpt:jp": "エレベーターは 工事中 です。",
          "jlpt:format": "tanbun", "schema:description": "L'ascenseur est en travaux.",
        }],
      }),
    };
  };
  const a = await loadPassages(fetchImpl);
  const b = await loadPassages(fetchImpl);
  expect(appels).toBe(1);
  expect(a).toBe(b);
  expect(a.get("jlpt:passage/tanbun-01")?.jp).toBe("エレベーターは 工事中 です。");
  expect(a.get("jlpt:passage/tanbun-01")?.format).toBe("tanbun");
  expect(a.get("jlpt:passage/tanbun-01")?.fr).toBe("L'ascenseur est en travaux.");
});
```

Compléter l'import en tête du fichier de test : `loadPassages` et `clearGraphCache` depuis `./graph.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/graph.test.ts -t "passage"`
Expected: FAIL — `loadPassages is not a function`.

- [ ] **Step 3: Déclarer les types**

Dans `src/types/quiz.ts`, avant `interface Question` :

```ts
/** Les quatre formats de textes de l'épreuve 読解 : 短文 (court), 中文 (moyen), 長文 (long),
 *  情報検索 (recherche d'information). Slugs ASCII : métadonnée de code, l'UI en donne le
 *  libellé français. */
export type PassageFormat = "tanbun" | "chubun" | "chobun" | "joho";

/** Un texte de compréhension écrite, partagé par 1 à 4 questions. */
export interface Passage {
  jp: string;
  format: PassageFormat;
  /** Traduction / résumé français, pour le corrigé. */
  fr?: string;
}
```

puis, dans `interface Question`, avant la signature d'index :

```ts
  /** IRI du texte que la question interroge (`jlpt:passage/…`). Clé de regroupement : les
   *  questions d'un même texte voyagent ensemble dans une session (`withPassageGroups`). */
  passageId?: string;
  /** Le texte résolu, attaché par `bank.ts#loadCategory` — la projection, elle, est synchrone. */
  passage?: Passage;
```

- [ ] **Step 4: Projeter et charger**

Dans `src/lib/graph.ts` : importer les types (`import type { Difficulty, Passage, Question } from "../types/quiz.ts";`), **supprimer** la ligne `const passage = str(s["jlpt:passage"]); …` de `toQuestion` et la remplacer par

```ts
  const pid = str(s.readsPassage); if (pid !== undefined) q.passageId = pid;
```

Ajouter la mémoïsation à côté de `corpusPromise` :

```ts
let passagesPromise: Promise<Map<string, Passage>> | null = null;
```

l'ajouter à `clearGraphCache` (`passagesPromise = null;`), et après `loadCorpus` :

```ts
/** Les passages de lecture, indexés par IRI, mémoïsés. Même purge en cas d'échec que
 *  `loadCorpus` : une promesse rejetée gardée en cache condamnerait la lecture pour toute
 *  la session. */
export function loadPassages(fetchImpl: FetchLike = fetch as FetchLike): Promise<Map<string, Passage>> {
  if (!passagesPromise) {
    passagesPromise = fetchImpl("data/graph/passage.jsonld")
      .then(graphDoc)
      .then((doc) => {
        const m = new Map<string, Passage>();
        for (const s of doc["@graph"] ?? []) {
          const p: Passage = {
            jp: String(s["jlpt:jp"] ?? ""),
            format: s["jlpt:format"] as Passage["format"],
          };
          const fr = str(s["schema:description"]); if (fr !== undefined) p.fr = fr;
          m.set(s["@id"] as string, p);
        }
        return m;
      })
      .catch((err) => { passagesPromise = null; throw err; });
  }
  return passagesPromise;
}
```

- [ ] **Step 5: Run the tests**

Run: `bun test src/lib/graph.test.ts && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/quiz.ts src/lib/graph.ts src/lib/graph.test.ts
git commit -m "feat(graphe): projection passageId et chargement memoise des passages"
```

---

### Task 5: Résolution au chargement du pool, et affichage

Une question de lecture dont le texte ne résout pas est **inrépondable** : elle est écartée du pool, pas affichée sans son texte.

**Files:**
- Modify: `src/lib/bank.ts:24-29` (`loadCategory`)
- Modify: `src/features/quiz/QuestionCard.tsx:28`, `:50-55`
- Test: `src/lib/bank.test.ts`, `src/features/quiz/QuestionCard.test.tsx`

**Interfaces:**
- Consumes: `loadPassages` et `Question.passageId` / `Question.passage` (Task 4).
- Produces: `loadCategory(cat, fetchImpl?)` rend des questions dont le champ `passage` est **résolu**, et **exclut** celles dont le `passageId` est pendant.

- [ ] **Step 1: Write the failing test**

Ajouter à `src/lib/bank.test.ts` :

```ts
test("loadCategory résout le passage et écarte une IRI pendante", async () => {
  clearCategoryCache();
  const fetchImpl = async (url: string) => ({
    json: async () => url.includes("passage.jsonld")
      ? { "@graph": [{
          "@id": "jlpt:passage/tanbun-01", "@type": "jlpt:Passage",
          "schema:name": "Note", "jlpt:jp": "エレベーターは 工事中 です。", "jlpt:format": "tanbun",
        }] }
      : { "@graph": [
          { "@id": "jlpt:q/10307", "@type": "jlpt:Question", "jlpt:ord": 10307,
            "jlpt:skill": "lecture", "jlpt:difficulty": 2, "jlpt:stem": "何 が 分かりますか。",
            opts: ["a", "b"], "jlpt:answer": 0, readsPassage: "jlpt:passage/tanbun-01" },
          { "@id": "jlpt:q/10308", "@type": "jlpt:Question", "jlpt:ord": 10308,
            "jlpt:skill": "lecture", "jlpt:difficulty": 2, "jlpt:stem": "いつ ですか。",
            opts: ["a", "b"], "jlpt:answer": 0, readsPassage: "jlpt:passage/absent" },
          { "@id": "jlpt:q/10309", "@type": "jlpt:Question", "jlpt:ord": 10309,
            "jlpt:skill": "lecture", "jlpt:difficulty": 1, "jlpt:stem": "どこ ですか。",
            opts: ["a", "b"], "jlpt:answer": 0 },
        ] },
  });
  const pool = await loadCategory("lecture", fetchImpl);
  expect(pool.map((q) => q.id)).toEqual([10307, 10309]); // 10308 écartée : passage pendant
  expect(pool[0].passage?.jp).toBe("エレベーターは 工事中 です。");
  expect(pool[1].passage).toBeUndefined();               // question sans passage : intacte
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/bank.test.ts -t "résout le passage"`
Expected: FAIL — les trois questions sont rendues et `pool[0].passage` est `undefined`.

- [ ] **Step 3: Résoudre dans `bank.ts`**

Remplacer `loadCategory` :

```ts
/** Le pool d'une compétence, passages **résolus**. Passe par le graphe (`q-<skill>.jsonld`) :
 *  la projection JSON-LD → `Question` vit dans `graph.ts`, pas ici.
 *
 *  ⚠ Une question dont le `passageId` ne résout pas est ÉCARTÉE : sans son texte, elle est
 *  inrépondable. Le court-circuit `some()` garde les quatre autres compétences sur le tableau
 *  mémoïsé tel quel — seule la lecture paie la reconstruction (une centaine d'objets). */
export async function loadCategory(
  cat: Skill, fetchImpl: FetchLike = fetch as FetchLike,
): Promise<Question[]> {
  const pool = await loadSkill(cat, fetchImpl);
  if (!pool.some((q) => typeof q.passageId === "string")) return pool;
  const passages = await loadPassages(fetchImpl);
  const out: Question[] = [];
  for (const q of pool) {
    if (typeof q.passageId !== "string") { out.push(q); continue; }
    const p = passages.get(q.passageId);
    if (!p) { console.warn(`question ${q.id} : passage ${q.passageId} introuvable — écartée`); continue; }
    out.push({ ...q, passage: p });
  }
  return out;
}
```

Compléter l'import : `import { clearGraphCache, loadPassages, loadSkill, skillOfOrd, type SkillRange } from "./graph.ts";`

- [ ] **Step 4: Afficher le texte résolu**

Dans `src/features/quiz/QuestionCard.tsx`, remplacer la ligne 28 par

```tsx
  const passage = question.passage ?? null;
```

et le bloc de rendu (lignes 50-55) par

```tsx
      {question.cat === "lecture" && passage && (
        <div
          className="text-fg text-base mb-3 leading-loose"
          dangerouslySetInnerHTML={{ __html: furi(passage.jp) }}
        />
      )}
```

- [ ] **Step 5: Test d'affichage**

Créer `src/features/quiz/QuestionCard.passage.test.tsx` — le dépôt nomme ses tests de
`QuestionCard` par sujet (`QuestionCard.audio.test.tsx`, `QuestionCard.production.test.tsx`) :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionCard } from "./QuestionCard.tsx";
import type { Question } from "../../types/quiz.ts";

/** Texte de base sans les annotations furigana — même assistant que `quiz.test.tsx` : une
 *  assertion sur un kanji brut est un flake (furi() scinde le mot en spans). */
const baseText = (h: string): string =>
  h.replace(/<span class="furi-rt">.*?<\/span>/g, "").replace(/<[^>]+>/g, "");

const avecPassage: Question = {
  id: 10307, cat: "lecture", d: 2, q: "何 が 分かりますか。", o: ["a", "b"], a: 0,
  passageId: "jlpt:passage/tanbun-01",
  passage: { jp: "あしたは やすみ です。", format: "tanbun" },
};

test("QuestionCard rend le texte du passage résolu", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={avecPassage} chosen={null} answered={false}
                  onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(baseText(html)).toContain("あしたは やすみ です。");
});

test("QuestionCard sans passage rend l'énoncé seul", () => {
  const sansPassage: Question = { id: 1, cat: "lecture", d: 1, q: "どこ ですか。", o: ["a", "b"], a: 0 };
  const html = renderToStaticMarkup(
    <QuestionCard question={sansPassage} chosen={null} answered={false}
                  onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(baseText(html)).toContain("どこ ですか。");
  expect(baseText(html)).not.toContain("やすみ");
});
```

- [ ] **Step 6: Run the tests**

Run: `bun test src/lib/bank.test.ts src/features/quiz/QuestionCard.passage.test.tsx && bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bank.ts src/lib/bank.test.ts src/features/quiz/QuestionCard.tsx src/features/quiz/QuestionCard.passage.test.tsx
git commit -m "feat(lecture): resoudre le passage au chargement du pool et l afficher"
```

---

### Task 6: `withPassageGroups` — les questions d'un texte voyagent ensemble

`composeSession` **mélange** la session finale : sans cette passe, les trois questions d'un 中文 se retrouvent en position 3, 11 et 17, et le texte est affiché trois fois. La règle s'applique **après** le mélange, qu'elle préserve pour tout le reste.

**Files:**
- Modify: `src/lib/bank.ts` (nouvelle fonction exportée, après `composeSession`)
- Test: `src/lib/bank.test.ts`

**Interfaces:**
- Consumes: `Question.passageId` (Task 4).
- Produces: `withPassageGroups(session: Question[], pool: Question[], total: number): Question[]` — pure.

- [ ] **Step 1: Write the failing test**

Ajouter à `src/lib/bank.test.ts` :

```ts
const qp = (id: number, passageId?: string): Question =>
  ({ id, cat: "lecture", d: 2, q: `énoncé ${id}`, o: ["a", "b"], a: 0, ...(passageId ? { passageId } : {}) });

test("withPassageGroups complète la fratrie et la rend adjacente", () => {
  const pool = [qp(1, "p/A"), qp(2, "p/A"), qp(3, "p/A"), qp(9)];
  const session = [qp(9), qp(2, "p/A")]; // seule la 2 a été tirée
  const out = withPassageGroups(session, pool, 4);
  expect(out.map((q) => q.id)).toEqual([9, 1, 2, 3]); // fratrie complétée, triée, en bloc
});

test("withPassageGroups écarte un groupe qui ne tient pas dans le budget", () => {
  const pool = [qp(1, "p/A"), qp(2, "p/A"), qp(3, "p/A"), qp(4, "p/A"), qp(9), qp(8)];
  const session = [qp(9), qp(8), qp(2, "p/A")];
  const out = withPassageGroups(session, pool, 3); // 2 isolées + 1 place → le groupe de 4 ne tient pas
  expect(out.map((q) => q.id)).toEqual([9, 8]);     // groupe entier écarté, jamais tronqué
});

test("withPassageGroups laisse intacte une session sans passage", () => {
  const pool = [qp(9), qp(8)];
  const session = [qp(8), qp(9)];
  expect(withPassageGroups(session, pool, 2).map((q) => q.id)).toEqual([8, 9]);
});

test("withPassageGroups ne dépasse jamais le budget", () => {
  const pool = [qp(1, "p/A"), qp(2, "p/A"), qp(3, "p/B"), qp(4, "p/B"), qp(9)];
  const session = [qp(9), qp(1, "p/A"), qp(3, "p/B")];
  const out = withPassageGroups(session, pool, 3);
  expect(out.length).toBeLessThanOrEqual(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/bank.test.ts -t "withPassageGroups"`
Expected: FAIL — `withPassageGroups is not a function`.

- [ ] **Step 3: Write the implementation**

Ajouter à `src/lib/bank.ts`, après `composeSession` :

```ts
/**
 * Regroupe les questions d'un même passage : complète les fratries manquantes depuis `pool`,
 * écarte un groupe qui ne tient pas dans `total`, puis rend les membres adjacents et triés par
 * `id` (l'ordre de lecture du texte). Pure.
 *
 * ⚠ Appelée APRÈS `composeSession` / `selectDiagnostic` : c'est la seule position qui survive
 * au mélange final. L'ordre du reste de la session est préservé — chaque groupe est simplement
 * ramené d'un bloc à la position de son premier membre.
 *
 * ⚠ Un groupe écarté n'est PAS remplacé : la session est alors plus courte (borné à 3
 * questions). Refiler la place exigerait le vivier complet, les poids et le jeu d'exclusion —
 * une session légèrement plus courte est le prix accepté (cf. spec §4).
 */
export function withPassageGroups(session: Question[], pool: Question[], total: number): Question[] {
  const groups = new Map<string, Question[]>();
  for (const q of pool) {
    const pid = typeof q.passageId === "string" ? q.passageId : null;
    if (!pid) continue;
    const g = groups.get(pid);
    if (g) g.push(q); else groups.set(pid, [q]);
  }
  if (!groups.size) return session;
  for (const g of groups.values()) g.sort((a, b) => a.id - b.id);

  const pidOf = (q: Question) => (typeof q.passageId === "string" ? q.passageId : null);
  let room = total - session.filter((q) => !pidOf(q)).length;
  const kept = new Set<string>();
  for (const q of session) {
    const pid = pidOf(q);
    if (!pid || kept.has(pid)) continue;
    const g = groups.get(pid);
    if (g && g.length <= room) { kept.add(pid); room -= g.length; }
  }

  const out: Question[] = [];
  const placed = new Set<string>();
  for (const q of session) {
    const pid = pidOf(q);
    if (!pid) { out.push(q); continue; }
    if (!kept.has(pid) || placed.has(pid)) continue;
    placed.add(pid);
    out.push(...(groups.get(pid) as Question[]));
  }
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `bun test src/lib/bank.test.ts && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank.ts src/lib/bank.test.ts
git commit -m "feat(lecture): withPassageGroups garde ensemble les questions d un meme texte"
```

---

### Task 7: Câblage dans `useQuiz` — les deux chemins de session

**Files:**
- Modify: `src/features/quiz/useQuiz.ts:304-306` (diagnostic), `:380` (session composée)
- Create: `src/features/quiz/passage-wiring.test.ts`

**Interfaces:**
- Consumes: `withPassageGroups` (Task 6).
- Produces: aucune API nouvelle — le comportement de `start()` change.

> **Pourquoi pas un test d'intégration sur `start()`** : il n'existe aucun harnais montant
> `useQuiz` dans le dépôt, et la revue finale du lot cadence a explicitement acté ce choix
> (« pas de test intégration `start()` : convention projet, logique en couches pures testées »).
> La règle est prouvée par les tests purs de la Task 6 ; ce qui reste à garder ici, c'est que
> **les deux chemins de session la traversent** — et qu'un troisième chemin ajouté plus tard ne
> l'oublie pas en silence. Le dépôt teste déjà des invariants de ce genre en lisant le source
> (cf. les trois inventaires de `copy-static.test.ts`).

- [ ] **Step 1: Write the failing test**

Créer `src/features/quiz/passage-wiring.test.ts` :

```ts
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

// Le risque propre au câblage n'est pas la règle de regroupement (pure, testée dans bank.ts),
// c'est qu'un chemin de session l'OUBLIE : la session part alors avec les questions d'un même
// texte dispersées par le mélange, sans la moindre erreur.
const src = readFileSync("src/features/quiz/useQuiz.ts", "utf8");

test("chaque construction de session passe par withPassageGroups", () => {
  const constructions = (src.match(/\b(composeSession|selectDiagnostic)\s*\(/g) ?? []).length;
  const regroupements = (src.match(/\bwithPassageGroups\s*\(/g) ?? []).length;
  expect(constructions).toBeGreaterThan(0);
  expect(regroupements).toBe(constructions);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/quiz/passage-wiring.test.ts`
Expected: FAIL — 2 constructions, 0 regroupement.

- [ ] **Step 3: Câbler les deux chemins**

Dans `src/features/quiz/useQuiz.ts`, importer `withPassageGroups` depuis `../../lib/bank.ts` (à côté de `composeSession`).

Chemin diagnostic — remplacer

```ts
      const session = selectDiagnostic(await loadAllCategories(), total, Math.random);
```

par

```ts
      const poolsDiag = await loadAllCategories();
      const session = withPassageGroups(
        selectDiagnostic(poolsDiag, total, Math.random),
        poolsDiag.lecture, // seule compétence à passages
        total,
      );
```

Chemin composé — remplacer la ligne `const session = composeSession(...)` par

```ts
    const session = withPassageGroups(
      composeSession([...errorQs, ...confusionQs, ...revisionQs, ...learnQs], picked, total, Math.random),
      pools.lecture,
      total,
    );
```

- [ ] **Step 4: Run the tests**

Run: `bun test src/features/quiz && bun run typecheck`
Expected: PASS — y compris les tests de session existants (une session sans question de lecture traverse `withPassageGroups` inchangée).

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz/useQuiz.ts src/features/quiz/passage-wiring.test.ts
git commit -m "feat(lecture): appliquer le regroupement par passage aux deux chemins de session"
```

---

### Task 7 bis: Migrer les huit textes déjà présents dans le corpus

**Découvert en revue de la Task 3, et la spec avait tort** : le plan justifiait le retrait de
`jlpt:passage` par « zéro consommateur ». Faux — la mesure cherchait `"passage"` là où la clé est
`"jlpt:passage"`. **16 questions sur 52** (ords `10249`–`10264`, huit paires) portent leur texte
en clair. Les Tasks 4 et 5 ayant retiré la projection et basculé l'affichage sur l'objet résolu,
**ces seize questions s'affichent aujourd'hui sans leur texte** : inrépondables, en silence.

**Files:**
- Create: `tools/graph/migrate-passages.mjs`
- Create: `tools/graph/migrate-passages.test.ts`
- Modify: `data/graph/passage.jsonld`, `data/graph/q-lecture.jsonld` (par l'outil)

**Interfaces:**
- Consumes: le type `jlpt:Passage` et l'arête `readsPassage` (Task 3).
- Produces: `migrateInline(passages, questions)` → `{ passages, questions, migres }` — pure, les
  documents sont injectés.

- [ ] **Step 1: Lire les huit textes et leur donner un nom**

```bash
bun -e '
const g = JSON.parse(await Bun.file("data/graph/q-lecture.jsonld").text())["@graph"];
const vus = new Map();
for (const q of g) {
  const t = q["jlpt:passage"];
  if (typeof t !== "string") continue;
  if (!vus.has(t)) vus.set(t, []);
  vus.get(t).push(q["jlpt:ord"]);
}
let i = 0;
for (const [t, ords] of vus) console.log(`--- #${++i} ords ${ords.join(",")}\n${t}`);
'
```

Lis les huit textes et rédige pour chacun un `schema:name` français court et descriptif (ce qu'est
le document : « Annonce : fermeture de la bibliothèque », « Courriel : changement d'horaire »…).
Ces huit noms sont la seule part rédactionnelle de la tâche ; note-les dans ton rapport.

- [ ] **Step 2: Write the failing test**

`tools/graph/migrate-passages.test.ts` :

```ts
import { test, expect } from "bun:test";
import { migrateInline } from "./migrate-passages.mjs";

const q = (ord: number, texte?: string) => ({
  "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question", "jlpt:skill": "lecture",
  "jlpt:difficulty": 2, "jlpt:ord": ord, "jlpt:stem": `énoncé ${ord}`,
  opts: ["a", "b"], "jlpt:answer": 0,
  ...(texte ? { "jlpt:passage": texte } : {}),
});
const noms = { "texte A": "Annonce A", "texte B": "Annonce B" };

test("migrateInline crée un passage par texte distinct et relie ses questions", () => {
  const r = migrateInline([], [q(1, "texte A"), q(2, "texte A"), q(3, "texte B")], noms);
  expect(r.migres).toBe(2);
  expect(r.passages.length).toBe(2);
  expect(r.passages[0]["jlpt:jp"]).toBe("texte A");
  expect(r.passages[0]["schema:name"]).toBe("Annonce A");
  expect(r.passages[0]["jlpt:format"]).toBe("tanbun");
  expect(r.questions[0].readsPassage).toBe(r.passages[0]["@id"]);
  expect(r.questions[1].readsPassage).toBe(r.passages[0]["@id"]); // même texte, même passage
  expect(r.questions[2].readsPassage).toBe(r.passages[1]["@id"]);
});

test("migrateInline retire le champ jlpt:passage des questions migrées", () => {
  const r = migrateInline([], [q(1, "texte A")], noms);
  expect("jlpt:passage" in r.questions[0]).toBe(false);
});

test("migrateInline laisse intacte une question sans passage", () => {
  const r = migrateInline([], [q(1)], noms);
  expect(r.migres).toBe(0);
  expect(r.questions[0]).toEqual(q(1));
  expect(r.passages).toEqual([]);
});

test("migrateInline est idempotent : rejoué, il ne migre rien", () => {
  const premier = migrateInline([], [q(1, "texte A"), q(2, "texte A")], noms);
  const second = migrateInline(premier.passages, premier.questions, noms);
  expect(second.migres).toBe(0);
  expect(second.passages.length).toBe(1);
});

test("migrateInline ne renumérote aucun ordinal", () => {
  const r = migrateInline([], [q(7, "texte A"), q(8, "texte A")], noms);
  expect(r.questions.map((x) => x["jlpt:ord"])).toEqual([7, 8]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test tools/graph/migrate-passages.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 4: Write the implementation**

`tools/graph/migrate-passages.mjs` :

```js
#!/usr/bin/env node
// Migration ponctuelle : les textes de lecture embarqués en clair sur la question
// (`jlpt:passage`, 16 questions / 8 textes, hérités de la migration initiale du graphe)
// deviennent des sujets `jlpt:Passage` reliés par `readsPassage`.
//
// ⚠ Aucun `jlpt:ord` ne bouge, aucune question n'est ajoutée ni retirée : `corpus.jsonld` est
// inchangé et la progression persistée (bitsets indexés par ord) reste valide.
//
// ⚠ Idempotent : une question déjà porteuse de `readsPassage` est laissée telle quelle, et un
// texte déjà présent dans passage.jsonld n'est pas dupliqué.
//
// Zéro dépendance, exécuté par `bun`.
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "data/graph";

/** Noms français des huit textes, rédigés à la lecture (clé = texte japonais intégral). */
export const NOMS = {};

/** Migre les textes inline. Pure : les documents sont injectés, rien n'est lu ni écrit ici. */
export function migrateInline(passages, questions, noms) {
  const out = [...passages];
  const parTexte = new Map();
  for (const p of out) parTexte.set(p["jlpt:jp"], p["@id"]);
  let migres = 0;

  const nextIndex = () => out.length + 1;
  const questionsOut = questions.map((q) => {
    const texte = q["jlpt:passage"];
    if (typeof texte !== "string") return q;
    let id = parTexte.get(texte);
    if (!id) {
      const n = String(nextIndex()).padStart(2, "0");
      id = `jlpt:passage/legacy-${n}`;
      out.push({
        "@id": id,
        "@type": "jlpt:Passage",
        "schema:name": noms[texte] ?? `Texte de lecture ${n}`,
        "jlpt:format": "tanbun",
        "jlpt:jp": texte,
      });
      parTexte.set(texte, id);
      migres++;
    }
    const { "jlpt:passage": _retire, ...reste } = q;
    return { ...reste, readsPassage: id };
  });

  return { passages: out, questions: questionsOut, migres };
}

function main() {
  const cheminP = `${DIR}/passage.jsonld`, cheminQ = `${DIR}/q-lecture.jsonld`;
  const docP = JSON.parse(readFileSync(cheminP, "utf8"));
  const docQ = JSON.parse(readFileSync(cheminQ, "utf8"));
  const r = migrateInline(docP["@graph"] ?? [], docQ["@graph"] ?? [], NOMS);
  if (!r.migres) {
    console.log("✓ rien à migrer — les textes sont déjà des sujets jlpt:Passage");
    return 0;
  }
  writeFileSync(cheminP, JSON.stringify({ ...docP, "@graph": r.passages }, null, 1) + "\n");
  writeFileSync(cheminQ, JSON.stringify({ ...docQ, "@graph": r.questions }, null, 1) + "\n");
  console.log(`✓ ${r.migres} textes migrés vers jlpt:Passage`);
  return 0;
}

if (import.meta.main) process.exit(main());
```

Renseigne `NOMS` avec les huit paires « texte japonais intégral → nom français » de l'étape 1.

- [ ] **Step 5: Migrer, puis vérifier l'idempotence**

Run: `bun tools/graph/migrate-passages.mjs`
Expected: `✓ 8 textes migrés vers jlpt:Passage`.

Run une seconde fois : `✓ rien à migrer`, et `git diff --stat` inchangé après cette seconde passe.

- [ ] **Step 6: Prouver qu'aucune question n'a perdu son texte**

```bash
bun -e '
const q = JSON.parse(await Bun.file("data/graph/q-lecture.jsonld").text())["@graph"];
const p = JSON.parse(await Bun.file("data/graph/passage.jsonld").text())["@graph"];
const ids = new Set(p.map((x) => x["@id"]));
const inline = q.filter((x) => typeof x["jlpt:passage"] === "string").length;
const relies = q.filter((x) => typeof x.readsPassage === "string");
const pendants = relies.filter((x) => !ids.has(x.readsPassage));
console.log("restes inline :", inline, "| reliees :", relies.length, "| pendantes :", pendants.length);
'
```

Expected : `restes inline : 0 | reliees : 16 | pendantes : 0`.

- [ ] **Step 7: Valider et commiter**

Run: `bun tools/validate-graph.mjs && bun test && bun run typecheck`
Expected: tout vert. Pas de bump `sw.js` : la branche a déjà porté `v117` → `v118`, et elle n'a pas été livrée.

```bash
git add tools/graph/migrate-passages.mjs tools/graph/migrate-passages.test.ts data/graph/passage.jsonld data/graph/q-lecture.jsonld
git commit -m "feat(lecture): migrer les huit textes inline vers le type Passage"
```

---

### Task 8: `audit-passages.mjs` — la garde de périmètre

C'est cet outil qui remplace l'arbitrage humain : le périmètre lexical et la forme se **prouvent** mécaniquement. Il lit le fichier de décisions et n'écrit rien.

**Files:**
- Create: `tools/graph/audit-passages.mjs`
- Create: `tools/graph/audit-passages.test.ts`
- Create: `data/passages-arbitres.json` (avec un seul passage d'amorçage, remplacé en Task 10)

**Interfaces:**
- Consumes: `data/graph/kanji.jsonld`, `data/graph/word.jsonld`.
- Produces: `auditPassages(decisions, refs): { erreurs: string[], avertissements: string[] }` ;
  `refs = { kanji: Set<string>, motsHorsN3: Set<string> }`. Le CLI `main()` lit les fichiers,
  affiche les deux listes et sort **1 seulement s'il y a des erreurs**.

> ⚠ **Deux catégories, et c'est structurant.** `kanji.jsonld` est une **liste d'étude** (810 kanji
> à apprendre), pas la liste de ce qu'un lecteur N3 sait lire : 不, 用, 工, 便, 場, 方, 室 en sont
> absents. En faire une barrière bloquante rejetterait des textes sains — le dépôt a déjà payé
> cette erreur avec la chaîne de purge (« la proposition est une heuristique, jamais un ordre de
> suppression : elle a désigné trois VRAIS mots »). Le périmètre lexical **signale** ; seuls les
> défauts structurels **bloquent**.

- [ ] **Step 1: Créer le fichier de décisions d'amorçage**

`data/passages-arbitres.json` — **un** passage complet, qui sert de gabarit à tous les autres :

```json
{
 "passages": [
  {
   "id": "jlpt:passage/tanbun-01",
   "name": "Note de service : ascenseur en travaux",
   "format": "tanbun",
   "jp": "社員のみなさんへ。三月十日から十二日まで、エレベーターの工事を行います。その間、エレベーターは使えませんので、階段をご利用ください。ご不便をおかけしますが、ご協力をお願いします。なお、大きな荷物をお持ちの方は、一階の事務室にお声をおかけください。",
   "fr": "Avis au personnel : l'ascenseur sera en travaux du 10 au 12 mars ; merci d'emprunter l'escalier.",
   "tests": ["jlpt:word/工事", "jlpt:word/利用"],
   "questions": [
    {
     "stem": "この お知らせ から 分かる こと は 何 ですか。",
     "opts": [
      "三月十日から三日間、階段を使う",
      "三月十日にエレベーターが直る",
      "工事の間は会社が休みになる",
      "階段の工事が三日間行われる"
     ],
     "answer": 0,
     "difficulty": 2,
     "description": "<b>十日から十二日まで</b> = trois jours ; l'ascenseur étant inutilisable, on prend l'escalier.",
     "gloss": "工事（こうじ）« travaux » · 行う（おこなう）« effectuer » · その間（そのあいだ）« pendant ce temps » · 階段（かいだん）« escalier » · 利用（りよう）« usage »",
     "optionNote": [
      "Du 10 au 12 inclus = trois jours d'escalier — exact",
      "« Réparé le 10 » : c'est le début des travaux, pas leur fin",
      "L'avis ne dit rien d'une fermeture de l'entreprise",
      "Ce sont les travaux de l'ASCENSEUR, pas de l'escalier"
     ],
     "tests": ["jlpt:word/工事"]
    }
   ]
  }
 ]
}
```

- [ ] **Step 2: Write the failing test**

`tools/graph/audit-passages.test.ts` :

```ts
import { test, expect } from "bun:test";
import { auditPassages } from "./audit-passages.mjs";

const refs = { kanji: new Set(["工", "事", "階", "段"]), motsHorsN3: new Set(["斡旋"]) };
const bon = {
  id: "jlpt:passage/tanbun-01", name: "Note", format: "tanbun",
  jp: "工事の間は階段を使ってください。".repeat(8).slice(0, 120),
  questions: [{
    stem: "何 が 分かりますか。", opts: ["a", "b", "c", "d"], answer: 0, difficulty: 2,
    optionNote: ["x", "y", "z", "w"],
  }],
};

test("auditPassages accepte un passage conforme", () => {
  const r = auditPassages({ passages: [bon] }, refs);
  expect(r.erreurs).toEqual([]);
  expect(r.avertissements).toEqual([]);
});

test("auditPassages avertit d'un kanji hors référentiel SANS bloquer", () => {
  // kanji.jsonld est une liste d'ÉTUDE, pas la liste de ce qu'un lecteur N3 sait lire :
  // 不, 用, 工, 便, 場, 方, 室 en sont absents. Bloquer là-dessus rejetterait des textes sains.
  const ko = { ...bon, jp: bon.jp.slice(0, 119) + "斡" };
  const r = auditPassages({ passages: [ko] }, refs);
  expect(r.avertissements.some((e) => e.includes("斡"))).toBe(true);
  expect(r.erreurs).toEqual([]);
});

test("auditPassages avertit d'un mot hors N3 SANS bloquer", () => {
  const ko = { ...bon, jp: bon.jp.slice(0, 118) + "斡旋" };
  const r = auditPassages({ passages: [ko] }, refs);
  expect(r.avertissements.some((e) => e.includes("斡旋"))).toBe(true);
  expect(r.erreurs).toEqual([]);
});

test("auditPassages bloque sur une longueur hors gabarit", () => {
  const ko = { ...bon, jp: "工事。" };
  expect(auditPassages({ passages: [ko] }, refs).erreurs.some((e) => e.includes("longueur"))).toBe(true);
});

test("auditPassages bloque sur un nombre de questions non conforme au format", () => {
  const ko = { ...bon, format: "chubun" }; // 中文 = 3 questions, une seule fournie
  expect(auditPassages({ passages: [ko] }, refs).erreurs.some((e) => e.includes("questions"))).toBe(true);
});

test("auditPassages bloque sur un optionNote désaligné", () => {
  const ko = { ...bon, questions: [{ ...bon.questions[0], optionNote: ["x", "y"] }] };
  expect(auditPassages({ passages: [ko] }, refs).erreurs.some((e) => e.includes("optionNote"))).toBe(true);
});

test("auditPassages bloque sur une réponse hors bornes", () => {
  const ko = { ...bon, questions: [{ ...bon.questions[0], answer: 9 }] };
  expect(auditPassages({ passages: [ko] }, refs).erreurs.some((e) => e.includes("answer"))).toBe(true);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test tools/graph/audit-passages.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 4: Write the implementation**

`tools/graph/audit-passages.mjs` :

```js
#!/usr/bin/env node
// Garde de périmètre des passages de lecture : lit data/passages-arbitres.json et signale ce
// qui sort du N3 ou du gabarit. N'ÉCRIT RIEN — c'est l'applicateur (passages.mjs) qui pose.
//
// ⚠ Le périmètre lexical se prouve ; le naturel de la langue et l'unicité de la réponse
// défendable, non. Cet outil ne remplace pas la relecture du lot 1a.
//
// Zéro dépendance, exécuté par `bun`.
import { readFileSync } from "node:fs";

const DIR = "data/graph";
const DECISIONS = "data/passages-arbitres.json";

/** Gabarit par format : longueur du texte (caractères) et nombre de questions. */
export const GABARIT = {
  tanbun: { min: 100, max: 200, questions: 1 },
  chubun: { min: 300, max: 420, questions: 3 },
  chobun: { min: 500, max: 650, questions: 4 },
  joho:   { min: 150, max: 300, questions: 2 },
};

const KANJI_RE = /[一-龯]/gu;

/**
 * Anomalies d'un jeu de décisions. Pure : les référentiels sont injectés.
 *
 * Deux catégories. `erreurs` = défauts STRUCTURELS, prouvés, qui bloquent la pose.
 * `avertissements` = périmètre lexical, qui ne bloque JAMAIS : `kanji.jsonld` est une liste
 * d'ÉTUDE (810 kanji à apprendre), pas la liste de ce qu'un lecteur N3 sait lire — 不, 用, 工,
 * 便, 場, 方, 室 en sont absents. Bloquer là-dessus condamnerait des textes parfaitement sains,
 * exactement comme l'heuristique de purge avait désigné trois VRAIS mots.
 */
export function auditPassages(decisions, refs) {
  const errs = [];
  const avertissements = [];
  const vus = new Set();
  for (const p of decisions.passages ?? []) {
    const tag = p.id ?? "(sans id)";
    if (!p.id || !/^jlpt:passage\/[a-z]+-\d+$/.test(p.id)) {
      errs.push(`${tag} : id absent ou non conforme à jlpt:passage/<format>-<nn>`);
    }
    if (vus.has(p.id)) errs.push(`${tag} : id en double`);
    vus.add(p.id);
    if (!p.name) errs.push(`${tag} : name manquant`);

    // ⚠ PAS de `continue` sur un format inconnu : les contrôles structurels des questions
    // (cardinalité d'optionNote, réponse hors bornes…) n'en dépendent pas, et les masquer
    // livrerait un rapport trompeur — l'auteur corrigerait le format, relancerait, et
    // découvrirait alors seulement les vrais défauts. Seuls les contrôles DÉRIVÉS du gabarit
    // sont sautés.
    const g = GABARIT[p.format];
    if (!g) errs.push(`${tag} : format inconnu « ${p.format} »`);

    const jp = String(p.jp ?? "");
    if (g && (jp.length < g.min || jp.length > g.max)) {
      errs.push(`${tag} : longueur ${jp.length} hors gabarit ${p.format} (${g.min}–${g.max})`);
    }
    for (const k of new Set(jp.match(KANJI_RE) ?? [])) {
      if (!refs.kanji.has(k)) avertissements.push(`${tag} : kanji « ${k} » hors du référentiel`);
    }
    for (const mot of refs.motsHorsN3) {
      if (jp.includes(mot)) avertissements.push(`${tag} : mot « ${mot} » hors N3/N4/N5`);
    }

    const qs = p.questions ?? [];
    if (g && qs.length !== g.questions) {
      errs.push(`${tag} : ${qs.length} questions pour un ${p.format} (attendu ${g.questions})`);
    }
    qs.forEach((q, i) => {
      const qtag = `${tag}#${i}`;
      const opts = q.opts ?? [];
      if (opts.length < 2) errs.push(`${qtag} : moins de deux options`);
      if (new Set(opts).size !== opts.length) errs.push(`${qtag} : deux options identiques`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) {
        errs.push(`${qtag} : answer hors bornes`);
      }
      if (![1, 2, 3].includes(q.difficulty)) errs.push(`${qtag} : difficulty hors 1–3`);
      if (!q.stem) errs.push(`${qtag} : stem manquant`);
      const notes = q.optionNote ?? [];
      if (notes.length !== opts.length) {
        errs.push(`${qtag} : optionNote de longueur ${notes.length} pour ${opts.length} options`);
      }
    });
  }
  return { erreurs: errs, avertissements };
}

/** Référentiels lus depuis le graphe : kanji connus, et mots glosés de niveau > N3. */
export function readRefs() {
  const kanjiDoc = JSON.parse(readFileSync(`${DIR}/kanji.jsonld`, "utf8"));
  const wordDoc = JSON.parse(readFileSync(`${DIR}/word.jsonld`, "utf8"));
  const kanji = new Set((kanjiDoc["@graph"] ?? []).map((k) => k["schema:name"]).filter(Boolean));
  const motsHorsN3 = new Set(
    (wordDoc["@graph"] ?? [])
      .filter((w) => ["N2", "N1"].includes(w["jlpt:level"]))
      .map((w) => w["schema:name"])
      .filter(Boolean),
  );
  return { kanji, motsHorsN3 };
}

function main() {
  const decisions = JSON.parse(readFileSync(DECISIONS, "utf8"));
  const { erreurs, avertissements } = auditPassages(decisions, readRefs());
  const n = (decisions.passages ?? []).length;
  const q = (decisions.passages ?? []).reduce((a, p) => a + (p.questions ?? []).length, 0);
  // Les avertissements s'affichent TOUJOURS, verdict compris : c'est à l'auteur de juger si un
  // kanji hors liste d'étude gêne, pas à l'outil de trancher à sa place.
  if (avertissements.length) {
    console.log(`⚠ ${avertissements.length} signalements de périmètre (non bloquants) :`);
    for (const a of avertissements) console.log(`  ${a}`);
  }
  if (!erreurs.length) {
    console.log(`✓ ${n} passages, ${q} questions — conformes`);
    return 0;
  }
  console.error(`✗ ${erreurs.length} erreurs sur ${n} passages :`);
  for (const e of erreurs) console.error(`  ${e}`);
  return 1;
}

if (import.meta.main) process.exit(main());
```

- [ ] **Step 5: Run the tests and the CLI**

Run: `bun test tools/graph/audit-passages.test.ts && bun tools/graph/audit-passages.mjs`
Expected: tests PASS, et le CLI affiche `✓ 1 passages, 1 questions — conformes` sur le fichier d'amorçage.

- [ ] **Step 6: Commit**

```bash
git add tools/graph/audit-passages.mjs tools/graph/audit-passages.test.ts data/passages-arbitres.json
git commit -m "feat(lecture): audit de perimetre des passages (chaine n6, etape 1)"
```

---

### Task 9: `passages.mjs` — l'applicateur idempotent

**Files:**
- Create: `tools/graph/passages.mjs`
- Create: `tools/graph/passages.test.ts`

**Interfaces:**
- Consumes: `data/passages-arbitres.json` (Task 8), le type et le document de Task 3.
- Produces: `applyPassages(decisions, docs)` → `{ passages, questions, corpus, poses, deja }` où `docs = { passages, lecture, corpus }` (les trois `@graph` en entrée) ; `nextOrd(shards)` → premier ordinal libre.

- [ ] **Step 1: Write the failing test**

`tools/graph/passages.test.ts` :

```ts
import { test, expect } from "bun:test";
import { applyPassages } from "./passages.mjs";

const decisions = {
  passages: [{
    id: "jlpt:passage/tanbun-01", name: "Note", format: "tanbun", jp: "工事です。",
    fr: "Travaux.", tests: ["jlpt:word/工事"],
    questions: [{
      stem: "何 ですか。", opts: ["a", "b"], answer: 0, difficulty: 2,
      description: "…", gloss: "…", optionNote: ["x", "y"], tests: ["jlpt:word/工事"],
    }],
  }],
};
const docsVides = () => ({
  passages: [],
  lecture: [{ "@id": "jlpt:q/10223", "@type": "jlpt:Question", "jlpt:skill": "lecture", "jlpt:ord": 10223 }],
  corpus: [{ "@id": "jlpt:corpus/lecture", "@type": "jlpt:SkillRange", "jlpt:skill": "lecture", "jlpt:from": 10223, "jlpt:count": 1 }],
  nextOrd: 10224,
});

test("applyPassages pose le passage, la question et l'intervalle", () => {
  const r = applyPassages(decisions, docsVides());
  expect(r.poses).toBe(1);
  expect(r.passages[0]["@type"]).toBe("jlpt:Passage");
  expect(r.passages[0]["jlpt:format"]).toBe("tanbun");
  const q = r.questions[r.questions.length - 1];
  expect(q["jlpt:ord"]).toBe(10224);
  expect(q.readsPassage).toBe("jlpt:passage/tanbun-01");
  expect(q["jlpt:skill"]).toBe("lecture");
  const nouveau = r.corpus.find((c) => c["@id"] === "jlpt:corpus/lecture-2");
  expect(nouveau["jlpt:from"]).toBe(10224);
  expect(nouveau["jlpt:count"]).toBe(1);
});

test("applyPassages est idempotent : rejoué, il ne pose rien", () => {
  const premier = applyPassages(decisions, docsVides());
  const second = applyPassages(decisions, {
    passages: premier.passages, lecture: premier.questions, corpus: premier.corpus,
    nextOrd: 10225,
  });
  expect(second.poses).toBe(0);
  expect(second.deja).toBe(1);
  expect(second.questions.length).toBe(premier.questions.length);
  expect(second.corpus.length).toBe(premier.corpus.length);
});

test("applyPassages n'écrit pas les champs optionnels absents", () => {
  // Convention de la chaîne : readings/traps/link-answers assertent tous `toBeUndefined()`.
  // Sans ce test, un jour où l'écriture deviendrait inconditionnelle, un `undefined` entrerait
  // dans le graphe sans qu'aucun test ne bronche.
  const minimal = {
    passages: [{
      id: "jlpt:passage/tanbun-09", name: "Minimal", format: "tanbun", jp: "短い文。",
      questions: [{ stem: "何 ですか。", opts: ["a", "b"], answer: 0, difficulty: 1 }],
    }],
  };
  const r = applyPassages(minimal, docsVides());
  const p = r.passages[r.passages.length - 1];
  const q = r.questions[r.questions.length - 1];
  expect(p["schema:description"]).toBeUndefined();
  expect(p.tests).toBeUndefined();
  expect(q["schema:description"]).toBeUndefined();
  expect(q["jlpt:gloss"]).toBeUndefined();
  expect(q["jlpt:optionNote"]).toBeUndefined();
  expect(q.tests).toBeUndefined();
});

test("applyPassages ne mute pas les documents de l'appelant", () => {
  const docs = docsVides();
  const avant = JSON.stringify(docs);
  applyPassages(decisions, docs);
  expect(JSON.stringify(docs)).toBe(avant);
});

test("applyPassages étend l'intervalle existant plutôt que d'en créer un troisième", () => {
  const premier = applyPassages(decisions, docsVides());
  const autre = {
    passages: [{ ...decisions.passages[0], id: "jlpt:passage/tanbun-02" }],
  };
  const second = applyPassages(autre, {
    passages: premier.passages, lecture: premier.questions, corpus: premier.corpus,
    nextOrd: 10225,
  });
  const intervalles = second.corpus.filter((c) => c["jlpt:skill"] === "lecture");
  expect(intervalles.length).toBe(2);
  expect(intervalles.find((c) => c["@id"] === "jlpt:corpus/lecture-2")["jlpt:count"]).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/graph/passages.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write the implementation**

`tools/graph/passages.mjs` :

```js
#!/usr/bin/env node
// Pose les passages arbitrés (data/passages-arbitres.json) dans le graphe : passage.jsonld,
// q-lecture.jsonld et corpus.jsonld.
//
// ⚠ Idempotent, et n'écrase JAMAIS un @id existant — même invariant que readings.mjs,
// link-answers.mjs et traps.mjs. Ce n'est pas un générateur : il ajoute ce qui manque.
// Corriger un texte à la main dans le graphe est donc définitif.
//
// ⚠ Les ordinaux sont posés en FIN DE CORPUS (jlpt:ord global, dense, jamais renuméroté : il
// indexe les bitsets persistés). La lecture n'étant pas la dernière compétence, cela lui ouvre
// un SECOND intervalle dans corpus.jsonld — ce que checkCorpus et coverageBySkill savent lire.
//
// Zéro dépendance, exécuté par `bun`.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "data/graph";
const DECISIONS = "data/passages-arbitres.json";

const lire = (f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
const ecrire = (f, doc, sujets) =>
  writeFileSync(`${DIR}/${f}`, JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n");

/** Premier ordinal libre = max(ord) + 1 sur TOUS les shards de questions. */
export function nextOrd(shards) {
  let max = -1;
  for (const sujets of shards) {
    for (const s of sujets) {
      const o = s["jlpt:ord"];
      if (Number.isInteger(o) && o > max) max = o;
    }
  }
  return max + 1;
}

/** Pose ce qui manque. Pure : les documents sont injectés, rien n'est lu ni écrit ici. */
export function applyPassages(decisions, docs) {
  const passages = [...docs.passages];
  const questions = [...docs.lecture];
  const corpus = [...docs.corpus];
  const connus = new Set(passages.map((p) => p["@id"]));
  let ord = docs.nextOrd;
  let poses = 0, deja = 0, premierOrd = null;

  for (const p of decisions.passages ?? []) {
    if (connus.has(p.id)) { deja++; continue; }
    const sujet = {
      "@id": p.id,
      "@type": "jlpt:Passage",
      "schema:name": p.name,
      "jlpt:format": p.format,
      "jlpt:jp": p.jp,
    };
    if (p.fr) sujet["schema:description"] = p.fr;
    if (p.tests?.length) sujet.tests = p.tests;
    passages.push(sujet);
    connus.add(p.id);

    for (const q of p.questions ?? []) {
      if (premierOrd === null) premierOrd = ord;
      const sq = {
        "@id": `jlpt:q/${ord}`,
        "@type": "jlpt:Question",
        "jlpt:skill": "lecture",
        "jlpt:difficulty": q.difficulty,
        "jlpt:ord": ord,
        "jlpt:stem": q.stem,
        opts: q.opts,
        "jlpt:answer": q.answer,
        readsPassage: p.id,
      };
      if (q.description) sq["schema:description"] = q.description;
      if (q.gloss) sq["jlpt:gloss"] = q.gloss;
      if (q.optionNote?.length) sq["jlpt:optionNote"] = q.optionNote;
      if (q.tests?.length) sq.tests = q.tests;
      questions.push(sq);
      ord++;
    }
    poses++;
  }

  if (premierOrd !== null) {
    const ajoutees = ord - premierOrd;
    // ⚠ REMPLACER l'objet, jamais le muter : `[...docs.corpus]` ne copie que le tableau, pas
    // les objets qu'il contient. Un `existant["jlpt:count"] += …` modifierait le document de
    // l'appelant sous ses pieds — et la fonction cesserait d'être pure, contrairement à ce que
    // son propre commentaire affirme.
    const i = corpus.findIndex((c) => c["@id"] === "jlpt:corpus/lecture-2");
    if (i >= 0) corpus[i] = { ...corpus[i], "jlpt:count": corpus[i]["jlpt:count"] + ajoutees };
    else corpus.push({
      "@id": "jlpt:corpus/lecture-2",
      "@type": "jlpt:SkillRange",
      "jlpt:skill": "lecture",
      "jlpt:from": premierOrd,
      "jlpt:count": ajoutees,
    });
  }
  return { passages, questions, corpus, poses, deja };
}

function main() {
  const decisions = JSON.parse(readFileSync(DECISIONS, "utf8"));
  const docP = lire("passage.jsonld");
  const docQ = lire("q-lecture.jsonld");
  const docC = lire("corpus.jsonld");
  const shards = readdirSync(DIR)
    .filter((f) => /^q-.*\.jsonld$/.test(f))
    .map((f) => lire(f)["@graph"] ?? []);

  const r = applyPassages(decisions, {
    passages: docP["@graph"] ?? [],
    lecture: docQ["@graph"] ?? [],
    corpus: docC["@graph"] ?? [],
    nextOrd: nextOrd(shards),
  });

  if (!r.poses) {
    console.log(`✓ rien à poser (${r.deja} passages déjà présents) — le graphe fait autorité`);
    return 0;
  }
  ecrire("passage.jsonld", docP, r.passages);
  ecrire("q-lecture.jsonld", docQ, r.questions);
  ecrire("corpus.jsonld", docC, r.corpus);
  console.log(`✓ ${r.poses} passages posés (${r.deja} déjà présents), ${r.questions.length - (docQ["@graph"] ?? []).length} questions ajoutées`);
  console.log("  → penser à rejouer : bun tools/graph/traps.mjs, puis bun tools/validate-graph.mjs");
  return 0;
}

if (import.meta.main) process.exit(main());
```

- [ ] **Step 4: Run the tests**

Run: `bun test tools/graph/passages.test.ts && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/graph/passages.mjs tools/graph/passages.test.ts
git commit -m "feat(lecture): applicateur idempotent des passages (chaine n6, etape 2)"
```

---

### Task 10: Lot 1a — trois passages, et la seule relecture humaine du lot

**Files:**
- Modify: `data/passages-arbitres.json` (3 passages : le `tanbun-01` d'amorçage + un `chubun-01` + un `joho-01`)
- Modify: `data/graph/passage.jsonld`, `data/graph/q-lecture.jsonld`, `data/graph/corpus.jsonld` (par l'outil, jamais à la main)
- Modify: `src/lib/cadence.ts:11`

**Interfaces:**
- Consumes: les deux outils (Tasks 8-9).
- Produces: 3 passages, 6 questions (1 + 3 + 2), corpus à 10 313 questions, lecture à 58.

- [ ] **Step 1: Écrire les deux passages manquants**

Dans `data/passages-arbitres.json`, ajouter un `chubun-01` (3 questions, 300–420 caractères) et un `joho-01` (2 questions, 150–300 caractères), sur le gabarit exact du `tanbun-01` déjà présent. Règles de rédaction :

- **Textes originaux** — aucun extrait d'annales (droit d'auteur).
- Kanji : uniquement ceux du référentiel (810 dans `kanji.jsonld`) ; l'audit le vérifie.
- `joho` = document de « recherche d'information » : horaires, tarifs, conditions d'inscription — le lecteur doit **retrouver** une donnée, pas interpréter.
- `chubun` = texte suivi (courriel, billet, notice) où les 3 questions portent sur des points **distincts** : un détail explicite, une inférence, l'intention de l'auteur.
- Chaque option porte sa `optionNote` : elle dit **pourquoi** l'option est fausse (ou juste). C'est cette note qui alimente le moteur de confusion.
- Une seule réponse défendable — c'est le point que l'outil ne sait pas prouver.

- [ ] **Step 2: Passer l'audit**

Run: `bun tools/graph/audit-passages.mjs`
Expected: `✓ 3 passages, 6 questions — conformes`. Sinon, corriger le texte (jamais l'outil) et relancer.

- [ ] **Step 3: Poser dans le graphe**

Run: `bun tools/graph/passages.mjs`
Expected: `✓ 3 passages posés (0 déjà présents), 6 questions ajoutées`.

- [ ] **Step 4: Vérifier l'idempotence, immédiatement**

Run: `bun tools/graph/passages.mjs`
Expected: `✓ rien à poser (3 passages déjà présents)` — et `git diff --stat` ne montre **aucune** modification supplémentaire.

- [ ] **Step 5: Remonter le cliquet de mesure**

Dans `src/lib/cadence.ts`, `TOTAL_QUESTIONS = 10307` → `10313`.

> Ce test est **conçu** pour échouer quand le corpus grandit (« forçant à remonter la constante ») : son rouge est le cliquet qui fonctionne, pas une régression.

- [ ] **Step 6: Valider l'ensemble**

Run: `bun tools/validate-graph.mjs && bun test && bun run typecheck`
Expected: graphe valide (dont `checkCorpus` sur **deux** intervalles de lecture) et suite verte.

- [ ] **Step 7: Commit**

```bash
git add data/passages-arbitres.json data/graph/passage.jsonld data/graph/q-lecture.jsonld data/graph/corpus.jsonld src/lib/cadence.ts
git commit -m "feat(lecture): lot 1a — 3 passages, 6 questions (tanbun, chubun, joho)"
```

- [ ] **Step 8: PORTE DE RELECTURE — s'arrêter ici**

Soumettre les trois passages à l'auteur (texte japonais + questions + notes d'options) et **attendre son retour** avant la Task 11. C'est la seule relecture humaine demandée : elle calibre les 17 passages suivants. Corriger dans `data/passages-arbitres.json` puis, si un passage déjà posé doit changer, **éditer le graphe** (il fait autorité — l'applicateur n'écrasera pas).

---

### Task 11: Lot 1b — les 17 passages restants

**Files:**
- Modify: `data/passages-arbitres.json`
- Modify: `data/graph/passage.jsonld`, `data/graph/q-lecture.jsonld`, `data/graph/corpus.jsonld` (par l'outil)
- Modify: `src/lib/cadence.ts:11`
- **Ne PAS rejouer `traps.mjs`** : son périmètre est `["q-kanji", "q-vocabulaire"]` et son en-tête motive l'exclusion — « l'écoute comme la lecture testent la compréhension, pas la forme ». Les `optionNote` des passages servent au corrigé, pas au typage des pièges.

**Interfaces:**
- Consumes: le retour de relecture (Task 10).
- Produces: 20 passages, 44 questions au total ; corpus à 10 351 ; lecture à 96.

- [ ] **Step 1: Écrire les 17 passages**

Composition, pour atteindre le mix visé (8 `tanbun`, 6 `chubun`, 3 `chobun`, 3 `joho`) : ajouter **7 `tanbun`** (7 questions), **5 `chubun`** (15), **3 `chobun`** (12), **2 `joho`** (4) = 38 questions. Mêmes règles de rédaction qu'en Task 10, **plus** les corrections issues de la relecture.

- [ ] **Step 2: Audit**

Run: `bun tools/graph/audit-passages.mjs`
Expected: `✓ 20 passages, 44 questions — conformes`.

- [ ] **Step 3: Poser et vérifier l'idempotence**

Run: `bun tools/graph/passages.mjs && bun tools/graph/passages.mjs`
Expected: la première passe pose 17 passages / 38 questions ; la seconde n'écrit rien.

- [ ] **Step 4: Remonter le cliquet**

`src/lib/cadence.ts` : `TOTAL_QUESTIONS = 10313` → `10351`.

- [ ] **Step 5: Mesurer le surcoût gzip**

```bash
gzip -c data/graph/q-lecture.jsonld | wc -c
gzip -c data/graph/passage.jsonld | wc -c
git show HEAD~1:data/graph/q-lecture.jsonld | gzip -c | wc -c
```

Attendu : le surcoût sur le fil reste très en deçà des 5 % du **total livré** (les deux documents pèsent quelques dizaines de Ko gzippés face à ~1,3 Mo). **Règle absolue du dépôt** : au-delà de 5 %, on s'arrête et on signale à l'auteur au lieu d'improviser un encodage plus court.

- [ ] **Step 6: Validation complète**

Run: `bun tools/validate-graph.mjs && bun test && bun run typecheck`
Expected: tout vert. Vérifier dans la sortie du validateur que la lecture déclare bien deux intervalles cohérents.

- [ ] **Step 7: Vérification navigateur**

```bash
bun run build && bunx serve _site
```

Ouvrir `#/entrainement`, lancer une session, et vérifier de visu : un texte s'affiche au-dessus de l'énoncé, ses questions **se suivent**, le texte n'est pas ré-affiché entre elles de façon incohérente, et les furigana du passage se révèlent au tap. ⚠ Le chargement à froid des shards prend ~8 s : attendre avant de conclure.

- [ ] **Step 8: Commit**

```bash
git add data/passages-arbitres.json data/graph/passage.jsonld data/graph/q-lecture.jsonld data/graph/corpus.jsonld src/lib/cadence.ts
git commit -m "feat(lecture): lot 1b — 17 passages, 38 questions (les quatre formats)"
```

---

## Ce qui reste hors de ce plan

Consigné dans la spec §9, à ne **pas** faire ici : la chaîne écoute (32 questions pour 60 points), l'examen blanc chronométré, la question du groupement `grammaire + lecture` dans `sectionMastery`, et l'amortissement de `K` sur les réponses corrélées d'un même texte.
