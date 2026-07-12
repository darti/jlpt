# Carte de session adaptative (sous-projet #1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 4 actions du hub `/entrainement` par une seule carte auto-pilotée par l'état, adossée à un moteur de décision pur capability-aware.

**Architecture:** Une fonction pure `pickSessionPlan(state, total, caps)` décide du plan de session (`resume` | `diagnostic` | `composed{errors,learn,adaptive}`). Un composant `SessionCard` prop-driven rend deux états (Reprendre / Session minimale). `useQuiz.start()` consulte le plan avant de piocher. En #1 toutes les capacités sont `false` ⇒ le plan est toujours `composed` adaptatif pur (= l'existant sans sélection manuelle de catégories).

**Tech Stack:** React + TypeScript, bundlé par Bun. Tests : `bun test` (`renderToStaticMarkup` pour le SSR smoke, happy-dom pour le runtime).

## Global Constraints

- **Runtime & outils : `bun` exclusivement — jamais `node`.** Tests : `bun test`. Typecheck : `bun run typecheck`.
- **Tout le travail se fait dans le worktree `.worktrees/carte-session-adaptative`** (déjà créé, branche `carte-session-adaptative`).
- **UI en français**, contenu en japonais.
- `renderToStaticMarkup` **échappe les apostrophes** (`'` → `&#x27;`) — asserter uniquement sur des sous-chaînes **sans apostrophe**.
- **Jamais de ligne `Co-Authored-By`** dans les messages de commit.
- **Pas de bump `CACHE` dans `sw.js`** : ce sous-projet ne touche que des sources `src/` (le HTML est network-first). Aucun asset livré (`data/*.json`, icônes, `sw.js`) n'est modifié.
- Cap erreurs = **30 %** ; intervalle diagnostic = **7 jours** ; catégories **100 % auto**.

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `src/features/entrainement/sessionPlan.ts` | Moteur de décision pur + constantes (`BUILT_CAPS`, `ERRORS_CAP`, `DIAGNOSTIC_INTERVAL_DAYS`) | **Créer** |
| `src/features/entrainement/sessionPlan.test.ts` | Tests unitaires exhaustifs du moteur | **Créer** |
| `src/features/entrainement/SessionCard.tsx` | La carte unique (états Reprendre / Session) | **Créer** |
| `src/features/entrainement/SessionCard.test.tsx` | SSR smoke des deux états | **Créer** |
| `src/features/entrainement/EntrainementHome.tsx` | Monte `SessionCard`, retire `QuizHome` + `STUBS` | **Modifier** |
| `src/EntrainementApp.tsx` | Retire props `selected`/`onToggleCat` ; câble `SessionCard` | **Modifier** |
| `src/features/quiz/useQuiz.ts` | `start()` plan-aware ; retire `selected`/`toggleCat` | **Modifier** |
| `src/EntrainementApp.test.tsx` | MAJ assertions (session minimale) | **Modifier** |
| `src/EntrainementApp.runtime.test.tsx` | MAJ assertions (état Reprendre) | **Modifier** |
| `src/features/quiz/QuizHome.tsx` | Remplacé par `SessionCard` | **Supprimer** |
| `src/features/quiz/ResumeBanner.tsx` | Absorbé dans `SessionCard` | **Supprimer** |

Vérifié : `QuizHome` et `ResumeBanner` ne sont importés que par `EntrainementHome.tsx` (grep `.ts`+`.tsx`). Aucun test dédié à ces deux composants.

---

## Task 1: Moteur de décision `pickSessionPlan`

**Files:**
- Create: `src/features/entrainement/sessionPlan.ts`
- Test: `src/features/entrainement/sessionPlan.test.ts`

**Interfaces:**
- Consumes: rien (fonction pure, aucune dépendance projet).
- Produces:
  - `interface SessionState { resume: boolean; daysSinceDiagnostic: number | null; wrongCount: number; newCoursePoints: number }`
  - `interface Caps { diagnostic: boolean; errors: boolean; learn: boolean }`
  - `type SessionPlan = { kind: "resume" } | { kind: "diagnostic" } | { kind: "composed"; alloc: { errors: number; learn: number; adaptive: number } }`
  - `function pickSessionPlan(state: SessionState, total: number, caps: Caps): SessionPlan`
  - `const BUILT_CAPS: Caps` — les capacités réellement construites à ce jour (en #1 : tout `false`). C'est le **seul** endroit que les sous-projets #2→#4 modifient.
  - `const ERRORS_CAP = 0.30`, `const DIAGNOSTIC_INTERVAL_DAYS = 7`.

- [ ] **Step 1: Write the failing test**

Create `src/features/entrainement/sessionPlan.test.ts`:

```ts
import { test, expect } from "bun:test";
import { pickSessionPlan, BUILT_CAPS, type Caps } from "./sessionPlan.ts";

const OFF: Caps = { diagnostic: false, errors: false, learn: false };
const base = { resume: false, daysSinceDiagnostic: null, wrongCount: 0, newCoursePoints: 0 };

test("resume state always wins, even when diagnostic is due", () => {
  const plan = pickSessionPlan(
    { ...base, resume: true, daysSinceDiagnostic: 30 },
    10,
    { diagnostic: true, errors: true, learn: true },
  );
  expect(plan).toEqual({ kind: "resume" });
});

test("diagnostic emitted when capable and never assessed", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: null }, 10, { ...OFF, diagnostic: true });
  expect(plan).toEqual({ kind: "diagnostic" });
});

test("diagnostic emitted when capable and >= 7 days since last", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: 7 }, 10, { ...OFF, diagnostic: true });
  expect(plan).toEqual({ kind: "diagnostic" });
});

test("diagnostic NOT emitted when < 7 days since last", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: 6 }, 10, { ...OFF, diagnostic: true });
  expect(plan.kind).toBe("composed");
});

test("diagnostic NOT emitted when capability off", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: null }, 10, OFF);
  expect(plan.kind).toBe("composed");
});

test("errors capped at 30% of total when capable", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 50 }, 10, { ...OFF, errors: true });
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, learn: 0, adaptive: 7 } });
});

test("errors limited by wrongCount when below the cap", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 2 }, 10, { ...OFF, errors: true });
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 2, learn: 0, adaptive: 8 } });
});

test("learn fills after errors, bounded by newCoursePoints", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 2 },
    10,
    { diagnostic: false, errors: true, learn: true },
  );
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, learn: 2, adaptive: 5 } });
});

test("#1 contract: BUILT_CAPS all off yields composed adaptive-only", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 5, daysSinceDiagnostic: null },
    10,
    BUILT_CAPS,
  );
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 0, learn: 0, adaptive: 10 } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: FAIL — `Cannot find module './sessionPlan.ts'` (module absent).

- [ ] **Step 3: Write minimal implementation**

Create `src/features/entrainement/sessionPlan.ts`:

```ts
/** Moteur de décision de session : mappe l'état de l'apprenant + le budget temps vers un
 *  plan de session. Fonction pure, capability-aware — n'émet un mode que si sa capacité est
 *  construite. Cœur du « next-best-action » du hub Entraînement (sous-projet #1). */

/** Jours depuis le dernier diagnostic au-delà desquels un recalibrage est proposé. */
export const DIAGNOSTIC_INTERVAL_DAYS = 7;

/** Part maximale du budget de questions consacrée au rejeu des erreurs. */
export const ERRORS_CAP = 0.3;

/** État de l'apprenant lu depuis la progression + la session reprenable. */
export interface SessionState {
  /** Une session en cours (< 2 j) existe. */
  resume: boolean;
  /** Jours depuis le dernier diagnostic ; `null` = jamais évalué. */
  daysSinceDiagnostic: number | null;
  /** Nombre d'items actuellement dans `wrong[]`. */
  wrongCount: number;
  /** Points de cours non encore travaillés (0 tant que le mode Apprendre n'est pas construit). */
  newCoursePoints: number;
}

/** Capacités (modes) réellement construites — gèle les branches non implémentées. */
export interface Caps {
  diagnostic: boolean;
  errors: boolean;
  learn: boolean;
}

/** Plan de session : deux prises de contrôle totales, ou une composition du budget. */
export type SessionPlan =
  | { kind: "resume" }
  | { kind: "diagnostic" }
  | { kind: "composed"; alloc: { errors: number; learn: number; adaptive: number } };

/** Capacités construites à ce jour. Sous-projets #2→#4 : passer un flag à `true` ici. */
export const BUILT_CAPS: Caps = { diagnostic: false, errors: false, learn: false };

/** Décide le plan de session (premier match gagne). `total` = budget de questions (dérivé du temps). */
export function pickSessionPlan(state: SessionState, total: number, caps: Caps): SessionPlan {
  if (state.resume) return { kind: "resume" };

  const diagnosticDue =
    state.daysSinceDiagnostic == null || state.daysSinceDiagnostic >= DIAGNOSTIC_INTERVAL_DAYS;
  if (caps.diagnostic && diagnosticDue) return { kind: "diagnostic" };

  const errors = caps.errors ? Math.min(state.wrongCount, Math.floor(ERRORS_CAP * total)) : 0;
  const learn = caps.learn ? Math.min(state.newCoursePoints, Math.max(0, total - errors)) : 0;
  const adaptive = Math.max(0, total - errors - learn);
  return { kind: "composed", alloc: { errors, learn, adaptive } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/carte-session-adaptative
git add src/features/entrainement/sessionPlan.ts src/features/entrainement/sessionPlan.test.ts
git commit -m "feat : moteur de décision de session (pickSessionPlan, capability-aware)"
```

---

## Task 2: Composant `SessionCard`

**Files:**
- Create: `src/features/entrainement/SessionCard.tsx`
- Test: `src/features/entrainement/SessionCard.test.tsx`

**Interfaces:**
- Consumes: `ResumeState` depuis `../quiz/useQuiz.ts` (existant : `{ kind, ids, qi, right, t }`).
- Produces: `function SessionCard(props: { resume: ResumeState | null; minutes: number; onSetMinutes: (m: number) => void; onStart: () => void; onResumeNow: () => void; onDismissResume: () => void }): JSX.Element`

Design note : l'état « Reprendre » absorbe l'ancienne `ResumeBanner`, y compris son affordance
« Ignorer » — ici un bouton secondaire **« Nouvelle session »** qui appelle `onDismissResume`
(bascule la carte vers l'état Session sans perdre la possibilité de démarrer neuf).

- [ ] **Step 1: Write the failing test**

Create `src/features/entrainement/SessionCard.test.tsx`:

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionCard } from "./SessionCard.tsx";
import type { ResumeState } from "../quiz/useQuiz.ts";

const noop = () => {};

test("SessionCard without resume shows the time picker and start button", () => {
  const html = renderToStaticMarkup(
    <SessionCard resume={null} minutes={10} onSetMinutes={noop} onStart={noop} onResumeNow={noop} onDismissResume={noop} />,
  );
  expect(html).toContain("Ta session du moment");
  expect(html).toContain("Commencer");
  expect(html).not.toContain("Reprendre");
});

test("SessionCard with resume shows the resume headline and continue button", () => {
  const resume: ResumeState = { kind: "quiz", ids: [1, 2, 3], qi: 1, right: 1, t: 0 };
  const html = renderToStaticMarkup(
    <SessionCard resume={resume} minutes={10} onSetMinutes={noop} onStart={noop} onResumeNow={noop} onDismissResume={noop} />,
  );
  expect(html).toContain("Reprendre ta session");
  expect(html).toContain("Continuer");
  expect(html).toContain("Nouvelle session");
  expect(html).toContain("2/3");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/entrainement/SessionCard.test.tsx`
Expected: FAIL — `Cannot find module './SessionCard.tsx'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/entrainement/SessionCard.tsx`:

```tsx
import type { ResumeState } from "../quiz/useQuiz.ts";

const DURATIONS = [5, 10, 15];

/** Carte de session unique du hub Entraînement : rend l'état « Reprendre » (session en
 *  cours) ou l'état « Session » minimal (sélecteur de temps + Commencer). Le mélange composé
 *  reste caché (parti pris « magique »). Pure / prop-driven. */
export function SessionCard({
  resume, minutes, onSetMinutes, onStart, onResumeNow, onDismissResume,
}: {
  resume: ResumeState | null;
  minutes: number;
  onSetMinutes: (m: number) => void;
  onStart: () => void;
  onResumeNow: () => void;
  onDismissResume: () => void;
}) {
  if (resume) {
    const pos = `${Math.min(resume.qi + 1, resume.ids.length)}/${resume.ids.length}`;
    return (
      <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
        <h2 className="text-fg text-lg font-bold mt-0 mb-1">Reprendre ta session</h2>
        <p className="text-fg-dim text-sm mt-0 mb-4">{pos} · {resume.right} bonne(s) réponse(s)</p>
        <button
          type="button"
          onClick={() => onResumeNow()}
          className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
        >
          Continuer
        </button>
        <button
          type="button"
          onClick={onDismissResume}
          className="w-full bg-transparent border border-line text-fg-dim rounded-xl px-4 py-2.5 text-sm cursor-pointer mt-2"
        >
          Nouvelle session
        </button>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
      <h2 className="text-fg text-lg font-bold mt-0 mb-3">Ta session du moment</h2>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-fg-dim text-sm">J'ai</span>
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSetMinutes(m)}
            aria-pressed={minutes === m}
            className={minutes === m
              ? "bg-accent text-fg-on-accent border-none rounded-full min-w-9 h-9 text-sm font-bold cursor-pointer"
              : "bg-surface-2 border border-line text-fg-dim rounded-full min-w-9 h-9 text-sm cursor-pointer"}
          >
            {m}
          </button>
        ))}
        <span className="text-fg-dim text-sm">min</span>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
      >
        Commencer
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/entrainement/SessionCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/carte-session-adaptative
git add src/features/entrainement/SessionCard.tsx src/features/entrainement/SessionCard.test.tsx
git commit -m "feat : carte de session unique (SessionCard, états Reprendre / Session)"
```

---

## Task 3: Intégration — hub plan-aware, suppression des stubs & de la sélection manuelle

Landing atomique : câble `SessionCard` + le plan dans `useQuiz`, retire la sélection de catégories, supprime `QuizHome`/`ResumeBanner`, met à jour les deux tests d'`EntrainementApp`. L'arbre reste vert à la fin.

**Files:**
- Modify: `src/features/quiz/useQuiz.ts`
- Modify: `src/features/entrainement/EntrainementHome.tsx`
- Modify: `src/EntrainementApp.tsx`
- Modify: `src/EntrainementApp.test.tsx`
- Modify: `src/EntrainementApp.runtime.test.tsx`
- Delete: `src/features/quiz/QuizHome.tsx`, `src/features/quiz/ResumeBanner.tsx`

**Interfaces:**
- Consumes: `pickSessionPlan`, `BUILT_CAPS` (Task 1) ; `SessionCard` (Task 2).
- Produces: `useQuiz()` ne retourne plus `selected` ni `toggleCat`. `EntrainementHome` props = `{ minutes, resume, onSetMinutes, onStart, onResumeNow, onDismissResume }`. `EntrainementAppView` perd `selected` et `onToggleCat`.

- [ ] **Step 1: Update the two failing tests first (RED)**

Replace the `home`-phase tests in `src/EntrainementApp.test.tsx`. Change the `handlers` object (remove `onToggleCat`), the `view()` props (remove `selected`), and rewrite the first `home` test. Final file:

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import type { Phase } from "./features/quiz/useQuiz.ts";
import type { Question } from "./types/quiz.ts";

const q: Question = {
  id: 0, cat: "grammaire", d: 1, q: "家に帰っ___、電話します。",
  o: ["たら", "なら", "ば", "と"], a: 0, e: "<b>〜たら</b>", g: "帰る→帰ったら", od: ["ok", "b", "c", "d"],
};

const handlers = {
  onStart: () => {}, onChoose: () => {}, onNext: () => {}, onRestart: () => {},
  onSetMinutes: () => {}, onResumeNow: () => {}, onDismissResume: () => {},
};

function view(phase: Phase, question: Question | null) {
  return renderToStaticMarkup(
    <EntrainementAppView
      phase={phase} question={question} count={1} right={0}
      minutes={10} resume={null}
      answered={false} chosen={null}
      {...handlers}
    />,
  );
}

test("home phase renders the single session card (no categories, no stubs)", () => {
  const html = view("home", null);
  expect(html).toContain("Ta session du moment"); // SessionCard title
  expect(html).toContain("Commencer");            // start button
  expect(html).not.toContain("Lancer une session"); // old QuizHome title gone
  expect(html).not.toContain("bientôt");            // deferred stubs gone
  expect(html).not.toContain("réussite estimée");   // Dashboard stats on Accueil
  expect(html).not.toContain("Progression");        // chart on Accueil
});

test("home phase no longer renders settings or sync (moved to Paramétrage)", () => {
  const html = view("home", null);
  expect(html).not.toContain("Réglages");
  expect(html).not.toContain("Synchronisation multi-appareils");
});

test("question phase renders the question card, not the hub", () => {
  const html = view("question", q);
  expect(html).toContain("電話します");
  expect(html).not.toContain("Ta session du moment");
});
```

In `src/EntrainementApp.runtime.test.tsx` (its `beforeEach` seeds a resume, so the card renders in **Reprendre** state), replace the first and last tests. Change test at line 40 and delete the now-redundant resume test at line 54:

```tsx
test("mounts live and renders the session card in resume state", () => {
  renderApp();
  expect(container.textContent ?? "").toContain("Reprendre ta session");
  expect(container.textContent ?? "").toContain("Continuer");
});
```

Delete the old `test("resume banner appears when a valid quiz session is stored", ...)` block entirely (its assertion `"Reprendre ma session"` referred to the deleted `ResumeBanner` wording; the new headline is now covered above). Leave the middle test (`hub no longer shows stats, chart, settings or sync`) unchanged.

- [ ] **Step 2: Run the two test files to verify they fail (RED)**

Run: `bun test src/EntrainementApp.test.tsx src/EntrainementApp.runtime.test.tsx`
Expected: FAIL — assertions on "Ta session du moment" / "Reprendre ta session" fail (old hub still renders `QuizHome` + `ResumeBanner`); type errors possible on removed props.

- [ ] **Step 3: Rewrite `EntrainementHome.tsx` to mount `SessionCard`**

Replace the entire file `src/features/entrainement/EntrainementHome.tsx`:

```tsx
import { SessionCard } from "./SessionCard.tsx";
import type { ResumeState } from "../quiz/useQuiz.ts";

/** Entraînement hub (phase "home") : une seule carte de session auto-pilotée par l'état
 *  (`SessionCard`). Stats + graphe de progression vivent sur l'Accueil ; réglages + synchro
 *  sur Paramétrage. Pure / prop-driven. */
export function EntrainementHome(props: {
  minutes: number;
  resume: ResumeState | null;
  onSetMinutes: (m: number) => void;
  onStart: () => void;
  onResumeNow: () => void;
  onDismissResume: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SessionCard
        resume={props.resume}
        minutes={props.minutes}
        onSetMinutes={props.onSetMinutes}
        onStart={props.onStart}
        onResumeNow={props.onResumeNow}
        onDismissResume={props.onDismissResume}
      />
    </div>
  );
}
```

- [ ] **Step 4: Update `EntrainementApp.tsx` — drop `selected` / `onToggleCat`**

In `src/EntrainementApp.tsx`:

Remove the unused `Skill` import if it becomes unused (it is still referenced by `Set<Skill>` only in the lines we remove — delete `import type { Skill } from "./types/progress.ts";`).

Change the `EntrainementAppView` props type (remove `selected` and `onToggleCat` lines):

```tsx
export function EntrainementAppView(props: {
  phase: Phase; question: Question | null; count: number; right: number;
  minutes: number; resume: ResumeState | null;
  answered: boolean; chosen: number | null;
  onStart: () => void; onChoose: (i: number) => void; onNext: () => void; onRestart: () => void;
  onSetMinutes: (m: number) => void;
  onResumeNow: () => void; onDismissResume: () => void;
}) {
```

Change the `home`-phase render (remove `selected` / `onToggleCat` props passed to `EntrainementHome`):

```tsx
  if (props.phase === "home") {
    return (
      <EntrainementHome
        minutes={props.minutes} resume={props.resume}
        onSetMinutes={props.onSetMinutes} onStart={props.onStart}
        onResumeNow={props.onResumeNow} onDismissResume={props.onDismissResume}
      />
    );
  }
```

Change the container's `EntrainementAppView` invocation (remove `selected={quiz.selected}` and `onToggleCat={quiz.toggleCat}`):

```tsx
    <EntrainementAppView
      phase={quiz.phase} question={quiz.question} count={quiz.count} right={quiz.right}
      minutes={quiz.minutes}
      resume={resumeDismissed ? null : quiz.resume}
      answered={quiz.answered} chosen={quiz.chosen}
      onStart={quiz.start} onChoose={quiz.choose} onNext={quiz.next} onRestart={quiz.restart}
      onSetMinutes={quiz.setMinutes}
      onResumeNow={quiz.resumeNow} onDismissResume={() => setResumeDismissed(true)}
    />
```

- [ ] **Step 5: Make `useQuiz.start()` plan-aware and drop category state**

In `src/features/quiz/useQuiz.ts`:

Add the import (top of file, with the other `../` lib imports):

```ts
import { pickSessionPlan, BUILT_CAPS } from "../entrainement/sessionPlan.ts";
```

Remove the `selected` state and `toggleCat` callback. Delete this line:

```ts
  const [selected, setSelected] = useState<Set<Skill>>(() => new Set(SKILLS));
```

and delete the whole `toggleCat` `useCallback` block:

```ts
  const toggleCat = useCallback((c: Skill) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      if (next.size === 0) next.add(c); // never allow an empty selection (mirrors legacy renderCats)
      return next;
    });
  }, []);
```

Replace the body of `start` so it consults the plan and iterates all skills (no `selected` gate). The new `start`:

```ts
  const start = useCallback(async (minArg?: number) => {
    const min = resolveMinutes(minArg, minutes);
    const raw = readRawProgress();
    const progress = asProgress(raw);
    const wrong = asWrong(raw);
    const { total, alloc } = allocate((c) => masteryOf(progress, c), min);

    // Consult the decision engine. `resume: false` — "Commencer" always starts fresh; the
    // resume decision is handled at the card level. In #1 BUILT_CAPS is all-off, so the plan
    // is always { kind: "composed", alloc: { errors: 0, learn: 0, adaptive: total } }. Later
    // sub-projects flip a cap in BUILT_CAPS and branch on plan.kind / plan.alloc here.
    const plan = pickSessionPlan(
      { resume: false, daysSinceDiagnostic: null, wrongCount: wrong.length, newCoursePoints: 0 },
      total,
      BUILT_CAPS,
    );
    if (plan.kind !== "composed") return; // diagnostic/resume unreachable in #1

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

    rightRef.current = 0;
    setQuestions(session);
    setIndex(0);
    setAnswered(false);
    setChosen(null);
    setPhase("question");

    const r: ResumeState = { kind: "quiz", ids: session.map((q) => q.id), qi: 0, right: 0, t: Date.now() };
    persistResumeState(r);
    setResume(r);
  }, [minutes]);
```

Remove `selected` and `toggleCat` from the returned object (the `return { ... }` at the end of `useQuiz`): delete the `selected,` and `toggleCat,` entries.

`SKILLS` stays imported (used in the `for` loop). `Skill` type stays used elsewhere in the file (`skillStateOf`, etc.).

- [ ] **Step 6: Delete the replaced components**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/carte-session-adaptative
git rm src/features/quiz/QuizHome.tsx src/features/quiz/ResumeBanner.tsx
```

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: PASS, no errors. (If `Skill` import in `EntrainementApp.tsx` is flagged unused, confirm it was deleted in Step 4.)

- [ ] **Step 8: Run the full test suite (GREEN)**

Run: `bun test`
Expected: PASS — all suites green, including the rewritten `EntrainementApp.test.tsx` (3 tests) and `EntrainementApp.runtime.test.tsx` (2 tests), plus Task 1 & 2 suites.

- [ ] **Step 9: Commit**

```bash
cd /Users/matthieu/Projects/japonais/jlpt/.worktrees/carte-session-adaptative
git add -A
git commit -m "feat : carte de session auto-pilotée sur le hub Entraînement (retire chips + stubs)"
```

---

## Self-Review

**1. Spec coverage:**
- Cerveau `pickSessionPlan` capability-aware, cap 30 %, diagnostic ≥7 j / jamais → **Task 1**.
- Carte unique deux états (Reprendre / Session minimale, mix caché) → **Task 2**.
- Câblage plan-aware + catégories auto (retrait `toggleCat`/chips) → **Task 3** (steps 4-5).
- Suppression `QuizHome` + `ResumeBanner` → **Task 3** (step 6).
- Contrat #1 (caps off ⇒ composed adaptive-only) → **Task 1** test + **Task 3** step 5 comment.
- Tests (moteur exhaustif ; SSR smoke deux états) → **Task 1 / Task 2** ; MAJ tests d'intégration → **Task 3** steps 1-2, 8.
- Hors périmètre (modes réels Erreurs/Diagnostic/Apprendre) : non planifiés ici — corrects, ce sont les sous-projets #2→#4.

**2. Placeholder scan:** aucun TBD/TODO ; chaque étape porte le code réel + la commande + l'attendu.

**3. Type consistency:** `SessionState`/`Caps`/`SessionPlan`/`pickSessionPlan`/`BUILT_CAPS` définis en Task 1, consommés à l'identique en Task 3. `SessionCard` props définis en Task 2, câblés à l'identique via `EntrainementHome` en Task 3. `EntrainementAppView` : les props retirées (`selected`, `onToggleCat`) le sont de façon cohérente dans le type, le rendu `home`, l'appel container **et** les deux tests.
