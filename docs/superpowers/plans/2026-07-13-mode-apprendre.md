# Mode « Apprendre » — ingrédient `learn` (sous-projet #4, Partie A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduire des questions inédites (jamais vues — bitmap `seen`) comme ingrédient de session plafonné à 40 %, pondéré par maîtrise/niveau, en allumant le dernier `cap` du cerveau (`BUILT_CAPS.learn`).

**Architecture:** Un helper pur `countUnseen` (coverage.ts), un plafond `LEARN_CAP` dans `pickSessionPlan`, et une tranche `learn` dans `useQuiz.start()` (non-vus filtrés via `hasBit`, répartis par `allocateCount`, pioche `pickAdaptive`). Aucun composant UI — ingrédient caché comme les erreurs. Réutilise `composeSession` (socle garanti = erreurs+nouveau).

**Tech Stack:** React + TypeScript, bundlé par Bun. Tests : `bun test` (helpers/plan purs ; happy-dom pour l'intégration).

## Global Constraints

- **Runtime & outils : `bun` exclusivement — jamais `node`.** Tests `bun test` ; typecheck `bun run typecheck`.
- **Worktree `.worktrees/mode-apprendre`** (créé, branche `mode-apprendre`, base `11beea5`).
- **Jamais de `Co-Authored-By`** ; pas de bump `sw.js` (sources `src/` uniquement).
- **Plafond learn = 40 %** ; **Mesure** inchangée ; sélection **non-vus pondérés par maîtrise** ; carte inchangée.
- `renderToStaticMarkup` échappe les apostrophes (pas de composant ici, mais l'intégration reste happy-dom).

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/lib/coverage.ts` | +`countUnseen` | **Modifier** |
| `src/lib/coverage.test.ts` | tests `countUnseen` | **Modifier/Créer** |
| `src/features/entrainement/sessionPlan.ts` | `LEARN_CAP` + formule + flip `BUILT_CAPS.learn` | **Modifier** |
| `src/features/entrainement/sessionPlan.test.ts` | test plafond + MAJ contrat `BUILT_CAPS` | **Modifier** |
| `src/features/quiz/useQuiz.ts` | `start()` : `newCoursePoints` + tranche `learn` | **Modifier** |
| `src/EntrainementApp.learn.test.tsx` | intégration happy-dom | **Créer** |

Rappel — signatures existantes : `hasBit(bits, id)`, `decodeBits`, `emptyBits`, `setBit`, `coverageBySkill` (coverage.ts) ; `allocateCount`, `pickAdaptive`, `loadCategory`, `composeSession`, `questionsForIds`, `selectRecentErrors` (bank.ts) ; `masteryOf`, `skillStateOf` ; `ensureBankIndex()` → `Record<number, Skill>`.

---

## Task 1: `countUnseen` — helper pur (coverage.ts)

**Files:**
- Modify: `src/lib/coverage.ts`
- Test: `src/lib/coverage.test.ts` (create if absent)

**Interfaces:**
- Produces: `function countUnseen(seen: Uint8Array, bankIndex: Record<number, Skill>): number` — nombre d'ids de `bankIndex` dont le bit `seen` est à 0.

- [ ] **Step 1: Write the failing test**

If `src/lib/coverage.test.ts` exists, append; else create it. Header:

```ts
import { test, expect } from "bun:test";
import { countUnseen, setBit, emptyBits } from "./coverage.ts";
import type { Skill } from "../types/progress.ts";
```

Tests:

```ts
test("countUnseen counts bank-index ids whose seen bit is 0", () => {
  const idx = { 1: "kanji", 2: "grammaire", 5: "kanji" } as Record<number, Skill>;
  expect(countUnseen(emptyBits(), idx)).toBe(3); // none seen
  let seen = setBit(emptyBits(), 2);
  seen = setBit(seen, 5);
  expect(countUnseen(seen, idx)).toBe(1); // only id 1 still unseen
  seen = setBit(setBit(setBit(emptyBits(), 1), 2), 5);
  expect(countUnseen(seen, idx)).toBe(0); // all seen
});

test("countUnseen ignores seen bits for ids not in the index", () => {
  const idx = { 3: "kanji" } as Record<number, Skill>;
  const seen = setBit(emptyBits(), 99); // 99 not in idx
  expect(countUnseen(seen, idx)).toBe(1); // id 3 still unseen
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/lib/coverage.test.ts`
Expected: FAIL — `countUnseen` not exported.

- [ ] **Step 3: Implement**

In `src/lib/coverage.ts`, add after `coverageBySkill` (uses the existing `hasBit`):

```ts
/** Count of bank-index ids whose `seen` bit is unset (never-encountered items). Pure. */
export function countUnseen(seen: Uint8Array, bankIndex: Record<number, Skill>): number {
  let n = 0;
  for (const key in bankIndex) {
    if (!hasBit(seen, Number(key))) n++;
  }
  return n;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test src/lib/coverage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-apprendre
git add src/lib/coverage.ts src/lib/coverage.test.ts
git commit -m "feat : countUnseen — compte les items jamais vus (ingrédient learn)"
```

---

## Task 2: Plafond `LEARN_CAP` dans `pickSessionPlan` (flag reste OFF)

**Files:**
- Modify: `src/features/entrainement/sessionPlan.ts`
- Test: `src/features/entrainement/sessionPlan.test.ts`

**Interfaces:**
- Produces: `export const LEARN_CAP = 0.4;` and an updated `learn` term in `pickSessionPlan` (capped). `BUILT_CAPS` unchanged here (`learn: false`) — non-breaking.

- [ ] **Step 1: Write the failing test**

Append to `src/features/entrainement/sessionPlan.test.ts` (imports `pickSessionPlan`, `BUILT_CAPS`, `Caps` already present; `base` defined):

```ts
test("learn is capped at LEARN_CAP (40%) of the budget", () => {
  const plan = pickSessionPlan(
    { ...base, newCoursePoints: 100 },
    10,
    { diagnostic: false, errors: false, learn: true },
  );
  // errors off → 0; learn = min(100, floor(0.4*10)=4, 10-0=10) = 4; adaptive = 6
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 0, learn: 4, adaptive: 6 } });
});
```

(The existing `"learn fills after errors, bounded by newCoursePoints"` test — `newCoursePoints: 2`, `total: 10` — stays green: `learn = min(2, 4, 7) = 2`, unchanged.)

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: FAIL — without the cap, `learn = min(100, 10) = 10`, `adaptive = 0`; the new test expects `learn: 4`.

- [ ] **Step 3: Implement the cap**

In `src/features/entrainement/sessionPlan.ts`, add the constant near `ERRORS_CAP`:

```ts
/** Part maximale du budget de questions consacrée aux items inédits (mode Apprendre). */
export const LEARN_CAP = 0.4;
```

And change the `learn` line in `pickSessionPlan`:

```ts
  const learn = caps.learn
    ? Math.min(state.newCoursePoints, Math.floor(LEARN_CAP * total), Math.max(0, total - errors))
    : 0;
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: PASS (existing + new cap test; `BUILT_CAPS`-based tests unaffected since `learn` is still off).

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-apprendre
git add src/features/entrainement/sessionPlan.ts src/features/entrainement/sessionPlan.test.ts
git commit -m "feat : plafond LEARN_CAP (40%) sur la tranche learn de pickSessionPlan"
```

---

## Task 3: Flip `BUILT_CAPS.learn` + tranche `learn` dans `start()`

Atomique : allume le flag, câble la tranche inédits dans `start()`, met à jour le contrat, prouvé par un test d'intégration. Arbre vert à la fin.

**Files:**
- Modify: `src/features/entrainement/sessionPlan.ts` (flip), `src/features/entrainement/sessionPlan.test.ts` (contrat), `src/features/quiz/useQuiz.ts` (start)
- Create: `src/EntrainementApp.learn.test.tsx`

**Interfaces:**
- Consumes: `countUnseen`, `hasBit` (coverage) ; `LEARN_CAP`/`pickSessionPlan`/`BUILT_CAPS` (updated).
- Produces: no new exports — `start()` now injects a learn slice; `BUILT_CAPS.learn === true`.

- [ ] **Step 1: Update the contract test first (RED)**

In `src/features/entrainement/sessionPlan.test.ts`, the existing `"#2 contract: BUILT_CAPS enables errors (30% cap); learn still off"` test (state `wrongCount:50, newCoursePoints:5, daysSinceDiagnostic:3`, `total:10`, `BUILT_CAPS`) will change once `learn` flips on. Replace it with the #4 contract:

```ts
test("#4 contract: BUILT_CAPS enables learn (40% cap) alongside errors", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 5, daysSinceDiagnostic: 3 },
    10,
    BUILT_CAPS,
  );
  // errors = min(50,3)=3; learn = min(5, floor(0.4*10)=4, 10-3=7)=4; adaptive = 10-3-4=3
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, learn: 4, adaptive: 3 } });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: FAIL — with `BUILT_CAPS.learn` still `false`, the plan yields `learn: 0, adaptive: 7`, not `learn: 4, adaptive: 3`.

- [ ] **Step 3: Flip the capability**

In `src/features/entrainement/sessionPlan.ts`:

```ts
/** Capacités construites à ce jour. Les 4 modes sont désormais réels. */
export const BUILT_CAPS: Caps = { diagnostic: true, errors: true, learn: true };
```

- [ ] **Step 4: Run the contract tests (they now pass; full suite waits for the wiring)**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: PASS. (Do NOT run the full suite yet — `start()` doesn't build the learn slice, so the composed session would be short by `plan.alloc.learn` until Step 5.)

- [ ] **Step 5: Wire the learn slice into `start()`**

In `src/features/quiz/useQuiz.ts`, extend the coverage import (currently `import { decodeBits, encodeBits, setBit } from "../../lib/coverage.ts";`) to add `hasBit` and `countUnseen`:

```ts
import { decodeBits, encodeBits, setBit, hasBit, countUnseen } from "../../lib/coverage.ts";
```

Restructure the top of `start()` so the bank index + unseen count are computed BEFORE `pickSessionPlan`. Replace the current block from `const daysSinceDiagnostic = …` through the `pickSessionPlan(...)` call with:

```ts
    // `skipDiagnostic` ([Plus tard]) forces a recent-diagnostic reading → composed path.
    const daysSinceDiagnostic = opts?.skipDiagnostic ? 0 : daysSince(raw?.diagAt);

    // Coverage: count never-seen items for the learn ingredient (needs the full bank index).
    // ensureBankIndex is prefetched on mount + cached, so awaiting it here is cheap.
    const idx = await ensureBankIndex();
    const seen = decodeBits(typeof raw?.seen === "string" ? raw.seen : "");
    const newCoursePoints = idx ? countUnseen(seen, idx) : 0;

    // Consult the decision engine. `resume: false` — "Commencer" always starts fresh; the resume
    // decision is handled at the card level. All four caps are now built.
    const plan = pickSessionPlan(
      { resume: false, daysSinceDiagnostic, wrongCount: wrong.length, newCoursePoints },
      total,
      BUILT_CAPS,
    );
```

The diagnostic branch (`if (plan.kind === "diagnostic") { … }`) stays unchanged. After `if (plan.kind !== "composed") return;` and `setMode("normal"); const progress = asProgress(raw);`, replace the errors-slice + adaptive block (currently: `const errorIds = …` through the pick loop and `const session = composeSession(errorQs, picked, total, Math.random);`) with:

```ts
    // Errors slice: the most-recent wrong[] ids (up to plan.alloc.errors), resolved to questions.
    // (idx already loaded above; C2 fallback unchanged — null idx → empty errors, session degrades.)
    const errorIds = selectRecentErrors(wrong, plan.alloc.errors);
    const errorQs = idx ? await questionsForIds(errorIds, idx) : [];
    const exclude = new Set<number>(errorQs.map((q) => q.id));

    // Learn slice: never-seen items, distributed by mastery and picked near the level. Each category's
    // pool is filtered to unseen; unseen-thin categories simply contribute fewer (adaptive covers the
    // shortfall below — budget still `total`).
    const learnQs: Question[] = [];
    if (plan.alloc.learn > 0) {
      const learnAlloc = allocateCount((c) => masteryOf(progress, c), plan.alloc.learn);
      for (const cat of SKILLS) {
        const n = learnAlloc[cat];
        if (!n) continue;
        const pool = await loadCategory(cat);
        const unseen = pool.filter((q) => !hasBit(seen, q.id));
        const R = skillStateOf(raw, cat).R;
        const picks = pickAdaptive(unseen, R, exclude, wrong).slice(0, n);
        for (const q of picks) exclude.add(q.id);
        learnQs.push(...picks);
      }
    }

    // Adaptive fills the remaining budget (weighted by mastery), from the full pools.
    const adaptiveTarget = Math.max(0, total - errorQs.length - learnQs.length);
    const alloc = allocateCount((c) => masteryOf(progress, c), adaptiveTarget);
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

    // Guaranteed slices (errors + learn) + adaptive fill → composeSession reconciles the budget.
    const session = composeSession([...errorQs, ...learnQs], picked, total, Math.random);
    if (!session.length) return;
```

The rest of the composed path (`rightRef.current = 0;` … `setResume(r);`) is unchanged.

- [ ] **Step 6: Write the integration test**

Create `src/EntrainementApp.learn.test.tsx` (reuse the harness from `EntrainementApp.start.test.tsx`: `pool`/`BANK`/`INDEX`, mocked `fetch`, `clearCategoryCache`; **seed `diagAt: Date.now()` so no diagnostic fires**):

```tsx
import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { SKILLS } from "./types/progress.ts";
import { clearCategoryCache } from "./lib/bank.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root; let origFetch: typeof fetch;

function pool(cat: string, base: number) {
  return Array.from({ length: 12 }, (_, i) => ({
    id: base + i, cat, d: ((i % 3) + 1), q: `Q-${cat}-${i}`, o: ["a", "b", "c", "d"], a: 0,
  }));
}
const BANK: Record<string, ReturnType<typeof pool>> = {};
SKILLS.forEach((c, idx) => { BANK[c] = pool(c, (idx + 1) * 100); });
const INDEX: Record<number, string> = {};
Object.values(BANK).flat().forEach((q) => { INDEX[q.id] = q.cat; });

beforeEach(() => {
  localStorage.clear(); clearCategoryCache();
  origFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const u = String(url);
    if (u.includes("bank-index")) return { json: async () => INDEX };
    const m = u.match(/bank-([a-z]+)\.json/);
    if (m && BANK[m[1]]) return { json: async () => BANK[m[1]] };
    return { json: async () => ({}) };
  }) as unknown as typeof fetch;
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => { root.unmount(); }); container.remove(); globalThis.fetch = origFetch; clearCategoryCache(); });

async function commencer() {
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Commencer");
  await act(async () => { btn!.click(); await new Promise((r) => setTimeout(r, 0)); });
}

test("with everything unseen, a session includes a learn slice — full budget, no duplicates", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 0, skill: {}, diagAt: Date.now() })); // recent diag, no seen
  await commencer();
  const resume = JSON.parse(localStorage.getItem("jlptN3quiz_resume") ?? "null");
  expect(resume).toBeTruthy();
  expect(resume.ids).toHaveLength(15);                 // budget kept (learn + adaptive)
  expect(new Set(resume.ids).size).toBe(15);            // no duplicates across errors/learn/adaptive
  expect(resume.ids.every((id: number) => id in INDEX)).toBe(true); // real bank items
});

test("with all items already seen, learn is empty and the session is still built", async () => {
  // Mark every bank id as seen so newCoursePoints = 0 → learn = 0.
  const { encodeBits, setBit, emptyBits } = await import("./lib/coverage.ts");
  let seen = emptyBits();
  for (const id of Object.keys(INDEX)) seen = setBit(seen, Number(id));
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 0, skill: {}, diagAt: Date.now(), seen: encodeBits(seen) }));
  await commencer();
  const resume = JSON.parse(localStorage.getItem("jlptN3quiz_resume") ?? "null");
  expect(resume).toBeTruthy();
  expect(resume.ids).toHaveLength(15);       // adaptive fills the whole budget (learn = 0)
  expect(new Set(resume.ids).size).toBe(15);  // no duplicates
});
```

- [ ] **Step 7: Typecheck + full suite (GREEN)**

Run: `bun run typecheck`
Expected: PASS.

Run: `bun test`
Expected: PASS — full suite green. **Re-verify the pre-existing container-driven tests** (`EntrainementApp.start.test.tsx`, `.recording.test.tsx`, `.diagnostic.test.tsx`): they seed `diagAt` (recent) but **no `seen`**, so a learn slice now runs. Their assertions should still hold — the session is still `total` questions of `Q-` items with no duplicates, and seeded `wrong[]` ids are still surfaced by the errors slice (excluded from learn). If any assertion breaks (e.g. a hard-coded expectation that a specific non-error item appears), investigate — do NOT weaken it without confirming it's a legitimate consequence of the learn slice.

- [ ] **Step 8: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-apprendre
git add -A -- src
git commit -m "feat : tranche learn (questions inédites) dans la session — BUILT_CAPS.learn, 4 modes complets"
```

---

## Self-Review

**1. Spec coverage:**
- `countUnseen` → **Task 1**.
- `LEARN_CAP` (40 %) + formule → **Task 2**.
- Flip `BUILT_CAPS.learn` + `newCoursePoints` réel + tranche learn (non-vus, pondérés) → **Task 3**.
- Dégradation gracieuse (catégorie non-vus thin → adaptatif comble) → **Task 3** (`adaptiveTarget = total − errors − learn`, `composeSession`).
- Contrat + intégration → **Task 3** (steps 1-2, 6-7).
- Carte inchangée / pas de composant → aucune tâche UI (correct).

**2. Placeholder scan:** aucun TBD ; chaque étape porte le code réel + commande + attendu.

**3. Type consistency:** `countUnseen(seen, bankIndex)` défini Task 1, appelé Task 3 avec `idx` (`Record<number, Skill>`) + `seen` (`Uint8Array`). `LEARN_CAP`/formule Task 2 consommés via `BUILT_CAPS` Task 3. `composeSession([...errorQs, ...learnQs], picked, total)` — même signature qu'aux #2/#3 (1ᵉʳ arg = socle garanti). `hasBit` déjà exporté (coverage.ts), ajouté à l'import de `useQuiz`. `plan.alloc.learn` désormais utilisé (était ignoré).

**Note de couverture :** l'intégration (Task 3 step 6) exerce les deux régimes (tout inédit → learn actif ; tout vu → learn=0), prouvant la composition à 3 tranches sans doublon et le budget tenu ; la logique de plafond/comptage est unit-testée (Tasks 1-2).
