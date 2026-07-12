# Mode « Diagnostic » (sous-projet #3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre réel le mode Diagnostic : une session-test large (toutes catégories, difficultés étalées), sans corrigé au fil de l'eau, avec écran d'intro « mode test » et bilan « niveau estimé » + correction complète à la fin ; proposé au 1ᵉʳ lancement puis tous les 7 jours.

**Architecture:** `selectDiagnostic` (pure, sélection large) + 2 composants purs (`DiagnosticIntro`, `DiagnosticResults`) + une extension de la machine à états de `useQuiz` (état `mode`, phases `diag-intro`/`diag-results`, accumulateur `diagAnswers`, persistance `diagAt`) + routage dans `EntrainementApp`. Réutilise `updateRating` (K=40 calibre vite) et `dashboardModel` (niveau estimé) — aucun nouveau moteur de notation.

**Tech Stack:** React + TypeScript, bundlé par Bun. Tests : `bun test` (helpers/​composants purs ; happy-dom pour l'intégration, patron `EntrainementApp.start.test.tsx`).

## Global Constraints

- **Runtime & outils : `bun` exclusivement — jamais `node`.** Tests `bun test` ; typecheck `bun run typecheck`.
- **Worktree `.worktrees/mode-diagnostic`** (créé, branche `mode-diagnostic`, base `d12965a`).
- **Jamais de `Co-Authored-By`** dans les commits.
- **Pas de bump `CACHE` dans `sw.js`** : seules des sources `src/` changent.
- **UI en français** ; `renderToStaticMarkup` **échappe les apostrophes** (`'`→`&#x27;`) → asserter sur des sous-chaînes **sans apostrophe**.
- Longueur pilotée par le temps (`questionCount(min)`) ; **Mesure** Elo normale (aucun reset de `t`) ; **tout droit** (pas de phase `corrige` en diagnostic) ; intervalle diagnostic = **7 j** (déjà `DIAGNOSTIC_INTERVAL_DAYS` dans `sessionPlan.ts`).

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/lib/bank.ts` | +`selectDiagnostic` | **Modifier** |
| `src/lib/bank.test.ts` | tests `selectDiagnostic` | **Modifier** |
| `src/features/quiz/DiagnosticIntro.tsx` | écran intro « mode test » | **Créer** |
| `src/features/quiz/DiagnosticResults.tsx` | niveau estimé + correction | **Créer** |
| `src/features/quiz/DiagnosticIntro.test.tsx` / `DiagnosticResults.test.tsx` | SSR smoke | **Créer** |
| `src/features/quiz/useQuiz.ts` | `Phase` étendue, `mode`/`diagAnswers`, `start()` branche diag + `skipDiagnostic`, `beginDiagnostic`, `choose()` branche diag, `restart()` reset, persistance `diagAt` | **Modifier** |
| `src/features/entrainement/sessionPlan.ts` | `BUILT_CAPS.diagnostic = true` | **Modifier** |
| `src/features/entrainement/sessionPlan.test.ts` | contrat #2 → passer un `daysSinceDiagnostic` récent ; + tests #3 | **Modifier** |
| `src/EntrainementApp.tsx` | routage `diag-intro`/`diag-results`, calcul `dashboardModel`, nouvelles props | **Modifier** |
| `src/EntrainementApp.diagnostic.test.tsx` | intégration happy-dom | **Créer** |

Rappel — signatures existantes à réutiliser : `shuffle`, `questionCount`, `loadCategory` (bank.ts) ; `SKILLS`, `Skill` (`types/progress.ts`) ; `Question`, `Difficulty` (`types/quiz.ts`) ; `dashboardModel`, `DashboardModel` (`lib/scoring.ts`) ; `readProgress` (`lib/storage.ts`) ; `QuestionCard`, `Corrige`.

---

## Task 1: `selectDiagnostic` — sélection large (pure)

**Files:**
- Modify: `src/lib/bank.ts`
- Test: `src/lib/bank.test.ts`

**Interfaces:**
- Produces: `function selectDiagnostic(poolsBySkill: Record<Skill, Question[]>, total: number, rng?: () => number): Question[]` — répartit `total` ~également sur les skills ayant des questions, **étale les difficultés** (d=1/2/3), sans doublon, résultat `shuffle`-é.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/bank.test.ts` (add `selectDiagnostic` to the existing import from `./bank.ts`). The `q(id,d)` helper hardcodes `cat:"kanji"`; build per-skill pools with explicit `cat`:

```ts
test("selectDiagnostic spreads across skills and difficulties, no duplicates", () => {
  const mk = (cat: string, base: number): Question[] =>
    [1, 2, 3].flatMap((d) => [0, 1].map((k) => ({ id: base + d * 10 + k, cat, d: d as 1 | 2 | 3, q: "", o: [], a: 0 })));
  const pools = {
    grammaire: mk("grammaire", 100), vocabulaire: mk("vocabulaire", 200), kanji: mk("kanji", 300),
    lecture: mk("lecture", 400), ecoute: mk("ecoute", 500),
  } as Record<string, Question[]>;
  const out = selectDiagnostic(pools as any, 15, () => 0);
  expect(out).toHaveLength(15);
  expect(new Set(out.map((x) => x.id)).size).toBe(15); // no duplicates
  // ~3 per skill (15/5)
  for (const cat of ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"]) {
    expect(out.filter((x) => x.cat === cat)).toHaveLength(3);
  }
  // difficulties are spread, not all the same
  expect(new Set(out.map((x) => x.d)).size).toBeGreaterThan(1);
});

test("selectDiagnostic skips empty skills and never exceeds total", () => {
  const one = [{ id: 1, cat: "kanji", d: 1 as const, q: "", o: [], a: 0 }];
  const pools = { grammaire: [], vocabulaire: [], kanji: one, lecture: [], ecoute: [] } as Record<string, Question[]>;
  const out = selectDiagnostic(pools as any, 15, () => 0);
  expect(out.length).toBeLessThanOrEqual(15);
  expect(out.every((x) => x.cat === "kanji")).toBe(true);
});

test("selectDiagnostic returns [] for total<=0", () => {
  expect(selectDiagnostic({} as any, 0, () => 0)).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/lib/bank.test.ts`
Expected: FAIL — `selectDiagnostic` not exported.

- [ ] **Step 3: Implement `selectDiagnostic`**

In `src/lib/bank.ts`, add after `pickAdaptive` (uses `shuffle`, `SKILLS`, `Question`):

```ts
/** Broad, level-triangulating selection for a diagnostic: ~equal share per skill with a spread of
 *  difficulties (d=1/2/3), shuffled. Distinct from pickAdaptive (mastery-weighted). Pure. */
export function selectDiagnostic(
  poolsBySkill: Record<Skill, Question[]>, total: number, rng: () => number = Math.random,
): Question[] {
  if (total <= 0) return [];
  const skills = SKILLS.filter((s) => (poolsBySkill[s]?.length ?? 0) > 0);
  if (!skills.length) return [];
  const base = Math.floor(total / skills.length);
  let remainder = total - base * skills.length;
  const picked: Question[] = [];
  for (const s of skills) {
    const want = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    // Group this skill's (shuffled) pool by difficulty, then round-robin d1→d2→d3 to spread levels.
    const byD: [Question[], Question[], Question[]] = [[], [], []];
    for (const q of shuffle(poolsBySkill[s], rng)) byD[q.d - 1].push(q);
    let taken = 0, di = 0;
    while (taken < want) {
      let advanced = false;
      for (let k = 0; k < 3; k++) {
        const bucket = byD[(di + k) % 3];
        if (bucket.length) {
          picked.push(bucket.shift() as Question);
          taken++; di = (di + k + 1) % 3; advanced = true;
          break;
        }
      }
      if (!advanced) break; // this skill's pool is exhausted
    }
  }
  return shuffle(picked, rng);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test src/lib/bank.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-diagnostic
git add src/lib/bank.ts src/lib/bank.test.ts
git commit -m "feat : selectDiagnostic — sélection large étalée en difficulté (mode diagnostic)"
```

---

## Task 2: Composants `DiagnosticIntro` + `DiagnosticResults`

**Files:**
- Create: `src/features/quiz/DiagnosticIntro.tsx`, `src/features/quiz/DiagnosticResults.tsx`
- Test: `src/features/quiz/DiagnosticIntro.test.tsx`, `src/features/quiz/DiagnosticResults.test.tsx`

**Interfaces:**
- `DiagnosticIntro(props: { count: number; onStart: () => void; onLater: () => void })`
- `DiagnosticResults(props: { model: DashboardModel; answers: { question: Question; chosen: number }[]; onDone: () => void })`

- [ ] **Step 1: Write failing tests**

`src/features/quiz/DiagnosticIntro.test.tsx`:

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticIntro } from "./DiagnosticIntro.tsx";

test("DiagnosticIntro shows test-mode heading, count, and both buttons", () => {
  const html = renderToStaticMarkup(<DiagnosticIntro count={15} onStart={() => {}} onLater={() => {}} />);
  expect(html).toContain("Mode test");
  expect(html).toContain("15");
  expect(html).toContain("Commencer le test");
  expect(html).toContain("Plus tard");
});
```

`src/features/quiz/DiagnosticResults.test.tsx`:

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticResults } from "./DiagnosticResults.tsx";
import type { DashboardModel } from "../../lib/scoring.ts";
import type { Question } from "../../types/quiz.ts";

const model: DashboardModel = {
  answers: 15, passPct: 42, sectionTotal: 90, level: "N3-", days: 100, confidence: 0.5,
  barMastery: { grammaire: 55, vocabulaire: 60, kanji: 40, lecture: 50, ecoute: 45 } as Record<string, number> as never,
  hasEnough: true,
};
const q: Question = { id: 1, cat: "grammaire", d: 1, q: "test", o: ["a", "b"], a: 0 };

test("DiagnosticResults shows the estimated level, score, and a correction per answer", () => {
  const html = renderToStaticMarkup(
    <DiagnosticResults model={model} answers={[{ question: q, chosen: 1 }]} onDone={() => {}} />,
  );
  expect(html).toContain("niveau estim"); // "niveau estimé" (é is not escaped, but assert prefix to be safe)
  expect(html).toContain("N3-");
  expect(html).toContain("Correction");
  expect(html).toContain("Termin"); // "Terminé" button
  expect(html).toContain("Faux"); // Corrige renders (chosen 1 != a 0)
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun test src/features/quiz/DiagnosticIntro.test.tsx src/features/quiz/DiagnosticResults.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the components**

`src/features/quiz/DiagnosticIntro.tsx`:

```tsx
/** Diagnostic intro: notifies the learner they're entering a test (no per-question corrigé,
 *  full report at the end). [Commencer le test] starts it; [Plus tard] runs a normal session
 *  instead (the diagnostic is never forced). Pure / prop-driven. */
export function DiagnosticIntro({
  count, onStart, onLater,
}: {
  count: number;
  onStart: () => void;
  onLater: () => void;
}) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
      <h2 className="text-fg text-lg font-bold mt-0 mb-2">🧭 Mode test</h2>
      <p className="text-fg-dim text-sm mt-0 mb-2">On évalue ton niveau réel sur toutes les catégories.</p>
      <ul className="text-fg-dim text-sm list-disc pl-5 mt-0 mb-4 flex flex-col gap-1">
        <li>{count} questions, difficultés variées</li>
        <li>pas de correction au fil de l&#39;eau</li>
        <li>ton niveau estimé et le corrigé complet à la fin</li>
      </ul>
      <button
        type="button"
        onClick={onStart}
        className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
      >
        Commencer le test
      </button>
      <button
        type="button"
        onClick={onLater}
        className="w-full bg-transparent border border-line text-fg-dim rounded-xl px-4 py-2.5 text-sm cursor-pointer mt-2"
      >
        Plus tard
      </button>
    </div>
  );
}
```

`src/features/quiz/DiagnosticResults.tsx`:

```tsx
import type { DashboardModel } from "../../lib/scoring.ts";
import type { Skill } from "../../types/progress.ts";
import type { Question } from "../../types/quiz.ts";
import { QuestionCard } from "./QuestionCard.tsx";
import { Corrige } from "./Corrige.tsx";

const SKILL_LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture", ecoute: "Écoute",
};

/** Diagnostic report: estimated level (from `dashboardModel`) + a full corrigé per answered
 *  question (reuses QuestionCard + Corrige). Pure / prop-driven. */
export function DiagnosticResults({
  model, answers, onDone,
}: {
  model: DashboardModel;
  answers: { question: Question; chosen: number }[];
  onDone: () => void;
}) {
  const right = answers.filter((a) => a.chosen === a.question.a).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-panel border border-line rounded-xl p-6 shadow-card surface-blur text-center">
        <p className="text-fg-dim text-sm mb-1">Ton niveau estimé</p>
        <p className="text-4xl font-bold text-accent mb-1">{model.level}</p>
        <p className="text-fg-dim text-sm mb-3">
          {model.passPct}% de réussite estimée · {right}/{answers.length} au test
        </p>
        <div className="flex flex-col gap-1 text-left">
          {(Object.entries(model.barMastery) as [Skill, number][]).map(([skill, pct]) => (
            <div key={skill} className="flex items-center justify-between text-sm">
              <span className="text-fg-dim">{SKILL_LABELS[skill] ?? skill}</span>
              <span className="text-fg font-bold">{pct}%</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-fg text-base font-bold m-0">Correction</p>
      {answers.map((a, i) => (
        <div key={i} className="flex flex-col gap-2">
          <QuestionCard question={a.question} chosen={a.chosen} answered={true} onChoose={() => {}} onSpeak={() => {}} />
          <Corrige question={a.question} correct={a.chosen === a.question.a} />
        </div>
      ))}
      <button
        type="button"
        onClick={onDone}
        className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
      >
        Terminé
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `bun test src/features/quiz/DiagnosticIntro.test.tsx src/features/quiz/DiagnosticResults.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-diagnostic
git add src/features/quiz/DiagnosticIntro.tsx src/features/quiz/DiagnosticResults.tsx src/features/quiz/DiagnosticIntro.test.tsx src/features/quiz/DiagnosticResults.test.tsx
git commit -m "feat : composants DiagnosticIntro + DiagnosticResults (mode diagnostic)"
```

---

## Task 3: Intégration — machine à états diagnostic + routage + flip flag

Atomique : le hook émet le diagnostic, la vue le route, le flag est allumé, les contrats mis à jour, prouvé par un test d'intégration. L'arbre reste vert à la fin.

**Files:**
- Modify: `src/features/quiz/useQuiz.ts`, `src/features/entrainement/sessionPlan.ts`, `src/features/entrainement/sessionPlan.test.ts`, `src/EntrainementApp.tsx`
- Create: `src/EntrainementApp.diagnostic.test.tsx`

**Interfaces:**
- `useQuiz()` gagne : `mode: "normal" | "diagnostic"`, `diagAnswers: { question: Question; chosen: number }[]`, `beginDiagnostic: () => void` ; `start(minArg?, opts?: { skipDiagnostic?: boolean })` ; `restart()` réinitialise aussi `mode`/`diagAnswers`. `Phase` = `... | "diag-intro" | "diag-results"`.
- `EntrainementAppView` gagne : `mode`, `index`, `diagAnswers`, `diagModel: DashboardModel | null`, `onBeginDiag`, `onLater`, `onDiagDone`.

- [ ] **Step 1: Update the contract tests first (RED)**

In `src/features/entrainement/sessionPlan.test.ts`: the existing `#2 contract` tests pass `daysSinceDiagnostic: null` with `BUILT_CAPS` — once `diagnostic` is on, those would become `{kind:"diagnostic"}`. Make them pass a **recent** diagnostic so they still exercise the composed/errors path, and add the #3 diagnostic cases.

Change the existing `#2 contract: BUILT_CAPS enables errors …` test's state to include `daysSinceDiagnostic: 3` (recent), and the `#2 contract: no errors …` test likewise. Then append:

```ts
test("#3 contract: BUILT_CAPS emits diagnostic when never assessed or >=7d", () => {
  expect(pickSessionPlan({ ...base, daysSinceDiagnostic: null }, 10, BUILT_CAPS)).toEqual({ kind: "diagnostic" });
  expect(pickSessionPlan({ ...base, daysSinceDiagnostic: 7 }, 10, BUILT_CAPS)).toEqual({ kind: "diagnostic" });
});

test("#3 contract: a recent diagnostic (<7d) yields a composed session", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: 3, wrongCount: 50 }, 10, BUILT_CAPS);
  expect(plan.kind).toBe("composed");
});
```

- [ ] **Step 2: Run to verify RED**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: FAIL — the new `#3` "diagnostic when never assessed" test gets `composed` (flag still off), and/or the amended `#2` tests now assert composed while the code still returns composed (those pass) — the failing one is the diagnostic-emitted assertion.

- [ ] **Step 3: Flip the capability**

In `src/features/entrainement/sessionPlan.ts`:

```ts
/** Capacités construites à ce jour. Sous-projet #4 : passer `learn` à `true` ici. */
export const BUILT_CAPS: Caps = { diagnostic: true, errors: true, learn: false };
```

- [ ] **Step 4: Run contract tests (they now pass, but the full suite will break until wiring lands)**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: PASS. (Do NOT run the full suite yet — `start()` isn't wired, so `EntrainementApp.start.test.tsx` will break; Step 5-8 fix that.)

- [ ] **Step 5: Extend `useQuiz.ts` — types, state, imports**

Add imports (top, with the bank import and others):

```ts
import { questionCount, allocateCount, loadCategory, pickAdaptive, questionsForIds, selectRecentErrors, composeSession, selectDiagnostic } from "../../lib/bank.ts";
```

Extend the `Phase` type:

```ts
export type Phase = "home" | "question" | "corrige" | "results" | "diag-intro" | "diag-results";
```

Add a `DiagAnswer` type near `ResumeState`:

```ts
export interface DiagAnswer { question: Question; chosen: number; }
```

Add a day helper near the other module helpers:

```ts
const DAY_MS = 864e5;
function daysSince(ts: unknown): number | null {
  return typeof ts === "number" && ts > 0 ? (Date.now() - ts) / DAY_MS : null;
}
```

Add state inside `useQuiz` (next to the other `useState`s):

```ts
const [mode, setMode] = useState<"normal" | "diagnostic">("normal");
const [diagAnswers, setDiagAnswers] = useState<DiagAnswer[]>([]);
```

- [ ] **Step 6: `start()` — diagnostic branch + real `daysSinceDiagnostic` + `skipDiagnostic`**

Replace the `start` signature and the plan computation. Change the callback to accept `opts`, compute `daysSinceDiagnostic`, and add the diagnostic branch BEFORE the composed path:

```ts
  const start = useCallback(async (minArg?: number, opts?: { skipDiagnostic?: boolean }) => {
    const min = resolveMinutes(minArg, minutes);
    const raw = readRawProgress();
    const progress = asProgress(raw);
    const wrong = asWrong(raw);
    const total = questionCount(min);

    // `skipDiagnostic` ([Plus tard]) forces a recent-diagnostic reading → composed path.
    const daysSinceDiagnostic = opts?.skipDiagnostic ? 0 : daysSince(raw?.diagAt);

    const plan = pickSessionPlan(
      { resume: false, daysSinceDiagnostic, wrongCount: wrong.length, newCoursePoints: 0 },
      total,
      BUILT_CAPS,
    );

    if (plan.kind === "diagnostic") {
      const poolsBySkill = {} as Record<Skill, Question[]>;
      await Promise.all(SKILLS.map(async (s) => { poolsBySkill[s] = await loadCategory(s); }));
      const session = selectDiagnostic(poolsBySkill, total, Math.random);
      if (!session.length) return;
      rightRef.current = 0;
      setQuestions(session);
      setIndex(0);
      setDiagAnswers([]);
      setMode("diagnostic");
      setAnswered(false);
      setChosen(null);
      setPhase("diag-intro"); // notify before the first question; no resume for a one-shot test
      return;
    }
    if (plan.kind !== "composed") return; // resume unreachable from start()

    setMode("normal");
```

Everything AFTER `setMode("normal");` is the existing composed body (errors slice → adaptive → `composeSession` → set state → persist resume) — leave it unchanged. Keep the explanatory comment block above the composed body.

- [ ] **Step 7: `beginDiagnostic`, `choose()` diagnostic branch, `restart()` reset**

Add `beginDiagnostic` (near the other callbacks):

```ts
  const beginDiagnostic = useCallback(() => {
    setPhase("question"); // questions already loaded by start(); mode is "diagnostic"
    setAnswered(false);
    setChosen(null);
  }, []);
```

In `choose()`, keep the shared progress/rating write, but branch the UI transition. Restructure so the write happens first, then split by mode. Replace the current `choose` body:

```ts
  const choose = useCallback((i: number) => {
    const q = questions[index];
    if (!q || answered) return;
    const correct = i === q.a;

    // Shared: measure — write the Elo rating + progression exactly like a normal answer.
    const raw = readRawProgress();
    const curWrong = asWrong(raw);
    const nextSkill = updateRating(skillStateOf(raw, q.cat), q.d, correct);
    const withoutId = curWrong.filter((id) => id !== q.id);
    const nextWrong = (correct ? withoutId : [...withoutId, q.id]).slice(-80);
    const seen = encodeBits(setBit(decodeBits(typeof raw?.seen === "string" ? raw.seen : ""), q.id));
    const mastered = correct
      ? encodeBits(setBit(decodeBits(typeof raw?.mastered === "string" ? raw.mastered : ""), q.id))
      : undefined;
    writeProgress({
      skill: { [q.cat]: nextSkill },
      total: numField(raw, "total") + 1,
      right: numField(raw, "right") + (correct ? 1 : 0),
      wrong: nextWrong,
      seen,
      ...(mastered !== undefined ? { mastered } : {}),
    });
    schedulePush();
    rightRef.current += correct ? 1 : 0;

    if (mode === "diagnostic") {
      // Tout droit: record the answer for the end-of-test corrigé, then advance immediately.
      setDiagAnswers((prev) => [...prev, { question: q, chosen: i }]);
      const ni = index + 1;
      if (ni >= questions.length) {
        writeProgress({ diagAt: Date.now() }); // stamp the diagnostic completion
        setPhase("diag-results");
      } else {
        setIndex(ni); // phase stays "question"
      }
      return;
    }

    // Normal: reveal the corrigé.
    setChosen(i);
    setAnswered(true);
    setPhase("corrige");
    setResume((prev) => {
      if (!prev) return prev;
      const next: ResumeState = { ...prev, qi: index, right: rightRef.current };
      persistResumeState(next);
      return next;
    });
  }, [questions, index, answered, schedulePush, mode]);
```

Extend `restart()` to also reset diagnostic state:

```ts
  const restart = useCallback(() => {
    setPhase("home");
    setQuestions([]);
    setIndex(0);
    setAnswered(false);
    setChosen(null);
    setMode("normal");
    setDiagAnswers([]);
  }, []);
```

Add `mode`, `diagAnswers`, `beginDiagnostic` to the returned object (next to `start`, `restart`, etc.).

- [ ] **Step 8: Route the new phases in `EntrainementApp.tsx`**

Add imports:

```ts
import { DiagnosticIntro } from "./features/quiz/DiagnosticIntro.tsx";
import { DiagnosticResults } from "./features/quiz/DiagnosticResults.tsx";
import { dashboardModel, type DashboardModel } from "./lib/scoring.ts";
import { readProgress } from "./lib/storage.ts";
import type { DiagAnswer } from "./features/quiz/useQuiz.ts";
```

Extend `EntrainementAppView`'s props (add the diagnostic ones):

```ts
export function EntrainementAppView(props: {
  phase: Phase; question: Question | null; count: number; right: number; index: number;
  minutes: number; resume: ResumeState | null;
  answered: boolean; chosen: number | null;
  mode: "normal" | "diagnostic"; diagAnswers: DiagAnswer[]; diagModel: DashboardModel | null;
  onStart: () => void; onChoose: (i: number) => void; onNext: () => void; onRestart: () => void;
  onSetMinutes: (m: number) => void;
  onResumeNow: () => void; onDismissResume: () => void;
  onBeginDiag: () => void; onLater: () => void; onDiagDone: () => void;
}) {
```

Add the `diag-intro` case (early return, like `home`) and update the `question` case to show progress in diagnostic mode; add the `diag-results` case:

```ts
  if (props.phase === "diag-intro") {
    return <DiagnosticIntro count={props.count} onStart={props.onBeginDiag} onLater={props.onLater} />;
  }
```

Replace the `question`-phase block with:

```tsx
      {props.phase === "question" && question && (
        <div className="flex flex-col gap-3">
          {props.mode === "diagnostic" && (
            <p className="text-fg-dim text-sm m-0">Test · question {props.index + 1} / {props.count}</p>
          )}
          <QuestionCard question={question} chosen={null} answered={false} onChoose={props.onChoose} onSpeak={onSpeak} />
        </div>
      )}
```

Add after the `results` block:

```tsx
      {props.phase === "diag-results" && props.diagModel && (
        <DiagnosticResults model={props.diagModel} answers={props.diagAnswers} onDone={props.onDiagDone} />
      )}
```

Update the container (`EntrainementApp` default export) to compute `diagModel` and pass the new props:

```tsx
export default function EntrainementApp() {
  const quiz = useQuiz();
  const [resumeDismissed, setResumeDismissed] = useState(false);

  const diagModel: DashboardModel | null = quiz.phase === "diag-results"
    ? dashboardModel(readProgress() ?? { total: 0, skill: {} }, new Date())
    : null;

  return (
    <EntrainementAppView
      phase={quiz.phase} question={quiz.question} count={quiz.count} right={quiz.right} index={quiz.index}
      minutes={quiz.minutes}
      resume={resumeDismissed ? null : quiz.resume}
      answered={quiz.answered} chosen={quiz.chosen}
      mode={quiz.mode} diagAnswers={quiz.diagAnswers} diagModel={diagModel}
      onStart={quiz.start} onChoose={quiz.choose} onNext={quiz.next} onRestart={quiz.restart}
      onSetMinutes={quiz.setMinutes}
      onResumeNow={quiz.resumeNow} onDismissResume={() => setResumeDismissed(true)}
      onBeginDiag={quiz.beginDiagnostic} onLater={() => quiz.start(undefined, { skipDiagnostic: true })}
      onDiagDone={quiz.restart}
    />
  );
}
```

Note: `quiz.index` must be returned by `useQuiz` — it already is (`index` is in the return object). Confirm it's present; if not, add it.

- [ ] **Step 9: Write the integration test**

Create `src/EntrainementApp.diagnostic.test.tsx` (reuse the harness shape from `EntrainementApp.start.test.tsx` — `pool`/`BANK`/`INDEX`, mocked `fetch`, `clearCategoryCache`):

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

async function click(text: string) {
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  expect(btn, `button "${text}"`).toBeTruthy();
  await act(async () => { btn!.click(); await new Promise((r) => setTimeout(r, 0)); });
}

test("first-ever Commencer runs a diagnostic: intro → straight-through → estimated level + diagAt", async () => {
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  await click("Commencer");                       // no diagAt → diagnostic due
  expect(container.textContent ?? "").toContain("Mode test"); // intro notifies

  await click("Commencer le test");               // begin; first question shows
  expect(container.textContent ?? "").toContain("Test · question 1 /");

  // answer straight-through until the report appears (no "Suivant" between questions)
  for (let i = 0; i < 60 && !(container.textContent ?? "").includes("Ton niveau estimé"); i++) {
    const opt = [...container.querySelectorAll("button")].find((b) => /^[abcd]$/.test(b.textContent ?? ""));
    if (!opt) break;
    await act(async () => { opt.click(); await new Promise((r) => setTimeout(r, 0)); });
  }
  const text = container.textContent ?? "";
  expect(text).toContain("Ton niveau estimé");
  expect(text).toContain("Correction");
  const blob = JSON.parse(localStorage.getItem("jlptN3adapt_v2") ?? "{}");
  expect(typeof blob.diagAt).toBe("number"); // completion stamped
});

test("a recent diagnostic (<7d) skips the test — Commencer builds a normal session", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 0, skill: {}, diagAt: Date.now() }));
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  await click("Commencer");
  const text = container.textContent ?? "";
  expect(text).not.toContain("Mode test");   // no diagnostic
  expect(text).toContain("Q-");              // a normal question is showing
});
```

- [ ] **Step 10: Typecheck + full suite (GREEN)**

Run: `bun run typecheck`
Expected: PASS.

Run: `bun test`
Expected: PASS — full suite green (contract tests, component smokes, the two integration tests, and all pre-existing tests including `EntrainementApp.start.test.tsx`, which still seeds no `diagAt`… **wait**: that file's tests seed no `diagAt` → after the flip they'd hit the diagnostic path and break. **Fix them in this step:** in `src/EntrainementApp.start.test.tsx`, add `diagAt: Date.now()` to the seeded `jlptN3adapt_v2` blob in the tests that click "Commencer" and expect a normal session (the "starts a session" test and the "stored errors" test), so they exercise the composed path. The index-null test already throws on `bank-index`; add `diagAt` there too so it stays on the composed path.)

- [ ] **Step 11: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/mode-diagnostic
git add -A -- src
git commit -m "feat : mode diagnostic de bout en bout (intro, tout droit, niveau estimé + corrigé) — BUILT_CAPS.diagnostic"
```

---

## Self-Review

**1. Spec coverage:**
- `selectDiagnostic` large/étalé → **Task 1**.
- Intro « mode test » + résultat niveau/correction → **Task 2** (composants) + **Task 3** (routage).
- Persistance `diagAt` + `daysSinceDiagnostic` + flip flag → **Task 3** (steps 3, 6, 7).
- Tout droit (pas de `corrige`) → **Task 3** (choose branche diag).
- [Plus tard] → session normale sans reset → **Task 3** (`skipDiagnostic`, step 8).
- Mesure (Elo normal, pas de reset `t`) → **Task 3** (choose écrit `updateRating` comme le normal ; aucun reset).
- Contrat `BUILT_CAPS` + tests d'intégration → **Task 3** (steps 1-2, 9-10).

**2. Placeholder scan:** aucun TBD ; chaque étape porte le code réel + commande + attendu.

**3. Type consistency:** `Phase` étendue (Task 3) et consommée dans la vue (Task 3, même tâche). `DiagAnswer` défini dans useQuiz, importé par `EntrainementApp` et utilisé par `DiagnosticResults` via la forme `{ question, chosen }` (structurellement identique). `DashboardModel` importé de `scoring.ts` dans `DiagnosticResults` (Task 2) et `EntrainementApp` (Task 3). `start(minArg?, opts?)` — la nouvelle signature est appelée `quiz.start` (0 arg via onStart), `quiz.start(undefined, {skipDiagnostic:true})` (onLater), et `start(params.min)` (effet URL, inchangé, `opts` optionnel). `selectDiagnostic` défini Task 1, consommé Task 3.

**Note de couverture :** le test d'intégration (Task 3 step 9) exerce le chemin diagnostic de bout en bout (intro → tout droit → niveau + `diagAt`) et le repli « diagnostic récent → composé », ce qui couvre le câblage `start()`/`choose()`/routage que les unités ne voient pas isolément.
