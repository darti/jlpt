# Modèle de mémoire par entité (FSRS) — plan d'implémentation (lot 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au moteur une dimension temporelle : un état de mémoire FSRS par entité du graphe,
mis à jour à chaque réponse, qui injecte une tranche « révision » dans le quiz adaptatif.

**Architecture:** Couche pure FSRS-4.5 (`fsrs.ts`) → requêtes pures (`revision.ts` : état ↔ blob,
entités dues, index inverse IRI→ords) → écriture dans `useQuiz#choose` → tranche « révision » dans
`pickSessionPlan`/`start()` → panneau Accueil « À réviser ». Le pont entre l'état (indexé par IRI)
et le quiz (indexé par `ord`) est l'arête `q.tests` et son inverse.

**Tech Stack:** bun (runtime, tests, bundler), React + TypeScript, happy-dom.

**Spec:** `docs/superpowers/specs/2026-07-22-memoire-entite-design.md`

## Global Constraints

- **Worktree `.worktrees/memoire`, branche `feat/memoire-entite`.** Jamais dans le répertoire principal.
- **`bun` EXCLUSIVEMENT, jamais `node`.** Tests : `bun test <fichier>`. Typecheck : `bun run typecheck`.
- **Pas de linter** : `bun run typecheck` + `bun test` font foi. Ne pas en ajouter.
- **Zéro dépendance nouvelle.** FSRS est implémenté à la main (pas de `ts-fsrs`).
- Commentaires et messages de commit en **français**, conventional commits. **PAS de ligne Co-Authored-By.**
- **Commit : message COURT à UNE ligne** via `git commit -m "..."`. PAS de heredoc (un hook du dépôt déclenche une revue d'équipe et fait parfois échouer le commit — si bloqué, laisser STAGÉ proprement et le signaler).
- Écrire la progression **UNIQUEMENT** via `writeProgress()` (patch fusionné ; il ne deep-merge que `skill`, tout le reste est remplacé → réécrire la carte `fsrs` COMPLÈTE).
- **Aucune clé localStorage nouvelle** : le champ `fsrs` vit dans le blob `PROGRESS_KEY` existant.
- **Ce lot ne touche PAS `data/graph/`** → **pas de bump `sw.js`**.
- **Époque temporelle unique** : réutiliser `dayNumber`/`EPOCH_MS` de `src/features/quiz/traps.ts` (2026-01-01 UTC). Ne pas réintroduire une autre origine.
- ⚠ `renderToStaticMarkup` échappe les apostrophes (`'` → `&#x27;`) : asserter sur des sous-chaînes SANS apostrophe.
- ⚠ happy-dom préchargé pour toute la suite : `localStorage`/`document` existent même dans un test « pur ». Les couches `fsrs.ts`/`revision.ts` sont pures (date injectée) — ne jamais y lire une horloge ni le store.
- IRIs d'entité : `jlpt:word/…` (vocabulaire), `jlpt:kanji/…` (kanji), `jlpt:gram/…` (grammaire).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/fsrs.ts` | **créé** — algorithme FSRS-4.5 pur (init, review, retrievability, isDue) |
| `src/lib/fsrs.test.ts` | **créé** — invariants + vecteurs de référence |
| `src/features/quiz/revision.ts` | **créé** — `asFsrs`, `dueEntities`, `fsrsIndex`, `selectRevision`, `dueBySkill` |
| `src/features/quiz/revision.test.ts` | **créé** — table-driven |
| `src/features/quiz/useQuiz.ts` | **modifié** — `choose` écrit l'état ; `start()` insère la tranche révision |
| `src/features/quiz/revision-wiring.test.ts` | **créé** — garde-fou perte de champ au patch |
| `src/features/entrainement/sessionPlan.ts` | **modifié** — `REVISION_CAP`, `revisionDue` dans l'état, `revision` dans l'alloc |
| `src/features/entrainement/sessionPlan.test.ts` | **modifié** — cas de la tranche révision |
| `src/features/dashboard/useRevision.ts` | **créé** — hook (blob seul, pas de fetch) |
| `src/features/dashboard/RevisionPanel.tsx` | **créé** — panneau « À réviser » |
| `src/features/dashboard/RevisionPanel.test.tsx` | **créé** — SSR smoke |
| `src/App.tsx` | **modifié** — monte le panneau |

---

## Task 1 : l'algorithme FSRS-4.5 (`fsrs.ts`)

**Files:**
- Create: `src/lib/fsrs.ts`
- Test: `src/lib/fsrs.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces :
  - `type Grade = 1 | 2 | 3 | 4` (`1`=Again, `3`=Good ; `2`/`4` définis, jamais émis en binaire)
  - `type Fsrs = [stability: number, difficulty: number, lastDay: number]`
  - `fsrsInit(grade: Grade, today: number): Fsrs`
  - `fsrsReview(state: Fsrs, grade: Grade, today: number): Fsrs`
  - `retrievability(state: Fsrs, today: number): number`
  - `isDue(state: Fsrs, today: number, retention?: number): boolean`

- [ ] **Step 1 : écrire les tests d'invariant (les plus solides — aucun nombre magique)**

`src/lib/fsrs.test.ts` :

```ts
import { test, expect } from "bun:test";
import { fsrsInit, fsrsReview, retrievability, isDue, type Fsrs } from "./fsrs.ts";

// Les invariants de FSRS-4.5 sont des ancres exactes, indépendantes de toute arithmétique à la
// main : R(S,S)=0.9 par construction, R(0)=1, décroissance monotone. Ils prouvent la fidélité
// bien mieux qu'un nombre attendu recopié (qui figerait une éventuelle erreur de calcul).

test("R(0) = 1 : aucun temps écoulé, rappel certain", () => {
  const s: Fsrs = [10, 5, 100];
  expect(retrievability(s, 100)).toBeCloseTo(1, 10);
});

test("R(S, S) = 0.9 : rétention de 90 % après une durée = stabilité (contrainte FSRS)", () => {
  const s: Fsrs = [10, 5, 100];         // stabilité 10
  expect(retrievability(s, 110)).toBeCloseTo(0.9, 6); // écoulé = 10 = S
});

test("R décroît strictement avec le temps", () => {
  const s: Fsrs = [10, 5, 100];
  const r5 = retrievability(s, 105), r10 = retrievability(s, 110), r20 = retrievability(s, 120);
  expect(r5).toBeGreaterThan(r10);
  expect(r10).toBeGreaterThan(r20);
});

test("temps écoulé négatif (horloge/import) borné à 0 → R = 1, jamais NaN", () => {
  const s: Fsrs = [10, 5, 100];
  expect(retrievability(s, 90)).toBeCloseTo(1, 10);
});

test("isDue : dû quand R < 0.9 (au-delà de la stabilité), pas avant", () => {
  const s: Fsrs = [10, 5, 100];
  expect(isDue(s, 109)).toBe(false); // écoulé 9 < S → R > 0.9
  expect(isDue(s, 111)).toBe(true);  // écoulé 11 > S → R < 0.9
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run: `bun test src/lib/fsrs.test.ts`
Expected: FAIL — `Cannot find module './fsrs.ts'`

- [ ] **Step 3 : écrire l'algorithme**

`src/lib/fsrs.ts` :

```ts
/**
 * FSRS-4.5 — courbe d'oubli par entité (stabilité, difficulté).
 *
 * Modèle de rappel espacé moderne (celui d'Anki). Chaque entité porte un état
 * `[stabilité, difficulté, dernierJour]` ; une révision le met à jour depuis le grade et le
 * temps écoulé. « Dû » = rétrievabilité sous la rétention cible (0,9).
 *
 * ⚠ Mode BINAIRE : le quiz ne produit que juste/faux → `Good(3)` / `Again(1)`. Les branches
 * Hard(2)/Easy(4) (poids w15/w16) ne se déclenchent jamais — conservées pour rester fidèle aux
 * 17 poids publiés.
 *
 * ⚠ Les 17 poids par défaut proviennent de la référence FSRS-4.5 publiée (Open Spaced
 * Repetition / ts-fsrs), reproduits verbatim. NE PAS les modifier : les tests d'invariant
 * (R(S,S)=0.9) valident la transposition des FORMULES, pas ces constantes.
 *
 * Module PUR : `today` est toujours injecté, jamais lu d'une horloge.
 */

/** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. En binaire, seuls 1 et 3 sont émis. */
export type Grade = 1 | 2 | 3 | 4;

/** État de mémoire d'une entité : `[stabilité (jours), difficulté (1..10), dernier jour]`. */
export type Fsrs = [number, number, number];

// Poids par défaut FSRS-4.5 (17), verbatim de la référence publiée.
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // garantit R(S, S) = 0.9
const S_MIN = 0.01;
const clampD = (d: number) => Math.min(10, Math.max(1, d));

/** Difficulté initiale pour le grade « Good » — cible de la réversion à la moyenne. */
const D0_GOOD = W[4];

/** Rétrievabilité après `t` jours pour une stabilité `s`. */
function r(t: number, s: number): number {
  return Math.pow(1 + FACTOR * (t / s), DECAY);
}

export function retrievability(state: Fsrs, today: number): number {
  const t = Math.max(0, today - state[2]);
  return r(t, state[0]);
}

export function isDue(state: Fsrs, today: number, retention = 0.9): boolean {
  return retrievability(state, today) < retention;
}

export function fsrsInit(grade: Grade, today: number): Fsrs {
  const s = Math.max(S_MIN, W[grade - 1]);           // S0(G) = w_{G-1}
  const d = clampD(W[4] - (grade - 3) * W[5]);        // D0(G) = w4 - (G-3)*w5
  return [s, d, today];
}

export function fsrsReview(state: Fsrs, grade: Grade, today: number): Fsrs {
  const [s, d] = state;
  const t = Math.max(0, today - state[2]);
  const rr = r(t, s);
  // Difficulté suivante, avec réversion à la moyenne vers D0(Good).
  const dNext = clampD(W[7] * D0_GOOD + (1 - W[7]) * (d - W[6] * (grade - 3)));
  let sNext: number;
  if (grade === 1) {
    // Post-lapse : la stabilité retombe.
    sNext = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - rr));
  } else {
    const hard = grade === 2 ? W[15] : 1;
    const easy = grade === 4 ? W[16] : 1;
    sNext = s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - rr)) - 1) * hard * easy + 1);
  }
  return [Math.max(S_MIN, sNext), dNext, today];
}
```

- [ ] **Step 4 : lancer, vérifier le succès des invariants**

Run: `bun test src/lib/fsrs.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5 : ajouter les vecteurs de référence et les propriétés**

Ajouter à `src/lib/fsrs.test.ts` :

```ts
// Vecteurs de référence : valeurs INITIALES, calculables sans ambiguïté depuis les poids
// (S0 = poids brut, D0 = combinaison linéaire). Ils figent la transposition des formules d'init.
test("init Good(3) = [w2, w4, jour]", () => {
  expect(fsrsInit(3, 200)).toEqual([3.7145, 5.1618, 200]);
});

test("init Again(1) : D0 = w4 + 2·w5 (plus difficile), S0 = w0", () => {
  const [s, d, day] = fsrsInit(1, 200);
  expect(s).toBeCloseTo(0.4872, 6);
  expect(d).toBeCloseTo(5.1618 + 2 * 1.2298, 6); // 7.6214
  expect(day).toBe(200);
});

// Propriétés de la révision (le sens du modèle), sans figer un nombre calculé à la main.
test("succès après un délai : la stabilité CROÎT, la date avance", () => {
  const before: Fsrs = [10, 5, 100];
  const [sAfter, , dayAfter] = fsrsReview(before, 3, 130); // écoulé 30
  expect(sAfter).toBeGreaterThan(10);
  expect(dayAfter).toBe(130);
});

test("succès le MÊME jour (écoulé 0) : stabilité inchangée (e^0−1 = 0)", () => {
  const before: Fsrs = [10, 5, 100];
  const [sAfter] = fsrsReview(before, 3, 100);
  expect(sAfter).toBeCloseTo(10, 6);
});

test("échec : la difficulté augmente, et reste ≤ 10", () => {
  const before: Fsrs = [10, 5, 100];
  const [, dAfter] = fsrsReview(before, 1, 130);
  expect(dAfter).toBeGreaterThan(5);
  expect(dAfter).toBeLessThanOrEqual(10);
});

test("répétés Again : la difficulté sature à 10 sans dépasser", () => {
  let st: Fsrs = fsrsInit(1, 0);
  for (let i = 1; i <= 20; i++) st = fsrsReview(st, 1, i * 5);
  expect(st[1]).toBeLessThanOrEqual(10);
  expect(st[1]).toBeGreaterThan(9);
});

test("la stabilité ne descend jamais sous S_MIN", () => {
  const [s] = fsrsReview([0.02, 9, 100], 1, 101);
  expect(s).toBeGreaterThanOrEqual(0.01);
});
```

- [ ] **Step 6 : lancer les tests**

Run: `bun test src/lib/fsrs.test.ts`
Expected: PASS — 12 tests. Si un vecteur d'init échoue, la transposition des formules est fausse : NE PAS ajuster le test pour qu'il passe — relire la formule contre la spec § 4.

- [ ] **Step 7 : typecheck + commit**

Run: `bun run typecheck`
Expected: `tsc --noEmit` sans erreur.

```bash
git add src/lib/fsrs.ts src/lib/fsrs.test.ts
git commit -m "feat(fsrs): algorithme FSRS-4.5 binaire, couche pure validee par invariants"
```

---

## Task 2 : les requêtes (`revision.ts`)

**Files:**
- Create: `src/features/quiz/revision.ts`
- Test: `src/features/quiz/revision.test.ts`

**Interfaces:**
- Consumes : `Fsrs`, `isDue`, `retrievability` de `../../lib/fsrs.ts` ; `dayNumber` de `./traps.ts` ; `type Question` de `../../types/quiz.ts`.
- Produces :
  - `type FsrsMap = Record<string, Fsrs>`
  - `asFsrs(raw: Record<string, unknown> | null): FsrsMap`
  - `dueEntities(map: FsrsMap, today: number): { iri: string; r: number }[]` (triées par `r` croissant)
  - `dueBySkill(map: FsrsMap, today: number): { kanji: number; vocab: number; gram: number; autre: number; total: number }`
  - `fsrsIndex(questions: Question[]): Map<string, number[]>` (IRI → ords, mémoïsé)
  - `clearRevisionCache(): void`
  - `selectRevision(map: FsrsMap, today: number, questions: Question[], exclude: Set<number>, limit: number): Question[]`

- [ ] **Step 1 : écrire le test qui échoue**

`src/features/quiz/revision.test.ts` :

```ts
import { test, expect, beforeEach } from "bun:test";
import {
  asFsrs, dueEntities, dueBySkill, fsrsIndex, selectRevision, clearRevisionCache,
} from "./revision.ts";
import { fsrsInit } from "../../lib/fsrs.ts";
import type { Question } from "../../types/quiz.ts";

beforeEach(() => clearRevisionCache());

const q = (id: number, tests?: string[]): Question =>
  ({ id, cat: "vocabulaire", d: 1, q: "?", o: ["a", "b"], a: 0, ...(tests ? { tests } : {}) });

test("asFsrs : blob absent ou malformé → {}", () => {
  expect(asFsrs(null)).toEqual({});
  expect(asFsrs({})).toEqual({});
  expect(asFsrs({ fsrs: "corrompu" })).toEqual({});
  expect(asFsrs({ fsrs: { "jlpt:word/x": [1, 5, 0] } })).toEqual({ "jlpt:word/x": [1, 5, 0] });
});

test("dueEntities : seules les entités dues (R<0.9), triées de la plus en retard à la moins", () => {
  const map = { "jlpt:word/a": fsrsInit(3, 0), "jlpt:kanji/b": fsrsInit(3, 0) };
  // à today=200, très au-delà de la stabilité (S≈3.7) → toutes dues
  const due = dueEntities(map, 200);
  expect(due.map((d) => d.iri).sort()).toEqual(["jlpt:kanji/b", "jlpt:word/a"]);
  for (let i = 1; i < due.length; i++) expect(due[i - 1].r).toBeLessThanOrEqual(due[i].r);
});

test("dueEntities : une entité fraîche (revue à l'instant) n'est PAS due", () => {
  const map = { "jlpt:word/a": fsrsInit(3, 200) };
  expect(dueEntities(map, 200)).toEqual([]);
});

test("dueBySkill : ventile par préfixe d'IRI", () => {
  const map = {
    "jlpt:word/a": fsrsInit(3, 0), "jlpt:kanji/b": fsrsInit(3, 0), "jlpt:gram/c": fsrsInit(3, 0),
  };
  const by = dueBySkill(map, 200);
  expect(by).toEqual({ vocab: 1, kanji: 1, gram: 1, autre: 0, total: 3 });
});

test("fsrsIndex : inverse q.tests (IRI → ords), ignore les questions sans arête", () => {
  const idx = fsrsIndex([q(1, ["jlpt:word/a"]), q(2, ["jlpt:word/a"]), q(3)]);
  expect(idx.get("jlpt:word/a")).toEqual([1, 2]);
  expect(idx.has("__aucune")).toBe(false);
});

test("selectRevision : une question par entité due (la plus en retard d'abord), hors exclude, jusqu'à limit", () => {
  const map = { "jlpt:word/a": fsrsInit(3, 0), "jlpt:kanji/b": fsrsInit(3, 0) };
  const qs = [q(1, ["jlpt:word/a"]), q(2, ["jlpt:kanji/b"])];
  const picked = selectRevision(map, 200, qs, new Set(), 5);
  expect(picked.map((x) => x.id).sort()).toEqual([1, 2]);
});

test("selectRevision : respecte limit et exclude, saute une entité due sans question", () => {
  const map = {
    "jlpt:word/a": fsrsInit(3, 0), "jlpt:kanji/b": fsrsInit(3, 0), "jlpt:gram/z": fsrsInit(3, 0),
  };
  const qs = [q(1, ["jlpt:word/a"]), q(2, ["jlpt:kanji/b"])]; // rien ne teste gram/z
  const picked = selectRevision(map, 200, qs, new Set([1]), 5);
  expect(picked.map((x) => x.id)).toEqual([2]); // 1 exclu, gram/z sans question
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run: `bun test src/features/quiz/revision.test.ts`
Expected: FAIL — `Cannot find module './revision.ts'`

- [ ] **Step 3 : écrire les requêtes**

`src/features/quiz/revision.ts` :

```ts
/**
 * Requêtes du modèle de mémoire : lecture de l'état FSRS du blob, entités dues, index inverse.
 *
 * Le pont ord ↔ IRI : l'état FSRS est indexé par IRI d'entité (`jlpt:word/影響`), le quiz par
 * `ord`. `q.tests` donne ord → IRIs ; `fsrsIndex` en construit l'inverse pour retrouver une
 * question qui teste une entité due. Module PUR (date injectée).
 */
import { isDue, retrievability, type Fsrs } from "../../lib/fsrs.ts";
import type { Question } from "../../types/quiz.ts";

export type FsrsMap = Record<string, Fsrs>;

/** L'état FSRS du blob, ou `{}` si absent/malformé. Un blob antérieur au champ n'a pas besoin
 *  de migration. Validation superficielle : un tuple à 3 nombres. */
export function asFsrs(raw: Record<string, unknown> | null): FsrsMap {
  const m = raw?.fsrs;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const out: FsrsMap = {};
  for (const [iri, v] of Object.entries(m as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number")) {
      out[iri] = v as Fsrs;
    }
  }
  return out;
}

/** Entités dues (R < 0,9), triées de la plus en retard (R le plus bas) à la moins. */
export function dueEntities(map: FsrsMap, today: number): { iri: string; r: number }[] {
  const due: { iri: string; r: number }[] = [];
  for (const [iri, st] of Object.entries(map)) {
    if (isDue(st, today)) due.push({ iri, r: retrievability(st, today) });
  }
  return due.sort((a, b) => a.r - b.r);
}

/** Compétence d'une entité d'après son préfixe d'IRI. */
function skillOfIri(iri: string): "vocab" | "kanji" | "gram" | "autre" {
  if (iri.startsWith("jlpt:word/")) return "vocab";
  if (iri.startsWith("jlpt:kanji/")) return "kanji";
  if (iri.startsWith("jlpt:gram/")) return "gram";
  return "autre";
}

/** Décompte des entités dues par compétence (pour le panneau Accueil). */
export function dueBySkill(map: FsrsMap, today: number) {
  const by = { kanji: 0, vocab: 0, gram: 0, autre: 0, total: 0 };
  for (const { iri } of dueEntities(map, today)) { by[skillOfIri(iri)]++; by.total++; }
  return by;
}

let indexCache: { key: Question[]; index: Map<string, number[]> } | null = null;

/** Vide la mémoïsation de l'index inverse (isolation des tests, cf. clearGraphCache). */
export function clearRevisionCache(): void { indexCache = null; }

/** Index inverse IRI → ords, mémoïsé sur l'identité du tableau de questions. */
export function fsrsIndex(questions: Question[]): Map<string, number[]> {
  if (indexCache && indexCache.key === questions) return indexCache.index;
  const index = new Map<string, number[]>();
  for (const q of questions) {
    for (const iri of q.tests ?? []) {
      const arr = index.get(iri);
      if (arr) arr.push(q.id); else index.set(iri, [q.id]);
    }
  }
  indexCache = { key: questions, index };
  return index;
}

/** Jusqu'à `limit` questions de révision : pour chaque entité due (la plus en retard d'abord),
 *  la première question (ord croissant) qui la teste et n'est pas déjà exclue. Pure. */
export function selectRevision(
  map: FsrsMap, today: number, questions: Question[], exclude: Set<number>, limit: number,
): Question[] {
  if (limit <= 0) return [];
  const index = fsrsIndex(questions);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const taken = new Set(exclude);
  const out: Question[] = [];
  for (const { iri } of dueEntities(map, today)) {
    if (out.length >= limit) break;
    const ords = (index.get(iri) ?? []).slice().sort((a, b) => a - b);
    for (const ord of ords) {
      if (!taken.has(ord)) { const q = byId.get(ord); if (q) { out.push(q); taken.add(ord); break; } }
    }
  }
  return out;
}
```

- [ ] **Step 4 : lancer les tests + typecheck**

Run: `bun test src/features/quiz/revision.test.ts && bun run typecheck`
Expected: PASS — 7 tests, puis `tsc --noEmit` sans erreur.

- [ ] **Step 5 : commit**

```bash
git add src/features/quiz/revision.ts src/features/quiz/revision.test.ts
git commit -m "feat(fsrs): requetes de revision (asFsrs, dueEntities, index inverse, selectRevision)"
```

---

## Task 3 : enregistrer l'état à chaque réponse (`useQuiz#choose`)

**Files:**
- Modify: `src/features/quiz/useQuiz.ts` (fonction `choose`)
- Test: `src/features/quiz/revision-wiring.test.ts`

**Interfaces:**
- Consumes : `asFsrs` de `./revision.ts` ; `fsrsInit`, `fsrsReview`, `type Grade`, `type FsrsMap` ; `dayNumber` de `./traps.ts` ; `writeProgress`/`readRawProgress` de `../../lib/storage.ts`.
- Produces : champ `fsrs: FsrsMap` dans le blob `PROGRESS_KEY`.

- [ ] **Step 1 : écrire le garde-fou (le risque propre au câblage)**

`src/features/quiz/revision-wiring.test.ts` :

```ts
import { test, expect, beforeEach } from "bun:test";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { asFsrs } from "./revision.ts";

beforeEach(() => localStorage.clear());

// Le risque propre au câblage n'est pas le calcul FSRS (pur, testé à part), c'est la PERTE
// SILENCIEUSE de la carte : writeProgress ne fusionne en profondeur que `skill`, tout le reste
// est remplacé. Une feature qui patcherait le blob sans repasser `fsrs` l'effacerait — sans
// erreur (cf. CLAUDE.md « réécrire le blob entier efface les champs des autres features »).
test("un patch d'une autre feature ne perd pas la carte fsrs", () => {
  writeProgress({ fsrs: { "jlpt:word/a": [10, 5, 200] } });
  writeProgress({ total: 5 });
  writeProgress({ skill: { kanji: { R: 1500, t: 3 } } });
  expect(asFsrs(readRawProgress())).toEqual({ "jlpt:word/a": [10, 5, 200] });
});

test("la carte survit à un aller-retour JSON complet", () => {
  writeProgress({ fsrs: { "jlpt:word/a": [10, 5, 200], "jlpt:kanji/火": [3.1, 6.8, 201] } });
  expect(asFsrs(readRawProgress())["jlpt:kanji/火"]).toEqual([3.1, 6.8, 201]);
});
```

- [ ] **Step 2 : lancer, vérifier l'état**

Run: `bun test src/features/quiz/revision-wiring.test.ts`
Expected: FAIL tant que `revision.ts` n'est pas importable, sinon les deux cas passent d'emblée (writeProgress étant générique). **S'ils passent d'emblée, c'est le résultat attendu** : ce test fige un comportement de `writeProgress` dont ce lot devient dépendant.

- [ ] **Step 3 : câbler `choose`**

Dans `src/features/quiz/useQuiz.ts`, ajouter aux imports :

```ts
import { asFsrs } from "./revision.ts";
import { fsrsInit, fsrsReview, type Grade } from "../../lib/fsrs.ts";
```

(`dayNumber` est déjà importé de `./traps.ts` — le vérifier ; sinon l'ajouter à l'import existant.)

Dans `choose`, dans la portée « mesure » partagée (à côté du calcul de `nextConfusions`) :

```ts
    // Modèle de mémoire : la réponse révise l'entité qu'elle teste (arête `tests`, ~1).
    // Carte COMPLÈTE réécrite (writeProgress ne deep-merge que `skill`).
    const iris = Array.isArray(q.tests) ? q.tests : [];
    let nextFsrs: Record<string, [number, number, number]> | undefined;
    if (iris.length) {
      const jour = dayNumber(new Date());
      const g: Grade = correct ? 3 : 1;
      const map = asFsrs(raw);
      for (const iri of iris) map[iri] = map[iri] ? fsrsReview(map[iri], g, jour) : fsrsInit(g, jour);
      nextFsrs = map;
    }
```

Puis, dans l'objet passé à `writeProgress`, à côté de `...(nextConfusions !== undefined ? { confusions: nextConfusions } : {})` :

```ts
      ...(nextFsrs !== undefined ? { fsrs: nextFsrs } : {}),
```

- [ ] **Step 4 : lancer les tests + toute la suite + typecheck**

Run: `bun test src/features/quiz/revision-wiring.test.ts && bun run typecheck && bun test`
Expected: PASS — 2 tests du garde-fou, `tsc` propre, suite complète à 0 échec (`choose` est couvert par des tests existants qui ne doivent pas bouger).

- [ ] **Step 5 : commit**

```bash
git add src/features/quiz/useQuiz.ts src/features/quiz/revision-wiring.test.ts
git commit -m "feat(fsrs): met a jour l'etat de memoire de l'entite a chaque reponse"
```

---

## Task 4 : la tranche « révision » dans la composition de session

**Files:**
- Modify: `src/features/entrainement/sessionPlan.ts`, `src/features/quiz/useQuiz.ts` (`start()`)
- Test: `src/features/entrainement/sessionPlan.test.ts`

**Interfaces:**
- Consumes : `selectRevision`, `asFsrs` de `../quiz/revision.ts` ; `dayNumber` de `../quiz/traps.ts`.
- Produces :
  - `REVISION_CAP = 0.4`
  - `SessionState` gagne `revisionDue: number`
  - `SessionPlan` composé : `alloc: { errors: number; revision: number; learn: number; adaptive: number }`
  - `Caps` gagne `revision: boolean`

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter à `src/features/entrainement/sessionPlan.test.ts` :

```ts
import { pickSessionPlan, REVISION_CAP } from "./sessionPlan.ts";

const base = { resume: false, daysSinceDiagnostic: 3, wrongCount: 0, newCoursePoints: 0, revisionDue: 0 };
const CAPS = { diagnostic: false, errors: true, learn: true, revision: true };

test("la révision remplit jusqu'à REVISION_CAP, après les erreurs", () => {
  const p = pickSessionPlan({ ...base, wrongCount: 100, revisionDue: 100 }, 20, CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.errors).toBe(Math.floor(0.3 * 20));   // 6
  expect(p.alloc.revision).toBe(Math.floor(REVISION_CAP * 20)); // 8
});

test("la révision est bornée par le nombre d'entités dues", () => {
  const p = pickSessionPlan({ ...base, revisionDue: 2 }, 20, CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.revision).toBe(2);
});

test("erreurs + révision saturantes → apprentissage et adaptatif à 0", () => {
  const p = pickSessionPlan({ ...base, wrongCount: 100, revisionDue: 100, newCoursePoints: 100 }, 10, CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.errors + p.alloc.revision + p.alloc.learn + p.alloc.adaptive).toBe(10);
  expect(p.alloc.learn).toBe(0);
});

test("capacité révision absente → aucune tranche révision", () => {
  const p = pickSessionPlan({ ...base, revisionDue: 100 }, 20, { ...CAPS, revision: false });
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.revision).toBe(0);
});

test("fsrs vide (revisionDue 0) → session inchangée : tout en adaptatif", () => {
  const p = pickSessionPlan(base, 20, CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc).toEqual({ errors: 0, revision: 0, learn: 0, adaptive: 20 });
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: FAIL — `REVISION_CAP` non exporté / `revision` absent de l'alloc.

- [ ] **Step 3 : étendre `sessionPlan.ts`**

Ajouter la constante, après `LEARN_CAP` :

```ts
/** Part maximale du budget consacrée à la révision espacée (entités dues FSRS). */
export const REVISION_CAP = 0.4;
```

Ajouter à `interface SessionState`, après `newCoursePoints` :

```ts
  /** Nombre d'entités dues à révision aujourd'hui (0 tant que la mémoire ne s'est pas accumulée). */
  revisionDue: number;
```

Ajouter à `interface Caps`, après `learn` :

```ts
  revision: boolean;
```

Remplacer le type `SessionPlan` composé et `BUILT_CAPS` :

```ts
export type SessionPlan =
  | { kind: "resume" }
  | { kind: "diagnostic" }
  | { kind: "composed"; alloc: { errors: number; revision: number; learn: number; adaptive: number } };

/** Capacités construites à ce jour. */
export const BUILT_CAPS: Caps = { diagnostic: true, errors: true, learn: true, revision: true };
```

Remplacer le corps composé de `pickSessionPlan` (après le bloc diagnostic) :

```ts
  const errors = caps.errors ? Math.min(state.wrongCount, Math.floor(ERRORS_CAP * total)) : 0;
  // La révision suit les erreurs : à 4,5 mois de l'examen, l'oubli prime (priorité haute).
  const revision = caps.revision
    ? Math.min(state.revisionDue, Math.floor(REVISION_CAP * total), Math.max(0, total - errors))
    : 0;
  const learn = caps.learn
    ? Math.min(state.newCoursePoints, Math.floor(LEARN_CAP * total), Math.max(0, total - errors - revision))
    : 0;
  const adaptive = Math.max(0, total - errors - revision - learn);
  return { kind: "composed", alloc: { errors, revision, learn, adaptive } };
```

- [ ] **Step 4 : lancer les tests du plan de session**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: PASS. ⚠ Les tests EXISTANTS de ce fichier construisent des `SessionState`/`SessionPlan` sans `revisionDue`/`revision` — si `tsc` ou un cas casse, mettre à jour ces littéraux (ajouter `revisionDue: 0` à l'état, `revision: 0` aux `alloc` attendus). C'est une adaptation mécanique, pas un changement de comportement.

- [ ] **Step 5 : câbler la tranche dans `start()` (`useQuiz.ts`)**

Dans `start()`, là où l'état de session est construit pour `pickSessionPlan`, ajouter `revisionDue`.
Calculer le décompte des dues depuis le blob (pas de fetch — l'état est dans le blob) :

```ts
    const revisionDue = dueBySkill(asFsrs(raw), dayNumber(new Date())).total;
```

et passer `revisionDue` dans l'objet `SessionState`. Ajouter `dueBySkill` à l'import de `./revision.ts`.

Après la construction de `errorQs` et de son `exclude`, et après `const pools = await loadAllCategories();`, insérer la tranche révision AVANT la tranche apprentissage :

```ts
    // Tranche révision : questions testant les entités dues, la plus en retard d'abord.
    const allPool = SKILLS.flatMap((c) => pools[c]);
    const revisionQs = plan.alloc.revision > 0
      ? selectRevision(asFsrs(raw), dayNumber(new Date()), allPool, exclude, plan.alloc.revision)
      : [];
    for (const q of revisionQs) exclude.add(q.id);
```

Ajouter `selectRevision` à l'import de `./revision.ts`. Puis inclure `revisionQs` dans les tranches garanties passées à `composeSession` :

```ts
    const session = composeSession([...errorQs, ...revisionQs, ...learnQs], picked, total, Math.random);
```

Et corriger la cible adaptative pour retrancher aussi la révision :

```ts
    const adaptiveTarget = Math.max(0, total - errorQs.length - revisionQs.length - learnQs.length);
```

- [ ] **Step 6 : suite complète + typecheck**

Run: `bun run typecheck && bun test`
Expected: `tsc` propre, 0 échec. Vérifier que les tests existants de `useQuiz`/`sessionPlan` passent (adaptés si besoin au champ `revisionDue`).

- [ ] **Step 7 : commit**

```bash
git add src/features/entrainement/sessionPlan.ts src/features/entrainement/sessionPlan.test.ts src/features/quiz/useQuiz.ts
git commit -m "feat(fsrs): tranche revision dans la composition de session (cap 40%, priorite haute)"
```

---

## Task 5 : le panneau « À réviser » sur l'Accueil

**Files:**
- Create: `src/features/dashboard/useRevision.ts`, `src/features/dashboard/RevisionPanel.tsx`, `src/features/dashboard/RevisionPanel.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes : `asFsrs`, `dueBySkill` de `../quiz/revision.ts` ; `dayNumber` de `../quiz/traps.ts` ; `readRawProgress` de `../../lib/storage.ts` ; `PANEL`, `H2` de `../../ui/styles.ts`.
- Produces : `useRevision(): DueCounts | null`, `<RevisionPanel counts={…} />`, `type DueCounts`.

- [ ] **Step 1 : écrire le test qui échoue**

`src/features/dashboard/RevisionPanel.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RevisionPanel } from "./RevisionPanel.tsx";

test("sans données, invite à pratiquer plutôt qu'un tableau vide", () => {
  const html = renderToStaticMarkup(<RevisionPanel counts={null} />);
  expect(html).toContain("À réviser");
  expect(html).toContain("Rien à réviser");
});

test("aucune entité due → message « à jour »", () => {
  const html = renderToStaticMarkup(
    <RevisionPanel counts={{ kanji: 0, vocab: 0, gram: 0, autre: 0, total: 0 }} />,
  );
  expect(html).toContain("à jour");
});

test("des entités dues → total et ventilation", () => {
  const html = renderToStaticMarkup(
    <RevisionPanel counts={{ kanji: 4, vocab: 7, gram: 2, autre: 0, total: 13 }} />,
  );
  expect(html).toContain("13");
  expect(html).toContain("Kanji");
  expect(html).toContain("Vocab");
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run: `bun test src/features/dashboard/RevisionPanel.test.tsx`
Expected: FAIL — `Cannot find module './RevisionPanel.tsx'`

- [ ] **Step 3 : écrire le panneau**

`src/features/dashboard/RevisionPanel.tsx` :

```tsx
import { PANEL, H2 } from "../../ui/styles.ts";

export interface DueCounts { kanji: number; vocab: number; gram: number; autre: number; total: number }

/** Panneau « À réviser » : entités dont la mémoire décline (FSRS). Sans logique — le décompte
 *  vient de `dueBySkill`, pur et testé à part. */
export function RevisionPanel({ counts }: { counts: DueCounts | null }) {
  if (!counts) {
    return (
      <section className={PANEL}>
        <h2 className={H2}>À réviser</h2>
        <p className="text-fg-dim text-sm m-0">
          Rien à réviser pour l&#39;instant — réponds à quelques questions pour amorcer la mémoire.
        </p>
      </section>
    );
  }
  if (counts.total === 0) {
    return (
      <section className={PANEL}>
        <h2 className={H2}>À réviser</h2>
        <p className="text-fg-dim text-sm m-0">Tu es à jour : aucune entité à revoir aujourd&#39;hui.</p>
      </section>
    );
  }
  const lignes: [string, number][] = [["Kanji", counts.kanji], ["Vocab", counts.vocab], ["Grammaire", counts.gram]];
  return (
    <section className={PANEL}>
      <h2 className={H2}>À réviser</h2>
      <p className="text-fg text-2xl font-bold m-0">{counts.total}</p>
      <p className="text-fg-dim text-meta mt-0 mb-3">entités dont la mémoire décline aujourd&#39;hui</p>
      <ul className="list-none p-0 m-0 flex gap-4 text-sm">
        {lignes.filter(([, n]) => n > 0).map(([lbl, n]) => (
          <li key={lbl} className="text-fg-dim">{lbl} <span className="text-fg tabular-nums">{n}</span></li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4 : lancer, vérifier le succès**

Run: `bun test src/features/dashboard/RevisionPanel.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5 : écrire le hook**

`src/features/dashboard/useRevision.ts` :

```ts
import { useEffect, useState } from "react";
import { readRawProgress } from "../../lib/storage.ts";
import { asFsrs, dueBySkill } from "../quiz/revision.ts";
import { dayNumber } from "../quiz/traps.ts";
import type { DueCounts } from "./RevisionPanel.tsx";

/**
 * Décompte des entités dues aujourd'hui. Contrairement à `useTraps`, AUCUN fetch : la
 * rétrievabilité se calcule depuis la seule carte `fsrs` du blob (FSRS markovien) — les pools
 * ne servent qu'à la SÉLECTION, pas au comptage. Un nouvel arrivant (blob sans `fsrs`) obtient
 * `total: 0` sans rien charger.
 */
export function useRevision(): DueCounts | null {
  const [counts, setCounts] = useState<DueCounts | null>(null);
  useEffect(() => {
    const map = asFsrs(readRawProgress());
    if (!Object.keys(map).length) return; // rien collecté encore → état vide
    setCounts(dueBySkill(map, dayNumber(new Date())));
  }, []);
  return counts;
}
```

- [ ] **Step 6 : monter le panneau sur l'Accueil (`App.tsx`)**

Ajouter aux imports de `src/App.tsx` :

```tsx
import { RevisionPanel } from "./features/dashboard/RevisionPanel.tsx";
import { useRevision } from "./features/dashboard/useRevision.ts";
import type { DueCounts } from "./features/dashboard/RevisionPanel.tsx";
```

Ajouter `revision` aux props de `DashboardView` (optionnel, pour ne pas casser d'autres appelants) :

```tsx
export function DashboardView({ model, days, scores, coverage, traps, revision }: {
  model: DashboardModel | null; days: number; scores: number[];
  coverage?: Record<Skill, SkillCoverage> | null;
  traps?: TrapModel | null;
  revision?: DueCounts | null;
}) {
```

Monter le panneau dans le JSX, entre `<TrapPanel …/>` et la section « Progression » :

```tsx
      <RevisionPanel counts={revision ?? null} />
```

Dans `App`, appeler le hook et le passer :

```tsx
  const revision = useRevision();
```
```tsx
  return <DashboardView model={model} days={daysUntilExam(now)} scores={scores} coverage={coverage} traps={traps} revision={revision} />;
```

- [ ] **Step 7 : suite complète, typecheck, build**

Run: `bun run typecheck && bun test && bun run build`
Expected: `tsc` propre, 0 échec, build sans erreur.

- [ ] **Step 8 : commit**

```bash
git add src/features/dashboard/RevisionPanel.tsx src/features/dashboard/RevisionPanel.test.tsx src/features/dashboard/useRevision.ts src/App.tsx
git commit -m "feat(fsrs): panneau A reviser sur l'Accueil (decompte des entites dues)"
```

---

## Vérification finale

- [ ] `bun run typecheck` — sans erreur
- [ ] `bun test` — 0 échec
- [ ] `bun run build` — build propre
- [ ] **PAS de bump `sw.js`** (ce lot ne modifie aucun asset livré — `data/graph/` intact)
- [ ] Écart de formulation avec la spec à signaler : la spec § 4 dit « stabilité post-lapse (≤ stabilité avant) ». FSRS-4.5 n'impose PAS ce plafond dur ; la formule de lapse le produit *en pratique* mais n'est pas capée. Le plan implémente la formule exacte (sans `min(.,S)` artificiel), conformément à « fidèle à la référence, pas à peu près ».
