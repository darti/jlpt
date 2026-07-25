# Cadence & série quotidienne — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une cadence quotidienne — objectif du jour dérivé du rythme requis pour atteindre 70 % de maîtrise avant l'examen, série de jours consécutifs atteints, journal par jour — surfacée sur l'Accueil.

**Architecture:** Une couche PURE `cadence.ts` (modèle + règles, sur le patron de `scoring.ts`/`traps.ts`) ; une clé propre `jlptN3_cadence` lue/écrite par `storage.ts` ; un seul point d'effet dans `useQuiz.commitAnswer`, là où le bit `mastered` est déjà posé ; un `CadencePanel` sur l'Accueil alimenté par `useCadence`.

**Tech Stack:** bun (runtime + tests), React + TypeScript, happy-dom (`createRoot`+`act`), Web `localStorage`.

## Global Constraints

- **Worktree `.worktrees/cadence`, branche `feat/cadence-quotidienne`.** Jamais dans la racine.
- **`bun` EXCLUSIVEMENT.** Tests : `bun test <fichier>`. Typecheck : `bun run typecheck`.
- **Pas de linter** : `bun run typecheck` + `bun test` font foi. Ne pas en ajouter.
- **Zéro dépendance nouvelle.** Aucun asset livré modifié → **PAS** de bump `sw.js`.
- Commentaires et messages de commit en **français**, conventional commits. **PAS de ligne Co-Authored-By.**
- **Commit : message COURT à UNE ligne** via `git commit -m "..."`. PAS de heredoc (un hook de revue du dépôt bloque les messages multi-lignes ; si bloqué, laisser STAGÉ et le signaler).
- **`CADENCE_KEY = "jlptN3_cadence"`, seul ajout à `keys.ts`** — préfixe `jlptN3` obligatoire (sinon jamais synchronisée par Gist ; la synchro dernier-écrit-gagne est alors automatique via `gist.ts#collectData`, aucun code à ajouter).
- Constantes : `CIBLE_PCT = 0.70`, `TOTAL_QUESTIONS = 10307`.
- `day` = `dayNumber(now)` de `src/features/quiz/traps.ts` (entier depuis EPOCH 2026-01-01 UTC).
- ⚠ `renderToStaticMarkup` échappe `'` → asserter des sous-chaînes SANS apostrophe.
- ⚠ happy-dom est préchargé pour toute la suite ; `localStorage` existe même en test « pur » — appeler `localStorage.clear()` en `beforeEach` des tests à état.

---

### Task 1: `masteredCount` (popcount du bitset appris)

**Files:**
- Modify: `src/lib/coverage.ts` (ajouter la fonction près de `hasBit`/`countUnseen`)
- Test: `src/lib/coverage.test.ts`

**Interfaces:**
- Consumes: `Uint8Array` (le bitset décodé).
- Produces: `masteredCount(bits: Uint8Array): number` — nombre de bits à 1.

- [ ] **Step 1: Write the failing test** — ajouter à `src/lib/coverage.test.ts` :

```ts
import { masteredCount, setBit, emptyBits } from "./coverage.ts";

test("masteredCount compte les bits à 1 (vide, épars, plusieurs octets)", () => {
  expect(masteredCount(emptyBits())).toBe(0);
  let b = emptyBits();
  for (const id of [0, 7, 8, 100, 101]) b = setBit(b, id);
  expect(masteredCount(b)).toBe(5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/coverage.test.ts -t "masteredCount"`
Expected: FAIL — `masteredCount is not a function`.

- [ ] **Step 3: Write minimal implementation** — dans `src/lib/coverage.ts` :

```ts
/** Nombre de bits à 1 (questions apprises). Pur. */
export function masteredCount(bits: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    let b = bits[i];
    while (b) { b &= b - 1; n++; } // Kernighan : efface le bit bas à chaque tour
  }
  return n;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/coverage.test.ts -t "masteredCount"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/coverage.ts src/lib/coverage.test.ts
git commit -m "feat(coverage): masteredCount (popcount du bitset appris)"
```

---

### Task 2: `cadence.ts` — types, constantes, `dailyGoal`

**Files:**
- Create: `src/lib/cadence.ts`
- Test: `src/lib/cadence.test.ts`

**Interfaces:**
- Produces:
  - `interface Cadence { byDay: Record<number, number>; goalByDay: Record<number, number>; best: number }`
  - `emptyCadence(): Cadence`
  - `CIBLE_PCT = 0.70`, `TOTAL_QUESTIONS = 10307`
  - `dailyGoal(masteredNow: number, daysLeft: number, total?: number, pct?: number): number`

- [ ] **Step 1: Write the failing test** — créer `src/lib/cadence.test.ts` :

```ts
import { test, expect } from "bun:test";
import { dailyGoal, emptyCadence, TOTAL_QUESTIONS } from "./cadence.ts";

test("dailyGoal = rythme requis, arrondi au supérieur", () => {
  // cible 70 % de 10307 = 7215 ; 0 appris, 134 jours → ⌈7215/134⌉ = 54
  expect(dailyGoal(0, 134)).toBe(54);
});

test("dailyGoal borné à 0 quand la cible est atteinte", () => {
  expect(dailyGoal(TOTAL_QUESTIONS, 134)).toBe(0); // 100 % appris > cible
});

test("dailyGoal = 0 quand l'examen est passé (daysLeft ≤ 0)", () => {
  expect(dailyGoal(0, 0)).toBe(0);
});

test("emptyCadence est un journal vierge", () => {
  expect(emptyCadence()).toEqual({ byDay: {}, goalByDay: {}, best: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/cadence.test.ts`
Expected: FAIL — module `./cadence.ts` introuvable.

- [ ] **Step 3: Write minimal implementation** — créer `src/lib/cadence.ts` :

```ts
/**
 * Cadence quotidienne : objectif du jour = rythme requis pour atteindre CIBLE_PCT de maîtrise
 * avant l'examen, série de jours consécutifs atteints, journal par jour. Module PUR (aucun
 * effet ; `now`/`today` injectés) — les effets vivent dans `storage.ts`/`useQuiz`/`useCadence`.
 */

/** Cible de maîtrise visée (fraction du corpus). */
export const CIBLE_PCT = 0.70;
/** Taille du corpus — gardée par un test de mesure (cf. cadence.test.ts). */
export const TOTAL_QUESTIONS = 10307;

/** Journal persisté sous `jlptN3_cadence`. `byDay`/`goalByDay` indexés par `dayNumber`. */
export interface Cadence {
  byDay: Record<number, number>;     // jour → questions nouvellement apprises
  goalByDay: Record<number, number>; // jour → objectif gelé ce jour-là
  best: number;                      // record de série
}

/** Journal vierge (nouvel objet à chaque appel). */
export function emptyCadence(): Cadence {
  return { byDay: {}, goalByDay: {}, best: 0 };
}

/** Objectif du jour = ⌈(cible − appris) / jours⌉, borné ≥ 0. Pur. */
export function dailyGoal(
  masteredNow: number,
  daysLeft: number,
  total: number = TOTAL_QUESTIONS,
  pct: number = CIBLE_PCT,
): number {
  if (daysLeft <= 0) return 0;                       // examen passé : plus de rythme
  const remaining = Math.round(pct * total) - masteredNow;
  if (remaining <= 0) return 0;                      // cible atteinte
  return Math.ceil(remaining / daysLeft);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/cadence.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cadence.ts src/lib/cadence.test.ts
git commit -m "feat(cadence): couche pure — objectif du jour (rythme requis par maitrise)"
```

---

### Task 3: `cadence.ts` — `streakOf` + `recordMastery`

**Files:**
- Modify: `src/lib/cadence.ts`
- Test: `src/lib/cadence.test.ts`

**Interfaces:**
- Consumes: `Cadence`, `emptyCadence`.
- Produces:
  - `streakOf(c: Cadence, today: number): number` — jours consécutifs atteints finissant à `today` ou `today-1` (série encore vivante tant qu'aujourd'hui n'est pas fini).
  - `recordMastery(c: Cadence, day: number, goalToday: number, k?: number): Cadence` — gèle `goalByDay[day]` la 1re fois, incrémente `byDay[day]`, rafraîchit `best`. Retourne un NOUVEau `Cadence`.

- [ ] **Step 1: Write the failing test** — ajouter à `src/lib/cadence.test.ts` :

```ts
import { streakOf, recordMastery } from "./cadence.ts";

test("recordMastery gèle l'objectif du jour puis incrémente le journal", () => {
  const c0 = emptyCadence();
  const c1 = recordMastery(c0, 5, 3);      // jour 5, objectif 3
  expect(c1.byDay[5]).toBe(1);
  expect(c1.goalByDay[5]).toBe(3);
  const c2 = recordMastery(c1, 5, 999);    // même jour : objectif NE change PAS (gelé)
  expect(c2.byDay[5]).toBe(2);
  expect(c2.goalByDay[5]).toBe(3);
  expect(c0.byDay[5]).toBeUndefined();     // pureté : c0 intact
});

test("streakOf compte les jours consécutifs atteints, un trou casse", () => {
  let c = emptyCadence();
  // jours 3,4,5 atteints (objectif 1, une maîtrise chacun), jour 6 non ouvert
  c = recordMastery(c, 3, 1);
  c = recordMastery(c, 4, 1);
  c = recordMastery(c, 5, 1);
  expect(streakOf(c, 5)).toBe(3);          // aujourd'hui = 5, atteint
  expect(streakOf(c, 6)).toBe(3);          // aujourd'hui = 6 pas encore atteint → série vivante = le run 3-4-5
  expect(streakOf(c, 7)).toBe(0);          // jour 6 manqué → cassée
});

test("un jour ouvert mais objectif non atteint ne compte pas", () => {
  let c = emptyCadence();
  c = recordMastery(c, 3, 5); // objectif 5, une seule maîtrise → non atteint
  expect(streakOf(c, 3)).toBe(0);
  expect(c.best).toBe(0);
});

test("best suit le pic de série", () => {
  let c = emptyCadence();
  c = recordMastery(c, 1, 1);
  c = recordMastery(c, 2, 1);
  expect(c.best).toBe(2);
  c = recordMastery(c, 4, 1); // trou en 3
  expect(streakOf(c, 4)).toBe(1);
  expect(c.best).toBe(2);     // record conservé
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/cadence.test.ts -t "streak"`
Expected: FAIL — `streakOf`/`recordMastery` non exportés.

- [ ] **Step 3: Write minimal implementation** — ajouter à `src/lib/cadence.ts` :

```ts
/** Un jour est « atteint » ssi il a un objectif gelé et le progrès l'égale ou le dépasse. */
function isMet(c: Cadence, day: number): boolean {
  const done = c.byDay[day];
  const goal = c.goalByDay[day];
  return done !== undefined && goal !== undefined && done >= goal;
}

/** Série courante : run de jours atteints finissant à `today`, ou à `today-1` si aujourd'hui
 *  n'est pas encore atteint (la série reste vivante jusqu'à la fin de la journée). Pur. */
export function streakOf(c: Cadence, today: number): number {
  let n = 0;
  for (let d = isMet(c, today) ? today : today - 1; isMet(c, d); d--) n++;
  return n;
}

/** Journal après une nouvelle maîtrise. Gèle l'objectif du jour la 1re fois, incrémente le
 *  compteur du jour, met à jour le record. Retourne un nouveau `Cadence`. Pur. */
export function recordMastery(c: Cadence, day: number, goalToday: number, k = 1): Cadence {
  const goalByDay = day in c.goalByDay ? c.goalByDay : { ...c.goalByDay, [day]: goalToday };
  const byDay = { ...c.byDay, [day]: (c.byDay[day] ?? 0) + k };
  const next: Cadence = { byDay, goalByDay, best: c.best };
  next.best = Math.max(c.best, streakOf(next, day));
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/cadence.test.ts`
Expected: PASS (tous, dont Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cadence.ts src/lib/cadence.test.ts
git commit -m "feat(cadence): serie (streakOf) + journal (recordMastery)"
```

---

### Task 4: `cadence.ts` — `recordAnswer` + `cadenceModel` + garde-fou de mesure

**Files:**
- Modify: `src/lib/cadence.ts`
- Test: `src/lib/cadence.test.ts`

**Interfaces:**
- Consumes: `hasBit`, `masteredCount` de `./coverage.ts` ; `dailyGoal`, `recordMastery`, `streakOf`.
- Produces:
  - `recordAnswer(c: Cadence, prevMastered: Uint8Array, qId: number, correct: boolean, day: number, daysLeft: number): Cadence` — la RÈGLE d'intégration : n'enregistre que sur une nouvelle maîtrise (`correct && !hasBit`) ; sinon retourne `c` **inchangé (même référence)**.
  - `interface CadenceModel { goal: number; done: number; streak: number; best: number; reached: boolean; daysLeft: number }`
  - `cadenceModel(c: Cadence, masteredNow: number, daysLeft: number, today: number): CadenceModel`

- [ ] **Step 1: Write the failing test** — ajouter à `src/lib/cadence.test.ts` :

```ts
import { recordAnswer, cadenceModel } from "./cadence.ts";
import { setBit, emptyBits } from "./coverage.ts";
import { readdirSync, readFileSync } from "node:fs";

test("recordAnswer n'enregistre que sur une nouvelle maîtrise", () => {
  const c0 = emptyCadence();
  const prev = emptyBits();
  const bad = recordAnswer(c0, prev, 42, false, 5, 134); // mauvaise réponse
  expect(bad).toBe(c0);                                   // même référence : rien écrit
  const already = recordAnswer(c0, setBit(emptyBits(), 42), 42, true, 5, 134); // déjà maîtrisée
  expect(already).toBe(c0);
  const learned = recordAnswer(c0, prev, 42, true, 5, 134); // 1re bonne réponse
  expect(learned.byDay[5]).toBe(1);
  expect(learned.goalByDay[5]).toBe(54);                  // objectif gelé (0 appris, 134 j)
});

test("cadenceModel : objectif gelé du jour, progrès, série, cible/examen", () => {
  let c = emptyCadence();
  c = recordMastery(c, 10, 54);
  const m = cadenceModel(c, 1, 134, 10);
  expect(m.goal).toBe(54);        // gelé, pas recalculé sur masteredNow=1
  expect(m.done).toBe(1);
  expect(m.daysLeft).toBe(134);
  expect(m.reached).toBe(false);
  // cible atteinte → reached
  expect(cadenceModel(emptyCadence(), TOTAL_QUESTIONS, 134, 10).reached).toBe(true);
});

test("garde-fou de mesure : TOTAL_QUESTIONS = taille réelle du corpus", () => {
  let n = 0;
  for (const f of readdirSync("data/graph")) {
    if (!/^q-.*\.jsonld$/.test(f)) continue;
    const doc = JSON.parse(readFileSync(`data/graph/${f}`, "utf8"));
    const arr = Array.isArray(doc) ? doc : (Array.isArray(doc["@graph"]) ? doc["@graph"] : []);
    n += arr.filter((e: Record<string, unknown>) => String(e["@type"] ?? "").includes("Question")).length;
  }
  expect(n).toBe(TOTAL_QUESTIONS); // échoue si le corpus grandit → remonter la constante
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/cadence.test.ts -t "recordAnswer"`
Expected: FAIL — `recordAnswer` non exporté.

- [ ] **Step 3: Write minimal implementation** — ajouter à `src/lib/cadence.ts` (import en tête du fichier) :

```ts
import { hasBit, masteredCount } from "./coverage.ts";
```

puis, plus bas :

```ts
/** Règle d'intégration : enregistre une maîtrise SSI la réponse est juste ET la question
 *  n'était pas déjà apprise. Sinon retourne `c` inchangé (même référence → l'appelant peut
 *  éviter une écriture). Pur — `prevMastered` = bitset AVANT la réponse. */
export function recordAnswer(
  c: Cadence,
  prevMastered: Uint8Array,
  qId: number,
  correct: boolean,
  day: number,
  daysLeft: number,
): Cadence {
  if (!correct || hasBit(prevMastered, qId)) return c;
  return recordMastery(c, day, dailyGoal(masteredCount(prevMastered), daysLeft));
}

/** Modèle d'affichage du panneau. Aujourd'hui : objectif GELÉ s'il existe, sinon `dailyGoal`
 *  live (les deux coïncident avant toute maîtrise). Pur. */
export interface CadenceModel {
  goal: number;
  done: number;
  streak: number;
  best: number;
  reached: boolean;   // cible de maîtrise atteinte
  daysLeft: number;   // 0 = examen passé
}

export function cadenceModel(
  c: Cadence,
  masteredNow: number,
  daysLeft: number,
  today: number,
): CadenceModel {
  const goal = c.goalByDay[today] ?? dailyGoal(masteredNow, daysLeft);
  const remaining = Math.round(CIBLE_PCT * TOTAL_QUESTIONS) - masteredNow;
  return {
    goal,
    done: c.byDay[today] ?? 0,
    streak: streakOf(c, today),
    best: c.best,
    reached: remaining <= 0,
    daysLeft,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/cadence.test.ts`
Expected: PASS (tous). Si le garde-fou échoue avec un nombre ≠ 10307, mettre `TOTAL_QUESTIONS` à jour et re-committer.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cadence.ts src/lib/cadence.test.ts
git commit -m "feat(cadence): recordAnswer (regle) + cadenceModel + garde-fou de mesure"
```

---

### Task 5: `CADENCE_KEY` + `readCadence`/`writeCadence`

**Files:**
- Modify: `src/lib/keys.ts` (ajouter `CADENCE_KEY`)
- Modify: `src/lib/storage.ts` (ajouter `readCadence`/`writeCadence`)
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `Cadence`, `emptyCadence` de `./cadence.ts`.
- Produces:
  - `CADENCE_KEY = "jlptN3_cadence"`
  - `readCadence(store?): Cadence` — journal courant ou `emptyCadence()` (jamais throw).
  - `writeCadence(next: Cadence, store?): void` — écrit + `stampUpdated` (best-effort).

- [ ] **Step 1: Write the failing test** — ajouter à `src/lib/storage.test.ts` :

```ts
import { readCadence, writeCadence } from "./storage.ts";
import { emptyCadence } from "./cadence.ts";

test("readCadence rend un journal vierge quand la clé est absente ou corrompue", () => {
  localStorage.clear();
  expect(readCadence()).toEqual(emptyCadence());
  localStorage.setItem("jlptN3_cadence", "pas du json");
  expect(readCadence()).toEqual(emptyCadence());
});

test("writeCadence puis readCadence : aller-retour", () => {
  localStorage.clear();
  const c = { byDay: { 5: 3 }, goalByDay: { 5: 3 }, best: 1 };
  writeCadence(c);
  expect(readCadence()).toEqual(c);
  expect(localStorage.getItem("jlptN3_updatedAt")).not.toBeNull(); // stampUpdated
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/storage.test.ts -t "Cadence"`
Expected: FAIL — `readCadence`/`writeCadence` non exportés.

- [ ] **Step 3: Write minimal implementation**

Dans `src/lib/keys.ts`, après `PROD_KEY` :

```ts
/** Journal de cadence quotidienne (objectif/série/par-jour). Propre au blob de progression. */
export const CADENCE_KEY = "jlptN3_cadence";
```

Dans `src/lib/storage.ts`, ajouter l'import et les deux fonctions (en bas) :

```ts
import { CADENCE_KEY } from "./keys.ts";
import { emptyCadence, type Cadence } from "./cadence.ts";

function numMap(v: unknown): Record<number, number> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: Record<number, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number") out[Number(k)] = val;
  }
  return out;
}

/** Journal de cadence courant, ou un journal vierge. Best-effort : jamais throw. */
export function readCadence(store: Pick<Storage, "getItem"> = globalThis.localStorage): Cadence {
  try {
    const raw = store.getItem(CADENCE_KEY);
    if (raw === null) return emptyCadence();
    const v = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return emptyCadence();
    const o = v as Record<string, unknown>;
    return { byDay: numMap(o.byDay), goalByDay: numMap(o.goalByDay), best: typeof o.best === "number" ? o.best : 0 };
  } catch { return emptyCadence(); }
}

/** Écrit le journal (dernier-écrit-gagne) + horodate. Best-effort : ignore les erreurs. */
export function writeCadence(next: Cadence, store: Pick<Storage, "setItem"> = globalThis.localStorage): void {
  try { store.setItem(CADENCE_KEY, JSON.stringify(next)); stampUpdated(store); } catch { /* best-effort */ }
}
```

(`stampUpdated` est déjà importé dans `storage.ts`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/storage.test.ts -t "Cadence"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/keys.ts src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat(storage): cle jlptN3_cadence + readCadence/writeCadence"
```

---

### Task 6: Câblage dans `useQuiz.commitAnswer`

**Files:**
- Modify: `src/features/quiz/useQuiz.ts` (fonction `commitAnswer`, autour de la ligne 399)
- Test: `src/EntrainementApp.cadence.test.tsx` (créé)

**Interfaces:**
- Consumes: `recordAnswer` (`cadence.ts`), `readCadence`/`writeCadence` (`storage.ts`), `daysUntilExam` (`scoring.ts`), `decodeBits`/`masteredCount` (`coverage.ts`), `dayNumber` (déjà importé).
- Produces: à chaque réponse commitée, `jlptN3_cadence` reflète les nouvelles maîtrises du jour.

- [ ] **Step 1: Write the failing test** — créer `src/EntrainementApp.cadence.test.tsx` (reprend le harnais de `EntrainementApp.learn.test.tsx`) :

```ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { clearCategoryCache } from "./lib/bank.ts";
import { clearRappelCache } from "./features/quiz/rappel.ts";
import { graphFetch } from "./testing/graphFixture.ts";
import { readCadence } from "./lib/storage.ts";
import { readRawProgress } from "./lib/storage.ts";
import { decodeBits, masteredCount } from "./lib/coverage.ts";
import { dayNumber } from "./features/quiz/traps.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root; let origFetch: typeof fetch;

beforeEach(() => {
  localStorage.clear(); clearCategoryCache(); clearRappelCache();
  origFetch = globalThis.fetch;
  globalThis.fetch = graphFetch();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => { root.unmount(); }); container.remove(); globalThis.fetch = origFetch; clearCategoryCache(); clearRappelCache(); });

test("le journal de cadence reste en phase avec le bitset appris (progrès du jour = maîtrises gagnées)", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 0, skill: {}, diagAt: Date.now() }));
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  const start = [...container.querySelectorAll("button")].find((b) => b.textContent === "Commencer");
  await act(async () => { start!.click(); await new Promise((r) => setTimeout(r, 0)); });

  // Répondre à toute la session en cliquant la 1re option de chaque question.
  for (let i = 0; i < 20; i++) {
    const opts = [...container.querySelectorAll("button")].filter((b) => /^[A-D]\b|option/i.test(b.className) || b.dataset.opt !== undefined);
    const clickable = opts.length ? opts : [...container.querySelectorAll("button")].filter((b) => b.textContent && b.textContent !== "Réécouter");
    const next = [...container.querySelectorAll("button")].find((b) => /suivant|continuer|question/i.test(b.textContent ?? ""));
    const target = next ?? clickable[0];
    if (!target) break;
    await act(async () => { target.click(); await new Promise((r) => setTimeout(r, 0)); });
  }

  const mastered = masteredCount(decodeBits(typeof readRawProgress()?.mastered === "string" ? (readRawProgress() as Record<string, string>).mastered : ""));
  const cad = readCadence();
  const today = dayNumber(new Date());
  const sumToday = cad.byDay[today] ?? 0;
  // Invariant : ce que la cadence a enregistré aujourd'hui = la croissance du bitset appris
  // (parti de 0). Vrai quel que soit le nombre de bonnes réponses.
  expect(sumToday).toBe(mastered);
});
```

> Note d'implémentation : le sélecteur d'options ci-dessus est défensif car `QuestionCard` peut varier ; l'assertion FORTE est l'invariant `sumToday === mastered`, indépendant du parcours exact. Si le harnais peine à faire avancer la session, calquer les clics sur un test existant qui répond à des questions (`EntrainementApp.diagnostic.test.tsx` / `EntrainementApp.production-e2e.test.tsx`).

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/EntrainementApp.cadence.test.tsx`
Expected: FAIL — `sumToday` (0) ≠ `mastered` (> 0), car rien ne remplit encore `jlptN3_cadence`.

- [ ] **Step 3: Write minimal implementation** — dans `src/features/quiz/useQuiz.ts` :

Ajouter aux imports :

```ts
import { decodeBits, encodeBits, setBit, hasBit, countUnseen, masteredCount } from "../../lib/coverage.ts";
import { readRawProgress, writeProgress, readCadence, writeCadence } from "../../lib/storage.ts";
import { dashboardModel, prescriptiveWeights, daysUntilExam } from "../../lib/scoring.ts";
import { recordAnswer } from "../../lib/cadence.ts";
```

(fusionner avec les imports EXISTANTS de ces modules — `masteredCount`, `readCadence`, `writeCadence`, `daysUntilExam`, `recordAnswer` sont les ajouts ; ne pas dupliquer les lignes d'import.)

Dans `commitAnswer`, juste après `writeProgress(answerPatch(...))` (ligne ~399) :

```ts
    // Cadence : enregistrer une éventuelle NOUVELLE maîtrise, au même instant que le bit `mastered`.
    const prevMastered = decodeBits(typeof raw?.mastered === "string" ? raw.mastered : "");
    const cad = readCadence();
    const nextCad = recordAnswer(cad, prevMastered, q.id, correct, dayNumber(new Date()), daysUntilExam(new Date()));
    if (nextCad !== cad) writeCadence(nextCad);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/EntrainementApp.cadence.test.tsx`
Expected: PASS. Puis non-régression : `bun test` (toute la suite) verte.

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz/useQuiz.ts src/EntrainementApp.cadence.test.tsx
git commit -m "feat(cadence): enregistrer les nouvelles maitrises au commit de reponse"
```

---

### Task 7: Hook `useCadence`

**Files:**
- Create: `src/features/dashboard/useCadence.ts`
- Test: `src/features/dashboard/useCadence.test.tsx`

**Interfaces:**
- Consumes: `readCadence` (`storage.ts`), `readRawProgress` (`storage.ts`), `decodeBits`/`masteredCount` (`coverage.ts`), `daysUntilExam` (`scoring.ts`), `dayNumber` (`traps.ts`), `cadenceModel`/`CadenceModel` (`cadence.ts`).
- Produces: `useCadence(): CadenceModel | null` (`null` avant le montage/lecture).

- [ ] **Step 1: Write the failing test** — créer `src/features/dashboard/useCadence.test.tsx` :

```ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCadence } from "./useCadence.ts";
import type { CadenceModel } from "../../lib/cadence.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root; let captured: CadenceModel | null = null;
function Probe() { captured = useCadence(); return null; }

beforeEach(() => { localStorage.clear(); captured = null; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => { root.unmount(); }); container.remove(); });

test("useCadence expose un modèle même sans progression (nouvel arrivant)", async () => {
  await act(async () => { root.render(<Probe />); });
  expect(captured).not.toBeNull();
  expect(captured!.done).toBe(0);
  expect(captured!.goal).toBeGreaterThan(0);   // rythme requis positif avant l'examen
  expect(captured!.streak).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/dashboard/useCadence.test.tsx`
Expected: FAIL — module `./useCadence.ts` introuvable.

- [ ] **Step 3: Write minimal implementation** — créer `src/features/dashboard/useCadence.ts` :

```ts
import { useEffect, useState } from "react";
import { readCadence, readRawProgress } from "../../lib/storage.ts";
import { decodeBits, masteredCount } from "../../lib/coverage.ts";
import { daysUntilExam } from "../../lib/scoring.ts";
import { dayNumber } from "../quiz/traps.ts";
import { cadenceModel, type CadenceModel } from "../../lib/cadence.ts";

/** Modèle de cadence pour l'Accueil : objectif du jour, progrès, série. Lu une fois au montage
 *  (comme `useTraps`) — `masteredNow` vient du bitset local, donc dispo même hors ligne. */
export function useCadence(): CadenceModel | null {
  const [model, setModel] = useState<CadenceModel | null>(null);
  useEffect(() => {
    const now = new Date();
    const raw = readRawProgress();
    const masteredB64 = typeof raw?.mastered === "string" ? raw.mastered : "";
    const masteredNow = masteredCount(decodeBits(masteredB64));
    setModel(cadenceModel(readCadence(), masteredNow, daysUntilExam(now), dayNumber(now)));
  }, []);
  return model;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/dashboard/useCadence.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/useCadence.ts src/features/dashboard/useCadence.test.tsx
git commit -m "feat(cadence): hook useCadence (modele Accueil)"
```

---

### Task 8: `CadencePanel` + montage sur l'Accueil

**Files:**
- Create: `src/features/dashboard/CadencePanel.tsx`
- Create: `src/features/dashboard/CadencePanel.test.tsx`
- Modify: `src/App.tsx` (importer `useCadence`/`CadencePanel`, insérer le panneau en tête de `DashboardView`)

**Interfaces:**
- Consumes: `CadenceModel` (`cadence.ts`), `useCadence` (`useCadence.ts`), `PANEL`/`H2` (`ui/styles.ts`).
- Produces: panneau Accueil affichant série + objectif + le « pourquoi N ».

- [ ] **Step 1: Write the failing test** — créer `src/features/dashboard/CadencePanel.test.tsx` :

```ts
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CadencePanel } from "./CadencePanel.tsx";

test("affiche la série, l'objectif du jour et le pourquoi", () => {
  const html = renderToStaticMarkup(
    <CadencePanel model={{ goal: 54, done: 12, streak: 3, best: 5, reached: false, daysLeft: 134 }} />,
  );
  expect(html).toContain("Cadence");
  expect(html).toContain("3");            // série
  expect(html).toContain("12");           // progrès
  expect(html).toContain("54");           // objectif
  expect(html).toContain("examen");       // le « pourquoi » mentionne les jours avant l examen
});

test("cible atteinte : message de consolidation, pas de barre d'objectif", () => {
  const html = renderToStaticMarkup(
    <CadencePanel model={{ goal: 0, done: 0, streak: 2, best: 2, reached: true, daysLeft: 40 }} />,
  );
  expect(html).toContain("atteint");
});

test("examen passé : panneau en veille", () => {
  const html = renderToStaticMarkup(
    <CadencePanel model={{ goal: 0, done: 0, streak: 0, best: 9, reached: false, daysLeft: 0 }} />,
  );
  expect(html).toContain("passé");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/dashboard/CadencePanel.test.tsx`
Expected: FAIL — module `./CadencePanel.tsx` introuvable.

- [ ] **Step 3: Write minimal implementation** — créer `src/features/dashboard/CadencePanel.tsx` :

```tsx
import type { CadenceModel } from "../../lib/cadence.ts";
import { PANEL, H2 } from "../../ui/styles.ts";

/** Panneau Accueil : cadence quotidienne. Sans logique — le modèle vient de `useCadence`,
 *  pur et testé à part. */
export function CadencePanel({ model }: { model: CadenceModel | null }) {
  if (!model) return null;
  const { goal, done, streak, best, reached, daysLeft } = model;
  const record = best > streak ? ` · record ${best}` : "";
  return (
    <section className={PANEL}>
      <h2 className={H2}>Cadence</h2>
      <p className="text-fg text-sm mt-0 mb-2">🔥 Série : {streak} jour(s){record}</p>
      {daysLeft === 0 ? (
        <p className="text-fg-dim text-sm m-0">L&#39;examen est passé — bravo pour le chemin parcouru.</p>
      ) : reached ? (
        <p className="text-fg-dim text-sm m-0">Objectif de maîtrise atteint — continue à consolider.</p>
      ) : (
        <>
          <p className="text-fg text-sm mt-0 mb-2">Objectif du jour : {done} / {goal} apprises</p>
          <div
            role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={goal}
            className="h-2 rounded-full bg-surface-2 overflow-hidden mb-2"
          >
            <div className="h-full bg-accent" style={{ width: `${goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 100}%` }} />
          </div>
          <p className="text-meta text-fg-dim m-0">
            N = (70 % du banc − déjà apprises) ÷ jours avant l&#39;examen ({daysLeft} j).
          </p>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/dashboard/CadencePanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Monter sur l'Accueil** — dans `src/App.tsx` :

Ajouter les imports :

```ts
import { CadencePanel } from "./features/dashboard/CadencePanel.tsx";
import { useCadence } from "./features/dashboard/useCadence.ts";
import type { CadenceModel } from "./lib/cadence.ts";
```

Étendre la signature et le corps de `DashboardView` (ajouter `cadence` en tête du flux) :

```tsx
export function DashboardView({ model, days, scores, coverage, traps, revision, cadence }: {
  model: DashboardModel | null; days: number; scores: number[];
  coverage?: Record<Skill, SkillCoverage> | null;
  traps?: TrapModel | null;
  revision?: DueCounts | null;
  cadence?: CadenceModel | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CadencePanel model={cadence ?? null} />
      <Dashboard model={model} days={days} coverage={coverage} />
      <TrapPanel model={traps ?? null} />
      <RevisionPanel counts={revision ?? null} />
      <section className={PANEL}>
        <h2 className={H2}>Progression</h2>
        <ProgressChart scores={scores} />
      </section>
      <MethodeN3 />
    </div>
  );
}
```

Dans `App()`, appeler le hook et le passer :

```tsx
  const cadence = useCadence();
  // …
  return <DashboardView model={model} days={daysUntilExam(now)} scores={scores} coverage={coverage} traps={traps} revision={revision} cadence={cadence} />;
```

- [ ] **Step 6: Vérifier le montage + non-régression**

Run: `bun test src/App.test.tsx && bun run typecheck`
Expected: PASS + typecheck propre. (`App.test.tsx` monte l'Accueil ; le panneau `null` avant lecture ne casse rien.)

- [ ] **Step 7: Commit**

```bash
git add src/features/dashboard/CadencePanel.tsx src/features/dashboard/CadencePanel.test.tsx src/App.tsx
git commit -m "feat(cadence): panneau Cadence sur l'Accueil"
```

---

## Vérification finale (après Task 8)

- [ ] `bun test` — toute la suite verte.
- [ ] `bun run typecheck` — propre.
- [ ] Vérif navigateur (optionnelle, cf. CLAUDE.md) : seeder `jlptN3adapt_v2` + faire une session, confirmer que le panneau Cadence affiche série/objectif et que l'objectif décroît quand `mastered` monte.
