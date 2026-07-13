# Rappel de cours (corrigé grammaire, sous-projet #5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher en bas du corrigé de toute question de grammaire un bloc « Rappel de cours » (point matché forme/niv/sens + lien vers la leçon ; repli lien générique sinon).

**Architecture:** Un module pur `coursGramIndex.ts` (parse `cours-gram.json` → `Map<forme, {forme,niv,sens}>`, extraction de forme depuis `<b>`, résolution) + loader mémoïsé + hook `useCoursGramIndex`. `Corrige` gagne une prop `rappel` (reste pur). Câblé en phase corrigé (`EntrainementApp`) et dans le recap (`DiagnosticResults`).

**Tech Stack:** React + TypeScript, bundlé par Bun. Tests : `bun test` (module pur unitaire ; `renderToStaticMarkup` pour les composants).

## Global Constraints

- **Runtime & outils : `bun` exclusivement — jamais `node`.** Tests `bun test` ; typecheck `bun run typecheck`.
- **Worktree `.worktrees/rappel-cours`** (créé, branche `rappel-cours`, base `b0a3980`).
- **Jamais de `Co-Authored-By`** ; **pas de bump `sw.js`** (sources `src/` uniquement ; `data/cours-gram.json` est déjà servi via la route `/cours`).
- **UI en français** ; `renderToStaticMarkup` **échappe les apostrophes** → asserter sur des sous-chaînes **sans apostrophe**.
- Lien = `<a href="#/cours">` (HashRouter, pas de contexte Router requis). Grammaire uniquement.

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/features/cours/coursGramIndex.ts` | parse/index/extract/resolve (pur) + loader mémoïsé | **Créer** |
| `src/features/cours/coursGramIndex.test.ts` | tests unitaires | **Créer** |
| `src/features/cours/useCoursGramIndex.ts` | hook mémoïsé | **Créer** |
| `src/features/quiz/Corrige.tsx` | + prop `rappel` + bloc « Rappel de cours » | **Modifier** |
| `src/features/quiz/Corrige.test.tsx` | SSR smoke du bloc | **Créer** |
| `src/EntrainementApp.tsx` | hook + thread `coursIndex` + `resolveGrammarRappel` (phase corrigé) | **Modifier** |
| `src/features/quiz/DiagnosticResults.tsx` | prop `coursIndex` + résolution par réponse | **Modifier** |
| `src/features/quiz/DiagnosticResults.test.tsx` | (compat — prop optionnelle) | (inchangé) |

Types réutilisés : `CoursSection`/`CoursLesson`/`CoursTable` (`src/features/cours/useCours.ts`) ; `Question` (`src/types/quiz.ts`, a `cat` + `e?`).

---

## Task 1: `coursGramIndex.ts` — parse / extract / resolve (pur) + loader

**Files:**
- Create: `src/features/cours/coursGramIndex.ts`, `src/features/cours/coursGramIndex.test.ts`

**Interfaces:**
- `interface GrammarRappel { forme: string; niv: string; sens: string }`
- `type CoursGramIndex = Map<string, GrammarRappel>`
- `function normalizeForm(s: string): string`
- `function buildCoursGramIndex(section: CoursSection): CoursGramIndex`
- `function extractGrammarForm(e: string): string | null`
- `function resolveGrammarRappel(question: Question, index: CoursGramIndex | null): GrammarRappel | null`
- `function loadCoursGramIndex(fetchImpl?): Promise<CoursGramIndex>` + `function clearCoursGramCache(): void`

- [ ] **Step 1: Write the failing tests**

Create `src/features/cours/coursGramIndex.test.ts`:

```ts
import { test, expect } from "bun:test";
import {
  normalizeForm, buildCoursGramIndex, extractGrammarForm, resolveGrammarRappel,
  loadCoursGramIndex, clearCoursGramCache,
} from "./coursGramIndex.ts";
import type { CoursSection } from "./useCours.ts";
import type { Question } from "../../types/quiz.ts";

test("normalizeForm strips 〜, spaces, and keeps the part after a colon", () => {
  expect(normalizeForm("〜たら")).toBe("たら");
  expect(normalizeForm("〜place : 〜場合は")).toBe("場合は");
  expect(normalizeForm(" 〜について ")).toBe("について");
});

const section: CoursSection = {
  id: "gram", title: "文法",
  lessons: [
    { title: "Aide-mémoire", lessons: [
      { title: "lot 1", table: { headers: ["Forme", "Niv.", "Sens"], rows: [
        ["〜たら", "N3", "« quand/dès que »."],
        ["〜について / 〜に対して", "N3", "« au sujet de »."],
      ] } },
    ] },
    // a non-matching table (different headers) must be ignored
    { title: "conjug", table: { headers: ["Forme", "五段", "一段"], rows: [["x", "y", "z"]] } },
  ],
};

test("buildCoursGramIndex indexes only the Forme/Niv./Sens table, splitting alternatives", () => {
  const idx = buildCoursGramIndex(section);
  expect(idx.get("たら")).toEqual({ forme: "〜たら", niv: "N3", sens: "« quand/dès que »." });
  expect(idx.get("について")).toEqual({ forme: "〜について", niv: "N3", sens: "« au sujet de »." });
  expect(idx.get("に対して")).toEqual({ forme: "〜に対して", niv: "N3", sens: "« au sujet de »." });
  expect(idx.has("x")).toBe(false); // conjugation table ignored
});

test("extractGrammarForm returns the first <b> content, or null", () => {
  expect(extractGrammarForm("<b>〜たら</b> = « quand »")).toBe("〜たら");
  expect(extractGrammarForm("no bold here")).toBeNull();
});

test("resolveGrammarRappel: grammar match, no-match, non-grammar, null index", () => {
  const idx = buildCoursGramIndex(section);
  const g = (e: string, cat = "grammaire"): Question => ({ id: 1, cat: cat as Question["cat"], d: 1, q: "", o: [], a: 0, e });
  expect(resolveGrammarRappel(g("<b>〜たら</b> …"), idx)?.forme).toBe("〜たら");
  expect(resolveGrammarRappel(g("<b>〜inconnu</b> …"), idx)).toBeNull();
  expect(resolveGrammarRappel(g("<b>〜たら</b>", "vocabulaire"), idx)).toBeNull();
  expect(resolveGrammarRappel(g("<b>〜たら</b>"), null)).toBeNull();
});

test("loadCoursGramIndex fetches cours-gram.json, builds the index, and memoizes", async () => {
  clearCoursGramCache();
  let calls = 0;
  const fetchImpl = async (_url: string) => { calls++; return { json: async () => section }; };
  const a = await loadCoursGramIndex(fetchImpl as any);
  const b = await loadCoursGramIndex(fetchImpl as any);
  expect(a).toBe(b);            // memoized
  expect(calls).toBe(1);
  expect(a.get("たら")?.niv).toBe("N3");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/features/cours/coursGramIndex.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `coursGramIndex.ts`**

```ts
/** Index of N3/N4 grammar points from data/cours-gram.json, keyed by normalized form, so a quiz
 *  corrigé can show a "Rappel de cours" for the tested grammar point. Pure logic + a memoized loader. */
import type { CoursSection, CoursLesson } from "./useCours.ts";
import type { Question } from "../../types/quiz.ts";

export interface GrammarRappel { forme: string; niv: string; sens: string }
export type CoursGramIndex = Map<string, GrammarRappel>;

type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;

const GRAM_HEADERS = ["Forme", "Niv.", "Sens"];

/** Normalize a grammar form for matching: keep the part after a colon, drop 〜 and whitespace. */
export function normalizeForm(s: string): string {
  const colon = s.lastIndexOf(":");
  const core = colon >= 0 ? s.slice(colon + 1) : s;
  return core.replace(/〜/g, "").replace(/\s+/g, "");
}

/** Build the form→point index from the cours-gram section. Only the ['Forme','Niv.','Sens'] table
 *  counts; a Forme cell may hold `A / B` alternatives (each becomes its own key). */
export function buildCoursGramIndex(section: CoursSection): CoursGramIndex {
  const index: CoursGramIndex = new Map();
  const walk = (lessons: CoursLesson[] | undefined): void => {
    for (const lesson of lessons ?? []) {
      const t = lesson.table;
      if (t && GRAM_HEADERS.every((h, i) => t.headers[i] === h)) {
        for (const row of t.rows) {
          const [forme, niv, sens] = row;
          for (const alt of forme.split(" / ")) {
            const key = normalizeForm(alt);
            if (key) index.set(key, { forme: alt.trim(), niv, sens });
          }
        }
      }
      walk(lesson.lessons);
    }
  };
  walk(section.lessons);
  return index;
}

/** The grammar form tested by a question = content of the first <b>…</b> in its explanation `e`. */
export function extractGrammarForm(e: string): string | null {
  const m = /<b>([\s\S]*?)<\/b>/.exec(e ?? "");
  if (!m) return null;
  const form = m[1].replace(/<[^>]*>/g, "").trim();
  return form || null;
}

/** Resolve the "Rappel de cours" point for a question, or null (non-grammar, no form, no match, no index). */
export function resolveGrammarRappel(question: Question, index: CoursGramIndex | null): GrammarRappel | null {
  if (!index || question.cat !== "grammaire") return null;
  const form = extractGrammarForm(typeof question.e === "string" ? question.e : "");
  if (!form) return null;
  return index.get(normalizeForm(form)) ?? null;
}

let cache: Promise<CoursGramIndex> | null = null;

/** Clears the memoized index (test isolation). */
export function clearCoursGramCache(): void { cache = null; }

/** Load + memoize the cours-gram index. Failure → empty index (every grammar corrigé falls back to the link). */
export function loadCoursGramIndex(fetchImpl: FetchLike = fetch as FetchLike): Promise<CoursGramIndex> {
  if (!cache) {
    cache = fetchImpl("data/cours-gram.json")
      .then((r) => r.json() as Promise<CoursSection>)
      .then(buildCoursGramIndex)
      .catch(() => new Map<string, GrammarRappel>());
  }
  return cache;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test src/features/cours/coursGramIndex.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/rappel-cours
git add src/features/cours/coursGramIndex.ts src/features/cours/coursGramIndex.test.ts
git commit -m "feat : index cours-gram (forme→point) + extraction/résolution (rappel de cours)"
```

---

## Task 2: `Corrige` bloc « Rappel de cours » + hook `useCoursGramIndex`

**Files:**
- Create: `src/features/cours/useCoursGramIndex.ts`
- Modify: `src/features/quiz/Corrige.tsx`
- Create: `src/features/quiz/Corrige.test.tsx`

**Interfaces:**
- `function useCoursGramIndex(): CoursGramIndex | null`
- `Corrige` gains `rappel?: GrammarRappel | null`.

- [ ] **Step 1: Write the failing test**

Create `src/features/quiz/Corrige.test.tsx`:

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Corrige } from "./Corrige.tsx";
import type { Question } from "../../types/quiz.ts";

const gram: Question = { id: 1, cat: "grammaire", d: 1, q: "", o: ["a", "b"], a: 0, e: "<b>〜たら</b> = « quand »" };
const vocab: Question = { id: 2, cat: "vocabulaire", d: 1, q: "", o: ["a", "b"], a: 0, e: "sens" };

test("Corrige shows a matched Rappel de cours for a grammar question", () => {
  const html = renderToStaticMarkup(
    <Corrige question={gram} correct={true} rappel={{ forme: "〜たら", niv: "N3", sens: "« quand/dès que »." }} />,
  );
  expect(html).toContain("Rappel de cours");
  expect(html).toContain("〜たら");
  expect(html).toContain("N3");
  expect(html).toContain("voir la le"); // "voir la leçon" (avoid the ç just in case)
});

test("Corrige shows the fallback link for a grammar question with no match", () => {
  const html = renderToStaticMarkup(<Corrige question={gram} correct={true} rappel={null} />);
  expect(html).toContain("Rappel de cours");
  expect(html).toContain("Revoir la grammaire");
});

test("Corrige shows NO rappel block for a non-grammar question", () => {
  const html = renderToStaticMarkup(<Corrige question={vocab} correct={true} rappel={null} />);
  expect(html).not.toContain("Rappel de cours");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/features/quiz/Corrige.test.tsx`
Expected: FAIL — `Corrige` doesn't accept `rappel` / no rappel block rendered.

- [ ] **Step 3: Add the rappel block to `Corrige.tsx`**

Add the import at the top:

```ts
import type { GrammarRappel } from "../cours/coursGramIndex.ts";
```

Add `rappel` to the props (the current signature is `{ question, correct }`):

```ts
export function Corrige({ question, correct, rappel }: { question: Question; correct: boolean; rappel?: GrammarRappel | null }) {
```

Insert the block just before the closing `</div>` of the component's root panel (after the existing `!correct && hasOd` block):

```tsx
      {question.cat === "grammaire" && (
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-accent text-sm font-bold mb-1">Rappel de cours</p>
          {rappel ? (
            <p className="text-fg-dim text-sm m-0">
              <span className="text-fg font-bold" dangerouslySetInnerHTML={{ __html: furiOrPlain(rappel.forme) }} />
              {" "}({rappel.niv}) — {rappel.sens}{" "}
              <a href="#/cours" className="text-accent">· voir la leçon</a>
            </p>
          ) : (
            <a href="#/cours" className="text-accent text-sm">📖 Revoir la grammaire dans le cours</a>
          )}
        </div>
      )}
```

(`furiOrPlain` is already defined in `Corrige.tsx`.)

- [ ] **Step 4: Run to verify it passes**

Run: `bun test src/features/quiz/Corrige.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create the hook `useCoursGramIndex.ts`**

```ts
import { useEffect, useState } from "react";
import { loadCoursGramIndex, type CoursGramIndex } from "./coursGramIndex.ts";

/** Loads the memoized cours-gram index once; `null` until it resolves. */
export function useCoursGramIndex(): CoursGramIndex | null {
  const [index, setIndex] = useState<CoursGramIndex | null>(null);
  useEffect(() => {
    let alive = true;
    loadCoursGramIndex().then((idx) => { if (alive) setIndex(idx); });
    return () => { alive = false; };
  }, []);
  return index;
}
```

- [ ] **Step 6: Typecheck + focused tests**

Run: `bun run typecheck`
Expected: PASS.

Run: `bun test src/features/quiz/Corrige.test.tsx src/features/cours/coursGramIndex.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/rappel-cours
git add src/features/quiz/Corrige.tsx src/features/quiz/Corrige.test.tsx src/features/cours/useCoursGramIndex.ts
git commit -m "feat : bloc « Rappel de cours » dans Corrige (grammaire) + hook useCoursGramIndex"
```

---

## Task 3: Câblage — `coursIndex` dans la phase corrigé et le recap diagnostic

**Files:**
- Modify: `src/EntrainementApp.tsx`, `src/features/quiz/DiagnosticResults.tsx`

**Interfaces:**
- `EntrainementAppView` gains `coursIndex?: CoursGramIndex | null`.
- `DiagnosticResults` gains `coursIndex?: CoursGramIndex | null`.

- [ ] **Step 1: Wire `DiagnosticResults`**

In `src/features/quiz/DiagnosticResults.tsx`, add imports:

```ts
import { resolveGrammarRappel, type CoursGramIndex } from "../cours/coursGramIndex.ts";
```

Add `coursIndex` to the props (optional, default null):

```ts
export function DiagnosticResults({
  model, answers, onDone, coursIndex,
}: {
  model: DashboardModel;
  answers: { question: Question; chosen: number }[];
  onDone: () => void;
  coursIndex?: CoursGramIndex | null;
}) {
```

Pass the resolved rappel to each `Corrige` (the per-answer map):

```tsx
          <Corrige question={a.question} correct={a.chosen === a.question.a} rappel={resolveGrammarRappel(a.question, coursIndex ?? null)} />
```

- [ ] **Step 2: Wire `EntrainementApp` + `EntrainementAppView`**

In `src/EntrainementApp.tsx`, add imports:

```ts
import { useCoursGramIndex } from "./features/cours/useCoursGramIndex.ts";
import { resolveGrammarRappel, type CoursGramIndex } from "./features/cours/coursGramIndex.ts";
```

Add `coursIndex` to `EntrainementAppView`'s props (optional):

```ts
  mode?: "normal" | "diagnostic"; diagAnswers?: DiagAnswer[]; diagModel?: DashboardModel | null;
  coursIndex?: CoursGramIndex | null;
```

In the `corrige` phase, pass the resolved rappel to `Corrige`:

```tsx
          <Corrige question={question} correct={props.chosen != null && props.chosen === question.a} rappel={resolveGrammarRappel(question, props.coursIndex ?? null)} />
```

In the `diag-results` phase, pass `coursIndex` down to `DiagnosticResults`:

```tsx
      {props.phase === "diag-results" && props.diagModel && (
        <DiagnosticResults model={props.diagModel} answers={props.diagAnswers ?? []} onDone={props.onDiagDone ?? (() => {})} coursIndex={props.coursIndex ?? null} />
      )}
```

In the container `EntrainementApp`, load the index and pass it:

```tsx
export default function EntrainementApp() {
  const quiz = useQuiz();
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const coursIndex = useCoursGramIndex();
  // … diagModel unchanged …

  return (
    <EntrainementAppView
      // … existing props …
      mode={quiz.mode} diagAnswers={quiz.diagAnswers} diagModel={diagModel}
      coursIndex={coursIndex}
      // … existing handlers …
    />
  );
}
```

(Add `coursIndex={coursIndex}` to the JSX; keep every other prop unchanged.)

- [ ] **Step 3: Add a wiring test to `DiagnosticResults.test.tsx`**

Append to `src/features/quiz/DiagnosticResults.test.tsx` a case proving the index reaches the per-answer Corrige:

```tsx
test("DiagnosticResults renders a matched Rappel de cours when a coursIndex is provided", () => {
  const g: Question = { id: 3, cat: "grammaire", d: 1, q: "", o: ["a", "b"], a: 0, e: "<b>〜たら</b> = x" };
  const idx = new Map([["たら", { forme: "〜たら", niv: "N3", sens: "« quand »." }]]);
  const html = renderToStaticMarkup(
    <DiagnosticResults model={model} answers={[{ question: g, chosen: 1 }]} onDone={() => {}} coursIndex={idx} />,
  );
  expect(html).toContain("Rappel de cours");
  expect(html).toContain("〜たら");
});
```

(Reuse the existing `model` fixture in that file; add `import type { Question } from "../../types/quiz.ts";` if not already imported.)

- [ ] **Step 4: Typecheck + full suite**

Run: `bun run typecheck`
Expected: PASS (the new props are optional, so existing callers/tests compile unchanged).

Run: `bun test`
Expected: PASS — full suite green (coursGramIndex, Corrige, DiagnosticResults wiring, and all pre-existing).

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/rappel-cours
git add -A -- src
git commit -m "feat : câbler le rappel de cours (phase corrigé + recap diagnostic) — coursIndex"
```

---

## Self-Review

**1. Spec coverage:**
- Index + normalisation + extraction + résolution + loader → **Task 1**.
- Bloc « Rappel de cours » (matché / repli) grammaire-only + hook → **Task 2**.
- Câblage phase corrigé + recap diagnostic → **Task 3**.
- Lien `#/cours` (pas d'ancre), `Corrige` pur → **Task 2/3**.
- Aucune entrée `copy-static.mjs` (cours-gram déjà servi) → confirmé au spec, rien à faire.

**2. Placeholder scan:** aucun TBD ; chaque étape porte le code réel + commande + attendu.

**3. Type consistency:** `GrammarRappel`/`CoursGramIndex`/`resolveGrammarRappel` définis Task 1, consommés à l'identique par `Corrige` (Task 2), `DiagnosticResults` et `EntrainementApp` (Task 3). Props `rappel`/`coursIndex` **optionnelles** → aucun appelant existant (ni test) ne casse. `useCoursGramIndex` (Task 2) consommé uniquement dans le conteneur `EntrainementApp` (Task 3).

**Note de couverture :** le rendu du bloc (matché/repli/non-grammaire) est SSR-testé (Task 2) ; le câblage est prouvé par le test `DiagnosticResults` avec `coursIndex` (Task 3). Le loader/fetch est unit-testé (Task 1). Le hook `useCoursGramIndex` (effet trivial autour du loader mémoïsé) n'a pas de test dédié — même posture que `useCours`.
