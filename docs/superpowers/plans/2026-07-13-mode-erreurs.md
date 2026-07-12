# Mode « Réviser les erreurs » (sous-projet #2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre réel l'ingrédient « erreurs » de la session composée : injecter un socle garanti de fautes récentes (≤30 % du budget), toutes catégories confondues, en allumant la capacité du cerveau du #1.

**Architecture:** Trois helpers purs/testables dans `bank.ts` (`selectRecentErrors`, `composeSession`, `questionsForIds`), un flag flippé dans `sessionPlan.ts` (`BUILT_CAPS.errors = true`), et le câblage dans `useQuiz.start()`. `questionsForIds` consolide le résolveur ids→questions aujourd'hui dupliqué dans `resumeNow`.

**Tech Stack:** React + TypeScript, bundlé par Bun. Tests : `bun test` (helpers purs unitaires ; fetch mocké pour `questionsForIds` via le patron existant de `bank.test.ts`).

## Global Constraints

- **Runtime & outils : `bun` exclusivement — jamais `node`.** Tests : `bun test`. Typecheck : `bun run typecheck`.
- **Travail dans le worktree `.worktrees/mode-erreurs`** (déjà créé, branche `mode-erreurs`, base `c49aa60`).
- **Jamais de ligne `Co-Authored-By`** dans les commits.
- **Pas de bump `CACHE` dans `sw.js`** : seules des sources `src/` changent, aucun asset livré.
- **Cap erreurs = 30 %** (déjà encodé dans `pickSessionPlan`) ; **sélection = plus récentes** (queue de `wrong[]`) ; **plancher souple** : le boost +150 de `pickAdaptive` reste actif (on continue de lui passer `wrong`).
- Aucun changement UI (la carte reste « magique »).

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/lib/bank.ts` | +`selectRecentErrors`, +`composeSession`, +`questionsForIds` | **Modifier** |
| `src/lib/bank.test.ts` | Tests des 3 helpers | **Modifier** |
| `src/features/quiz/useQuiz.ts` | `resumeNow` réutilise `questionsForIds` ; `start()` câble la tranche erreurs | **Modifier** |
| `src/features/entrainement/sessionPlan.ts` | `BUILT_CAPS.errors = true` | **Modifier** |
| `src/features/entrainement/sessionPlan.test.ts` | Contrat `BUILT_CAPS` mis à jour (erreurs émises) | **Modifier** |

Contexte utile (types/fonctions existants, ne pas recréer) : `bank.ts` exporte déjà `shuffle`, `pickAdaptive`, `allocate`, `loadCategory(cat, fetchImpl=fetch)`, `loadBankIndex`, `clearCategoryCache`, `clearBankIndexCache`, et un `type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>` **module-local**. `Question` vient de `../types/quiz.ts` ; `Skill`/`SKILLS` de `../types/progress.ts`.

---

## Task 1: Helpers purs `selectRecentErrors` + `composeSession`

**Files:**
- Modify: `src/lib/bank.ts`
- Test: `src/lib/bank.test.ts`

**Interfaces:**
- Consumes: `shuffle` (déjà dans `bank.ts`), `Question`.
- Produces:
  - `function selectRecentErrors(wrong: number[], n: number): number[]` — les `n` ids les plus récents de `wrong[]` (sa queue), **plus récent en tête** ; `[]` si `n<=0` ou `wrong` vide.
  - `function composeSession(errorQs: Question[], adaptiveCandidates: Question[], total: number, rng?: () => number): Question[]` — `adaptiveTarget = max(0, total - errorQs.length)` ; renvoie `shuffle([...errorQs, ...shuffle(adaptiveCandidates).slice(0, adaptiveTarget)])`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/bank.test.ts` (the file already imports `shuffle, pickAdaptive, allocate, loadCategory, loadBankIndex, clearBankIndexCache` and defines `const q = (id, d) => ({ id, cat: "kanji", d, q: "", o: [], a: 0 })`). Update the import line and add tests:

```ts
// change the existing import line to add the three new helpers:
import {
  shuffle, pickAdaptive, allocate, loadCategory, loadBankIndex, clearBankIndexCache,
  selectRecentErrors, composeSession,
} from "./bank.ts";
```

```ts
test("selectRecentErrors returns [] for empty wrong or non-positive n", () => {
  expect(selectRecentErrors([], 3)).toEqual([]);
  expect(selectRecentErrors([1, 2, 3], 0)).toEqual([]);
  expect(selectRecentErrors([1, 2, 3], -1)).toEqual([]);
});

test("selectRecentErrors takes the tail (most recent), newest first", () => {
  // wrong is chronological: 10 oldest ... 40 newest
  expect(selectRecentErrors([10, 20, 30, 40], 2)).toEqual([40, 30]);
});

test("selectRecentErrors returns all (reversed) when n >= length", () => {
  expect(selectRecentErrors([10, 20, 30], 5)).toEqual([30, 20, 10]);
});

test("composeSession keeps all errorQs and fills adaptive up to total", () => {
  const rng = () => 0; // deterministic shuffle (no swaps beyond j=0)
  const errorQs = [q(1, 1), q(2, 1), q(3, 1)];
  const adaptive = [q(10, 1), q(11, 1), q(12, 1), q(13, 1), q(14, 1)];
  const out = composeSession(errorQs, adaptive, 6, rng);
  expect(out).toHaveLength(6);
  for (const id of [1, 2, 3]) expect(out.map((x) => x.id)).toContain(id);
  expect(new Set(out.map((x) => x.id)).size).toBe(6); // no duplicates
});

test("composeSession short errors slice: adaptive covers the remainder to total", () => {
  const errorQs = [q(1, 1)];
  const adaptive = [q(10, 1), q(11, 1), q(12, 1), q(13, 1)];
  const out = composeSession(errorQs, adaptive, 4, () => 0);
  expect(out).toHaveLength(4);
  expect(out.map((x) => x.id)).toContain(1);
});

test("composeSession clamps adaptiveTarget to 0 when errors already exceed total", () => {
  const errorQs = [q(1, 1), q(2, 1), q(3, 1)];
  const out = composeSession(errorQs, [q(10, 1)], 2, () => 0);
  expect(out).toHaveLength(3); // all errorQs kept, no adaptive added
  expect(out.map((x) => x.id).sort()).toEqual([1, 2, 3]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/bank.test.ts`
Expected: FAIL — `selectRecentErrors`/`composeSession` are not exported (import error / undefined).

- [ ] **Step 3: Implement the two helpers**

In `src/lib/bank.ts`, add after `pickAdaptive` (keep them next to the other picking utilities):

```ts
/** The `n` most-recent ids from `wrong[]` (its tail), newest first. Empty for n<=0 or no errors. */
export function selectRecentErrors(wrong: number[], n: number): number[] {
  if (n <= 0 || wrong.length === 0) return [];
  return wrong.slice(Math.max(0, wrong.length - n)).reverse();
}

/** Combine a guaranteed errors slice with adaptive fill into a single shuffled session.
 *  Adaptive fills `total - errorQs.length` (reconciles the budget when errorQs is short or empty;
 *  clamped at 0). Callers must exclude the error ids from `adaptiveCandidates` upstream. */
export function composeSession(
  errorQs: Question[], adaptiveCandidates: Question[], total: number, rng: () => number = Math.random,
): Question[] {
  const adaptiveTarget = Math.max(0, total - errorQs.length);
  const adaptiveQs = shuffle(adaptiveCandidates, rng).slice(0, adaptiveTarget);
  return shuffle([...errorQs, ...adaptiveQs], rng);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/bank.test.ts`
Expected: PASS (existing + 5 new tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-erreurs
git add src/lib/bank.ts src/lib/bank.test.ts
git commit -m "feat : helpers purs selectRecentErrors + composeSession (tranche erreurs)"
```

---

## Task 2: Résolveur partagé `questionsForIds` + consolidation de `resumeNow`

**Files:**
- Modify: `src/lib/bank.ts`
- Test: `src/lib/bank.test.ts`
- Modify: `src/features/quiz/useQuiz.ts`

**Interfaces:**
- Consumes: `loadCategory`, `FetchLike` (module-local), `Question`, `Skill`.
- Produces: `async function questionsForIds(ids: number[], idx: Record<number, Skill>, fetchImpl?: FetchLike): Promise<Question[]>` — mappe `ids → Question[]` en chargeant les pools des catégories requises (via `idx`), **dans l'ordre des `ids`**, ids inconnus filtrés.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/bank.test.ts`. Add `clearCategoryCache` and `questionsForIds` to the import, then the test:

```ts
// extend the import to add clearCategoryCache + questionsForIds:
import {
  shuffle, pickAdaptive, allocate, loadCategory, loadBankIndex, clearBankIndexCache,
  clearCategoryCache, selectRecentErrors, composeSession, questionsForIds,
} from "./bank.ts";
```

```ts
test("questionsForIds resolves ids across categories, preserves order, drops unknowns", async () => {
  clearCategoryCache();
  const idx = { 1: "kanji", 2: "grammaire", 3: "kanji" } as Record<string, string>;
  const fetchImpl = async (url: string) => ({
    json: async () =>
      url.includes("kanji")
        ? [{ id: 1, cat: "kanji", d: 1, q: "", o: [], a: 0 }, { id: 3, cat: "kanji", d: 1, q: "", o: [], a: 0 }]
        : [{ id: 2, cat: "grammaire", d: 1, q: "", o: [], a: 0 }],
  });
  const out = await questionsForIds([3, 2, 1, 99], idx as any, fetchImpl as any);
  expect(out.map((x) => x.id)).toEqual([3, 2, 1]); // order preserved, 99 (unknown) dropped
});

test("questionsForIds returns [] for no ids", async () => {
  expect(await questionsForIds([], {}, (async () => ({ json: async () => [] })) as any)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/bank.test.ts`
Expected: FAIL — `questionsForIds` is not exported.

- [ ] **Step 3: Implement `questionsForIds`**

In `src/lib/bank.ts`, add near `loadCategory` (it depends on it):

```ts
/** Resolve `ids → Question[]` by loading the pools of the categories the ids belong to (per `idx`).
 *  Order follows `ids`; ids absent from the pools are dropped. Shared by resume + the errors slice. */
export async function questionsForIds(
  ids: number[], idx: Record<number, Skill>, fetchImpl: FetchLike = fetch as FetchLike,
): Promise<Question[]> {
  if (!ids.length) return [];
  const catsNeeded = new Set<Skill>();
  for (const id of ids) { const c = idx[id]; if (c) catsNeeded.add(c); }
  const pools = await Promise.all([...catsNeeded].map((c) => loadCategory(c, fetchImpl)));
  const byId = new Map<number, Question>();
  for (const pool of pools) for (const p of pool) byId.set(p.id, p);
  return ids.map((id) => byId.get(id)).filter((p): p is Question => p !== undefined);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/bank.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `resumeNow` to reuse `questionsForIds`**

In `src/features/quiz/useQuiz.ts`, add `questionsForIds` to the `bank.ts` import (line 6):

```ts
import { allocate, loadCategory, pickAdaptive, shuffle, questionsForIds } from "../../lib/bank.ts";
```

Then in `resumeNow` (currently lines 305-314), replace the manual resolution block:

```ts
    const catsNeeded = new Set<Skill>();
    for (const id of r.ids) {
      const cat = idx[id];
      if (cat) catsNeeded.add(cat);
    }
    const pools = await Promise.all([...catsNeeded].map((c) => loadCategory(c)));
    const byId = new Map<number, Question>();
    for (const pool of pools) for (const q of pool) byId.set(q.id, q);

    const rebuilt = r.ids.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined);
```

with:

```ts
    const rebuilt = await questionsForIds(r.ids, idx);
```

(The surrounding `const idx = await ensureBankIndex(); if (!idx) return;` above and the `if (!rebuilt.length) { … }` guard below stay unchanged.)

- [ ] **Step 6: Typecheck + full suite (behaviour preserved)**

Run: `bun run typecheck`
Expected: PASS.

Run: `bun test`
Expected: PASS — full suite green (resume behaviour unchanged; `loadCategory` may now be flagged unused in `useQuiz.ts` if no other caller remains — it is still used by `start()`, so it stays imported).

- [ ] **Step 7: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-erreurs
git add src/lib/bank.ts src/lib/bank.test.ts src/features/quiz/useQuiz.ts
git commit -m "refactor : résolveur partagé questionsForIds (DRY resumeNow)"
```

---

## Task 3: Allumer la capacité + câbler la tranche erreurs dans `start()`

**Files:**
- Modify: `src/features/entrainement/sessionPlan.ts`
- Modify: `src/features/entrainement/sessionPlan.test.ts`
- Modify: `src/features/quiz/useQuiz.ts`

**Interfaces:**
- Consumes: `pickSessionPlan`/`BUILT_CAPS` (updated), `selectRecentErrors`/`questionsForIds`/`composeSession` (Tasks 1-2).
- Produces: no new exports — `start()` now injects the errors slice; `BUILT_CAPS.errors === true`.

- [ ] **Step 1: Update the contract test first (RED)**

In `src/features/entrainement/sessionPlan.test.ts`, replace the `#1 contract` test (currently at the end of the file) with the #2 contract:

```ts
test("#2 contract: BUILT_CAPS enables errors (30% cap); learn/diagnostic still off", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 5, daysSinceDiagnostic: null },
    10,
    BUILT_CAPS,
  );
  // errors = min(50, floor(0.30*10)) = 3; learn off = 0; adaptive = 7
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, learn: 0, adaptive: 7 } });
});

test("#2 contract: no errors emitted when wrong[] is empty", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 0 }, 10, BUILT_CAPS);
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 0, learn: 0, adaptive: 10 } });
});
```

- [ ] **Step 2: Run the test to verify it fails (RED)**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: FAIL — with `BUILT_CAPS.errors` still `false`, the first new test gets `{ errors: 0, learn: 0, adaptive: 10 }` instead of `{ errors: 3, … }`.

- [ ] **Step 3: Flip the capability**

In `src/features/entrainement/sessionPlan.ts`, change `BUILT_CAPS`:

```ts
/** Capacités construites à ce jour. Sous-projets #3→#4 : passer un flag à `true` ici. */
export const BUILT_CAPS: Caps = { diagnostic: false, errors: true, learn: false };
```

- [ ] **Step 4: Run the contract test to verify it passes (GREEN)**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the errors slice into `start()`**

In `src/features/quiz/useQuiz.ts`, extend the `bank.ts` import (line 6) to add the two picking helpers (`questionsForIds` was added in Task 2):

```ts
import {
  allocate, loadCategory, pickAdaptive, questionsForIds, selectRecentErrors, composeSession,
} from "../../lib/bank.ts";
```

(`shuffle` is no longer used directly in `useQuiz.ts` once `composeSession` replaces the inline `shuffle(picked).slice(...)` — remove `shuffle` from this import to avoid an unused import.)

Then replace the current composition block in `start()` (lines 191-204):

```ts
    const exclude = new Set<number>();
    const picked: Question[] = [];
    for (const cat of SKILLS) {
      const n = alloc[cat];
      if (!n) continue;
      const pool = await loadCategory(cat);
      const R = skillStateOf(raw, cat).R;
      const picks = pickAdaptive(pool, R, exclude, wrong).slice(0, n);
      for (const q of picks) exclude.add(q.id);
      picked.push(...picks);
    }

    const session = shuffle(picked).slice(0, plan.alloc.adaptive);
    if (!session.length) return;
```

with (seed `exclude` with the resolved error ids so the adaptive pick never duplicates them):

```ts
    // Errors slice: the most-recent wrong[] ids (up to plan.alloc.errors), resolved to questions.
    const errorIds = selectRecentErrors(wrong, plan.alloc.errors);
    const idx = await ensureBankIndex();
    const errorQs = idx ? await questionsForIds(errorIds, idx) : [];

    // Adaptive candidates fill the rest — excluding the errors already picked (no duplicates).
    const exclude = new Set<number>(errorQs.map((q) => q.id));
    const picked: Question[] = [];
    for (const cat of SKILLS) {
      const n = alloc[cat];
      if (!n) continue;
      const pool = await loadCategory(cat);
      const R = skillStateOf(raw, cat).R;
      const picks = pickAdaptive(pool, R, exclude, wrong).slice(0, n); // wrong kept → +150 boost (soft floor)
      for (const q of picks) exclude.add(q.id);
      picked.push(...picks);
    }

    // composeSession reconciles the budget: adaptive = total - errorQs.length (unresolved errors
    // fall back to adaptive), then shuffles errors + adaptive together.
    const session = composeSession(errorQs, picked, total, Math.random);
    if (!session.length) return;
```

Also update the stale comment above the `pickSessionPlan` call (lines 180-183) so it no longer says "#1 BUILT_CAPS is all-off". Replace that comment with:

```ts
    // Consult the decision engine. `resume: false` — "Commencer" always starts fresh; the resume
    // decision is handled at the card level. Errors are built (BUILT_CAPS.errors); diagnostic/learn
    // are not yet, so plan.kind is always "composed" here. Later sub-projects flip a cap and branch.
```

- [ ] **Step 6: Typecheck + full suite (GREEN)**

Run: `bun run typecheck`
Expected: PASS (confirm `shuffle` is no longer imported unused in `useQuiz.ts`; `plan.alloc.adaptive`/`plan.alloc.learn` unused is fine — they are properties, not bindings).

Run: `bun test`
Expected: PASS — full suite green.

- [ ] **Step 7: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-erreurs
git add src/features/entrainement/sessionPlan.ts src/features/entrainement/sessionPlan.test.ts src/features/quiz/useQuiz.ts
git commit -m "feat : injecter la tranche erreurs dans la session (BUILT_CAPS.errors)"
```

---

## Self-Review

**1. Spec coverage:**
- `BUILT_CAPS.errors = true` → **Task 3** step 3.
- `selectRecentErrors` (queue, plus récentes) → **Task 1**.
- `questionsForIds` résolveur partagé + DRY `resumeNow` → **Task 2**.
- `composeSession` (réconciliation `total − erreurs`, sans `fetch`) → **Task 1** + câblé **Task 3**.
- `start()` injecte la tranche, seed `exclude`, plancher souple (garde `wrong` → boost +150) → **Task 3** step 5.
- Fallback ids non résolus → adaptatif comble → couvert par `composeSession` (`adaptiveTarget = total - errorQs.length`), testé **Task 1** (« short errors slice »).
- Contrat `BUILT_CAPS` mis à jour → **Task 3** steps 1-4.
- Carte inchangée / hors périmètre #3-#4 → aucune tâche (correct).

**2. Placeholder scan:** aucun TBD/TODO ; chaque étape porte le code réel + la commande + l'attendu.

**3. Type consistency:** `selectRecentErrors`/`composeSession`/`questionsForIds` définis en Task 1-2, consommés à l'identique en Task 3. `composeSession(errorQs, adaptiveCandidates, total, rng?)` — signature identique entre définition (Task 1) et appel `composeSession(errorQs, picked, total, Math.random)` (Task 3). `questionsForIds(ids, idx, fetchImpl?)` — appelé `questionsForIds(r.ids, idx)` (Task 2, resumeNow) et `questionsForIds(errorIds, idx)` (Task 3), les deux laissant `fetchImpl` par défaut. `BUILT_CAPS.errors` passe de `false` (#1) à `true` (#2), et le test contrat suit dans la même tâche (pas de dérive).

**Note de couverture (neutre, pour le relecteur) :** le câblage de `start()` (Task 3 step 5) n'a pas de test d'intégration dédié — comme au #1, `start()` n'est pas testé directement ; ses trois briques (`selectRecentErrors`, `questionsForIds`, `composeSession`) sont testées unitairement, et le suite complète + typecheck gardent l'intégration. Le relecteur tracera le seed d'`exclude` et l'ordre des appels.
