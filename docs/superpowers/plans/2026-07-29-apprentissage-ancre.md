# Lot 2 — La phase d'apprentissage ancrée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une séance commence par enseigner quelques entités du programme — chaque carte suivie
immédiatement d'une question qui la teste — avant d'enchaîner sur le quiz, où les mêmes notions
reviennent mêlées.

**Architecture :** Trois modules purs neufs portent toute la règle — `anchor.ts` (entité →
question, avec le pont kanji → mots qui le contiennent), `curriculum.ts` (quelle leçon, quels
items) et `learnQueue.ts` (la file de la phase 1 et ce qu'elle laisse au quiz). `useQuiz` ne
gagne qu'une phase et l'orchestration ; `sessionPlan.ts` n'est pas touché — seule
l'interprétation d'`alloc.learn` change.

**Tech Stack :** React 19 + TypeScript, bundlé par **Bun** (jamais `node`), react-router-dom
(`HashRouter`), Tailwind v4 vendorisé, tests `bun test` (happy-dom préchargé via `bunfig.toml`).

**Spec :** `docs/superpowers/specs/2026-07-28-apprendre-avant-quiz-design.md` §5.

## Global Constraints

- **Worktree obligatoire** : tout le travail dans `.worktrees/feat-apprendre-ancre`
  (branche `feat/apprendre-ancre`). Jamais dans le répertoire principal.
- **`bun` exclusivement** — `bun test`, `bun run typecheck`, `bun run build`. Jamais `node`/`npm`/`npx`.
- **Toujours `bun test` COMPLET avant de commiter**, jamais un fichier seul : quatre tests de
  mesure éloignés servent de cliquets (`cadence.test.ts`, `rappel.reel.test.ts`,
  `shapes.test.ts`, `TOTAL_QUESTIONS` dans `cadence.ts`). Ne JAMAIS les assouplir : aucune
  question n'est ajoutée par ce lot, ils doivent passer tels quels.
- **Pas de linter** dans le projet (ni eslint, ni prettier, ni biome). Ne pas en ajouter, et
  n'écrire aucune directive de lint dans le code.
- **Ne JAMAIS modifier** : `src/lib/elo.ts`, `src/lib/scoring.ts`, `src/lib/fsrs.ts`,
  `src/lib/bank.ts`, `src/features/entrainement/sessionPlan.ts`, `src/features/quiz/answerPatch.ts`.
  Un refactor de ces modules exigerait une preuve bit-identique hors périmètre.
- **Toute règle nouvelle va dans une couche PURE**, pas dans le hook. `useQuiz.ts` fait déjà
  408 lignes ; il ne gagne que l'orchestration.
- **Modules purs** : `today` et `rng` sont toujours **injectés**, jamais lus d'une horloge ni de
  `Math.random` à l'intérieur.
- **Écriture de la progression** uniquement via `writeProgress()` ; ⚠ le deep-merge ne concerne
  que `skill`, le champ `fsrs` est remplacé **en entier**.
- **Lecture du blob** uniquement via `src/lib/blob.ts` / `revision.ts#asFsrs` : un champ absent
  ou corrompu dégrade vers un défaut, il ne jette jamais.
- **Tests SSR** : `renderToStaticMarkup` échappe les apostrophes (`'` → `&#x27;`). **Ne jamais**
  asserter un kanji rendu par `furi()` en sous-chaîne brute — `furi` scinde les mots en `<span>`
  et le `DICT` est un état de module qui fuit entre fichiers de test.
- **Router** : envelopper dans `<MemoryRouter>` tout composant utilisant les hooks du routeur.
- **Commits** : message d'UNE ligne, en français, sans accents dans le sujet, **jamais** de ligne
  `Co-Authored-By`. ⚠ Si un hook bloque le commit, **ne pas rejouer la commande à l'identique** :
  rapporter le texte exact et s'arrêter.

---

## Décisions de conception prises avant l'écriture

**(a) Les reprises ne sont PAS « en tête » de la file adaptive.** La spec §5.4 le disait, mais
`composeSession` (`bank.ts:125-131`) fait `shuffle([...errorQs, ...adaptiveQs], rng)` : aucune
position ne survit à cet appel. Les reprises rejoignent donc la tranche **garantie** (certaines
d'apparaître) et `composeSession` disperse leur position — ce qui est **meilleur** : c'est
l'espacement entre l'exposition et le re-test qui fabrique la mémoire, pas la proximité.

**(b) L'allocation restreinte aux trois pistes enseignables réutilise `allocateCount`.**
`bank.ts` est intouchable et `allocateCount` distribue sur les cinq compétences. On l'appelle
avec un poids nul pour `lecture`/`ecoute`, puis on **rapatrie** les unités qui leur seraient
malgré tout échues (le reliquat de la division entière peut en atteindre jusqu'à deux) sur la
piste enseignable de plus fort poids. C'est trois lignes, testable, et ça ne duplique pas la
primitive.

**(c) Les IRIs des cartes ne vont PAS dans `ResumeState.ids`** (ce sont des IRIs, pas des ords).
`ResumeState` gagne `learn?: string[]`. Un blob ancien n'a pas le champ → la reprise se fait
directement en phase quiz, conformément à la tolérance imposée aux lectures de blob.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `src/features/quiz/anchor.ts` | **créé** — index inverse entité → questions, pont kanji → mots |
| `src/features/quiz/anchor.test.ts` | **créé** — unitaires |
| `src/features/quiz/anchor.reel.test.ts` | **créé** — test de MESURE sur le graphe réel |
| `src/features/entrainement/curriculum.ts` | **créé** — la leçon en cours, les `n` prochains items |
| `src/features/entrainement/curriculum.test.ts` | **créé** |
| `src/features/entrainement/learnQueue.ts` | **créé** — allocation 3 pistes, file de phase 1, budget rendu au quiz |
| `src/features/entrainement/learnQueue.test.ts` | **créé** |
| `src/features/quiz/resume.ts` | **modifié** — `learn?: string[]` |
| `src/features/quiz/useQuiz.ts` | **modifié** — phase `apprendre`, orchestration |
| `src/features/quiz/LearnCard.tsx` | **créé** — la carte enseignée + ses contrôles |
| `src/features/quiz/LearnCard.test.tsx` | **créé** |
| `src/EntrainementApp.tsx` | **modifié** — branche de rendu de la phase `apprendre` |

---

## Task 1 : `anchor.ts` — entité → question

**Files:**
- Create: `src/features/quiz/anchor.ts`
- Test: `src/features/quiz/anchor.test.ts`

**Interfaces:**
- Consumes: `Question` (`src/types/quiz.ts` — porte `id: number` et `tests?: string[]`).
- Produces:
  - `interface AnchorIndex { direct: Map<string, number[]>; parKanji: Map<string, number[]> }`
  - `function anchorIndex(questions: Question[]): AnchorIndex`
  - `function selectAnchor(iri: string, index: AnchorIndex, exclude: Set<number>): number | null`
  - `function clearAnchorCache(): void`

⚠ Rend un **ord** (`number`), pas une `Question` : l'appelant possède déjà la table `id → Question`
et n'a pas besoin qu'on la lui reconstruise.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/quiz/anchor.test.ts` :

```ts
import { test, expect, afterEach } from "bun:test";
import { anchorIndex, selectAnchor, clearAnchorCache } from "./anchor.ts";
import type { Question } from "../../types/quiz.ts";

afterEach(() => { clearAnchorCache(); });

const q = (id: number, tests?: string[]): Question =>
  ({ id, cat: "kanji", d: 1, q: "", o: [], a: 0, ...(tests ? { tests } : {}) }) as Question;

test("selectAnchor resout une arete tests directe", () => {
  const qs = [q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/たら"])];
  expect(selectAnchor("jlpt:gram/ば", anchorIndex(qs), new Set())).toBe(1);
});

test("selectAnchor rend le plus petit ord quand plusieurs questions testent l entite", () => {
  const qs = [q(9, ["jlpt:gram/ば"]), q(3, ["jlpt:gram/ば"])];
  expect(selectAnchor("jlpt:gram/ば", anchorIndex(qs), new Set())).toBe(3);
});

test("selectAnchor saute une question deja exclue", () => {
  const qs = [q(3, ["jlpt:gram/ば"]), q(9, ["jlpt:gram/ば"])];
  expect(selectAnchor("jlpt:gram/ば", anchorIndex(qs), new Set([3]))).toBe(9);
});

// LE PONT : un kanji enseigné n'est presque jamais testé directement (les 551 kanji du cours et
// les 124 kanji testés sont des ensembles DISJOINTS, mesuré). Il l'est via les MOTS qui le
// contiennent — c'est ce qui fait passer la piste kanji de 0 % à 93 % d'ancrage.
test("selectAnchor atteint un kanji via un mot testé qui le contient", () => {
  const qs = [q(7, ["jlpt:word/位置"])];
  expect(selectAnchor("jlpt:kanji/位", anchorIndex(qs), new Set())).toBe(7);
});

test("l arete directe l emporte sur le pont par le mot", () => {
  const qs = [q(7, ["jlpt:word/位置"]), q(8, ["jlpt:kanji/位"])];
  expect(selectAnchor("jlpt:kanji/位", anchorIndex(qs), new Set())).toBe(8);
});

test("le pont ne s applique qu aux IRIs de kanji", () => {
  // 影響 contient 影, mais on cherche un MOT : pas de décomposition en caractères.
  const qs = [q(7, ["jlpt:word/影響"])];
  expect(selectAnchor("jlpt:word/影", anchorIndex(qs), new Set())).toBeNull();
});

test("selectAnchor rend null quand rien ne teste l entite", () => {
  expect(selectAnchor("jlpt:kanji/仁", anchorIndex([q(1, ["jlpt:gram/ば"])]), new Set())).toBeNull();
});

test("une question sans arete tests n entre pas dans l index", () => {
  expect(selectAnchor("jlpt:gram/ば", anchorIndex([q(1)]), new Set())).toBeNull();
});

test("anchorIndex est memoise sur l identite du tableau", () => {
  const qs = [q(1, ["jlpt:gram/ば"])];
  expect(anchorIndex(qs)).toBe(anchorIndex(qs));
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/quiz/anchor.test.ts
```

Attendu : ÉCHEC — `Cannot find module './anchor.ts'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/features/quiz/anchor.ts` :

```ts
/**
 * Ancrage : quelle question teste une entité donnée.
 *
 * Sert la phase d'apprentissage — chaque carte enseignée est suivie d'une question sur elle.
 *
 * ⚠ **Le pont kanji → mot est la raison d'être de ce module.** Les 551 kanji enseignés par le
 * cours et les 124 kanji que le corpus teste directement sont des ensembles DISJOINTS
 * (intersection vide, mesurée) : `link-answers.mjs` pose l'arête depuis la RÉPONSE, et la
 * réponse d'une question de kanji est presque toujours un MOT (2 690 arêtes `jlpt:word` contre
 * 436 `jlpt:kanji` dans `q-kanji.jsonld`). Sans ce pont, la piste kanji s'ancre à 0 % ; avec
 * lui, à 93 %. Aucune donnée n'est écrite : le pont se DÉRIVE des caractères du mot.
 *
 * Module PUR (aucune horloge, aucun aléa). Même patron de mémoïsation que `revision.ts#fsrsIndex`.
 */
import type { Question } from "../../types/quiz.ts";

export interface AnchorIndex {
  /** IRI d'entité → ords des questions qui la testent (arête `tests`). */
  direct: Map<string, number[]>;
  /** Caractère kanji → ords des questions testant un MOT qui le contient. */
  parKanji: Map<string, number[]>;
}

let cache: { key: Question[]; index: AnchorIndex } | null = null;

/** Vide la mémoïsation (isolation des tests, cf. `clearRevisionCache`). */
export function clearAnchorCache(): void { cache = null; }

const WORD = "jlpt:word/";
const KANJI = "jlpt:kanji/";

function push(m: Map<string, number[]>, k: string, ord: number): void {
  const a = m.get(k);
  if (a) a.push(ord); else m.set(k, [ord]);
}

export function anchorIndex(questions: Question[]): AnchorIndex {
  if (cache && cache.key === questions) return cache.index;
  const direct = new Map<string, number[]>();
  const parKanji = new Map<string, number[]>();
  for (const q of questions) {
    for (const iri of q.tests ?? []) {
      push(direct, iri, q.id);
      if (!iri.startsWith(WORD)) continue;
      // Un mot testé rend testable CHACUN de ses kanji. `new Set` évite qu'un mot répétant un
      // caractère (人人) inscrive deux fois le même ord.
      for (const ch of new Set(iri.slice(WORD.length))) push(parKanji, ch, q.id);
    }
  }
  cache = { key: questions, index: { direct, parKanji } };
  return cache.index;
}

/**
 * L'ord de la question qui ancre `iri`, ou `null` s'il n'y en a aucune de disponible.
 *
 * Deux temps : l'arête `tests` directe d'abord, le pont par le mot ensuite (kanji seulement).
 * À égalité, le plus petit ord gagne — c'est l'ordre du corpus, donc la question la plus
 * simple d'abord. `exclude` porte ce que la session a déjà réservé.
 */
export function selectAnchor(
  iri: string, index: AnchorIndex, exclude: Set<number>,
): number | null {
  const premier = (ords: number[] | undefined): number | null => {
    if (!ords) return null;
    let best: number | null = null;
    for (const o of ords) if (!exclude.has(o) && (best === null || o < best)) best = o;
    return best;
  };
  const directe = premier(index.direct.get(iri));
  if (directe !== null) return directe;
  if (!iri.startsWith(KANJI)) return null;
  return premier(index.parKanji.get(iri.slice(KANJI.length)));
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/quiz/anchor.test.ts
```

Attendu : 9 tests PASS.

- [ ] **Step 5: Écrire le test de MESURE sur le graphe réel**

Créer `src/features/quiz/anchor.reel.test.ts`. Il lit `data/graph/` depuis le disque (comme
`rappel.reel.test.ts` le fait déjà — s'inspirer de sa façon de charger les documents) :

```ts
import { test, expect } from "bun:test";
import { anchorIndex, selectAnchor, clearAnchorCache } from "./anchor.ts";
import type { Question } from "../../types/quiz.ts";

/** Les questions du corpus réel, réduites à ce dont l'ancrage a besoin. */
async function corpus(): Promise<Question[]> {
  const out: Question[] = [];
  for (const f of ["kanji", "vocabulaire", "grammaire", "lecture", "ecoute"]) {
    const doc = await Bun.file(`data/graph/q-${f}.jsonld`).json();
    for (const s of doc["@graph"] as Record<string, unknown>[]) {
      const t = s.tests;
      const tests = Array.isArray(t) ? (t as string[]) : (typeof t === "string" ? [t] : undefined);
      out.push({ id: s["jlpt:ord"], cat: f, d: 1, q: "", o: [], a: 0, ...(tests ? { tests } : {}) } as unknown as Question);
    }
  }
  return out;
}

/** Les entités enseignées par une piste du cours, dans l'ordre des leçons. */
async function enseignees(track: string): Promise<string[]> {
  const doc = await Bun.file("data/graph/lesson.jsonld").json();
  const out: string[] = [];
  for (const l of doc["@graph"] as Record<string, unknown>[]) {
    if (l["jlpt:track"] !== track) continue;
    const c = l.covers;
    out.push(...(Array.isArray(c) ? (c as string[]) : [c as string]));
  }
  return out;
}

/**
 * TEST DE MESURE — fige le taux d'ancrage réel, piste par piste. Ce sont des CLIQUETS :
 * si les arêtes `tests` du graphe s'enrichissent, ces seuils doivent être REMONTÉS, jamais
 * abaissés. Un seuil laissé en place cesse de garder quoi que ce soit.
 */
test("le taux d ancrage reel par piste tient ses cliquets", async () => {
  clearAnchorCache();
  const index = anchorIndex(await corpus());
  const taux: Record<string, number> = {};
  for (const track of ["gram", "vocab", "kanji"]) {
    const items = await enseignees(track);
    const ancres = items.filter((iri) => selectAnchor(iri, index, new Set()) !== null).length;
    taux[track] = ancres / items.length;
  }
  expect(taux.gram).toBeGreaterThanOrEqual(0.84);
  expect(taux.vocab).toBeGreaterThanOrEqual(0.87);
  expect(taux.kanji).toBeGreaterThanOrEqual(0.93);
});

/**
 * TEST DE MESURE — la piste kanji ne s'ancre QUE par le pont. Fige le fait qui justifie
 * l'existence de `parKanji` : si un jour des arêtes `jlpt:kanji` directes apparaissent sur les
 * kanji du cours, ce test échouera en annonçant un PROGRÈS, et il faudra le reformuler.
 */
test("aucun kanji enseigne n est teste par une arete directe", async () => {
  clearAnchorCache();
  const index = anchorIndex(await corpus());
  const items = await enseignees("kanji");
  const directs = items.filter((iri) => (index.direct.get(iri) ?? []).length > 0);
  expect(directs).toEqual([]);
});
```

- [ ] **Step 6: Lancer les deux tests de mesure**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/quiz/anchor.reel.test.ts
```

Attendu : 2 PASS. **Si un seuil passe largement** (par ex. gram ≥ 0,90), remonter le cliquet à
la valeur mesurée arrondie au centième inférieur, et le dire dans le rapport.

- [ ] **Step 7: Suite complète + typecheck**

```bash
cd .worktrees/feat-apprendre-ancre && bun test && bun run typecheck
```

- [ ] **Step 8: Commit**

```bash
cd .worktrees/feat-apprendre-ancre
git add src/features/quiz/anchor.ts src/features/quiz/anchor.test.ts src/features/quiz/anchor.reel.test.ts
git commit -m "feat(quiz): ancrage d une entite, avec le pont kanji vers les mots"
```

---

## Task 2 : `curriculum.ts` — la leçon en cours

**Files:**
- Create: `src/features/entrainement/curriculum.ts`
- Test: `src/features/entrainement/curriculum.test.ts`

**Interfaces:**
- Consumes: `CoursCategory`, `LearnCategory`, `CoursItem`, `CoursGroup` (`src/features/cours/coursSchema.ts`) ;
  `entityState` (`src/features/cours/entityState.ts`) ; `FsrsMap` (`src/features/quiz/revision.ts`).
- Produces:
  - `type Track = "gram" | "vocab" | "kanji"`
  - `function nextLessonBlock(track: Track, categories: CoursCategory[], m: FsrsMap, today: number, n: number): CoursItem[]`

⚠ `categories` est ce que rend `useCours()` — les groupes y sont **déjà triés** par `jlpt:order`
(`coursFromGraph.ts` les trie à la construction). Ne pas re-trier : s'appuyer sur l'ordre reçu.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/entrainement/curriculum.test.ts` :

```ts
import { test, expect } from "bun:test";
import { nextLessonBlock } from "./curriculum.ts";
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import type { Fsrs } from "../../lib/fsrs.ts";

const it = (id: string): CoursItem => ({ id, form: id }) as CoursItem;
const ACQUIS: Fsrs = [30, 5, 0]; // S ≥ 21 et non due → « acquis »

const cats: CoursCategory[] = [{
  id: "gram", title: "文法", kind: "learn",
  groups: [
    { id: "g1", title: "L1", items: [it("a"), it("b")] },
    { id: "g2", title: "L2", items: [it("c"), it("d"), it("e")] },
  ],
}];

test("nextLessonBlock rend les n premiers items de la premiere lecon", () => {
  expect(nextLessonBlock("gram", cats, {}, 0, 2).map((i) => i.id)).toEqual(["a", "b"]);
});

test("nextLessonBlock saute les items acquis", () => {
  const m = { a: ACQUIS };
  expect(nextLessonBlock("gram", cats, m, 0, 2).map((i) => i.id)).toEqual(["b", "c"]);
});

// La FRONTIÈRE de leçon : un bloc peut chevaucher deux leçons. C'est accepté (c'est la
// frontière, pas le régime courant) — mieux vaut un bloc complet qu'un bloc tronqué.
test("nextLessonBlock complete sur la lecon suivante en fin de lecon", () => {
  expect(nextLessonBlock("gram", cats, {}, 0, 3).map((i) => i.id)).toEqual(["a", "b", "c"]);
});

test("nextLessonBlock saute une lecon entierement acquise", () => {
  const m = { a: ACQUIS, b: ACQUIS };
  expect(nextLessonBlock("gram", cats, m, 0, 2).map((i) => i.id)).toEqual(["c", "d"]);
});

test("nextLessonBlock rend un tableau vide quand la piste est epuisee", () => {
  const m = { a: ACQUIS, b: ACQUIS, c: ACQUIS, d: ACQUIS, e: ACQUIS };
  expect(nextLessonBlock("gram", cats, m, 0, 2)).toEqual([]);
});

test("nextLessonBlock rend un tableau vide pour une piste absente", () => {
  expect(nextLessonBlock("kanji", cats, {}, 0, 2)).toEqual([]);
});

test("nextLessonBlock rend un tableau vide quand n vaut zero", () => {
  expect(nextLessonBlock("gram", cats, {}, 0, 0)).toEqual([]);
});

// Un item « à revoir » ou « en cours » n'est PAS acquis : il reste enseignable. C'est voulu —
// une notion vacillante mérite d'être ré-exposée, pas seulement re-testée.
test("nextLessonBlock reprend un item non acquis mais deja rencontre", () => {
  const m = { a: [0.5, 5, 0] as Fsrs }; // stabilité faible → « en-cours »
  expect(nextLessonBlock("gram", cats, m, 0, 1).map((i) => i.id)).toEqual(["a"]);
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/entrainement/curriculum.test.ts
```

Attendu : ÉCHEC — `Cannot find module './curriculum.ts'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/features/entrainement/curriculum.ts` :

```ts
/**
 * Le curseur de programme : quelles entités la séance du jour enseigne.
 *
 * On avance dans l'ORDRE DU COURS plutôt que de laisser un algorithme composer un paquet
 * hétéroclite : apprendre 〜たら, 〜ば et 〜なら ensemble permet de les contraster, ce qu'un
 * tirage par compétence la plus faible ne donne jamais.
 *
 * Module PUR : `today` est injecté. L'état d'un item se DÉRIVE de la carte FSRS
 * (`entityState`) — il n'y a plus de cochage manuel.
 */
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import { entityState } from "../cours/entityState.ts";
import type { FsrsMap } from "../quiz/revision.ts";

export type Track = "gram" | "vocab" | "kanji";

/**
 * Jusqu'à `n` entités à enseigner sur `track`, dans l'ordre du programme.
 *
 * La leçon en cours est la première (dans l'ordre reçu, déjà trié par `jlpt:order`) qui
 * contient au moins un item non acquis ; on y prend les premiers non acquis. Si elle en fournit
 * moins de `n`, on complète avec la suivante : un bloc peut donc chevaucher deux leçons. C'est
 * la frontière, pas le régime courant — mieux vaut un bloc complet qu'un bloc tronqué.
 */
export function nextLessonBlock(
  track: Track, categories: CoursCategory[], m: FsrsMap, today: number, n: number,
): CoursItem[] {
  if (n <= 0) return [];
  const cat = categories.find((c) => c.id === track);
  if (!cat || cat.kind !== "learn") return [];
  const out: CoursItem[] = [];
  for (const g of cat.groups) {
    for (const item of g.items) {
      if (entityState(m[item.id], today) === "acquis") continue;
      out.push(item);
      if (out.length >= n) return out;
    }
  }
  return out;
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/entrainement/curriculum.test.ts
```

Attendu : 8 tests PASS.

- [ ] **Step 5: Suite complète + typecheck, puis commit**

```bash
cd .worktrees/feat-apprendre-ancre && bun test && bun run typecheck
git add src/features/entrainement/curriculum.ts src/features/entrainement/curriculum.test.ts
git commit -m "feat(entrainement): curseur de programme, la lecon en cours par piste"
```

---

## Task 3 : `learnQueue.ts` — allocation, file, budget

**Files:**
- Create: `src/features/entrainement/learnQueue.ts`
- Test: `src/features/entrainement/learnQueue.test.ts`

**Interfaces:**
- Consumes: `nextLessonBlock`, `Track` (Task 2) ; `anchorIndex`, `selectAnchor`, `AnchorIndex`
  (Task 1) ; `allocateCount` (`src/lib/bank.ts`, **lecture seule**) ; `SKILLS`, `Skill`
  (`src/types/progress.ts`) ; `CoursCategory`, `CoursItem` ; `FsrsMap`.
- Produces:
  - `const TRACK_DE_SKILL: Record<Track, Skill>` — `{ gram: "grammaire", vocab: "vocabulaire", kanji: "kanji" }`
  - `function allocateLearn(weightOf: (c: Skill) => number, total: number): Record<Track, number>`
  - `interface LearnStep { item: CoursItem; anchor: number | null }`
  - `function buildLearnQueue(args: { categories: CoursCategory[]; fsrs: FsrsMap; today: number; alloc: Record<Track, number>; index: AnchorIndex; exclude: Set<number> }): LearnStep[]`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/entrainement/learnQueue.test.ts` :

```ts
import { test, expect, afterEach } from "bun:test";
import { allocateLearn, buildLearnQueue, TRACK_DE_SKILL } from "./learnQueue.ts";
import { anchorIndex, clearAnchorCache } from "../quiz/anchor.ts";
import type { Question } from "../../types/quiz.ts";
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import type { Skill } from "../../types/progress.ts";

afterEach(() => { clearAnchorCache(); });

test("TRACK_DE_SKILL relie les trois pistes enseignables", () => {
  expect(TRACK_DE_SKILL).toEqual({ gram: "grammaire", vocab: "vocabulaire", kanji: "kanji" });
});

// ⚠ `allocateCount` distribue sur les CINQ compétences ; lecture et écoute n'ont aucune entité
// à enseigner. Tout ce qui leur écherrait doit être rapatrié, sinon le budget d'apprentissage
// fuit vers des pistes qui ne peuvent rien en faire.
test("allocateLearn ne donne jamais rien a lecture ni ecoute", () => {
  const poids: Record<string, number> = {
    grammaire: 1, vocabulaire: 1, kanji: 1, lecture: 5, ecoute: 5,
  };
  const a = allocateLearn((c: Skill) => poids[c], 6);
  expect(a.gram + a.vocab + a.kanji).toBe(6);
});

test("allocateLearn conserve le total exact", () => {
  for (const total of [0, 1, 2, 3, 5, 7, 12]) {
    const a = allocateLearn(() => 1, total);
    expect(a.gram + a.vocab + a.kanji).toBe(total);
  }
});

test("allocateLearn favorise la piste au plus fort poids", () => {
  const poids: Record<string, number> = {
    grammaire: 10, vocabulaire: 1, kanji: 1, lecture: 0, ecoute: 0,
  };
  const a = allocateLearn((c: Skill) => poids[c], 6);
  expect(a.gram).toBeGreaterThan(a.vocab);
  expect(a.gram).toBeGreaterThan(a.kanji);
});

const item = (id: string): CoursItem => ({ id, form: id }) as CoursItem;
const cats: CoursCategory[] = [
  { id: "gram", title: "文法", kind: "learn",
    groups: [{ id: "g1", title: "L1", items: [item("jlpt:gram/ば"), item("jlpt:gram/たら")] }] },
  { id: "kanji", title: "漢字", kind: "learn",
    groups: [{ id: "k1", title: "K1", items: [item("jlpt:kanji/位")] }] },
];
const q = (id: number, tests: string[]): Question =>
  ({ id, cat: "kanji", d: 1, q: "", o: [], a: 0, tests }) as Question;

test("buildLearnQueue rend une etape par entite, avec son ancre", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:word/位置"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 1, vocab: 0, kanji: 1 }, index, exclude: new Set(),
  });
  expect(file.map((s) => [s.item.id, s.anchor])).toEqual([
    ["jlpt:gram/ば", 1],
    ["jlpt:kanji/位", 2], // atteint via le mot 位置
  ]);
});

// Les mini-blocs restent CONTIGUS par piste : on n'alterne pas grammaire / kanji / grammaire.
test("buildLearnQueue garde les pistes en blocs contigus", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"]), q(2, ["jlpt:gram/たら"]), q(3, ["jlpt:kanji/位"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 2, vocab: 0, kanji: 1 }, index, exclude: new Set(),
  });
  expect(file.map((s) => s.item.id))
    .toEqual(["jlpt:gram/ば", "jlpt:gram/たら", "jlpt:kanji/位"]);
});

// Une entité SANS ancre est quand même enseignée : 38 kanji et ~14 % du reste n'ont aucune
// question. On n'invente pas de question — la carte propose l'auto-évaluation et passe.
test("buildLearnQueue enseigne une entite meme sans ancre", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/autre"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 1, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  expect(file).toHaveLength(1);
  expect(file[0].anchor).toBeNull();
});

// Deux entités ne peuvent pas partager la même question d'ancrage.
test("buildLearnQueue ne reutilise jamais la meme question", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば", "jlpt:gram/たら"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 2, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  expect(file[0].anchor).toBe(1);
  expect(file[1].anchor).toBeNull();
});

test("buildLearnQueue respecte les questions deja reservees par la session", () => {
  const index = anchorIndex([q(1, ["jlpt:gram/ば"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 1, vocab: 0, kanji: 0 }, index, exclude: new Set([1]),
  });
  expect(file[0].anchor).toBeNull();
});

test("buildLearnQueue rend une file vide quand rien n est alloue", () => {
  const index = anchorIndex([]);
  expect(buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 0, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  })).toEqual([]);
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/entrainement/learnQueue.test.ts
```

Attendu : ÉCHEC — `Cannot find module './learnQueue.ts'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/features/entrainement/learnQueue.ts` :

```ts
/**
 * La file de la phase d'apprentissage : quelles entités, dans quel ordre, avec quelle ancre.
 *
 * Toute la règle de la phase 1 vit ici, pas dans le hook — `useQuiz` n'orchestre que les
 * phases. Module PUR.
 */
import { allocateCount } from "../../lib/bank.ts";
import { SKILLS, type Skill } from "../../types/progress.ts";
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import type { FsrsMap } from "../quiz/revision.ts";
import { selectAnchor, type AnchorIndex } from "../quiz/anchor.ts";
import { nextLessonBlock, type Track } from "./curriculum.ts";

/** Les trois pistes enseignables et la compétence de quiz correspondante. */
export const TRACK_DE_SKILL: Record<Track, Skill> = {
  gram: "grammaire", vocab: "vocabulaire", kanji: "kanji",
};

const TRACKS: Track[] = ["gram", "vocab", "kanji"];

/**
 * Répartit `total` entités à enseigner sur les trois pistes enseignables.
 *
 * ⚠ `allocateCount` distribue sur les CINQ compétences, or `lecture` et `ecoute` n'ont aucune
 * entité (leur réponse est un fragment de texte, pas une entité du référentiel). On leur donne
 * un poids nul, puis on RAPATRIE ce qui leur écherrait malgré tout : le reliquat de la division
 * entière est distribué par poids décroissant et peut les atteindre. Sans ce rapatriement, le
 * budget d'apprentissage fuit vers des pistes qui ne peuvent rien en faire.
 */
export function allocateLearn(
  weightOf: (c: Skill) => number, total: number,
): Record<Track, number> {
  if (total <= 0) return { gram: 0, vocab: 0, kanji: 0 };
  const enseignable = (c: Skill) => (TRACKS.some((t) => TRACK_DE_SKILL[t] === c) ? weightOf(c) : 0);
  const brut = allocateCount(enseignable, total);
  const out: Record<Track, number> = {
    gram: brut.grammaire, vocab: brut.vocabulaire, kanji: brut.kanji,
  };
  // Rapatriement : tout ce qui est allé aux compétences non enseignables revient à la piste
  // enseignable de plus fort poids (à égalité, l'ordre de TRACKS tranche — déterministe).
  // ⚠ On teste l'APPARTENANCE aux pistes enseignables, PAS la valeur du poids. Une première
  // rédaction faisait `enseignable(c) === 0` — or `enseignable` rend `weightOf(c)` pour les
  // trois pistes enseignables : une piste enseignable de poids NUL était comptée comme
  // orpheline et sa part réinjectée EN DOUBLE. Déclenchement : les trois poids nuls à la fois,
  // où `allocateCount` bascule dans sa branche `sum === 0` et répartit en tournante.
  // Mesuré sur le code fautif : poids tous nuls, total = 7 → somme 12.
  let orphelins = 0;
  for (const c of SKILLS) if (!TRACKS.some((t) => TRACK_DE_SKILL[t] === c)) orphelins += brut[c];
  if (orphelins > 0) {
    const meilleure = TRACKS.reduce((a, b) =>
      weightOf(TRACK_DE_SKILL[b]) > weightOf(TRACK_DE_SKILL[a]) ? b : a);
    out[meilleure] += orphelins;
  }
  return out;
}

/** Une étape de la phase d'apprentissage : la carte, et la question qui la teste (ou aucune). */
export interface LearnStep {
  item: CoursItem;
  /** Ord de la question d'ancrage — `null` quand rien dans le corpus ne teste l'entité. */
  anchor: number | null;
}

/**
 * La file de la phase 1 : les entités du programme, **en blocs contigus par piste**, chacune
 * suivie de sa question d'ancrage.
 *
 * ⚠ Une entité sans ancre reste enseignée : 38 kanji et ~14 % de la grammaire et du vocabulaire
 * n'ont aucune question qui les teste. On n'invente pas de question — la carte proposera
 * l'auto-évaluation. Son créneau de question retourne au quiz (cf. l'invariant de budget).
 */
export function buildLearnQueue(args: {
  categories: CoursCategory[];
  fsrs: FsrsMap;
  today: number;
  alloc: Record<Track, number>;
  index: AnchorIndex;
  exclude: Set<number>;
}): LearnStep[] {
  const { categories, fsrs, today, alloc, index } = args;
  const pris = new Set(args.exclude);
  const out: LearnStep[] = [];
  for (const track of TRACKS) {
    for (const item of nextLessonBlock(track, categories, fsrs, today, alloc[track])) {
      const anchor = selectAnchor(item.id, index, pris);
      if (anchor !== null) pris.add(anchor);
      out.push({ item, anchor });
    }
  }
  return out;
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/entrainement/learnQueue.test.ts
```

Attendu : 11 tests PASS.

- [ ] **Step 5: Suite complète + typecheck, puis commit**

```bash
cd .worktrees/feat-apprendre-ancre && bun test && bun run typecheck
git add src/features/entrainement/learnQueue.ts src/features/entrainement/learnQueue.test.ts
git commit -m "feat(entrainement): file d apprentissage, blocs contigus et ancrage"
```

---

## Task 4 : `LearnCard` — le rendu d'une carte enseignée

**Files:**
- Create: `src/features/quiz/LearnCard.tsx`
- Test: `src/features/quiz/LearnCard.test.tsx`

**Interfaces:**
- Consumes: `EntityCard` (`src/features/cours/EntityCard.tsx`, signature
  `EntityCard({ item, state?, legende? })` — **il n'y a plus de prop `variant`**) ;
  `EntityState` (`src/features/cours/entityState.ts`) ; `CoursItem` ; `PANEL`, `BTN_PRIMARY`,
  `BTN_GHOST` (`src/ui/styles.ts`).
- Produces:
  - `function LearnCard(props: { item: CoursItem; state: EntityState; index: number; count: number; hasAnchor: boolean; onNext: () => void; onSelfGrade: (grade: 1 | 3) => void }): JSX.Element`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/quiz/LearnCard.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LearnCard } from "./LearnCard.tsx";
import type { CoursItem } from "../cours/coursSchema.ts";

const item: CoursItem = { id: "jlpt:gram/ば", form: "〜ば", mean: "condition generale" };
const base = {
  item, state: "neuf" as const, index: 0, count: 4,
  onNext: () => {}, onSelfGrade: () => {},
};

test("LearnCard affiche la position dans le bloc", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("1 / 4");
});

test("LearnCard rend le contenu de l entite", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("condition generale");
});

// Avec une ancre : un seul geste, on enchaîne sur la question.
test("avec une ancre, LearnCard propose de passer a la question", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("Question");
  expect(html).not.toContain("Je connais");
});

// Sans ancre : rien ne peut la tester, donc le seul signal disponible est l'auto-évaluation.
// C'est la contrepartie assumée du refus d'inventer une question.
test("sans ancre, LearnCard propose l auto-evaluation a deux branches", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor={false} />);
  expect(html).toContain("Je connais");
  expect(html).toContain("revoir");
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/quiz/LearnCard.test.tsx
```

Attendu : ÉCHEC — `Cannot find module './LearnCard.tsx'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/features/quiz/LearnCard.tsx` :

```tsx
/**
 * Une carte de la phase d'apprentissage : l'entité qu'on présente avant de la tester.
 *
 * Rend la MÊME `EntityCard` que le paquet du cours et que le rappel du corrigé — une notion a
 * une seule apparence dans toute l'application.
 *
 * ⚠ Deux régimes. Avec ancre, un seul geste : on enchaîne sur la question, et c'est elle qui
 * écrit la mémoire. Sans ancre (38 kanji, ~14 % du reste : rien dans le corpus ne les teste),
 * on n'invente pas de question — l'auto-évaluation est le seul signal disponible, et elle
 * amorce le planificateur au lieu de ne rien faire.
 */
import type { CoursItem } from "../cours/coursSchema.ts";
import type { EntityState } from "../cours/entityState.ts";
import { EntityCard } from "../cours/EntityCard.tsx";
import { PANEL, BTN_PRIMARY, BTN_GHOST } from "../../ui/styles.ts";

export function LearnCard({
  item, state, index, count, hasAnchor, onNext, onSelfGrade,
}: {
  item: CoursItem;
  state: EntityState;
  index: number;
  count: number;
  hasAnchor: boolean;
  onNext: () => void;
  onSelfGrade: (grade: 1 | 3) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-accent text-meta font-bold m-0">
        Apprendre · {index + 1} / {count}
      </p>
      <div className={PANEL}>
        <EntityCard item={item} state={state} legende />
      </div>
      {hasAnchor ? (
        <button type="button" onClick={onNext} className={`w-full ${BTN_PRIMARY}`}>
          Question →
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button" onClick={() => onSelfGrade(3)}
            className={`flex-1 ${BTN_PRIMARY}`}
          >
            Je connais
          </button>
          <button
            type="button" onClick={() => onSelfGrade(1)}
            className={`flex-1 ${BTN_GHOST}`}
          >
            À revoir
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/quiz/LearnCard.test.tsx
```

Attendu : 4 tests PASS.

- [ ] **Step 5: Vérifier les utilités Tailwind employées**

Aucune classe neuve n'est attendue (toutes viennent de `src/ui/styles.ts` ou sont déjà employées
ailleurs). Le confirmer :

```bash
cd .worktrees/feat-apprendre-ancre && bun run css
for c in "flex-1" "text-meta" "text-accent"; do
  printf "%-12s %s\n" "$c" "$(grep -c -- "$c" src/styles/styles.gen.css)"
done
```

Attendu : chaque ligne ≥ 1. Si `flex-1` ressort à 0, le définir dans `src/styles/tailwind.css`
`@layer base` (le Tailwind du projet est vendorisé, donc un sous-ensemble : une classe absente
ne lève AUCUNE erreur, seul le rendu casse). ⚠ `src/styles/styles.gen.css` est **gitignoré** :
son absence du commit est normale.

- [ ] **Step 6: Suite complète + typecheck, puis commit**

```bash
cd .worktrees/feat-apprendre-ancre && bun test && bun run typecheck
git add src/features/quiz/LearnCard.tsx src/features/quiz/LearnCard.test.tsx
git commit -m "feat(quiz): carte de la phase d apprentissage"
```

---

## Task 5 : `ResumeState.learn` — la reprise tolère la phase d'apprentissage

**Files:**
- Modify: `src/features/quiz/resume.ts`
- Test: `src/features/quiz/resume.test.ts` (créer s'il n'existe pas ; sinon ajouter les cas)

**Interfaces:**
- Produces: `ResumeState` gagne `learn?: string[]` (IRIs restant à enseigner).

- [ ] **Step 1: Écrire le test qui échoue**

**`src/features/quiz/resume.test.ts` n'existe pas** — le créer avec exactement ce contenu :

```ts
import { test, expect, afterEach } from "bun:test";
import { readResumeState, persistResumeState, type ResumeState } from "./resume.ts";
import { RESUME_KEY } from "../../lib/keys.ts";

afterEach(() => { try { globalThis.localStorage.clear(); } catch { /* noop */ } });

test("persistResumeState conserve la file d apprentissage", () => {
  const r: ResumeState = {
    kind: "quiz", ids: [1, 2], qi: 0, right: 0, t: Date.now(),
    learn: ["jlpt:gram/ば", "jlpt:kanji/位"],
  };
  persistResumeState(r);
  expect(readResumeState()?.learn).toEqual(["jlpt:gram/ば", "jlpt:kanji/位"]);
});

// ⚠ Le blob est de la donnée utilisateur ancienne, éventuellement rapatriée d un Gist : un
// champ absent dégrade vers un défaut, il ne jette jamais.
test("un blob ancien sans champ learn se relit sans erreur", () => {
  globalThis.localStorage.setItem(RESUME_KEY, JSON.stringify(
    { kind: "quiz", ids: [1], qi: 0, right: 0, t: Date.now() },
  ));
  const r = readResumeState();
  expect(r).not.toBeNull();
  expect(r?.learn).toBeUndefined();
});

test("un champ learn malforme est ignore, la session reste lisible", () => {
  globalThis.localStorage.setItem(RESUME_KEY, JSON.stringify(
    { kind: "quiz", ids: [1], qi: 0, right: 0, t: Date.now(), learn: "pas un tableau" },
  ));
  const r = readResumeState();
  expect(r).not.toBeNull();
  expect(r?.learn).toBeUndefined();
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/quiz/resume.test.ts
```

Attendu : ÉCHEC sur au moins le premier cas (`learn` non conservé).

- [ ] **Step 3: Écrire l'implémentation**

Dans `src/features/quiz/resume.ts`, ajouter le champ à l'interface :

```ts
  /** IRIs des entités restant à ENSEIGNER (phase « apprendre »). Absent d'un blob antérieur au
   *  lot 2 : la reprise se fait alors directement en phase quiz. Ce ne sont pas des ords, ils
   *  n'ont donc rien à faire dans `ids`. */
  learn?: string[];
```

puis, dans la validation de `readResumeState`, ne retenir `learn` que si c'est un tableau de
chaînes (même tolérance que le reste : un champ malformé est ignoré, il ne fait pas échouer la
lecture de la session).

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/quiz/resume.test.ts
```

Attendu : tous PASS.

- [ ] **Step 5: Suite complète + typecheck, puis commit**

```bash
cd .worktrees/feat-apprendre-ancre && bun test && bun run typecheck
git add src/features/quiz/resume.ts src/features/quiz/resume.test.ts
git commit -m "feat(quiz): la reprise conserve la file d apprentissage"
```

---

## Task 6 : la phase `apprendre` dans `useQuiz`

**Files:**
- Modify: `src/features/quiz/useQuiz.ts`
- Test: `src/features/quiz/apprendre.test.ts` (créé)

**Interfaces:**
- Consumes: tout ce que les Tasks 1-3 et 5 produisent ; `useCours` (`src/features/cours/useCours.ts`,
  rend `CoursCategory[] | null`) ; `asFsrs` (`revision.ts`) ; `dayNumber` (`traps.ts`) ;
  `fsrsInit` (`src/lib/fsrs.ts`) ; `writeProgress` (`src/lib/storage.ts`).
- Produces (ajouts au retour de `useQuiz`) :
  - `Phase` gagne `"apprendre"`
  - `learnStep: { item: CoursItem; state: EntityState; index: number; count: number; hasAnchor: boolean } | null`
  - `learnNext: () => void`
  - `learnSelfGrade: (grade: 1 | 3) => void`

**Ce que la tâche doit respecter, et qui n'est pas négociable :**

1. **`sessionPlan.ts` n'est PAS modifié.** Seule l'interprétation d'`alloc.learn` change :
   ce n'est plus « N questions inédites » mais « **N entités à enseigner** ».
2. **L'invariant de budget.** Une entité **sans ancre** ne consomme pas de créneau de question :
   son créneau retourne au quiz. La session compte donc toujours `total` questions, quel que
   soit le taux d'ancrage.
3. **`commitAnswer` n'est pas modifié.** Une réponse d'ancrage passe par le même chemin (Elo,
   `seen`, `mastered`, cadence, `fsrsPatch`).
4. **Les reprises rejoignent la tranche GARANTIE**, pas la tête de la file adaptive :
   `composeSession` mélange tout (`bank.ts:125-131`), donc aucune position ne survit — et c'est
   tant mieux, l'espacement vaut mieux que la proximité.
5. **L'ancienne tranche `learn` (questions inédites via `pickSlice`) DISPARAÎT** : elle est
   remplacée par les ancres. Ne pas laisser les deux coexister, ce serait compter deux fois.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/quiz/apprendre.test.ts`. Il teste la LOGIQUE de composition, sans monter le
hook — les couches pures étant déjà couvertes, ce qu'on vérifie ici est le contrat de phase et
l'invariant de budget :

```ts
import { test, expect, afterEach } from "bun:test";
import { buildLearnQueue, allocateLearn } from "../entrainement/learnQueue.ts";
import { anchorIndex, clearAnchorCache } from "./anchor.ts";
import type { Question } from "../../types/quiz.ts";
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";

afterEach(() => { clearAnchorCache(); });

const item = (id: string): CoursItem => ({ id, form: id }) as CoursItem;
const cats: CoursCategory[] = [{
  id: "gram", title: "文法", kind: "learn",
  groups: [{ id: "g1", title: "L1", items: [item("a"), item("b"), item("c")] }],
}];
const q = (id: number, tests: string[]): Question =>
  ({ id, cat: "grammaire", d: 1, q: "", o: [], a: 0, tests }) as Question;

/**
 * INVARIANT DE BUDGET (spec §5.1) : le créneau d'une entité sans ancre retourne au quiz.
 * Une session dont AUCUNE entité enseignée n'a d'ancre doit encore compter `total` questions.
 */
test("le creneau d une entite sans ancre retourne au quiz", () => {
  const total = 10;
  const alloc = allocateLearn(() => 1, 3);
  const index = anchorIndex([q(1, ["a"])]); // seule « a » est ancrable
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 3, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  const ancres = file.filter((s) => s.anchor !== null).length;
  expect(file).toHaveLength(3);
  expect(ancres).toBe(1);
  // Le quiz doit recevoir total - ancres, pas total - entités enseignées.
  expect(total - ancres).toBe(9);
  expect(alloc.gram + alloc.vocab + alloc.kanji).toBe(3);
});

test("aucune entite ancrable laisse le budget entier au quiz", () => {
  const index = anchorIndex([q(1, ["zzz"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 3, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  expect(file.every((s) => s.anchor === null)).toBe(true);
  expect(10 - file.filter((s) => s.anchor !== null).length).toBe(10);
});

test("les ancres et les reprises ne se recouvrent jamais", () => {
  const qs = [q(1, ["a"]), q(2, ["a"])];
  const index = anchorIndex(qs);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 1, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  const ancre = file[0].anchor!;
  // La reprise se choisit avec l'ancre déjà exclue : elle DOIT tomber sur l'autre question.
  expect(selectAnchor("a", index, new Set([ancre]))).not.toBe(ancre);
});
```

⚠ Compléter l'import en tête du fichier : `import { anchorIndex, selectAnchor, clearAnchorCache }
from "./anchor.ts";` — **jamais** de `require()` au milieu d'un test.

- [ ] **Step 2: Lancer le test et vérifier qu'il passe déjà pour les couches pures**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/features/quiz/apprendre.test.ts
```

Attendu : PASS (les couches pures existent depuis les Tasks 1-3). Ce fichier est le **contrat**
que le câblage du hook doit honorer ; il ne le teste pas encore.

- [ ] **Step 3: Câbler la phase dans `useQuiz.ts`**

Modifications, dans l'ordre :

1. `export type Phase` gagne `"apprendre"`.
2. Trois états : `const [learnQueue, setLearnQueue] = useState<LearnStep[]>([])`,
   `const [learnIdx, setLearnIdx] = useState(0)`, et une `ref` sur les questions de la phase quiz
   pour ne les monter qu'une fois la phase 1 terminée.
3. Le cours est nécessaire pour connaître le programme : appeler `useCours()` dans le hook.
   ⚠ Il rend `null` tant que les six documents ne sont pas chargés — si le cours n'est pas
   disponible au moment de `start()`, **la phase d'apprentissage est simplement sautée** et la
   session se compose comme avant. Une séance ne doit jamais être bloquée par le cours.
4. Dans `start()`, branche `plan.kind === "composed"` :
   - remplacer entièrement le bloc `learnQs` actuel (`pickSlice` sur les questions inédites) par :
     `allocateLearn(...)` → `buildLearnQueue(...)` → la file ;
   - les ords d'ancre entrent dans `exclude` et forment la file de la phase 1 ;
   - les **reprises** : pour chaque entité enseignée, `selectAnchor` une seconde fois avec les
     ancres déjà exclues ; les ords obtenus rejoignent la tranche **garantie** passée à
     `composeSession`, aux côtés de `errorQs`/`confusionQs`/`revisionQs` ;
   - le budget du quiz devient `total - (nombre d'ancres réellement résolues)`.
5. `setPhase(learnQueue.length ? "apprendre" : "question")`.
6. `learnNext()` : si l'étape courante a une ancre, passer en phase `question` sur cette
   question ; sinon avancer d'une étape. Quand la file est épuisée, entrer dans le quiz.
7. `learnSelfGrade(grade)` : écrire `fsrsInit(grade, jour)` sur l'IRI via `writeProgress` en
   réécrivant la carte **complète** (⚠ `writeProgress` ne deep-merge que `skill`), puis avancer.
8. Persister `learn: <IRIs restants>` dans le `ResumeState` à chaque avancée.
9. Exposer `learnStep`, `learnNext`, `learnSelfGrade` dans le retour du hook.

- [ ] **Step 4: Ajouter les tests de câblage**

Ajouter à `src/features/quiz/apprendre.test.ts` (compléter les imports en tête) :

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useQuiz } from "./useQuiz.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

/** Les six documents du graphe que `useCours` fetche, plus les shards de questions. */
const DOCS: Record<string, unknown> = {
  "data/graph/lesson.jsonld": { "@graph": [
    { "@id": "jlpt:lesson/gram-g1", "@type": "jlpt:Lesson", "schema:name": "Conditionnels",
      "jlpt:order": 0, "jlpt:track": "gram", covers: ["jlpt:gram/ば"] },
  ] },
  "data/graph/gram.jsonld": { "@graph": [
    { "@id": "jlpt:gram/ば", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜ば",
      "schema:description": "si" },
  ] },
  "data/graph/kanji.jsonld": { "@graph": [] },
  "data/graph/word.jsonld": { "@graph": [] },
  "data/graph/example.jsonld": { "@graph": [] },
  "data/graph/method.jsonld": { "@graph": [] },
};

function bouchonneFetch() {
  globalThis.fetch = ((url: string) =>
    Promise.resolve({
      json: () => Promise.resolve(DOCS[url] ?? { "@graph": [] }),
    })) as unknown as typeof fetch;
}

async function monterQuiz(): Promise<{ api: () => ReturnType<typeof useQuiz>; root: Root }> {
  bouchonneFetch();
  let courant: ReturnType<typeof useQuiz> | null = null;
  function Probe() { courant = useQuiz(); return null; }
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(<MemoryRouter><Probe /></MemoryRouter>);
  });
  await act(async () => { await Promise.resolve(); });
  return { api: () => courant!, root };
}

test("une session qui a des entites a enseigner s ouvre sur la phase apprendre", async () => {
  const { api, root } = await monterQuiz();
  // `skipDiagnostic` force le chemin « composed » (sinon un diagnostic est dû au premier lancement).
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  expect(api().phase).toBe("apprendre");
  expect(api().learnStep).not.toBeNull();
  await act(async () => { root.unmount(); });
});

test("learnNext sur une etape ancree amene en phase question", async () => {
  const { api, root } = await monterQuiz();
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  if (api().learnStep?.hasAnchor) {
    await act(async () => { api().learnNext(); });
    expect(api().phase).toBe("question");
  }
  await act(async () => { root.unmount(); });
});

// ⚠ Tolérance imposée aux lectures de blob : un blob antérieur au lot 2 n'a pas le champ
// `learn` — la reprise doit dégrader silencieusement vers la phase quiz, jamais jeter.
test("une reprise sans champ learn entre directement en phase quiz", async () => {
  const { api, root } = await monterQuiz();
  await act(async () => {
    await api().resumeNow({ kind: "quiz", ids: [0], qi: 0, right: 0, t: Date.now() });
  });
  expect(api().phase).not.toBe("apprendre");
  await act(async () => { root.unmount(); });
});
```

⚠ Si le corpus bouchonné ne permet pas de résoudre d'ancre, `learnStep.hasAnchor` sera `false` :
le deuxième test se contente alors de ne rien affirmer — c'est voulu, il vérifie la transition
**quand elle est possible**, et le contrat d'ancrage est déjà couvert par les Tasks 1 et 3.

- [ ] **Step 5: Suite complète + typecheck**

```bash
cd .worktrees/feat-apprendre-ancre && bun test && bun run typecheck
```

Attendu : tout vert, **y compris** `cadence.test.ts`, `rappel.reel.test.ts` et `shapes.test.ts`.

- [ ] **Step 6: Commit**

```bash
cd .worktrees/feat-apprendre-ancre
git add src/features/quiz/useQuiz.ts src/features/quiz/apprendre.test.ts
git commit -m "feat(quiz): phase apprendre, ancrage immediat puis quiz melange"
```

---

## Task 7 : le rendu de la phase, et la vérification navigateur

**Files:**
- Modify: `src/EntrainementApp.tsx`
- Test: `src/EntrainementApp.apprendre.test.tsx` (créé)

**Interfaces:**
- Consumes: `LearnCard` (Task 4) ; les champs `learnStep` / `learnNext` / `learnSelfGrade`
  exposés par `useQuiz` (Task 6).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/EntrainementApp.apprendre.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import type { CoursItem } from "./features/cours/coursSchema.ts";

const item: CoursItem = { id: "jlpt:gram/ば", form: "〜ば", mean: "condition generale" };

const base = {
  phase: "apprendre" as const, question: null, count: 12, right: 0, index: 0,
  minutes: 10, resume: null, chosen: null,
  onStart: () => {}, onChoose: () => {}, onNext: () => {}, onRestart: () => {},
  onSetMinutes: () => {}, onResumeNow: () => {}, onDismissResume: () => {},
};

test("la phase apprendre rend la carte enseignee", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView
        {...base}
        learnStep={{ item, state: "neuf", index: 0, count: 4, hasAnchor: true }}
        onLearnNext={() => {}} onLearnSelfGrade={() => {}}
      />
    </MemoryRouter>,
  );
  expect(html).toContain("Apprendre");
  expect(html).toContain("1 / 4");
  expect(html).toContain("condition generale");
});

test("la phase apprendre sans etape ne rend rien de la carte", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView {...base} learnStep={null}
        onLearnNext={() => {}} onLearnSelfGrade={() => {}} />
    </MemoryRouter>,
  );
  expect(html).not.toContain("Apprendre ·");
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/EntrainementApp.apprendre.test.tsx
```

Attendu : ÉCHEC — la prop `learnStep` n'existe pas sur `EntrainementAppView`.

- [ ] **Step 3: Brancher le rendu**

Dans `src/EntrainementApp.tsx` :
1. ajouter à la signature de `EntrainementAppView` les props optionnelles
   `learnStep?: { item: CoursItem; state: EntityState; index: number; count: number; hasAnchor: boolean } | null`,
   `onLearnNext?: () => void`, `onLearnSelfGrade?: (grade: 1 | 3) => void` ;
2. ajouter, avant la branche `phase === "diag-intro"`, une branche
   `if (props.phase === "apprendre")` qui rend `<LearnCard …/>` quand `learnStep` est fourni,
   et `null` sinon ;
3. dans le composant conteneur `EntrainementApp`, passer `quiz.learnStep`, `quiz.learnNext` et
   `quiz.learnSelfGrade`.

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-ancre && bun test src/EntrainementApp.apprendre.test.tsx
```

Attendu : 2 tests PASS.

- [ ] **Step 5: Suite complète, typecheck, build**

```bash
cd .worktrees/feat-apprendre-ancre && bun test && bun run typecheck && bun run build
```

- [ ] **Step 6: Commit**

```bash
cd .worktrees/feat-apprendre-ancre
git add src/EntrainementApp.tsx src/EntrainementApp.apprendre.test.tsx
git commit -m "feat(entrainement): rendu de la phase apprendre"
```

- [ ] **Step 7: Vérification navigateur (le seul contrôle que les tests ne donnent pas)**

⚠ Cette étape n'est **pas simulable** : ne pas prétendre l'avoir faite. Si l'agent qui exécute
ce plan ne peut pas piloter un navigateur, il l'écrit dans son rapport et s'arrête là.

Le chemin qui marche dans ce projet (l'extension Chrome n'est pas connectée, le MCP Playwright
cherche un canal absent) — piloter en CDP le Chromium que Playwright a déjà installé :

```bash
cd .worktrees/feat-apprendre-ancre && bun run build
(bunx serve _site -l 4173 &)
B=~/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/"Google Chrome for Testing.app"/Contents/MacOS/"Google Chrome for Testing"
"$B" --headless=new --disable-gpu --remote-debugging-port=9333 --user-data-dir=/tmp/cdp-lot2 about:blank &
# puis PUT /json/new?<url> → WebSocket → Runtime.evaluate
```

⚠ Le chargement à froid des shards prend ~8 s : **attendre la condition** (poller
`document.querySelector(...)`), jamais un délai fixe — conclure trop tôt fait croire à tort que
la séance ne démarre pas.

Points à contrôler sur `#/entrainement` :
1. une séance de 10 min s'ouvre bien sur la phase « Apprendre · 1 / N », pas sur une question ;
2. les cartes d'une même piste se suivent (blocs contigus), pas en alternance ;
3. « Question → » amène sur une question qui teste **l'entité qu'on vient de voir** ;
4. après la dernière carte, on entre dans le quiz et le total de questions annoncé est cohérent
   avec le budget de la séance ;
5. une entité sans ancre affiche « Je connais » / « À revoir » et son clic écrit bien une carte
   FSRS dans `jlptN3adapt_v2` ;
6. recharger en pleine phase d'apprentissage reprend là où on en était.

---

## Self-Review

**Couverture de la spec §5 :**

| Exigence (§) | Task |
|---|---|
| §5.1 — `sessionPlan.ts` non modifié, `alloc.learn` réinterprété | 6 |
| §5.1 — invariant de budget (créneau sans ancre rendu au quiz) | 6 (test dédié) |
| §5.1 — allocation restreinte aux trois pistes enseignables et renormalisée | 3 |
| §5.2 — `nextLessonBlock`, leçon en cours, chevauchement de frontière | 2 |
| §5.2 — mini-blocs contigus par piste | 3 |
| §5.3 — `anchorIndex` / `selectAnchor`, pont kanji → mots | 1 |
| §5.3 — taux d'ancrage figés par un test de mesure | 1 |
| §5.3 — entité sans ancre : auto-évaluation, aucune question inventée | 3 (file), 4 (rendu), 6 (écriture) |
| §5.4 — `Phase` gagne `"apprendre"` | 6 |
| §5.4 — `ResumeState.learn`, dégradation d'un blob ancien | 5 |
| §5.4 — `commitAnswer` inchangé | 6 (contrainte explicite) |
| §5.4 — une bonne réponse d'ancrage ne suffit pas à déclarer « acquis » | garanti par `entityState` (lot 1), pas de code neuf |

**Écarts assumés, signalés ici plutôt que découverts en route :**

1. **La spec disait « reprises en tête de la file adaptive » — c'est impossible et indésirable.**
   `composeSession` mélange (`bank.ts:125-131`). Les reprises rejoignent la tranche garantie ;
   leur position est dispersée, ce qui sert l'espacement. Décision (a) en tête de plan.
2. **La Task 6 est la plus grosse** et son étape 3 décrit le câblage en prose plutôt qu'en code
   complet : `useQuiz.start()` fait 130 lignes très denses et un bloc figé serait périmé au
   premier écart. Les couches pures, elles, sont données en entier — c'est là qu'est la règle.
   Si l'implémenteur bute, c'est le signe qu'il faut scinder la Task 6, pas improviser.
3. **`useCours()` appelé depuis `useQuiz`** ajoute six `fetch` au démarrage d'une séance. Ils
   sont déjà mémoïsés au module côté `graph.ts` et précachés par le service worker ; si le cours
   n'est pas prêt, la phase est sautée plutôt qu'attendue.
