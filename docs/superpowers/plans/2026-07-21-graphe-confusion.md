# Graphe de confusion — plan d'implémentation (lot 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dire à l'apprenant par quel *type de piège* il se fait avoir, à partir des notes d'option
déjà écrites dans le corpus et des erreurs qu'il commet réellement.

**Architecture:** Un outil hors ligne déterministe pose `jlpt:trapKind` sur les shards kanji et
vocabulaire. Le runtime n'enregistre que l'**événement brut** (`[ord, indexChoisi, jour]`) dans le
blob de progression, et calcule le type **à l'affichage** depuis le corpus — aucun dérivé n'est
stocké dans la donnée utilisateur. Une couche pure (`traps.ts`) produit le modèle ; deux écrans
l'affichent.

**Tech Stack:** bun (runtime, tests, bundler), React + TypeScript, JSON-LD, happy-dom.

**Spec:** `docs/superpowers/specs/2026-07-21-graphe-confusion-design.md`

## Global Constraints

- **Worktree `.worktrees/confusion`, branche `feat/graphe-confusion`.** Jamais dans le répertoire principal.
- **`bun` exclusivement, jamais `node`** — y compris pour les `tools/*.mjs` (`bun tools/graph/traps.mjs`).
- **Pas de linter** dans le projet : `bun run typecheck` + `bun test` font foi.
- Toute clé localStorage nouvelle porte le préfixe `jlptN3` et est déclarée dans `src/lib/keys.ts`. **Ce lot n'ajoute aucune clé** : `confusions` est un champ du blob `PROGRESS_KEY` existant.
- Écrire la progression **uniquement** via `writeProgress()` — patch fusionné, jamais le blob entier.
- Les chaînes d'utilitaires viennent de `src/ui/styles.ts` (`PANEL`, `H2`, `H2_TIGHT`) — ne pas retaper un squelette de carte.
- `jlpt:ord` est un index **stable** : ne jamais renuméroter. Ce lot n'ajoute que des champs.
- `data/graph/*.jsonld` est **livré** : toute modification impose d'incrémenter `CACHE` dans `sw.js`.
- Taxonomie figée par la spec § 3.2 : 13 types + `autre`. N'en inventer aucun.
- Périmètre : `q-kanji.jsonld` et `q-vocabulaire.jsonld` **et eux seuls**. La présence du champ définit le périmètre.
- Tests côte à côte (`foo.test.ts` à côté de `foo.ts`). `renderToStaticMarkup` échappe les apostrophes (`'` → `&#x27;`) : asserter sur des sous-chaînes sans apostrophe.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `tools/graph/trap-kinds.mjs` | **créé** — taxonomie + classifieur pur `note → type` |
| `tools/graph/trap-kinds.test.ts` | **créé** — table de cas + cliquet de couverture sur le vrai corpus |
| `tools/graph/traps.mjs` | **créé** — applicateur idempotent sur les deux shards |
| `tools/graph/traps.test.ts` | **créé** — pose, idempotence, non-écrasement |
| `tools/graph/integrity.mjs` | **modifié** — contrôle impératif de `jlpt:trapKind` |
| `src/lib/graph.ts` | **modifié** — `toQuestion` expose `trap` |
| `src/types/quiz.ts` | **modifié** — champ `trap?: string[]` |
| `src/features/quiz/traps.ts` | **créé** — couche **pure** : époque, forme des confusions, modèle, libellés |
| `src/features/quiz/traps.test.ts` | **créé** — table-driven |
| `src/features/quiz/useQuiz.ts` | **modifié** — `choose` enregistre l'événement (câblage seul) |
| `src/features/quiz/confusions.test.ts` | **créé** — garde-fou contre la perte du champ au patch |
| `src/features/dashboard/useTraps.ts` | **créé** — chargement paresseux des deux shards |
| `src/features/dashboard/TrapPanel.tsx` | **créé** — panneau d'affichage, sans logique |
| `src/features/dashboard/TrapPanel.test.tsx` | **créé** — SSR smoke |
| `src/App.tsx` | **modifié** — monte le panneau |
| `src/features/quiz/Corrige.tsx` | **modifié** — nomme le type sous la note d'option |

---

## Task 1 : le classifieur

**Files:**
- Create: `tools/graph/trap-kinds.mjs`
- Test: `tools/graph/trap-kinds.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `KINDS: string[]` (14 valeurs, `autre` compris), `trapKind(note: string): string`.

- [ ] **Step 1 : écrire le test qui échoue**

`tools/graph/trap-kinds.test.ts` :

```ts
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
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Run: `bun test tools/graph/trap-kinds.test.ts`
Expected: FAIL — `Cannot find module './trap-kinds.mjs'`

- [ ] **Step 3 : écrire le classifieur**

`tools/graph/trap-kinds.mjs` :

```js
#!/usr/bin/env node
// Classe une note d'option (`jlpt:optionNote`) en TYPE DE PIÈGE.
//
// Les motifs ne devinent rien : chacun reprend une formule que l'auteur emploie réellement
// dans le corpus. Ce qu'aucun motif ne couvre tombe en `autre` — un type faux vaut moins
// qu'un type absent, parce qu'il s'affiche à l'apprenant comme un diagnostic.
//
// ⚠ L'ordre compte : premier motif qui matche gagne, donc du plus spécifique au plus général.
// `sens-different` et `registre` sont volontairement en fin de liste, leurs mots-clés étant
// les plus larges.
//
// Zéro dépendance, exécuté par `bun`.

/** Motifs, du plus spécifique au plus général. */
const MOTIFS = [
  ["kanji-partage", /partage(nt)? [一-鿿]|partage le kanji|même kanji|contient [一-鿿]/],
  ["voisement", /voisement|dakuten|handakuten|sonoris|assimilation phonétique|devient .{1,3} devant/i],
  ["graphie-inexistante", /graphie inexistante|n'existe pas|mot inexistant|forme inexistante|inexistant|parasite|fausse\)/i],
  ["kanji-confondu", /confond avec|se confond|confusion avec|autre kanji/i],
  ["forme-proche", /forme proche|ressemble|graphie proche|se ressemble|proche graphiquement/i],
  ["homophone", /homophone|m[êe]me lecture|même son/i],
  ["lecture-on-kun", /lecture on|on.?yomi|lecture kun|kun.?yomi|on\/kun/i],
  ["lecture-autre-mot", /lecture de |est la lecture d|lecture du mot|se lit .{1,6}, pas/i],
  ["lecture-erronee", /lecture erron|lecture fausse|mauvaise lecture|lecture approximative|erreur ?:/i],
  ["longueur-voyelle", /voyelle|son long|allong|contraction|manquant/i],
  ["nuance-grammaticale", /exprime|valeur |conditionnel|simultanéité|but\b|énumération|hypothét|nuance/i],
  ["sens-different", /sens différent|sens voisin|autre sens|signifie|sens proche|autre mot|hors sujet|hors contexte/i],
  ["registre", /registre|poli|neutre|familier|honorif/i],
];

/** La taxonomie complète — `autre` compris. Sert au contrôle d'intégrité et aux libellés. */
export const KINDS = [...MOTIFS.map(([k]) => k), "autre"];

/** Le type de piège d'une note. `autre` si aucun motif ne matche. Pur. */
export function trapKind(note) {
  const t = typeof note === "string" ? note : "";
  if (!t) return "autre";
  const hit = MOTIFS.find(([, re]) => re.test(t));
  return hit ? hit[0] : "autre";
}
```

- [ ] **Step 4 : lancer le test pour vérifier qu'il passe**

Run: `bun test tools/graph/trap-kinds.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5 : ajouter le cliquet de couverture sur le VRAI corpus**

Ajouter à la fin de `tools/graph/trap-kinds.test.ts` :

```ts
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
```

- [ ] **Step 6 : lancer les tests**

Run: `bun test tools/graph/trap-kinds.test.ts`
Expected: PASS — 5 tests. Noter les pourcentages réels : s'ils dépassent nettement 93 / 74, remonter les seuils dans le même commit.

- [ ] **Step 7 : commit**

```bash
git add tools/graph/trap-kinds.mjs tools/graph/trap-kinds.test.ts
git commit -m "feat(traps): classifieur des notes d'option en types de piège"
```

---

## Task 2 : l'applicateur et la pose sur le corpus

**Files:**
- Create: `tools/graph/traps.mjs`
- Test: `tools/graph/traps.test.ts`
- Modify: `data/graph/q-kanji.jsonld`, `data/graph/q-vocabulaire.jsonld` (données), `sw.js`

**Interfaces:**
- Consumes: `trapKind(note)`, `KINDS` de `tools/graph/trap-kinds.mjs`.
- Produces: `applyTrapKinds(sujets: object[]): { sujets: object[]; poses: number }`, `SHARDS: string[]`.

- [ ] **Step 1 : écrire le test qui échoue**

`tools/graph/traps.test.ts` :

```ts
import { test, expect } from "bun:test";
import { applyTrapKinds, SHARDS } from "./traps.mjs";

const question = () => ({
  "@id": "jlpt:q/1",
  "jlpt:skill": "vocabulaire",
  opts: ["影像", "映像", "影響", "反響"],
  "jlpt:answer": 2,
  "jlpt:optionNote": [
    "影像（えいぞう）: partage 影, lecture différente",
    "映像 : 映 ressemble à 影",
    "Correct : 影響",
    "反響 : partage 響",
  ],
});

test("pose un tableau parallèle aux options, vide à l'index de la réponse", () => {
  const { sujets, poses } = applyTrapKinds([question()]);
  expect(poses).toBe(1);
  expect(sujets[0]["jlpt:trapKind"]).toEqual(["kanji-partage", "forme-proche", "", "kanji-partage"]);
});

test("n'écrase JAMAIS un type déjà posé — une correction à la main survit au rejeu", () => {
  const dejaPose = { ...question(), "jlpt:trapKind": ["autre", "autre", "", "autre"] };
  const { sujets, poses } = applyTrapKinds([dejaPose]);
  expect(poses).toBe(0);
  expect(sujets[0]["jlpt:trapKind"]).toEqual(["autre", "autre", "", "autre"]);
});

test("est idempotent : la seconde passe ne change plus rien", () => {
  const un = applyTrapKinds([question()]);
  const deux = applyTrapKinds(un.sujets);
  expect(deux.poses).toBe(0);
  expect(JSON.stringify(deux.sujets)).toBe(JSON.stringify(un.sujets));
});

test("laisse intacte une question sans options", () => {
  const { sujets, poses } = applyTrapKinds([{ "@id": "jlpt:q/2", "jlpt:skill": "kanji" }]);
  expect(poses).toBe(0);
  expect(sujets[0]["jlpt:trapKind"]).toBeUndefined();
});

test("ne traite que les shards kanji et vocabulaire", () => {
  expect(SHARDS).toEqual(["q-kanji", "q-vocabulaire"]);
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Run: `bun test tools/graph/traps.test.ts`
Expected: FAIL — `Cannot find module './traps.mjs'`

- [ ] **Step 3 : écrire l'applicateur**

`tools/graph/traps.mjs` :

```js
#!/usr/bin/env node
// Pose `jlpt:trapKind` sur chaque option, depuis sa note (`jlpt:optionNote`).
//
// ⚠ Idempotent, et n'écrase JAMAIS un tableau existant — même invariant que readings.mjs
// et link-answers.mjs. Ce n'est pas un générateur : il ajoute ce qui manque. Corriger un type
// à la main dans le graphe est donc définitif ; pour re-dériver une question, supprimer son
// champ.
//
// ⚠ PÉRIMÈTRE : kanji et vocabulaire, et eux seuls. La grammaire n'atteint que 20 % de typage
// (un distracteur de grammaire est presque toujours « un autre point, de valeur différente » :
// le type y est constant, donc muet), et l'écoute comme la lecture testent la compréhension,
// pas la forme. LA PRÉSENCE DU CHAMP DÉFINIT LE PÉRIMÈTRE — c'est ce qui permet au runtime de
// distinguer « hors périmètre » de « dans le périmètre mais non classé ».
//
// Zéro dépendance, exécuté par `bun`.
import { readFileSync, writeFileSync } from "node:fs";
import { trapKind } from "./trap-kinds.mjs";

const DIR = "data/graph";

/** Les seuls shards typés. */
export const SHARDS = ["q-kanji", "q-vocabulaire"];

/** Pose le tableau sur les sujets qui n'en portent pas. Rend les sujets patchés et le compte. */
export function applyTrapKinds(sujets) {
  let poses = 0;
  const out = sujets.map((s) => {
    if (Array.isArray(s["jlpt:trapKind"])) return s;
    const opts = Array.isArray(s.opts) ? s.opts : [];
    if (!opts.length) return s;
    const notes = Array.isArray(s["jlpt:optionNote"]) ? s["jlpt:optionNote"] : [];
    const ans = s["jlpt:answer"];
    poses++;
    return { ...s, "jlpt:trapKind": opts.map((_, i) => (i === ans ? "" : trapKind(notes[i]))) };
  });
  return { sujets: out, poses };
}

if (process.argv[1]?.endsWith("traps.mjs")) {
  let total = 0;
  for (const shard of SHARDS) {
    const chemin = `${DIR}/${shard}.jsonld`;
    const doc = JSON.parse(readFileSync(chemin, "utf8"));
    const { sujets, poses } = applyTrapKinds(doc["@graph"] ?? []);
    writeFileSync(chemin, JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n");
    console.log(`${shard} : ${poses} question(s) typée(s)`);
    total += poses;
  }
  console.log(`\n${total} au total. Relancer \`bun tools/validate-graph.mjs\` pour confirmer.`);
}
```

- [ ] **Step 4 : lancer le test pour vérifier qu'il passe**

Run: `bun test tools/graph/traps.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5 : mesurer le poids AVANT la pose**

```bash
for f in q-kanji q-vocabulaire; do
  printf "%s brut=%s gz=%s\n" "$f" \
    "$(wc -c < data/graph/$f.jsonld)" \
    "$(gzip -9 -c data/graph/$f.jsonld | wc -c)"
done
```

Noter les quatre nombres — ils servent de référence à l'étape 7.

- [ ] **Step 6 : poser les types sur le corpus**

Run: `bun tools/graph/traps.mjs`
Expected: `q-kanji : 3148 question(s) typée(s)` et `q-vocabulaire : 5901 question(s) typée(s)`

Puis vérifier l'idempotence sur le vrai corpus :

Run: `bun tools/graph/traps.mjs`
Expected: `q-kanji : 0 question(s) typée(s)` et `q-vocabulaire : 0 question(s) typée(s)`

- [ ] **Step 7 : mesurer le delta GZIPPÉ et appliquer la règle de décision**

Relancer la commande de l'étape 5 et calculer `(gz_après - gz_avant) / gz_avant`.

**Règle de décision de la spec § 9 :** si le surcoût **gzippé** dépasse **5 %**, ne pas basculer
soi-même sur un encodage court — **arrêter et le signaler**. Changer l'encodage change la
conception (§ 3.1 et § 4.2), et cette décision appartient à l'auteur.

En deçà de 5 %, continuer. Consigner les chiffres dans le message de commit.

- [ ] **Step 8 : incrémenter le cache du service worker**

`data/graph/*.jsonld` est un fichier **livré** : sans ce bump, les clients installés garderont
l'ancien corpus. Dans `sw.js`, passer `const CACHE = 'jlpt-n3-vN';` à `vN+1`.

- [ ] **Step 9 : valider le graphe et lancer toute la suite**

Run: `bun tools/validate-graph.mjs && bun test`
Expected: `✓ graphe valide`, puis 0 échec.

- [ ] **Step 10 : commit**

```bash
git add tools/graph/traps.mjs tools/graph/traps.test.ts data/graph/q-kanji.jsonld data/graph/q-vocabulaire.jsonld sw.js
git commit -m "feat(traps): pose jlpt:trapKind sur les shards kanji et vocabulaire"
```

---

## Task 3 : le contrôle d'intégrité

**Files:**
- Modify: `tools/graph/integrity.mjs` (fonction `checkQuestion`, après le contrôle de `optionNote`)
- Test: `tools/graph/integrity.test.ts` (ajouts ; créer le fichier s'il n'existe pas)

**Interfaces:**
- Consumes: `KINDS` de `tools/graph/trap-kinds.mjs`.
- Produces: aucune API nouvelle — `checkQuestion(s)` rend des messages supplémentaires.

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter à `tools/graph/integrity.test.ts` :

```ts
import { test, expect } from "bun:test";
import { checkQuestion } from "./integrity.mjs";

const base = {
  "@id": "jlpt:q/1",
  "jlpt:skill": "vocabulaire",
  "jlpt:difficulty": 2,
  opts: ["a", "b", "c", "d"],
  "jlpt:answer": 2,
};

test("trapKind valide ne produit aucune erreur", () => {
  expect(checkQuestion({ ...base, "jlpt:trapKind": ["voisement", "autre", "", "homophone"] })).toEqual([]);
});

test("trapKind de longueur différente des options est une erreur", () => {
  const errs = checkQuestion({ ...base, "jlpt:trapKind": ["voisement", ""] });
  expect(errs.join(" ")).toContain("trapKind");
});

test("trapKind non vide à l'index de la réponse est une erreur", () => {
  const errs = checkQuestion({ ...base, "jlpt:trapKind": ["voisement", "autre", "homophone", "autre"] });
  expect(errs.join(" ")).toContain("réponse");
});

test("un type hors taxonomie est une erreur", () => {
  const errs = checkQuestion({ ...base, "jlpt:trapKind": ["voisement", "inventé", "", "autre"] });
  expect(errs.join(" ")).toContain("inventé");
});

test("trapKind sur une piste hors périmètre est une erreur", () => {
  const errs = checkQuestion({
    ...base, "jlpt:skill": "grammaire", "jlpt:trapKind": ["voisement", "autre", "", "autre"],
  });
  expect(errs.join(" ")).toContain("grammaire");
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Run: `bun test tools/graph/integrity.test.ts`
Expected: FAIL — les quatre derniers cas rendent `[]`

- [ ] **Step 3 : ajouter le contrôle**

En tête de `tools/graph/integrity.mjs`, à côté des autres imports :

```js
import { KINDS } from "./trap-kinds.mjs";

/** Pistes où `jlpt:trapKind` a un sens (cf. traps.mjs). */
const PISTES_TYPEES = new Set(["kanji", "vocabulaire"]);
```

Dans `checkQuestion`, juste après le bloc qui contrôle `optionNote` :

```js
  // `jlpt:trapKind` : tableau parallèle aux options, vide EXACTEMENT à l'index de la réponse,
  // restreint à la taxonomie et aux deux pistes typées. C'est la présence du champ qui définit
  // le périmètre côté runtime — un champ égaré ailleurs ferait compter des erreurs de grammaire
  // comme « non typées », faisant passer une exclusion assumée pour une défaillance.
  const traps = s["jlpt:trapKind"];
  if (traps !== undefined) {
    const t = arr(traps);
    if (!PISTES_TYPEES.has(s["jlpt:skill"])) {
      errs.push(`${id} : trapKind sur la piste ${s["jlpt:skill"]}, hors périmètre`);
    }
    if (t.length !== opts.length) {
      errs.push(`${id} : trapKind de longueur ${t.length} pour ${opts.length} options`);
    } else if (t[answer] !== "") {
      errs.push(`${id} : trapKind ${JSON.stringify(t[answer])} à l'index de la réponse, attendu ""`);
    }
    t.forEach((k, i) => {
      if (i !== answer && !KINDS.includes(k)) {
        errs.push(`${id} : trapKind ${JSON.stringify(k)} hors taxonomie`);
      }
    });
  }
```

- [ ] **Step 4 : lancer les tests et valider le graphe réel**

Run: `bun test tools/graph/integrity.test.ts && bun tools/validate-graph.mjs`
Expected: PASS, puis `✓ graphe valide` — le corpus typé à la Task 2 doit passer sans erreur.

- [ ] **Step 5 : commit**

```bash
git add tools/graph/integrity.mjs tools/graph/integrity.test.ts
git commit -m "feat(traps): contrôle impératif de jlpt:trapKind dans le validateur"
```

---

## Task 4 : la couche pure — époque, libellés, modèle

**Files:**
- Create: `src/features/quiz/traps.ts`
- Test: `src/features/quiz/traps.test.ts`
- Modify: `src/types/quiz.ts`, `src/lib/graph.ts`

**Interfaces:**
- Consumes: `Question` de `src/types/quiz.ts`.
- Produces:
  - `CONF_MAX = 300`, `EPOCH_MS`, `dayNumber(now: Date): number`
  - `type Confusion = [number, number, number]`
  - `asConfusions(raw: Record<string, unknown> | null): Confusion[]`
  - `appendConfusion(ring, ord, choix, jour): Confusion[]`
  - `confusionPatch(ring, ord, choix, correct, jour): Confusion[] | undefined`
  - `KIND_LABELS: Record<string, string>`
  - `kindIndex(questions: Question[]): Map<number, string[]>`
  - `trapModel(confusions, kindByOrd, today, windowDays?): TrapModel`
  - `interface TrapCount { kind: string; recent: number }`
  - `interface TrapModel { active: TrapCount[]; resolved: string[]; untyped: number; outOfScope: number }`

> **Frontière de module.** La forme des confusions vit ici, dans la couche **pure**, et non dans
> `useQuiz.ts` : `useTraps` (Accueil) a besoin de `asConfusions`, et l'importer depuis le hook du
> quiz tirerait tout le moteur dans le chunk de l'Accueil. `traps.ts` est le propriétaire de la
> donnée ; `useQuiz` n'en est qu'un écrivain.

- [ ] **Step 1 : écrire le test qui échoue**

`src/features/quiz/traps.test.ts` :

```ts
import { test, expect } from "bun:test";
import { dayNumber, kindIndex, trapModel, KIND_LABELS, CONF_MAX, asConfusions, appendConfusion } from "./traps.ts";
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
test("la table de libellés couvre les 14 types, autre compris", () => {
  expect(Object.keys(KIND_LABELS).length).toBe(14);
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
```

Ajouter `confusionPatch` à la ligne d'import du fichier de test.

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Run: `bun test src/features/quiz/traps.test.ts`
Expected: FAIL — `Cannot find module './traps.ts'`

- [ ] **Step 3 : exposer le champ au runtime**

Dans `src/types/quiz.ts`, ajouter au sein de `interface Question`, après `tests?: string[];` :

```ts
  /** Type de piège de CHAQUE option (`""` à l'index de la réponse). Présent sur les seules
   *  pistes kanji et vocabulaire : son absence signifie « hors périmètre », à distinguer de
   *  la valeur `"autre"` qui signifie « dans le périmètre, mais non classé ». */
  trap?: string[];
```

Dans `src/lib/graph.ts`, dans `toQuestion`, juste après la ligne qui assigne `tests` :

```ts
  const trap = list(s["jlpt:trapKind"]); if (trap !== undefined) q.trap = trap;
```

- [ ] **Step 4 : écrire la couche pure**

`src/features/quiz/traps.ts` :

```ts
/**
 * Le « graphe de confusion » : par quel TYPE de piège l'apprenant se fait avoir.
 *
 * Le blob de progression ne stocke que l'événement brut — quelle question, quelle option
 * choisie, quel jour. Le type est calculé ICI, à l'affichage, depuis le corpus. C'est le
 * principe qui a motivé la migration vers le graphe : un dérivé stocké finit par se
 * désynchroniser, et dans la donnée utilisateur c'est irréparable. Corollaire : affiner la
 * taxonomie re-type tout l'historique, sans migration.
 *
 * ⚠ `untyped` et `outOfScope` sont DEUX compteurs distincts. Le premier mesure une limite du
 * classifieur (« autre »), le second une exclusion assumée (grammaire, écoute, lecture, cf.
 * tools/graph/traps.mjs). Les additionner ferait passer une décision de conception pour une
 * défaillance, et pousserait à « corriger » ce qui marche comme prévu.
 *
 * Module PUR — aucun effet, aucun accès au store. Les effets vivent dans `useQuiz`/`useTraps`.
 */
import type { Question } from "../../types/quiz.ts";

/** Anneau des événements conservés dans le blob. 300 ≈ 4 Ko : négligeable en Gist. */
export const CONF_MAX = 300;

/** Époque du champ « jour » — un entier à trois chiffres plutôt qu'un horodatage à treize. */
export const EPOCH_MS = Date.UTC(2026, 0, 1);

/** `[ord, indexChoisi, jour]`. */
export type Confusion = [number, number, number];

/** Jours écoulés depuis l'époque. */
export function dayNumber(now: Date): number {
  return Math.floor((now.getTime() - EPOCH_MS) / 864e5);
}

/** Les confusions du blob, ou `[]`. Un blob antérieur au champ ne demande aucune migration. */
export function asConfusions(raw: Record<string, unknown> | null): Confusion[] {
  return Array.isArray(raw?.confusions) ? (raw.confusions as Confusion[]) : [];
}

/** Ajoute un événement à l'anneau borné. Pur — la date est injectée, jamais lue ici. */
export function appendConfusion(
  ring: Confusion[], ord: number, choix: number, jour: number,
): Confusion[] {
  return [...ring, [ord, choix, jour] as Confusion].slice(-CONF_MAX);
}

/**
 * Le patch `confusions` d'une réponse — `undefined` quand il n'y a rien à écrire.
 *
 * On n'enregistre QUE les erreurs : décrémenter sur les réussites obligerait à stocker aussi
 * les bonnes réponses, pour un effet que la récence produit gratuitement (un piège qu'on ne
 * déclenche plus sort de la fenêtre de lui-même). Rendre `undefined` plutôt que l'anneau
 * inchangé évite de réécrire un tableau de 300 entrées à chaque bonne réponse.
 */
export function confusionPatch(
  ring: Confusion[], ord: number, choix: number, correct: boolean, jour: number,
): Confusion[] | undefined {
  return correct ? undefined : appendConfusion(ring, ord, choix, jour);
}

/** Libellés d'affichage — une seule source, comme `SKILL_LABELS` : deux écrans qui retapent
 *  leur table finissent par diverger (« Vocab » contre « Vocabulaire »). */
export const KIND_LABELS: Record<string, string> = {
  "kanji-partage": "Kanji partagé",
  voisement: "Voisement erroné",
  "graphie-inexistante": "Graphie inexistante",
  "kanji-confondu": "Kanji confondu",
  "forme-proche": "Forme proche",
  homophone: "Homophone",
  "lecture-on-kun": "Lecture on / kun",
  "lecture-autre-mot": "Lecture d'un autre mot",
  "lecture-erronee": "Lecture erronée",
  "longueur-voyelle": "Longueur de voyelle",
  "nuance-grammaticale": "Nuance grammaticale",
  "sens-different": "Sens différent",
  registre: "Registre",
  autre: "Non classé",
};

export interface TrapCount { kind: string; recent: number }

export interface TrapModel {
  /** Types encore actifs, triés par fréquence récente décroissante. */
  active: TrapCount[];
  /** Types vus dans l'anneau mais absents de la fenêtre récente. */
  resolved: string[];
  /** Événements DANS le périmètre, classés « autre ». */
  untyped: number;
  /** Événements hors périmètre — grammaire, écoute, lecture. Pas un échec du typage. */
  outOfScope: number;
}

/** Index `ord → types des options`, bâti depuis les shards chargés. Ne contient que les
 *  questions PORTANT le champ : son absence EST le critère de périmètre. Pur. */
export function kindIndex(questions: Question[]): Map<number, string[]> {
  const idx = new Map<number, string[]>();
  for (const q of questions) if (Array.isArray(q.trap)) idx.set(q.id, q.trap);
  return idx;
}

/** Le modèle d'affichage. Pur : `today` et `windowDays` sont injectés, jamais lus d'une horloge. */
export function trapModel(
  confusions: Confusion[],
  kindByOrd: Map<number, string[]>,
  today: number,
  windowDays = 30,
): TrapModel {
  const recents = new Map<string, number>();
  const vus = new Set<string>();
  let untyped = 0, outOfScope = 0;

  for (const [ord, choix, jour] of confusions) {
    const kinds = kindByOrd.get(ord);
    if (!kinds) { outOfScope++; continue; }
    const kind = kinds[choix];
    if (!kind || kind === "autre") { untyped++; continue; }
    vus.add(kind);
    if (today - jour < windowDays) recents.set(kind, (recents.get(kind) ?? 0) + 1);
  }

  const active = [...recents]
    .map(([kind, recent]) => ({ kind, recent }))
    .sort((a, b) => b.recent - a.recent || a.kind.localeCompare(b.kind));

  return {
    active,
    resolved: [...vus].filter((k) => !recents.has(k)).sort(),
    untyped,
    outOfScope,
  };
}
```

- [ ] **Step 5 : lancer les tests et le typecheck**

Run: `bun test src/features/quiz/traps.test.ts && bun run typecheck`
Expected: PASS — 9 tests, puis `tsc --noEmit` sans erreur.

- [ ] **Step 6 : commit**

```bash
git add src/features/quiz/traps.ts src/features/quiz/traps.test.ts src/types/quiz.ts src/lib/graph.ts
git commit -m "feat(traps): couche pure du modele de confusion + champ trap au runtime"
```

---

## Task 5 : enregistrer l'événement

**Files:**
- Modify: `src/features/quiz/useQuiz.ts` (fonction `choose`)
- Test: `src/features/quiz/confusions.test.ts`

**Interfaces:**
- Consumes: `asConfusions`, `confusionPatch`, `dayNumber` de `./traps.ts` ; `writeProgress`, `readRawProgress` de `src/lib/storage.ts`.
- Produces: champ `confusions: Confusion[]` dans le blob `PROGRESS_KEY`.

> Les helpers sont **déjà écrits et testés** (Task 4). Cette tâche est du câblage — d'où un test
> qui vise le risque propre au câblage, et non une redite des tests purs.

- [ ] **Step 1 : écrire le test qui échoue**

`src/features/quiz/confusions.test.ts` :

```ts
import { test, expect, beforeEach } from "bun:test";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { asConfusions } from "./traps.ts";

beforeEach(() => { localStorage.clear(); });

// ⚠ Le risque propre au câblage n'est pas le calcul de l'anneau (pur et testé à part), c'est
// la PERTE SILENCIEUSE de l'historique : `writeProgress` ne fusionne en profondeur que `skill`,
// tout le reste est remplacé tel quel. Une feature qui patcherait le blob sans repasser les
// confusions les effacerait — sans erreur, sans trace. C'est exactement l'accident contre
// lequel CLAUDE.md met en garde (« réécrire le blob entier efface les champs des autres
// features »), et il ne se voit qu'ici.
test("un patch venu d'une autre feature ne perd pas les confusions", () => {
  writeProgress({ confusions: [[1174, 0, 201]] });
  writeProgress({ total: 5 });
  writeProgress({ skill: { kanji: { R: 1500, t: 3 } } });
  expect(asConfusions(readRawProgress())).toEqual([[1174, 0, 201]]);
});

test("le champ survit à un aller-retour JSON complet", () => {
  writeProgress({ confusions: [[1174, 0, 201], [4609, 3, 203]] });
  const relu = asConfusions(readRawProgress());
  expect(relu).toEqual([[1174, 0, 201], [4609, 3, 203]]);
  expect(relu[0][0]).toBe(1174);            // et reste bien un tuple de nombres
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Run: `bun test src/features/quiz/confusions.test.ts`
Expected: FAIL — `Cannot find module './traps.ts'` si la Task 4 n'est pas faite ; sinon les deux
cas passent déjà (`writeProgress` étant générique). **Si les deux passent d'emblée, c'est le
résultat attendu** : le test est un garde-fou de régression, il fige un comportement de
`writeProgress` dont ce lot devient dépendant.

- [ ] **Step 3 : câbler `choose`**

Dans `src/features/quiz/useQuiz.ts`, ajouter aux imports :

```ts
import { asConfusions, confusionPatch, dayNumber } from "./traps.ts";
```

Dans `choose`, après le calcul de `nextWrong` :

```ts
    const nextConfusions = confusionPatch(asConfusions(raw), q.id, i, correct, dayNumber(new Date()));
```

Puis, dans l'objet passé à `writeProgress`, à côté de `...(mastered !== undefined ? { mastered } : {})` :

```ts
      ...(nextConfusions !== undefined ? { confusions: nextConfusions } : {}),
```

- [ ] **Step 4 : lancer les tests**

Run: `bun test src/features/quiz/confusions.test.ts && bun run typecheck`
Expected: PASS — 2 tests, puis `tsc --noEmit` sans erreur.

- [ ] **Step 5 : lancer TOUTE la suite**

Run: `bun test`
Expected: 0 échec — `choose` est couvert par des tests existants, qui ne doivent pas bouger.

- [ ] **Step 6 : commit**

```bash
git add src/features/quiz/useQuiz.ts src/features/quiz/confusions.test.ts
git commit -m "feat(traps): enregistre l'option choisie sur chaque erreur"
```

---

## Task 6 : le panneau de l'Accueil

**Files:**
- Create: `src/features/dashboard/useTraps.ts`, `src/features/dashboard/TrapPanel.tsx`
- Test: `src/features/dashboard/TrapPanel.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `trapModel`, `kindIndex`, `dayNumber`, `asConfusions`, `KIND_LABELS`, `type TrapModel` de `src/features/quiz/traps.ts` ; `loadSkill` de `src/lib/graph.ts` ; `readRawProgress` de `src/lib/storage.ts` ; `PANEL`, `H2` de `src/ui/styles.ts`.
- Produces: `useTraps(): TrapModel | null`, `<TrapPanel model={…} />`.

- [ ] **Step 1 : écrire le test qui échoue**

`src/features/dashboard/TrapPanel.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TrapPanel } from "./TrapPanel.tsx";

test("sans modèle, invite à répondre plutôt que d'afficher un tableau vide", () => {
  const html = renderToStaticMarkup(<TrapPanel model={null} />);
  expect(html).toContain("pas encore");
});

test("liste les pièges actifs avec leur libellé français", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [{ kind: "voisement", recent: 8 }], resolved: [], untyped: 0, outOfScope: 0 }} />,
  );
  expect(html).toContain("Voisement erroné");
  expect(html).toContain("8");
});

test("montre les types résolus", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [], resolved: ["lecture-on-kun"], untyped: 0, outOfScope: 0 }} />,
  );
  expect(html).toContain("Lecture on / kun");
  expect(html).toContain("résolu");
});

test("distingue les non typées des hors périmètre — jamais un seul chiffre", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [], resolved: [], untyped: 12, outOfScope: 34 }} />,
  );
  expect(html).toContain("12");
  expect(html).toContain("34");
  expect(html).toContain("hors périmètre");
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Run: `bun test src/features/dashboard/TrapPanel.test.tsx`
Expected: FAIL — `Cannot find module './TrapPanel.tsx'`

- [ ] **Step 3 : écrire le panneau**

`src/features/dashboard/TrapPanel.tsx` :

```tsx
import { KIND_LABELS, type TrapModel } from "../../features/quiz/traps.ts";
import { PANEL, H2 } from "../../ui/styles.ts";

const libelle = (k: string): string => KIND_LABELS[k] ?? k;

/** Panneau de diagnostic : par quel type de piège l'apprenant se fait avoir. Sans logique —
 *  le modèle vient de `trapModel`, pur et testé à part. */
export function TrapPanel({ model }: { model: TrapModel | null }) {
  if (!model || (!model.active.length && !model.resolved.length)) {
    return (
      <section className={PANEL}>
        <h2 className={H2}>Tes pièges</h2>
        <p className="text-fg-dim text-sm m-0">
          Pas encore assez d&#39;erreurs pour dégager une tendance — réponds à quelques questions
          de vocabulaire ou de kanji.
        </p>
      </section>
    );
  }
  const max = Math.max(1, ...model.active.map((a) => a.recent));
  return (
    <section className={PANEL}>
      <h2 className={H2}>Tes pièges</h2>
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {model.active.map((a) => (
          <li key={a.kind} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-fg">{libelle(a.kind)}</span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="text-accent tracking-widest">
                {"●".repeat(Math.round((a.recent / max) * 6)).padEnd(6, "○")}
              </span>
              <span className="text-fg-dim tabular-nums">{a.recent}</span>
            </span>
          </li>
        ))}
        {model.resolved.map((k) => (
          <li key={k} className="flex items-center justify-between text-sm text-fg-dim">
            <span>{libelle(k)}</span>
            <span className="text-status-completed">✓ résolu</span>
          </li>
        ))}
      </ul>
      <p className="text-meta text-fg-dim mt-3 mb-0">
        {model.untyped} non typée(s) · {model.outOfScope} hors périmètre (grammaire, écoute, lecture)
      </p>
    </section>
  );
}
```

- [ ] **Step 4 : lancer le test pour vérifier qu'il passe**

Run: `bun test src/features/dashboard/TrapPanel.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5 : écrire le hook de chargement**

`src/features/dashboard/useTraps.ts` :

```ts
import { useEffect, useState } from "react";
import { loadSkill } from "../../lib/graph.ts";
import { readRawProgress } from "../../lib/storage.ts";
import { asConfusions, dayNumber, kindIndex, trapModel, type TrapModel } from "../quiz/traps.ts";

/**
 * Le modèle des pièges, chargé PARESSEUSEMENT.
 *
 * ⚠ Les deux shards typés sont les plus gros du corpus : les charger sur l'Accueil pour n'y
 * rien afficher coûterait plusieurs secondes au démarrage. On ne les demande donc que si des
 * confusions existent — le cas d'un nouvel arrivant ne coûte rien. `loadSkill` est mémoïsé :
 * un utilisateur qui a déjà fait un quiz dans la session ne repaye pas le fetch.
 */
export function useTraps(): TrapModel | null {
  const [model, setModel] = useState<TrapModel | null>(null);
  useEffect(() => {
    const confusions = asConfusions(readRawProgress());
    if (!confusions.length) return;
    let vivant = true;
    Promise.all([loadSkill("kanji"), loadSkill("vocabulaire")])
      .then(([k, v]) => {
        if (!vivant) return;
        setModel(trapModel(confusions, kindIndex([...k, ...v]), dayNumber(new Date())));
      })
      .catch(() => { /* hors ligne : le panneau reste sur son état vide */ });
    return () => { vivant = false; };
  }, []);
  return model;
}
```

- [ ] **Step 6 : monter le panneau sur l'Accueil**

Dans `src/App.tsx`, ajouter aux imports :

```tsx
import { TrapPanel } from "./features/dashboard/TrapPanel.tsx";
import { useTraps } from "./features/dashboard/useTraps.ts";
```

Ajouter `traps` aux props de `DashboardView` :

```tsx
export function DashboardView({ model, days, scores, coverage, traps }: {
  model: DashboardModel | null; days: number; scores: number[];
  coverage?: Record<Skill, SkillCoverage> | null;
  traps?: TrapModel | null;
}) {
```

Avec l'import de type correspondant :

```tsx
import type { TrapModel } from "./features/quiz/traps.ts";
```

Dans le JSX de `DashboardView`, entre `<Dashboard …/>` et la section « Progression » :

```tsx
      <TrapPanel model={traps ?? null} />
```

Dans `App`, appeler le hook et le passer :

```tsx
  const traps = useTraps();
```
```tsx
  return <DashboardView model={model} days={daysUntilExam(now)} scores={scores} coverage={coverage} traps={traps} />;
```

- [ ] **Step 7 : lancer toute la suite et le typecheck**

Run: `bun run typecheck && bun test`
Expected: `tsc --noEmit` sans erreur, 0 échec.

- [ ] **Step 8 : commit**

```bash
git add src/features/dashboard/TrapPanel.tsx src/features/dashboard/TrapPanel.test.tsx src/features/dashboard/useTraps.ts src/App.tsx
git commit -m "feat(traps): panneau de diagnostic des pieges sur l'Accueil"
```

---

## Task 7 : nommer le type dans le corrigé

**Files:**
- Modify: `src/features/quiz/Corrige.tsx`
- Test: `src/features/quiz/quiz.test.tsx` (ajouts)

**Interfaces:**
- Consumes: `KIND_LABELS` de `./traps.ts` ; `Question.trap`.
- Produces: aucune API nouvelle.

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter à `src/features/quiz/quiz.test.tsx` :

```tsx
test("le corrige nomme le type de piege de l'option choisie", () => {
  const qt = { ...q, cat: "vocabulaire" as const, a: 2,
    o: ["影像", "映像", "影響", "反響"],
    od: ["partage 影", "映 ressemble à 影", "Correct", "partage 響"],
    trap: ["kanji-partage", "forme-proche", "", "kanji-partage"] };
  const html = renderToStaticMarkup(<Corrige question={qt} correct={false} />);
  expect(html).toContain("Kanji partag");
});

test("une question sans champ trap n'affiche aucun type", () => {
  const html = renderToStaticMarkup(<Corrige question={q} correct={false} />);
  expect(html).not.toContain("Type de pi");
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

Run: `bun test src/features/quiz/quiz.test.tsx`
Expected: FAIL — le premier cas ne trouve pas `Kanji partag`

- [ ] **Step 3 : implémenter**

Dans `src/features/quiz/Corrige.tsx`, ajouter à l'import :

```tsx
import { KIND_LABELS } from "./traps.ts";
```

Dans le bloc `{!correct && hasOd && (…)}`, sous la liste des notes d'option, ajouter :

```tsx
      {!correct && Array.isArray(question.trap) && (() => {
        // Le type de piège n'a de sens que sur une option FAUSSE : à l'index de la réponse,
        // le champ vaut "" par construction. `autre` n'est pas affiché — un « Non classé »
        // n'apprend rien à l'apprenant et sert seulement au diagnostic agrégé.
        const kinds = question.trap.filter((k, i) => k && k !== "autre" && i !== question.a);
        const uniques = [...new Set(kinds)];
        if (!uniques.length) return null;
        return (
          <p className="text-meta text-fg-dim mt-2 mb-0">
            Type de piège : {uniques.map((k) => KIND_LABELS[k] ?? k).join(" · ")}
          </p>
        );
      })()}
```

- [ ] **Step 4 : lancer les tests**

Run: `bun test src/features/quiz/quiz.test.tsx && bun run typecheck`
Expected: PASS, puis `tsc --noEmit` sans erreur.

- [ ] **Step 5 : vérifier l'ensemble et construire**

Run: `bun run typecheck && bun test && bun tools/validate-graph.mjs && bun run build`
Expected: tout vert, `✓ graphe valide`, build sans erreur.

- [ ] **Step 6 : commit**

```bash
git add src/features/quiz/Corrige.tsx src/features/quiz/quiz.test.tsx
git commit -m "feat(traps): nomme le type de piege dans le corrige"
```

---

## Vérification finale

- [ ] `bun run typecheck` — sans erreur
- [ ] `bun test` — 0 échec
- [ ] `bun tools/validate-graph.mjs` — `✓ graphe valide`
- [ ] `bun tools/graph/traps.mjs` une seconde fois — `0 question(s) typée(s)` sur les deux shards (idempotence sur le corpus réel)
- [ ] `sw.js` : `CACHE` incrémenté (Task 2, étape 8)
- [ ] Le delta gzippé des deux shards est consigné dans le message de commit de la Task 2
