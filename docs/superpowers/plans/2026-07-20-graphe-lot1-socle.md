# Graphe JSON-LD — Lot 1 : le socle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire `data/graph/` — le contenu JLPT en sujets JSON-LD validés par des shapes SHACL — sans toucher au runtime de l'app.

**Architecture :** Un validateur de sous-ensemble SHACL en Node pur (`tools/graph/`), branché en CI **à côté** de `tools/validate.mjs`, plus un script de migration exécuté une fois qui convertit `bank.json`, `dict.json`, les `cours-*.json` et les banques d'auteur en sujets. À la fin du lot, `data/graph/` existe, est validé à chaque push, et l'app continue de lire exactement ce qu'elle lisait avant : **rien ne peut casser en production**.

**Tech stack :** Node 20 ESM (pas de Bun dans `tools/`), zéro dépendance, tests `*.test.ts` exécutés par `bun test`.

## Global Constraints

- **`tools/*.mjs` = Node-compatible OBLIGATOIRE.** `.github/workflows/validate.yml` exécute `node`, pas `bun`. Aucune API `Bun.*` dans `tools/` — la CI casserait, et c'est invisible en local.
- **Zéro dépendance.** Pas de bibliothèque JSON-LD ni SHACL. Le projet n'a pas de linter et n'en veut pas ; `bun run typecheck` + `bun test` font foi.
- **Le sous-ensemble SHACL est exactement celui d'Oku**, vérifié dans `oku/crates/core/domain-bridge/src/shape.rs` : seules `sh:path`, `sh:datatype`, `sh:minCount`, `sh:maxCount`, `sh:in`, `sh:nodeKind` sont acceptées. Toute autre contrainte doit faire échouer le parseur. Ne rien ajouter sans contrepartie côté Oku.
- **`sh:in` n'accepte que des littéraux chaîne.** Oku fait `filter_map(|v| v.as_str())` et ignore silencieusement le reste. Notre parseur doit **rejeter** un `sh:in` contenant un non-string.
- **IRIs :** interdits `'`, `;`, `--`, `\`, `/*`, contrôles ASCII (U+0000–U+001F, U+007F), contrôles de formatage Unicode (U+200B–U+200F, U+202A–U+202E, U+2066–U+2069, U+FEFF), chaîne vide. L'Unicode japonais est autorisé.
- **Ne rien supprimer dans ce lot.** `bank.json`, `dict.json`, `split-bank.mjs`, `validate.mjs` restent en place et fonctionnels. Le ménage est le lot 4.
- **Français pour l'UI et les messages ; commentaires en français**, comme le reste du dépôt.

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `data/graph/context.jsonld` | préfixes + alias de termes, partagé par tous les documents |
| `data/graph/shapes.jsonld` | les `sh:NodeShape` — décrivent ET valident |
| `tools/graph/jsonld.mjs` | sous-ensemble JSON-LD : lecture d'un document, résolution des préfixes et alias |
| `tools/graph/shacl.mjs` | parseur de shapes + validateur de sujet |
| `tools/graph/integrity.mjs` | contrôles impératifs — ce que SHACL ne peut pas exprimer |
| `tools/validate-graph.mjs` | point d'entrée CI : charge, valide, rapporte, `exit 1` |
| `tools/migrate-to-graph.mjs` | script one-shot, supprimé au lot 4 |

Tests côte à côte : `tools/graph/jsonld.test.ts`, `shacl.test.ts`, `integrity.test.ts`.

---

### Task 1: Sous-ensemble JSON-LD — lecture et résolution

**Files:**
- Create: `data/graph/context.jsonld`
- Create: `tools/graph/jsonld.mjs`
- Test: `tools/graph/jsonld.test.ts`

**Interfaces:**
- Consomme : rien.
- Produit : `readContext(path) -> {prefixes: Record<string,string>, terms: Record<string,{id:string,type?:string,container?:string}>}` ; `expandIri(value, prefixes) -> string` ; `readDoc(path) -> {context, subjects: object[]}` ; `isSafeIri(iri) -> boolean`.

- [ ] **Step 1: Écrire le `@context`**

Créer `data/graph/context.jsonld` :

```json
{
  "@context": {
    "sh": "http://www.w3.org/ns/shacl#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "schema": "https://schema.org/",
    "jlpt": "https://okutheory.com/jlpt/vocab#",
    "tests": { "@id": "jlpt:tests", "@type": "@id", "@container": "@set" },
    "usesKanji": { "@id": "jlpt:usesKanji", "@type": "@id", "@container": "@set" },
    "covers": { "@id": "jlpt:covers", "@type": "@id", "@container": "@list" },
    "opts": { "@id": "jlpt:option", "@container": "@list" }
  }
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

Créer `tools/graph/jsonld.test.ts` :

```ts
import { test, expect } from "bun:test";
import { expandIri, isSafeIri, readContext } from "./jsonld.mjs";

const prefixes = { jlpt: "https://okutheory.com/jlpt/vocab#", sh: "http://www.w3.org/ns/shacl#" };

test("expandIri déplie un terme préfixé", () => {
  expect(expandIri("jlpt:Question", prefixes)).toBe("https://okutheory.com/jlpt/vocab#Question");
});

test("expandIri laisse une IRI absolue intacte", () => {
  expect(expandIri("https://schema.org/name", prefixes)).toBe("https://schema.org/name");
});

test("expandIri laisse un préfixe inconnu intact plutôt que de fabriquer une IRI fausse", () => {
  expect(expandIri("inconnu:X", prefixes)).toBe("inconnu:X");
});

test("isSafeIri accepte le japonais et les IRIs usuelles", () => {
  expect(isSafeIri("https://okutheory.com/jlpt/vocab#word/影響")).toBe(true);
  expect(isSafeIri("urn:oku:note:1")).toBe(true);
});

test("isSafeIri rejette les caractères dangereux pour SQL et la chaîne vide", () => {
  for (const bad of ["", "urn:foo'bar", "urn:foo;bar", "urn:foo--bar", "urn:foo\\bar", "urn:foo/*bar"]) {
    expect(isSafeIri(bad)).toBe(false);
  }
});

test("isSafeIri rejette les contrôles ASCII et les contrôles de formatage Unicode", () => {
  expect(isSafeIri("urn:oku:\u0007")).toBe(false);   // contrôle ASCII
  expect(isSafeIri("urn:oku:\u200B")).toBe(false);   // espace de largeur nulle
  expect(isSafeIri("urn:oku:\uFEFF")).toBe(false);   // BOM
});

test("readContext expose préfixes et alias de termes séparément", () => {
  const ctx = readContext("data/graph/context.jsonld");
  expect(ctx.prefixes.jlpt).toBe("https://okutheory.com/jlpt/vocab#");
  expect(ctx.terms.tests.id).toBe("jlpt:tests");
  expect(ctx.terms.covers.container).toBe("@list");
});
```

- [ ] **Step 3: Lancer les tests, vérifier qu'ils échouent**

Run: `bun test tools/graph/jsonld.test.ts`
Expected: FAIL — `Cannot find module './jsonld.mjs'`

- [ ] **Step 4: Implémenter `tools/graph/jsonld.mjs`**

```js
// Sous-ensemble JSON-LD suffisant pour nos documents : résolution des préfixes et des alias
// de termes. PAS une implémentation JSON-LD complète — ni @base, ni @reverse, ni langue.
// Node pur : la CI exécute `node`, jamais `bun`.
import { readFileSync } from "node:fs";

/** Caractères qu'Oku refuse dans une IRI (is_safe_iri_for_sql). */
const UNSAFE_SUBSTR = ["'", ";", "--", "\\", "/*"];
// Contrôles ASCII + contrôles de formatage Unicode, en séquences d échappement :
// les écrire en littéral rendrait le fichier binaire pour grep et les outils.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;

/** Une IRI acceptable par le store Oku (adossé à SQL). L'Unicode japonais passe. */
export function isSafeIri(iri) {
  if (typeof iri !== "string" || iri.length === 0) return false;
  if (UNSAFE_CHARS.test(iri)) return false;
  return !UNSAFE_SUBSTR.some((s) => iri.includes(s));
}

/** `jlpt:Question` → IRI complète. Un préfixe inconnu ou une IRI absolue ressort inchangé :
 *  fabriquer une IRI à partir d'un préfixe non déclaré masquerait une faute de frappe. */
export function expandIri(value, prefixes) {
  if (typeof value !== "string") return value;
  const i = value.indexOf(":");
  if (i <= 0) return value;
  const head = value.slice(0, i);
  const base = prefixes[head];
  return base === undefined ? value : base + value.slice(i + 1);
}

/** Sépare le @context en préfixes (valeurs chaîne) et alias de termes (valeurs objet). */
export function parseContext(ctx) {
  const prefixes = {};
  const terms = {};
  for (const [k, v] of Object.entries(ctx ?? {})) {
    if (typeof v === "string") prefixes[k] = v;
    else if (v && typeof v === "object") {
      terms[k] = { id: v["@id"], type: v["@type"], container: v["@container"] };
    }
  }
  return { prefixes, terms };
}

export function readContext(path) {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  return parseContext(doc["@context"]);
}

/** Lit un document `{ "@context": …, "@graph": [ … ] }`. Le @context peut être une chaîne
 *  (chemin relatif vers context.jsonld) ou un objet inline. */
export function readDoc(path, contextPath = "data/graph/context.jsonld") {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const ctx = typeof doc["@context"] === "string" || doc["@context"] === undefined
    ? readContext(contextPath)
    : parseContext(doc["@context"]);
  const subjects = Array.isArray(doc["@graph"]) ? doc["@graph"] : [];
  return { context: ctx, subjects };
}
```

- [ ] **Step 5: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/jsonld.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 6: Commit**

```bash
git add data/graph/context.jsonld tools/graph/jsonld.mjs tools/graph/jsonld.test.ts
git commit -m "feat(graph): @context et sous-ensemble JSON-LD (préfixes, alias, IRIs sûres)"
```

---

### Task 2: Parseur de shapes SHACL

**Files:**
- Create: `tools/graph/shacl.mjs`
- Test: `tools/graph/shacl.test.ts`

**Interfaces:**
- Consomme : `expandIri` de `tools/graph/jsonld.mjs`.
- Produit : `parseShapes(subjects, prefixes) -> NodeShape[]` où `NodeShape = {shapeIri, targetClass, properties: PropertyShape[]}` et `PropertyShape = {path, datatype?, minCount?, maxCount?, allowedValues?, nodeKind?}`. Lève une `Error` sur shape invalide.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tools/graph/shacl.test.ts` :

```ts
import { test, expect } from "bun:test";
import { parseShapes } from "./shacl.mjs";

const prefixes = {
  sh: "http://www.w3.org/ns/shacl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  jlpt: "https://okutheory.com/jlpt/vocab#",
};

const shape = (props) => ([{
  "@id": "jlpt:QuestionShape", "@type": "sh:NodeShape",
  "sh:targetClass": "jlpt:Question",
  "sh:property": props,
}]);

test("parseShapes déplie l'IRI de shape et la classe cible", () => {
  const [s] = parseShapes(shape([{ "sh:path": "jlpt:stem", "sh:datatype": "xsd:string" }]), prefixes);
  expect(s.shapeIri).toBe("https://okutheory.com/jlpt/vocab#QuestionShape");
  expect(s.targetClass).toBe("https://okutheory.com/jlpt/vocab#Question");
});

test("parseShapes lit cardinalité, datatype et nodeKind", () => {
  const [s] = parseShapes(shape([
    { "sh:path": "jlpt:stem", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:tests", "sh:nodeKind": "sh:IRI" },
  ]), prefixes);
  expect(s.properties[0].datatype).toBe("http://www.w3.org/2001/XMLSchema#string");
  expect(s.properties[0].minCount).toBe(1);
  expect(s.properties[0].maxCount).toBe(1);
  expect(s.properties[1].nodeKind).toBe("IRI");
});

test("parseShapes lit un sh:in de chaînes", () => {
  const [s] = parseShapes(shape([{ "sh:path": "jlpt:skill", "sh:in": ["kanji", "lecture"] }]), prefixes);
  expect(s.properties[0].allowedValues).toEqual(["kanji", "lecture"]);
});

test("parseShapes REJETTE un sh:in contenant un non-string (Oku l'ignorerait en silence)", () => {
  expect(() => parseShapes(shape([{ "sh:path": "jlpt:difficulty", "sh:in": [1, 2, 3] }]), prefixes))
    .toThrow(/sh:in/);
});

test("parseShapes rejette une contrainte hors du sous-ensemble d'Oku", () => {
  expect(() => parseShapes(shape([{ "sh:path": "jlpt:stem", "sh:pattern": "^a+$" }]), prefixes))
    .toThrow(/sh:pattern/);
});

test("parseShapes rejette une shape sans sh:targetClass", () => {
  const bad = [{ "@id": "jlpt:S", "@type": "sh:NodeShape", "sh:property": [] }];
  expect(() => parseShapes(bad, prefixes)).toThrow(/targetClass/);
});

test("parseShapes rejette une propriété sans sh:path", () => {
  expect(() => parseShapes(shape([{ "sh:datatype": "xsd:string" }]), prefixes)).toThrow(/sh:path/);
});

test("parseShapes ignore les sujets qui ne sont pas des NodeShape", () => {
  expect(parseShapes([{ "@id": "jlpt:x", "@type": "jlpt:Word" }], prefixes)).toEqual([]);
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `bun test tools/graph/shacl.test.ts`
Expected: FAIL — `Cannot find module './shacl.mjs'`

- [ ] **Step 3: Implémenter le parseur dans `tools/graph/shacl.mjs`**

```js
// Parseur + validateur du sous-ensemble SHACL d'Oku.
// Référence : oku/crates/core/domain-bridge/src/{shape,validate}.rs
// Contraintes supportées, et AUCUNE autre : sh:path, sh:datatype, sh:minCount,
// sh:maxCount, sh:in, sh:nodeKind.
import { expandIri } from "./jsonld.mjs";

const SUPPORTED = new Set([
  "sh:path", "sh:datatype", "sh:minCount", "sh:maxCount", "sh:in", "sh:nodeKind",
  "@id", "@type",
]);

function count(v, where) {
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < 0 || v > 0xFFFFFFFF) {
    throw new Error(`${where} : cardinalité invalide ${JSON.stringify(v)}`);
  }
  return v;
}

function parseProperty(p, prefixes, where) {
  for (const k of Object.keys(p)) {
    if (!SUPPORTED.has(k)) throw new Error(`${where} : contrainte non supportée ${k}`);
  }
  const path = p["sh:path"];
  if (typeof path !== "string" || !path) throw new Error(`${where} : sh:path manquant`);

  let allowedValues;
  if (p["sh:in"] !== undefined) {
    const arr = p["sh:in"];
    if (!Array.isArray(arr) || arr.length === 0) throw new Error(`${where} : sh:in doit être un tableau non vide`);
    // Oku fait filter_map(as_str) : un non-string y disparaît SANS ERREUR. On refuse
    // plutôt que de livrer une shape qui ne veut pas dire la même chose là-bas.
    const bad = arr.find((v) => typeof v !== "string");
    if (bad !== undefined) {
      throw new Error(`${where} : sh:in n'accepte que des chaînes (reçu ${JSON.stringify(bad)})`);
    }
    allowedValues = [...arr];
  }

  let nodeKind;
  if (p["sh:nodeKind"] !== undefined) {
    const nk = String(p["sh:nodeKind"]).replace(/^sh:/, "");
    if (nk !== "IRI" && nk !== "Literal") throw new Error(`${where} : sh:nodeKind invalide ${nk}`);
    nodeKind = nk;
  }

  return {
    path: expandIri(path, prefixes),
    datatype: p["sh:datatype"] === undefined ? undefined : expandIri(p["sh:datatype"], prefixes),
    minCount: count(p["sh:minCount"], where),
    maxCount: count(p["sh:maxCount"], where),
    allowedValues,
    nodeKind,
  };
}

/** Extrait les NodeShape d'une liste de sujets. Lève sur shape invalide — une shape fausse
 *  est un bug de modèle, pas une donnée à signaler. */
export function parseShapes(subjects, prefixes) {
  const shapes = [];
  for (const s of subjects) {
    const type = s["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (!types.includes("sh:NodeShape")) continue;

    const shapeIri = expandIri(s["@id"] ?? "", prefixes);
    const target = s["sh:targetClass"];
    if (typeof target !== "string" || !target) {
      throw new Error(`${s["@id"]} : sh:targetClass manquant`);
    }
    const props = Array.isArray(s["sh:property"]) ? s["sh:property"] : [];
    shapes.push({
      shapeIri,
      targetClass: expandIri(target, prefixes),
      properties: props.map((p, i) => parseProperty(p, prefixes, `${s["@id"]}/prop[${i}]`)),
    });
  }
  return shapes;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/shacl.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add tools/graph/shacl.mjs tools/graph/shacl.test.ts
git commit -m "feat(graph): parseur de shapes SHACL, sous-ensemble strict d'Oku"
```

---

### Task 3: Validateur de sujets

**Files:**
- Modify: `tools/graph/shacl.mjs` (ajout en fin de fichier)
- Modify: `tools/graph/shacl.test.ts` (ajout en fin de fichier)

**Interfaces:**
- Consomme : `NodeShape` de la Task 2.
- Produit : `validateSubject(subject, shape, prefixes) -> string[]` (messages, vide si conforme) ; `validateAll(subjects, shapes, prefixes) -> string[]`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `tools/graph/shacl.test.ts` :

```ts
import { validateSubject, validateAll } from "./shacl.mjs";
// `parseShapes` et `prefixes` viennent déjà du haut du fichier (Task 2).

const qShape = parseShapes([{
  "@id": "jlpt:QuestionShape", "@type": "sh:NodeShape",
  "sh:targetClass": "jlpt:Question",
  "sh:property": [
    { "sh:path": "jlpt:stem", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:ord", "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:skill", "sh:in": ["kanji", "lecture"], "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:tests", "sh:nodeKind": "sh:IRI" },
  ],
}], prefixes)[0];

const ok = { "@id": "jlpt:q/1", "@type": "jlpt:Question", "jlpt:stem": "x", "jlpt:ord": 0, "jlpt:skill": "kanji" };

test("validateSubject accepte un sujet conforme", () => {
  expect(validateSubject(ok, qShape, prefixes)).toEqual([]);
});

test("validateSubject signale une propriété obligatoire absente", () => {
  const { ["jlpt:stem"]: _, ...sans } = ok;
  expect(validateSubject(sans, qShape, prefixes).join(" ")).toMatch(/stem.*minCount/);
});

test("validateSubject signale un datatype faux", () => {
  expect(validateSubject({ ...ok, "jlpt:ord": "zéro" }, qShape, prefixes).join(" ")).toMatch(/ord/);
});

test("validateSubject refuse un entier négatif pour xsd:nonNegativeInteger", () => {
  expect(validateSubject({ ...ok, "jlpt:ord": -1 }, qShape, prefixes).join(" ")).toMatch(/ord/);
});

test("validateSubject signale une valeur hors sh:in", () => {
  expect(validateSubject({ ...ok, "jlpt:skill": "ecoute" }, qShape, prefixes).join(" ")).toMatch(/skill/);
});

test("validateSubject signale un dépassement de maxCount", () => {
  expect(validateSubject({ ...ok, "jlpt:stem": ["a", "b"] }, qShape, prefixes).join(" ")).toMatch(/maxCount/);
});

test("validateSubject exige une IRI sûre pour sh:nodeKind IRI", () => {
  expect(validateSubject({ ...ok, "jlpt:tests": ["jlpt:gram/a'b"] }, qShape, prefixes).join(" ")).toMatch(/IRI/);
});

test("validateAll n'applique une shape qu'aux sujets de sa classe cible", () => {
  const autre = { "@id": "jlpt:w/1", "@type": "jlpt:Word" };
  expect(validateAll([ok, autre], [qShape], prefixes)).toEqual([]);
});

test("validateAll signale un sujet dont le @type n'a aucune shape", () => {
  const orphelin = { "@id": "jlpt:z/1", "@type": "jlpt:Inconnu" };
  expect(validateAll([orphelin], [qShape], prefixes).join(" ")).toMatch(/aucune shape/);
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `bun test tools/graph/shacl.test.ts`
Expected: FAIL — `validateSubject is not a function`

- [ ] **Step 3: Implémenter le validateur (ajouter en fin de `tools/graph/shacl.mjs`)**

```js
import { isSafeIri } from "./jsonld.mjs";

const XSD = "http://www.w3.org/2001/XMLSchema#";

/** Un littéral respecte-t-il le datatype xsd déclaré ? Sous-ensemble : string, integer,
 *  nonNegativeInteger, boolean. Tout autre datatype est refusé explicitement. */
function datatypeOk(value, datatype) {
  switch (datatype) {
    case `${XSD}string`: return typeof value === "string";
    case `${XSD}integer`: return Number.isInteger(value);
    case `${XSD}nonNegativeInteger`: return Number.isInteger(value) && value >= 0;
    case `${XSD}boolean`: return typeof value === "boolean";
    default: return null; // datatype inconnu → signalé comme erreur de shape
  }
}

const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Retrouve la valeur d'un prédicat, que le document l'écrive en forme préfixée
 *  (`jlpt:stem`) ou dépliée. */
function valuesOf(subject, path, prefixes) {
  for (const [k, v] of Object.entries(subject)) {
    if (k === "@id" || k === "@type") continue;
    if (expandIri(k, prefixes) === path) return asArray(v);
  }
  return [];
}

/** Valide un sujet contre une shape. Retourne des messages, ne lève pas : une donnée
 *  invalide est un rapport, pas un plantage. */
export function validateSubject(subject, shape, prefixes) {
  const errs = [];
  const id = subject["@id"] ?? "(sans @id)";
  for (const p of shape.properties) {
    const vals = valuesOf(subject, p.path, prefixes);
    const short = p.path.split(/[#/]/).pop();

    if (p.minCount !== undefined && vals.length < p.minCount) {
      errs.push(`${id} : ${short} — minCount ${p.minCount}, trouvé ${vals.length}`);
    }
    if (p.maxCount !== undefined && vals.length > p.maxCount) {
      errs.push(`${id} : ${short} — maxCount ${p.maxCount}, trouvé ${vals.length}`);
    }
    for (const v of vals) {
      if (p.datatype !== undefined) {
        const res = datatypeOk(v, p.datatype);
        if (res === null) errs.push(`${id} : ${short} — datatype non supporté ${p.datatype}`);
        else if (!res) errs.push(`${id} : ${short} — attendu ${p.datatype}, reçu ${JSON.stringify(v)}`);
      }
      if (p.allowedValues !== undefined && !p.allowedValues.includes(v)) {
        errs.push(`${id} : ${short} — « ${v} » hors de [${p.allowedValues.join(", ")}]`);
      }
      if (p.nodeKind === "IRI") {
        const iri = typeof v === "object" && v !== null ? v["@id"] : v;
        if (typeof iri !== "string" || !isSafeIri(iri)) {
          errs.push(`${id} : ${short} — IRI invalide ou non sûre ${JSON.stringify(v)}`);
        }
      }
    }
  }
  return errs;
}

/** Valide tous les sujets. Un sujet dont le @type n'a aucune shape est signalé : c'est
 *  presque toujours une faute de frappe, jamais une intention. */
export function validateAll(subjects, shapes, prefixes) {
  const byClass = new Map(shapes.map((s) => [s.targetClass, s]));
  const errs = [];
  for (const s of subjects) {
    const types = asArray(s["@type"]);
    if (types.includes("sh:NodeShape")) continue;
    let matched = false;
    for (const t of types) {
      const shape = byClass.get(expandIri(t, prefixes));
      if (!shape) continue;
      matched = true;
      errs.push(...validateSubject(s, shape, prefixes));
    }
    if (!matched) errs.push(`${s["@id"] ?? "(sans @id)"} : aucune shape pour @type ${JSON.stringify(types)}`);
  }
  return errs;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/shacl.test.ts`
Expected: PASS — 17 tests (8 de la Task 2 + 9)

- [ ] **Step 5: Commit**

```bash
git add tools/graph/shacl.mjs tools/graph/shacl.test.ts
git commit -m "feat(graph): validateur de sujets (cardinalité, datatype, sh:in, nodeKind)"
```

---

### Task 4: Les shapes du domaine JLPT

**Files:**
- Create: `data/graph/shapes.jsonld`
- Test: `tools/graph/shapes.test.ts`

**Interfaces:**
- Consomme : `parseShapes` (Task 2), `readContext`/`readDoc` (Task 1).
- Produit : cinq `sh:NodeShape` — `jlpt:Kanji`, `jlpt:Word`, `jlpt:GrammarPoint`, `jlpt:Question`, `jlpt:Lesson`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tools/graph/shapes.test.ts` :

```ts
import { test, expect } from "bun:test";
import { readContext, readDoc } from "./jsonld.mjs";
import { parseShapes } from "./shacl.mjs";

test("shapes.jsonld se parse et couvre les cinq types du domaine", () => {
  const { prefixes } = readContext("data/graph/context.jsonld");
  const { subjects } = readDoc("data/graph/shapes.jsonld");
  const shapes = parseShapes(subjects, prefixes);
  const classes = shapes.map((s) => s.targetClass.split("#").pop()).sort();
  expect(classes).toEqual(["GrammarPoint", "Kanji", "Lesson", "Question", "Word"]);
});

test("la shape Question impose stem, answer, ord, skill et difficulty", () => {
  const { prefixes } = readContext("data/graph/context.jsonld");
  const { subjects } = readDoc("data/graph/shapes.jsonld");
  const q = parseShapes(subjects, prefixes).find((s) => s.targetClass.endsWith("#Question"));
  const paths = q.properties.map((p) => p.path.split("#").pop());
  for (const p of ["stem", "answer", "ord", "skill", "difficulty"]) expect(paths).toContain(p);
  expect(q.properties.find((p) => p.path.endsWith("#ord")).minCount).toBe(1);
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `bun test tools/graph/shapes.test.ts`
Expected: FAIL — `ENOENT: data/graph/shapes.jsonld`

- [ ] **Step 3: Écrire `data/graph/shapes.jsonld`**

```json
{
  "@context": "context.jsonld",
  "@graph": [
    {
      "@id": "jlpt:KanjiShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:Kanji",
      "sh:property": [
        { "sh:path": "schema:name", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "schema:description", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:onReading", "sh:datatype": "xsd:string" },
        { "sh:path": "jlpt:kunReading", "sh:datatype": "xsd:string" },
        { "sh:path": "jlpt:level", "sh:in": ["N5", "N4", "N3", "N2", "N1"], "sh:maxCount": 1 }
      ]
    },
    {
      "@id": "jlpt:WordShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:Word",
      "sh:property": [
        { "sh:path": "schema:name", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:reading", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "schema:description", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:level", "sh:in": ["N5", "N4", "N3", "N2", "N1"], "sh:maxCount": 1 },
        { "sh:path": "jlpt:usesKanji", "sh:nodeKind": "sh:IRI" }
      ]
    },
    {
      "@id": "jlpt:GrammarPointShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:GrammarPoint",
      "sh:property": [
        { "sh:path": "jlpt:form", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:altForm", "sh:datatype": "xsd:string" },
        { "sh:path": "schema:description", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:structure", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:level", "sh:in": ["N5", "N4", "N3", "N2", "N1"], "sh:maxCount": 1 }
      ]
    },
    {
      "@id": "jlpt:QuestionShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:Question",
      "sh:property": [
        { "sh:path": "jlpt:stem", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:answer", "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:ord", "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:skill", "sh:in": ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"], "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:difficulty", "sh:datatype": "xsd:integer", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "schema:description", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:gloss", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:script", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:passage", "sh:datatype": "xsd:string", "sh:maxCount": 1 },
        { "sh:path": "jlpt:tests", "sh:nodeKind": "sh:IRI" }
      ]
    },
    {
      "@id": "jlpt:LessonShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:Lesson",
      "sh:property": [
        { "sh:path": "schema:name", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:order", "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:track", "sh:in": ["gram", "vocab", "kanji"], "sh:minCount": 1, "sh:maxCount": 1 },
        { "sh:path": "jlpt:covers", "sh:nodeKind": "sh:IRI" }
      ]
    }
  ]
}
```

**Note :** `jlpt:option` et `jlpt:optionNote` ne portent pas de contrainte SHACL — ce sont des `@list` dont la longueur et l'alignement se vérifient côté impératif (Task 5), et `sh:maxCount` sur une liste compterait la liste, pas ses éléments.

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `bun test tools/graph/shapes.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add data/graph/shapes.jsonld tools/graph/shapes.test.ts
git commit -m "feat(graph): shapes SHACL des cinq types du domaine JLPT"
```

---

### Task 5: Contrôles impératifs intra-sujet

**Files:**
- Create: `tools/graph/integrity.mjs`
- Test: `tools/graph/integrity.test.ts`

**Interfaces:**
- Consomme : rien (opère sur des sujets bruts).
- Produit : `checkQuestion(subject) -> string[]`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tools/graph/integrity.test.ts` :

```ts
import { test, expect } from "bun:test";
import { checkQuestion } from "./integrity.mjs";

const q = (over = {}) => ({
  "@id": "jlpt:q/1", "@type": "jlpt:Question",
  "jlpt:stem": "「七月」の読み方は？", "jlpt:skill": "kanji", "jlpt:difficulty": 2, "jlpt:ord": 0,
  "opts": ["しちがつ", "なながつ", "しちげつ", "ななつき"], "jlpt:answer": 0,
  "jlpt:optionNote": ["a", "b", "c", "d"],
  ...over,
});

test("checkQuestion accepte une question saine", () => {
  expect(checkQuestion(q())).toEqual([]);
});

test("checkQuestion signale une réponse hors bornes", () => {
  expect(checkQuestion(q({ "jlpt:answer": 4 })).join(" ")).toMatch(/answer/);
});

test("checkQuestion signale des options identiques (cas #1381)", () => {
  const dup = q({ opts: ["しちがつ", "なながつ", "しちげつ", "なながつ"] });
  expect(checkQuestion(dup).join(" ")).toMatch(/option.*identique/i);
});

test("checkQuestion signale un optionNote désaligné", () => {
  expect(checkQuestion(q({ "jlpt:optionNote": ["a", "b"] })).join(" ")).toMatch(/optionNote/);
});

test("checkQuestion accepte l'absence totale d'optionNote", () => {
  const { ["jlpt:optionNote"]: _, ...sans } = q();
  expect(checkQuestion(sans)).toEqual([]);
});

test("checkQuestion signale une difficulté hors 1–3 (sh:in numérique impossible)", () => {
  expect(checkQuestion(q({ "jlpt:difficulty": 5 })).join(" ")).toMatch(/difficulty/);
});

test("checkQuestion exige au moins deux options", () => {
  expect(checkQuestion(q({ opts: ["seule"], "jlpt:answer": 0, "jlpt:optionNote": ["a"] })).join(" "))
    .toMatch(/options/);
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `bun test tools/graph/integrity.test.ts`
Expected: FAIL — `Cannot find module './integrity.mjs'`

- [ ] **Step 3: Implémenter `tools/graph/integrity.mjs`**

```js
// Contrôles que SHACL ne peut pas exprimer : relations entre deux propriétés d'un même
// sujet, et invariants portant sur l'ensemble du corpus.
// Node pur — la CI exécute `node`.

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Contrôles internes à une question. */
export function checkQuestion(s) {
  const errs = [];
  const id = s["@id"] ?? "(sans @id)";
  const opts = arr(s.opts);
  const answer = s["jlpt:answer"];
  const notes = s["jlpt:optionNote"];
  const diff = s["jlpt:difficulty"];

  if (opts.length < 2) errs.push(`${id} : au moins 2 options attendues, trouvé ${opts.length}`);

  if (!Number.isInteger(answer) || answer < 0 || answer >= opts.length) {
    errs.push(`${id} : answer ${JSON.stringify(answer)} hors des ${opts.length} options`);
  }

  const seen = new Set(opts.map(norm));
  if (seen.size !== opts.length) {
    errs.push(`${id} : options identiques — [${opts.join(" | ")}]`);
  }

  if (notes !== undefined && arr(notes).length !== opts.length) {
    errs.push(`${id} : optionNote de longueur ${arr(notes).length} pour ${opts.length} options`);
  }

  if (![1, 2, 3].includes(diff)) {
    errs.push(`${id} : difficulty ${JSON.stringify(diff)} hors de 1–3`);
  }

  return errs;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/integrity.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add tools/graph/integrity.mjs tools/graph/integrity.test.ts
git commit -m "feat(graph): contrôles intra-question (bornes, doublons, alignement, difficulté)"
```

---

### Task 6: Contrôles impératifs globaux

**Files:**
- Modify: `tools/graph/integrity.mjs` (ajout en fin de fichier)
- Modify: `tools/graph/integrity.test.ts` (ajout en fin de fichier)

**Interfaces:**
- Consomme : les sujets de tous les documents.
- Produit : `checkCorpus(subjects) -> string[]` — ordinaux, IRIs pendantes, réponses contradictoires.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `tools/graph/integrity.test.ts` :

```ts
import { checkCorpus } from "./integrity.mjs";

const gram = { "@id": "jlpt:gram/tara", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜たら" };
const qq = (id, ord, over = {}) => ({
  "@id": id, "@type": "jlpt:Question", "jlpt:ord": ord,
  "jlpt:stem": "家に帰っ___。", "opts": ["たら", "なら"], "jlpt:answer": 0,
  "jlpt:skill": "grammaire", "jlpt:difficulty": 1, ...over,
});

test("checkCorpus accepte des ordinaux denses et uniques", () => {
  expect(checkCorpus([qq("jlpt:q/1", 0), qq("jlpt:q/2", 1)])).toEqual([]);
});

test("checkCorpus signale un ordinal en double", () => {
  expect(checkCorpus([qq("jlpt:q/1", 0), qq("jlpt:q/2", 0)]).join(" ")).toMatch(/ord.*double/i);
});

test("checkCorpus signale un trou dans les ordinaux", () => {
  expect(checkCorpus([qq("jlpt:q/1", 0), qq("jlpt:q/2", 2)]).join(" ")).toMatch(/ord.*dense/i);
});

test("checkCorpus signale une IRI pendante dans tests", () => {
  const q = qq("jlpt:q/1", 0, { tests: ["jlpt:gram/inexistant"] });
  expect(checkCorpus([q, gram]).join(" ")).toMatch(/pendante/i);
});

test("checkCorpus accepte une IRI qui existe", () => {
  expect(checkCorpus([qq("jlpt:q/1", 0, { tests: ["jlpt:gram/tara"] }), gram])).toEqual([]);
});

test("checkCorpus signale deux questions identiques à réponse contradictoire", () => {
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "「いる」を漢字で書くと？", opts: ["居る", "要る"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "「いる」を漢字で書くと？", opts: ["居る", "要る"], "jlpt:answer": 1 });
  expect(checkCorpus([a, b]).join(" ")).toMatch(/contradictoire/i);
});

test("checkCorpus tolère le même énoncé avec des options différentes", () => {
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["C", "D"], "jlpt:answer": 0 });
  expect(checkCorpus([a, b])).toEqual([]);
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `bun test tools/graph/integrity.test.ts`
Expected: FAIL — `checkCorpus is not a function`

- [ ] **Step 3: Implémenter (ajouter en fin de `tools/graph/integrity.mjs`)**

```js
const isQuestion = (s) => arr(s["@type"]).includes("jlpt:Question");

/** Prédicats qui portent une référence vers un autre sujet. */
const REF_PREDICATES = ["tests", "usesKanji", "covers"];

/** Invariants portant sur l'ensemble du corpus : densité et unicité des ordinaux,
 *  intégrité référentielle, questions contradictoires. */
export function checkCorpus(subjects) {
  const errs = [];
  const questions = subjects.filter(isQuestion);

  // --- ordinaux : uniques et denses sur [0, n-1] ---
  const byOrd = new Map();
  for (const q of questions) {
    const o = q["jlpt:ord"];
    if (!byOrd.has(o)) byOrd.set(o, []);
    byOrd.get(o).push(q["@id"]);
  }
  for (const [o, ids] of byOrd) {
    if (ids.length > 1) errs.push(`ord ${o} en double : ${ids.join(", ")}`);
  }
  for (let i = 0; i < questions.length; i++) {
    if (!byOrd.has(i)) { errs.push(`ord non dense : ${i} manquant sur ${questions.length} questions`); break; }
  }

  // --- intégrité référentielle ---
  const known = new Set(subjects.map((s) => s["@id"]).filter(Boolean));
  for (const s of subjects) {
    for (const pred of REF_PREDICATES) {
      for (const ref of arr(s[pred])) {
        const iri = typeof ref === "object" && ref !== null ? ref["@id"] : ref;
        if (!known.has(iri)) {
          errs.push(`${s["@id"]} : référence pendante ${pred} → ${iri}`);
        }
      }
    }
  }

  // --- questions contradictoires : même énoncé, mêmes options, réponse différente ---
  const byKey = new Map();
  for (const q of questions) {
    const opts = arr(q.opts).map(norm);
    const key = `${norm(q["jlpt:stem"])}||${[...opts].sort().join("|")}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(q);
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const answers = new Set(group.map((q) => norm(arr(q.opts)[q["jlpt:answer"]])));
    if (answers.size > 1) {
      errs.push(`réponses contradictoires entre ${group.map((q) => q["@id"]).join(", ")} — ` +
        `« ${norm(group[0]["jlpt:stem"])} » → ${[...answers].join(" ≠ ")}`);
    }
  }

  return errs;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/integrity.test.ts`
Expected: PASS — 14 tests (7 de la Task 5 + 7)

- [ ] **Step 5: Commit**

```bash
git add tools/graph/integrity.mjs tools/graph/integrity.test.ts
git commit -m "feat(graph): invariants globaux (ordinaux, IRIs pendantes, contradictions)"
```

---

### Task 7: Point d'entrée CI

**Files:**
- Create: `tools/validate-graph.mjs`
- Modify: `.github/workflows/validate.yml`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consomme : `readContext`/`readDoc`, `parseShapes`/`validateAll`, `checkQuestion`/`checkCorpus`.
- Produit : un exécutable `bun tools/validate-graph.mjs` — `exit 0` si valide, `exit 1` sinon, rapport lisible sur stdout.

- [ ] **Step 1: Écrire `tools/validate-graph.mjs`**

```js
#!/usr/bin/env node
// Valide data/graph/ : shapes SHACL (sous-ensemble Oku) + contrôles impératifs.
// Node pur, zéro dépendance. Exit 1 si invalide.
// Coexiste avec tools/validate.mjs tant que l'ancien modèle est servi (lot 4 le supprime).
import { existsSync, readdirSync } from "node:fs";
import { readContext, readDoc } from "./graph/jsonld.mjs";
import { parseShapes, validateAll } from "./graph/shacl.mjs";
import { checkQuestion, checkCorpus } from "./graph/integrity.mjs";

const DIR = "data/graph";
const CONTEXT = `${DIR}/context.jsonld`;
const SHAPES = `${DIR}/shapes.jsonld`;

if (!existsSync(DIR)) {
  console.error(`✗ ${DIR} absent`);
  process.exit(1);
}

const { prefixes } = readContext(CONTEXT);
const shapes = parseShapes(readDoc(SHAPES, CONTEXT).subjects, prefixes);

const dataFiles = readdirSync(DIR)
  .filter((f) => f.endsWith(".jsonld") && f !== "context.jsonld" && f !== "shapes.jsonld")
  .sort();

const subjects = [];
for (const f of dataFiles) subjects.push(...readDoc(`${DIR}/${f}`, CONTEXT).subjects);

const errors = [
  ...validateAll(subjects, shapes, prefixes),
  ...subjects.filter((s) => (Array.isArray(s["@type"]) ? s["@type"] : [s["@type"]]).includes("jlpt:Question"))
    .flatMap(checkQuestion),
  ...checkCorpus(subjects),
];

const byType = {};
for (const s of subjects) {
  const t = (Array.isArray(s["@type"]) ? s["@type"][0] : s["@type"]) ?? "(sans type)";
  byType[t] = (byType[t] ?? 0) + 1;
}
console.log(`${dataFiles.length} documents, ${subjects.length} sujets, ${shapes.length} shapes`);
for (const [t, n] of Object.entries(byType).sort()) console.log(`  ${t.padEnd(24)} ${n}`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} erreur(s) :`);
  for (const e of errors.slice(0, 50)) console.error(`  ${e}`);
  if (errors.length > 50) console.error(`  … +${errors.length - 50} autres`);
  process.exit(1);
}
console.log("\n✓ graphe valide");
```

- [ ] **Step 2: Vérifier qu'il échoue proprement sans données**

Run: `bun tools/validate-graph.mjs`
Expected: le script s'exécute et ne plante pas ; il affiche `0 documents, 0 sujets, 5 shapes` puis `✓ graphe valide` (aucune donnée n'est encore migrée — c'est attendu à ce stade).

- [ ] **Step 3: Ajouter le script npm**

Dans `package.json`, ajouter à `"scripts"` :

```json
"validate:graph": "bun tools/validate-graph.mjs"
```

- [ ] **Step 4: Brancher la CI**

Dans `.github/workflows/validate.yml`, ajouter une étape **après** l'étape existante qui exécute `bun tools/validate.mjs`, sans la remplacer :

```yaml
      - name: Valider le graphe JSON-LD
        run: bun tools/validate-graph.mjs
```

- [ ] **Step 5: Vérifier que la suite complète passe**

Run: `bun test && bun run typecheck && bun tools/validate.mjs && bun tools/validate-graph.mjs`
Expected: tous verts, l'ancien validateur inchangé.

- [ ] **Step 6: Commit**

```bash
git add tools/validate-graph.mjs package.json .github/workflows/validate.yml
git commit -m "ci(graph): valide data/graph/ à côté du validateur existant"
```

---

### Task 8: Migration — les entités

**Files:**
- Create: `tools/migrate-to-graph.mjs`
- Create: `data/graph/kanji.jsonld`, `data/graph/word.jsonld`, `data/graph/gram.jsonld` (générés)
- Create: `docs/superpowers/plans/2026-07-20-conflits-lectures.md` (rapport généré, à arbitrer)

**Interfaces:**
- Consomme : `data/{dict,vocab,kanji,grammar,cours-gram}.json`, `isSafeIri`.
- Produit : `slugify(form) -> string`, `buildEntities() -> {kanji, word, gram, conflicts}` ; écrit les trois documents.

- [ ] **Step 1: Écrire le test de la règle de précédence**

Créer `tools/graph/migrate.test.ts` :

```ts
import { test, expect } from "bun:test";
import { slugify, resolveReading } from "../migrate-to-graph.mjs";

test("slugify produit une IRI sûre depuis une forme de grammaire", () => {
  expect(slugify("〜ようだ / 〜みたいだ")).toBe("ようだ-みたいだ");
  expect(slugify("〜たら")).toBe("たら");
});

test("slugify n'émet jamais de séquence interdite par Oku", () => {
  for (const s of ["a--b", "a;b", "a'b", "a\\b", "a/*b"]) {
    const out = slugify(s);
    for (const bad of ["--", ";", "'", "\\", "/*"]) expect(out.includes(bad)).toBe(false);
  }
});

test("resolveReading : la lecture d'auteur l'emporte sur le dictionnaire miné", () => {
  const r = resolveReading("嫌", { author: "いや", dict: "きら" });
  expect(r.reading).toBe("いや");
  expect(r.conflict).toBe(true);
});

test("resolveReading : sans lecture d'auteur, le dictionnaire sert s'il est propre", () => {
  expect(resolveReading("影響", { author: null, dict: "えいきょう" }).reading).toBe("えいきょう");
});

test("resolveReading : un dictionnaire suspect sans auteur n'est PAS tranché", () => {
  const r = resolveReading("安全", { author: null, dict: "あんぜん / きけん" });
  expect(r.reading).toBeNull();
  expect(r.needsArbitration).toBe(true);
});

test("resolveReading convertit une lecture de mot en katakana vers l'hiragana", () => {
  // 138 entrées de dict.json sont en katakana pur : rendues telles quelles, elles
  // produisent des furigana en katakana (階【カイ】) là où 3024 autres sont en hiragana.
  expect(resolveReading("階", { author: null, dict: "カイ" }).reading).toBe("かい");
});

test("resolveReading ne touche pas à un allongement ー ni à une lecture déjà hiragana", () => {
  expect(resolveReading("コーヒー", { author: null, dict: "コーヒー" }).reading).toBe("こーひー");
  expect(resolveReading("影響", { author: null, dict: "えいきょう" }).reading).toBe("えいきょう");
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun test tools/graph/migrate.test.ts`
Expected: FAIL — `Cannot find module '../migrate-to-graph.mjs'`

- [ ] **Step 3: Implémenter les fonctions pures dans `tools/migrate-to-graph.mjs`**

```js
#!/usr/bin/env node
// Script de migration ONE-SHOT : convertit l'ancien modèle en data/graph/.
// SUPPRIMÉ au lot 4. Il ne doit jamais devenir un générateur permanent — c'est
// exactement ce qui a tué tools/transform-cours.mjs (lecture/écriture des mêmes
// fichiers, non idempotent, plus exécutable aujourd'hui).
import { readFileSync, writeFileSync } from "node:fs";

const KANA_ONLY = /^[ぁ-んァ-ヴー]+$/;

/** Katakana → hiragana. Une lecture de MOT sert de furigana, et les furigana s'écrivent
 *  en hiragana : 138 entrées de dict.json sont en katakana pur contre 3024 en hiragana.
 *  (Ne s'applique PAS aux lectures ON d'un kanji, où le katakana est la convention.) */
export function toHiragana(s) {
  return String(s ?? "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Forme de grammaire → segment d'IRI sûr. Retire 〜, remplace les séparateurs, et
 *  garantit qu'aucune séquence interdite par Oku ne subsiste. */
export function slugify(form) {
  return String(form ?? "")
    .replace(/〜/g, "")
    .replace(/\s*\/\s*/g, "-")
    .replace(/[\s'\\;]/g, "")
    .replace(/\*/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Précédence des lectures (spec § « Précédence en cas de conflit ») :
 * 1. lecture d'auteur (vocab/kanji.json, `読み：…`) — fait foi ;
 * 2. dict.json (miné automatiquement) — seulement si (1) est muet ET propre ;
 * 3. sinon : pas de lecture, le cas part en arbitrage plutôt qu'en silence.
 */
export function resolveReading(word, { author, dict }) {
  if (author) {
    return { reading: toHiragana(author), conflict: !!dict && dict !== author, needsArbitration: false };
  }
  if (dict && KANA_ONLY.test(dict)) {
    return { reading: toHiragana(dict), conflict: false, needsArbitration: false };
  }
  if (dict) return { reading: null, conflict: false, needsArbitration: true };
  return { reading: null, conflict: false, needsArbitration: false };
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/migrate.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Compléter le script avec la construction des entités**

Ajouter en fin de `tools/migrate-to-graph.mjs` :

```js
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const readingOf = (x) => { const m = /読み[：:]\s*([^\s／/]+)/.exec(String(x.struct ?? "")); return m ? m[1].trim() : null; };
const doc = (subjects) => JSON.stringify({ "@context": "context.jsonld", "@graph": subjects }, null, 1);

export function buildEntities() {
  const dict = J("data/dict.json");
  const vocabSrc = J("data/vocab.json");
  const kanjiSrc = J("data/kanji.json");
  const gramSrc = J("data/grammar.json");
  const coursGram = J("data/cours-gram.json");

  const conflicts = [];

  // --- kanji ---
  const kanji = kanjiSrc.map((k) => ({
    "@id": `jlpt:kanji/${norm(k.k)}`, "@type": "jlpt:Kanji",
    "schema:name": norm(k.k),
    "schema:description": norm(k.sens),
    ...(k.lvl ? { "jlpt:level": norm(k.lvl) } : {}),
  }));
  const kanjiSet = new Set(kanjiSrc.map((k) => norm(k.k)));

  // --- mots : union vocab.json ∪ dict.json, précédence sur la lecture ---
  const authorReading = new Map();
  for (const v of vocabSrc) { const r = readingOf(v); if (r) authorReading.set(norm(v.k), r); }
  const authorMeaning = new Map(vocabSrc.map((v) => [norm(v.k), norm(v.sens)]));
  const authorLevel = new Map(vocabSrc.map((v) => [norm(v.k), norm(v.lvl)]));

  const allWords = new Set([...authorReading.keys(), ...Object.keys(dict).map(norm)]);
  const word = [];
  for (const w of allWords) {
    if (!w) continue;
    const { reading, conflict, needsArbitration } = resolveReading(w, {
      author: authorReading.get(w) ?? null,
      dict: norm(dict[w]?.r) || null,
    });
    if (conflict) conflicts.push({ mot: w, auteur: authorReading.get(w), dict: norm(dict[w]?.r), retenu: reading });
    if (needsArbitration) conflicts.push({ mot: w, auteur: null, dict: norm(dict[w]?.r), retenu: "(à arbitrer)" });
    const meaning = authorMeaning.get(w) || norm(dict[w]?.m);
    const uses = [...w].filter((c) => kanjiSet.has(c)).map((c) => `jlpt:kanji/${c}`);
    word.push({
      "@id": `jlpt:word/${w}`, "@type": "jlpt:Word",
      "schema:name": w,
      ...(reading ? { "jlpt:reading": reading } : {}),
      ...(meaning ? { "schema:description": meaning } : {}),
      ...(authorLevel.get(w) ? { "jlpt:level": authorLevel.get(w) } : {}),
      ...(uses.length ? { usesKanji: uses } : {}),
    });
  }

  // --- grammaire : fusion des DEUX référentiels (246 + 251, dont 122/127 disjoints) ---
  const gram = new Map();
  const put = (form, fields) => {
    const id = `jlpt:gram/${slugify(form)}`;
    const cur = gram.get(id) ?? { "@id": id, "@type": "jlpt:GrammarPoint", "jlpt:form": norm(form) };
    gram.set(id, { ...cur, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) });
  };
  for (const g of gramSrc) {
    put(g.k, { "schema:description": norm(g.sens), "jlpt:structure": norm(g.struct), "jlpt:level": norm(g.lvl) });
  }
  for (const grp of coursGram.groups ?? []) {
    for (const it of grp.items ?? []) {
      if (!it.form) continue;
      const [main, ...alts] = it.form.split(" / ").map(norm);
      put(main, { "schema:description": norm(it.mean), "jlpt:level": norm(it.niv) });
      if (alts.length) {
        const id = `jlpt:gram/${slugify(main)}`;
        gram.set(id, { ...gram.get(id), "jlpt:altForm": alts });
      }
    }
  }

  return { kanji, word, gram: [...gram.values()], conflicts };
}

if (process.argv[1]?.endsWith("migrate-to-graph.mjs")) {
  const { kanji, word, gram, conflicts } = buildEntities();
  writeFileSync("data/graph/kanji.jsonld", doc(kanji));
  writeFileSync("data/graph/word.jsonld", doc(word));
  writeFileSync("data/graph/gram.jsonld", doc(gram));
  const lignes = conflicts.map((c) => `| ${c.mot} | ${c.auteur ?? "—"} | ${c.dict ?? "—"} | ${c.retenu} |`);
  writeFileSync("docs/superpowers/plans/2026-07-20-conflits-lectures.md",
    `# Conflits de lecture à arbitrer\n\n${conflicts.length} cas.\n\n` +
    `| mot | lecture auteur | lecture dict | retenu |\n|---|---|---|---|\n${lignes.join("\n")}\n`);
  console.log(`kanji ${kanji.length} · mots ${word.length} · grammaire ${gram.length} · conflits ${conflicts.length}`);
}
```

- [ ] **Step 6: Exécuter la migration des entités**

Run: `bun tools/migrate-to-graph.mjs`
Expected: affiche les compteurs ; `data/graph/{kanji,word,gram}.jsonld` créés, plus le rapport de conflits.

- [ ] **Step 7: Valider le graphe partiel**

Run: `bun tools/validate-graph.mjs`
Expected: `✓ graphe valide` — les trois documents d'entités passent les shapes. En cas d'erreur, la corriger dans le script et régénérer, jamais à la main dans les `.jsonld`.

- [ ] **Step 8: Commit**

```bash
git add tools/migrate-to-graph.mjs tools/graph/migrate.test.ts data/graph/*.jsonld docs/superpowers/plans/2026-07-20-conflits-lectures.md
git commit -m "feat(graph): entités kanji/mots/grammaire, référentiels de grammaire fusionnés"
```

---

### Task 9: Migration — les questions et leurs arêtes

**Files:**
- Modify: `tools/migrate-to-graph.mjs`
- Modify: `tools/graph/migrate.test.ts`
- Create: `data/graph/q-{grammaire,vocabulaire,kanji,lecture,ecoute}.jsonld` (générés)

**Interfaces:**
- Consomme : `data/bank.json`, les entités de la Task 8.
- Produit : `subjectOf(question) -> string|null` (sujet entre 「」), `gramFormOf(question) -> string|null` (premier `<b>`), `buildQuestions(entities) -> {docs, linkRate}`.

- [ ] **Step 1: Écrire les tests d'extraction d'arêtes**

Ajouter à `tools/graph/migrate.test.ts` :

```ts
import { subjectOf, gramFormOf } from "../migrate-to-graph.mjs";

test("subjectOf extrait le sujet testé d'un énoncé 「…」", () => {
  expect(subjectOf({ q: "「政治」の読み方は？" })).toBe("政治");
});

test("subjectOf rend null quand l'énoncé n'a pas de 「…」", () => {
  expect(subjectOf({ q: "家に帰っ___、電話します。" })).toBeNull();
});

test("gramFormOf lit la forme du premier <b> du corrigé", () => {
  expect(gramFormOf({ e: "<b>〜たら</b> = « quand »." })).toBe("〜たら");
});

test("gramFormOf ignore le balisage imbriqué", () => {
  expect(gramFormOf({ e: "<b><i>〜ば</i></b> …" })).toBe("〜ば");
});

test("gramFormOf rend null sans <b>", () => {
  expect(gramFormOf({ e: "pas de forme en gras" })).toBeNull();
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun test tools/graph/migrate.test.ts`
Expected: FAIL — `subjectOf is not a function`

- [ ] **Step 3: Implémenter (ajouter à `tools/migrate-to-graph.mjs`, avant le bloc `if (process.argv…)`)**

```js
/** Sujet testé, extrait des 「…」 de l'énoncé. 80 % des questions en portent un. */
export function subjectOf(q) {
  const m = /「([^」]+)」/.exec(String(q.q ?? ""));
  return m ? m[1] : null;
}

/** Forme de grammaire testée = contenu du premier <b> du corrigé. C'est l'heuristique
 *  qu'utilisait coursGramIndex à l'exécution ; ici elle ne sert qu'UNE fois, à la
 *  migration, et son résultat devient une arête explicite. */
export function gramFormOf(q) {
  const m = /<b>([\s\S]*?)<\/b>/.exec(String(q.e ?? ""));
  if (!m) return null;
  const form = m[1].replace(/<[^>]*>/g, "").trim();
  return form || null;
}

const SKILLS = ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"];
const arrOf = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

export function buildQuestions({ kanji, word, gram }) {
  const bank = J("data/bank.json");
  const known = new Set([...kanji, ...word, ...gram].map((s) => s["@id"]));
  const gramByForm = new Map();
  for (const g of gram) {
    gramByForm.set(slugify(g["jlpt:form"]), g["@id"]);
    for (const alt of arrOf(g["jlpt:altForm"])) gramByForm.set(slugify(alt), g["@id"]);
  }

  const bySkill = Object.fromEntries(SKILLS.map((s) => [s, []]));
  let linked = 0;

  bank.forEach((q, ord) => {
    const tests = [];
    if (q.cat === "grammaire") {
      const f = gramFormOf(q);
      const id = f ? gramByForm.get(slugify(f)) : undefined;
      if (id) tests.push(id);
    } else {
      const s = subjectOf(q);
      if (s) {
        for (const cand of [`jlpt:word/${s}`, `jlpt:kanji/${s}`]) {
          if (known.has(cand)) { tests.push(cand); break; }
        }
      }
    }
    if (tests.length) linked++;

    bySkill[q.cat].push({
      "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question",
      "jlpt:skill": q.cat, "jlpt:difficulty": q.d, "jlpt:ord": ord,
      "jlpt:stem": q.q,
      opts: q.o,
      "jlpt:answer": q.a,
      ...(q.e ? { "schema:description": q.e } : {}),
      ...(q.g ? { "jlpt:gloss": q.g } : {}),
      ...(q.od ? { "jlpt:optionNote": q.od } : {}),
      ...(q.script ? { "jlpt:script": q.script } : {}),
      ...(q.passage ? { "jlpt:passage": q.passage } : {}),
      ...(tests.length ? { tests } : {}),
    });
  });

  return { bySkill, linkRate: linked / bank.length, total: bank.length };
}
```

Et remplacer le bloc d'exécution en fin de fichier par :

```js
if (process.argv[1]?.endsWith("migrate-to-graph.mjs")) {
  const entities = buildEntities();
  writeFileSync("data/graph/kanji.jsonld", doc(entities.kanji));
  writeFileSync("data/graph/word.jsonld", doc(entities.word));
  writeFileSync("data/graph/gram.jsonld", doc(entities.gram));
  const lignes = entities.conflicts.map((c) => `| ${c.mot} | ${c.auteur ?? "—"} | ${c.dict ?? "—"} | ${c.retenu} |`);
  writeFileSync("docs/superpowers/plans/2026-07-20-conflits-lectures.md",
    `# Conflits de lecture à arbitrer\n\n${entities.conflicts.length} cas.\n\n` +
    `| mot | lecture auteur | lecture dict | retenu |\n|---|---|---|---|\n${lignes.join("\n")}\n`);

  const { bySkill, linkRate, total } = buildQuestions(entities);
  for (const [skill, subjects] of Object.entries(bySkill)) {
    writeFileSync(`data/graph/q-${skill}.jsonld`, doc(subjects));
  }
  console.log(`kanji ${entities.kanji.length} · mots ${entities.word.length} · grammaire ${entities.gram.length}`);
  console.log(`questions ${total} · arêtes tests ${(linkRate * 100).toFixed(1)} % · conflits ${entities.conflicts.length}`);
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/migrate.test.ts`
Expected: PASS — 10 tests (5 de la Task 8 + 5)

- [ ] **Step 5: Exécuter la migration complète et vérifier le taux d'arêtes**

Run: `bun tools/migrate-to-graph.mjs && bun tools/validate-graph.mjs`
Expected: `questions 10310`, taux d'arêtes ≥ **75 %** (référence mesurée : 90 % sur vocab/kanji, 54 % sur grammaire, soit ~85 % global). Le validateur affiche `✓ graphe valide`.

Si le validateur signale des erreurs, **corriger le script et régénérer** — ne jamais éditer un `.jsonld` à la main à ce stade.

- [ ] **Step 6: Commit**

```bash
git add tools/migrate-to-graph.mjs tools/graph/migrate.test.ts data/graph/q-*.jsonld
git commit -m "feat(graph): 10310 questions en sujets JSON-LD, arêtes tests matérialisées"
```

---

### Task 10: Migration — les leçons

**Files:**
- Modify: `tools/migrate-to-graph.mjs`
- Create: `data/graph/lesson.jsonld` (généré)

**Interfaces:**
- Consomme : `data/cours-{gram,vocab,kanji}.json`, les entités de la Task 8.
- Produit : `buildLessons(entities) -> object[]` — des `jlpt:Lesson` qui **pointent** au lieu de recopier.

- [ ] **Step 1: Écrire le test**

Ajouter à `tools/graph/migrate.test.ts` :

```ts
import { lessonId } from "../migrate-to-graph.mjs";

test("lessonId préfixe la piste pour éviter les collisions entre cours", () => {
  expect(lessonId("gram", "conditionnel")).toBe("jlpt:lesson/gram-conditionnel");
  expect(lessonId("vocab", "conditionnel")).toBe("jlpt:lesson/vocab-conditionnel");
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun test tools/graph/migrate.test.ts`
Expected: FAIL — `lessonId is not a function`

- [ ] **Step 3: Implémenter (ajouter avant le bloc d'exécution)**

```js
/** Les trois cours ont des ids de groupe indépendants : on préfixe par la piste pour
 *  qu'un même id dans deux cours ne produise pas une seule leçon. */
export function lessonId(track, groupId) {
  return `jlpt:lesson/${track}-${slugify(groupId)}`;
}

/** Une leçon ORDONNE des entités existantes ; elle n'en recopie plus mot/lecture/sens.
 *  Un item qui ne correspond à aucune entité est ignoré et compté — le rapport dit
 *  combien de contenu du cours n'est pas encore adossé au référentiel. */
export function buildLessons({ kanji, word, gram }) {
  const known = new Set([...kanji, ...word, ...gram].map((s) => s["@id"]));
  const gramByForm = new Map();
  for (const g of gram) gramByForm.set(slugify(g["jlpt:form"]), g["@id"]);

  const lessons = [];
  let orphans = 0;
  for (const track of ["gram", "vocab", "kanji"]) {
    const src = J(`data/cours-${track}.json`);
    (src.groups ?? []).forEach((grp, order) => {
      const covers = [];
      for (const it of grp.items ?? []) {
        let iri = null;
        if (track === "gram" && it.form) iri = gramByForm.get(slugify(String(it.form).split(" / ")[0]));
        else if (track === "vocab" && it.mot) iri = `jlpt:word/${norm(it.mot)}`;
        else if (track === "kanji" && it.mot) iri = `jlpt:kanji/${norm(it.mot)}`;
        if (iri && known.has(iri)) covers.push(iri);
        else orphans++;
      }
      lessons.push({
        "@id": lessonId(track, grp.id), "@type": "jlpt:Lesson",
        "schema:name": norm(grp.title) || grp.id,
        "jlpt:order": order,
        "jlpt:track": track,
        ...(covers.length ? { covers } : {}),
      });
    });
  }
  return { lessons, orphans };
}
```

Ajouter dans le bloc d'exécution, avant le `console.log` final :

```js
  const { lessons, orphans } = buildLessons(entities);
  writeFileSync("data/graph/lesson.jsonld", doc(lessons));
  console.log(`leçons ${lessons.length} · items de cours sans entité ${orphans}`);
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/migrate.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5: Régénérer et valider**

Run: `bun tools/migrate-to-graph.mjs && bun tools/validate-graph.mjs`
Expected: `leçons` ≈ 60–80, `✓ graphe valide`. Le compteur d'orphelins mesure ce que le cours enseigne sans que le référentiel le connaisse — le noter, c'est une entrée du travail éditorial.

- [ ] **Step 6: Commit**

```bash
git add tools/migrate-to-graph.mjs tools/graph/migrate.test.ts data/graph/lesson.jsonld
git commit -m "feat(graph): leçons qui pointent vers les entités au lieu de les recopier"
```

---

### Task 11: Corrections de contenu, sur le graphe

**Files:**
- Modify: `tools/migrate-to-graph.mjs` (table de corrections)
- Modify: `tools/graph/migrate.test.ts`
- Regenerate: `data/graph/q-*.jsonld`

**Interfaces:**
- Consomme : `buildQuestions`.
- Produit : `applyFixes(question, ord) -> question` — corrections ciblées par ordinal, appliquées à la génération.

Les défauts corrigés ici sont ceux que l'audit a établis : l'option dupliquée de `#1381`, les cinq paires homophones à réponse contradictoire, et les trois doublons purs inter-catégories.

- [ ] **Step 1: Écrire les tests**

Ajouter à `tools/graph/migrate.test.ts` :

```ts
import { applyFixes } from "../migrate-to-graph.mjs";

test("applyFixes remplace l'option dupliquée de la question 1381", () => {
  const q = { q: "「七月」の読み方は？", o: ["しちがつ", "なながつ", "しちげつ", "なながつ"], a: 0, cat: "kanji", d: 1 };
  const out = applyFixes(q, 1381);
  expect(new Set(out.o).size).toBe(4);
  expect(out.o[out.a]).toBe("しちがつ");
});

test("applyFixes désambiguïse l'énoncé des paires homophones", () => {
  const a = applyFixes({ q: "「いる」を漢字で書くと？", o: ["居る", "要る"], a: 0, cat: "vocabulaire", d: 2 }, 5884);
  const b = applyFixes({ q: "「いる」を漢字で書くと？", o: ["居る", "要る"], a: 1, cat: "vocabulaire", d: 2 }, 5886);
  expect(a.q).not.toBe(b.q); // les deux énoncés ne peuvent plus être confondus
  expect(a.q).toContain("いる");
});

test("applyFixes laisse intacte une question non listée", () => {
  const q = { q: "x", o: ["a", "b"], a: 0, cat: "kanji", d: 1 };
  expect(applyFixes(q, 42)).toEqual(q);
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun test tools/graph/migrate.test.ts`
Expected: FAIL — `applyFixes is not a function`

- [ ] **Step 3: Implémenter (ajouter avant le bloc d'exécution)**

```js
// Corrections de contenu établies par l'audit du 2026-07-20, appliquées À LA GÉNÉRATION
// pour rester traçables. Clé = ordinal dans bank.json.
const FIXES = {
  // Option « なながつ » présente deux fois → seules 3 options réelles.
  1381: (q) => ({ ...q, o: ["しちがつ", "なながつ", "しちげつ", "ななつき"] }),
  // Cinq paires d'homophones : mêmes options, bonne réponse différente → aucune
  // réponse n'était défendable. On désambiguïse l'énoncé par le sens visé.
  5884: (q) => ({ ...q, q: "「いる」（存在する）を漢字で書くと？" }),
  5886: (q) => ({ ...q, q: "「いる」（必要だ）を漢字で書くと？" }),
  6182: (q) => ({ ...q, q: "「さす」（傘を〜）を漢字で書くと？" }),
  9014: (q) => ({ ...q, q: "「さす」（針で〜）を漢字で書くと？" }),
  6348: (q) => ({ ...q, q: "「つく」（到着する）を漢字で書くと？" }),
  6862: (q) => ({ ...q, q: "「つく」（明かりが〜）を漢字で書くと？" }),
  7594: (q) => ({ ...q, q: "「かてい」（家族の〜）を漢字で書くと？" }),
  8448: (q) => ({ ...q, q: "「かてい」（もし〜すれば）を漢字で書くと？" }),
  7618: (q) => ({ ...q, q: "「かみ」（頭の〜）を漢字で書くと？" }),
  8468: (q) => ({ ...q, q: "「かみ」（神社の〜）を漢字で書くと？" }),
};

/** Doublons purs inter-catégories : même énoncé, mêmes options, même réponse, rangés
 *  dans deux compétences. On garde l'occurrence kanji et on écarte celle de vocabulaire. */
const DROP = new Set([4530, 4696, 5108]);

export function applyFixes(q, ord) {
  const fix = FIXES[ord];
  return fix ? fix(q) : q;
}

export function isDropped(ord) {
  return DROP.has(ord);
}
```

Retirer une question créerait un trou dans les ordinaux, or `checkCorpus` exige la densité. Il faut donc **réattribuer** les ordinaux après filtrage, et non réutiliser l'index de `bank.json`. Dans `buildQuestions`, remplacer le bloc `bank.forEach((q, ord) => { … });` **en entier** par :

```js
  let ord = 0; // ordinal RÉATTRIBUÉ après filtrage — l'index de bank.json ne convient plus
  // `bank.entries()` donne la position d'origine sans coût : un bank.indexOf(raw) par
  // itération rendrait la boucle quadratique sur 10310 éléments.
  for (const [source, raw] of bank.entries()) {
    if (isDropped(source)) continue;
    const q = applyFixes(raw, source); // `source` = position d'origine, clé des corrections

    const tests = [];
    if (q.cat === "grammaire") {
      const f = gramFormOf(q);
      const id = f ? gramByForm.get(slugify(f)) : undefined;
      if (id) tests.push(id);
    } else {
      const s = subjectOf(q);
      if (s) {
        for (const cand of [`jlpt:word/${s}`, `jlpt:kanji/${s}`]) {
          if (known.has(cand)) { tests.push(cand); break; }
        }
      }
    }
    if (tests.length) linked++;

    bySkill[q.cat].push({
      "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question",
      "jlpt:skill": q.cat, "jlpt:difficulty": q.d, "jlpt:ord": ord,
      "jlpt:stem": q.q,
      opts: q.o,
      "jlpt:answer": q.a,
      ...(q.e ? { "schema:description": q.e } : {}),
      ...(q.g ? { "jlpt:gloss": q.g } : {}),
      ...(q.od ? { "jlpt:optionNote": q.od } : {}),
      ...(q.script ? { "jlpt:script": q.script } : {}),
      ...(q.passage ? { "jlpt:passage": q.passage } : {}),
      ...(tests.length ? { tests } : {}),
    });
    ord++;
  }
```

Et remplacer le `return` en fin de `buildQuestions` par celui-ci — le dénominateur n'est plus `bank.length`, puisque des questions ont été écartées :

```js
  return { bySkill, linkRate: ord === 0 ? 0 : linked / ord, total: ord };
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `bun test tools/graph/migrate.test.ts`
Expected: PASS — 14 tests

- [ ] **Step 5: Régénérer et valider — c'est le contrôle final du lot**

Run: `bun tools/migrate-to-graph.mjs && bun tools/validate-graph.mjs`
Expected : `questions 10307` (10310 − 3 doublons), `✓ graphe valide`, et **aucune erreur « réponses contradictoires »** ni « options identiques » : les contrôles de la Task 5 et 6 prouvent que les corrections ont pris.

- [ ] **Step 6: Vérifier que rien du runtime n'a bougé**

Run: `bun test && bun run typecheck && bun tools/validate.mjs && bun tools/split-bank.mjs --check`
Expected: tous verts. L'app lit toujours `bank-*.json` : le lot 1 n'a rien changé pour l'utilisateur.

- [ ] **Step 7: Commit**

```bash
git add tools/migrate-to-graph.mjs tools/graph/migrate.test.ts data/graph/q-*.jsonld
git commit -m "fix(graph): corrige option dupliquée, paires homophones et doublons inter-catégories"
```

---

## Fin du lot 1

À ce stade : `data/graph/` existe, est validé à chaque push par les shapes et les contrôles impératifs, et l'app tourne exactement comme avant. Les lots 2 à 4 feront l'objet de leurs propres plans, écrits une fois que la forme réelle des nœuds et la liste d'arbitrage des lectures seront connues.

**Livrables à relire avant d'enchaîner :**
- `docs/superpowers/plans/2026-07-20-conflits-lectures.md` — les lectures à arbitrer à la main ;
- le taux d'arêtes affiché par la migration, et le nombre d'items de cours sans entité : ce sont les deux entrées du travail éditorial que tu as prévu de faire ensuite.
