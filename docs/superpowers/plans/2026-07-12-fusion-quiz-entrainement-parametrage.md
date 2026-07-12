# Fusion Quiz+Entraînement & onglet Paramétrage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner les onglets Quiz et Entraînement en un seul onglet piloté par `useQuiz`, et déplacer police/thème/données/synchro dans un nouvel onglet Paramétrage.

**Architecture:** L'onglet Entraînement (`/entrainement`) devient l'unique route quiz : `useQuiz().phase === "home"` affiche le hub (Dashboard + graphe + carte de démarrage `QuizHome` + stubs), les autres phases affichent le flux quiz (question/corrigé/résultats). Un nouvel onglet Paramétrage (`/parametrage`) regroupe `Settings` (police/thème/données) + `SyncSection`. `/quiz` redirige vers `/entrainement`.

**Tech Stack:** React 18 + TypeScript, react-router-dom (HashRouter), bundlé par Bun, tests `bun test` (`renderToStaticMarkup` SSR + happy-dom runtime).

## Global Constraints

- **Runtime & outils : `bun` exclusivement — jamais `node`.**
- Tests : logique pure → unitaires ; composants → `renderToStaticMarkup` (SSR) ; montage réel → happy-dom (`createRoot` + `act`). Router : envelopper dans `<MemoryRouter>`.
- ⚠ `renderToStaticMarkup` échappe les apostrophes (`'` → `&#x27;`) — asserter sur des sous-chaînes **sans apostrophe**.
- **Aucun bump `CACHE` du SW** : ce changement est 100 % JS/TSX ; ne toucher à aucun asset livré (`sw.js`, `quiz.html`, `app-n3.html`, icônes, `data/*.json`).
- Commits : style du dépôt (français, « Scope : description »), **pas** de ligne `Co-Authored-By`.
- Branche : `feat/fusion-entrainement-parametrage` (déjà créée).

---

### Task 1: Onglet Paramétrage (additif)

Crée l'onglet Paramétrage (Settings + Sync), sans encore rien retirer d'Entraînement/Accueil. `Settings.tsx` reste à son emplacement actuel (déplacé en Task 3).

**Files:**
- Create: `src/features/parametrage/Parametrage.tsx`
- Create: `src/features/parametrage/Parametrage.test.tsx`
- Create: `src/ui/TopNav.test.tsx`
- Modify: `src/ui/TopNav.tsx` (ajouter l'entrée Paramétrage)
- Modify: `src/entries/index.tsx` (ajouter la route)

**Interfaces:**
- Consumes: `Settings` (`src/features/entrainement/Settings.tsx`, props `{ theme, onToggleTheme }`), `SyncSection` (`src/features/sync/SyncSection.tsx`, props `{ onProgressChanged }`), `useThemeContext` (`{ theme, toggle }`).
- Produces: `export function Parametrage()` (route content, no props).

- [ ] **Step 1: Write the failing test — Parametrage.test.tsx**

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeContext } from "../../hooks/useThemeContext.tsx";
import { Parametrage } from "./Parametrage.tsx";

test("Parametrage renders font, theme, data and sync sections", () => {
  const html = renderToStaticMarkup(
    <ThemeContext.Provider value={{ theme: "dark", toggle: () => {} }}>
      <Parametrage />
    </ThemeContext.Provider>,
  );
  expect(html).toContain("Police");                          // Settings font section
  expect(html).toContain("Exporter");                        // Settings data section
  expect(html).toContain("Réinitialiser");                   // Settings data section
  expect(html).toContain("Synchronisation multi-appareils"); // SyncSection
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `bun test src/features/parametrage/Parametrage.test.tsx`
Expected: FAIL (`Cannot find module './Parametrage.tsx'`).

- [ ] **Step 3: Create `src/features/parametrage/Parametrage.tsx`**

```tsx
import { Settings } from "../entrainement/Settings.tsx";
import { SyncSection } from "../sync/SyncSection.tsx";
import { useThemeContext } from "../../hooks/useThemeContext.tsx";

/** Paramétrage route: font scale + theme + data (Settings) and multi-device Gist sync.
 *  Theme comes from the shared ThemeContext; sync's `onProgressChanged` is a no-op here —
 *  this route shows no progress UI, and Accueil/Entraînement re-read progress on mount. */
export function Parametrage() {
  const { theme, toggle } = useThemeContext();
  return (
    <div className="flex flex-col gap-6">
      <Settings theme={theme} onToggleTheme={toggle} />
      <SyncSection onProgressChanged={() => {}} />
    </div>
  );
}
```

- [ ] **Step 4: Run it — verify it passes**

Run: `bun test src/features/parametrage/Parametrage.test.tsx`
Expected: PASS (4 assertions).

- [ ] **Step 5: Add the route in `src/entries/index.tsx`**

Add the import next to the other feature imports:

```tsx
import { Parametrage } from "../features/parametrage/Parametrage.tsx";
```

Add the route inside `<Route element={<AppShell />}>`, after the `cours` route:

```tsx
          <Route path="parametrage" element={<Parametrage />} />
```

- [ ] **Step 6: Add the nav entry in `src/ui/TopNav.tsx`**

Extend the `ROUTES` array (append after Planning):

```tsx
const ROUTES = [
  { to: "/", label: "Accueil", end: true },
  { to: "/entrainement", label: "Entraînement" },
  { to: "/quiz", label: "Quiz" },
  { to: "/cours", label: "Cours" },
  { to: "/planning", label: "Planning" },
  { to: "/parametrage", label: "Paramétrage" },
];
```

- [ ] **Step 7: Write the TopNav test — `src/ui/TopNav.test.tsx`**

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ThemeContext } from "../hooks/useThemeContext.tsx";
import { TopNav } from "./TopNav.tsx";

function nav() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ThemeContext.Provider value={{ theme: "dark", toggle: () => {} }}>
        <TopNav />
      </ThemeContext.Provider>
    </MemoryRouter>,
  );
}

test("TopNav lists the Accueil and Paramétrage tabs", () => {
  const html = nav();
  expect(html).toContain("Accueil");
  expect(html).toContain("Paramétrage");
});
```

- [ ] **Step 8: Run the full suite + typecheck**

Run: `bun test && bun run typecheck`
Expected: PASS (new Parametrage + TopNav tests green; nothing else broken — Entraînement/Accueil still render their own Settings/Sync).

- [ ] **Step 9: Commit**

```bash
git add src/features/parametrage/Parametrage.tsx src/features/parametrage/Parametrage.test.tsx src/ui/TopNav.tsx src/ui/TopNav.test.tsx src/entries/index.tsx
git commit -m "Paramétrage : nouvel onglet (police/thème/données + synchro)"
```

---

### Task 2: Accueil — retirer la synchro

`/` (Accueil) n'affiche plus la synchro (déplacée dans Paramétrage) : `InstallPrompt` + `Dashboard` seulement.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces: `export function DashboardView({ model, days }: { model: DashboardModel | null; days: number })` — la prop `onProgressChanged` disparaît.

- [ ] **Step 1: Update the failing test — `src/App.test.tsx`**

Replace the single test with:

```tsx
test("DashboardView renders the dashboard stats + install prompt (no sync)", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<DashboardView model={model} days={model.days} />);
  expect(html).toContain("17%");                              // stat
  expect(html).toContain("Installer");                        // InstallPrompt
  expect(html).not.toContain("Synchronisation multi-appareils"); // sync moved to Paramétrage
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `bun test src/App.test.tsx`
Expected: FAIL (current `DashboardView` still renders `SyncSection` → "Synchronisation multi-appareils" present; also a type error on the removed `onProgressChanged`).

- [ ] **Step 3: Rewrite `src/App.tsx`**

```tsx
import { InstallPrompt } from "./features/pwa/InstallPrompt.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";

/** Dashboard route content (shell lives in AppShell). Sync moved to the Paramétrage route. */
export function DashboardView({ model, days }: { model: DashboardModel | null; days: number }) {
  return (
    <>
      <InstallPrompt />
      <Dashboard model={model} days={days} />
    </>
  );
}

/** Route container: owns progress state only. */
export default function App() {
  const [progress] = useProgress();
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return <DashboardView model={model} days={daysUntilExam(now)} />;
}
```

- [ ] **Step 4: Run it — verify it passes**

Run: `bun test src/App.test.tsx && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "Accueil : retirer la synchro (déplacée dans Paramétrage)"
```

---

### Task 3: Fusionner le quiz dans l'onglet Entraînement

`EntrainementApp` pilote `useQuiz` + la progression : le hub en phase `home`, le flux quiz sinon. Supprime le code mort du hub d'origine et déplace `Settings` vers `features/parametrage/`.

**Files:**
- Rewrite: `src/features/entrainement/EntrainementHome.tsx` (vue hub)
- Rewrite: `src/EntrainementApp.tsx` (conteneur `useQuiz` + phase-switch + vue pure)
- Rewrite: `src/EntrainementApp.test.tsx` (SSR)
- Rewrite: `src/EntrainementApp.runtime.test.tsx` (happy-dom)
- Modify: `src/features/quiz/QuizHome.tsx` (titre → « Lancer une session »)
- Modify: `src/features/parametrage/Parametrage.tsx` (import Settings → `./Settings.tsx`)
- Move: `src/features/entrainement/Settings.tsx` → `src/features/parametrage/Settings.tsx`
- Move: `src/features/entrainement/Settings.handlers.test.tsx` → `src/features/parametrage/Settings.handlers.test.tsx`
- Delete: `src/features/entrainement/SessionLauncher.tsx`
- Delete: `src/features/entrainement/ResumeBanner.tsx`
- Delete: `src/features/entrainement/nav.ts`
- Delete: `src/features/entrainement/nav.test.ts`
- Delete: `src/features/entrainement/entrainement.test.tsx`

**Interfaces:**
- Consumes: `useQuiz()` → `{ phase, question, count, right, selected, minutes, resume, answered, chosen, start, choose, next, restart, toggleCat, setMinutes, resumeNow }` (`Phase`, `ResumeState` from `useQuiz.ts`); `useProgress()` → `[Progress | null, () => void]`; `readSessionScores()`; `speak`, `sentenceFromG`; `QuizHome`, `QuestionCard`, `Corrige`, `Results`, quiz `ResumeBanner`, `Dashboard`, `ProgressChart`.
- Produces:
  - `export function EntrainementHome(props)` — hub view, props: `{ model: DashboardModel | null; days: number; scores: number[]; selected: Set<Skill>; minutes: number; resume: ResumeState | null; onToggleCat: (c: Skill) => void; onSetMinutes: (m: number) => void; onStart: () => void; onResumeNow: () => void; onDismissResume: () => void }`.
  - `export function EntrainementAppView(props)` — merged pure view (hub or quiz flow), props are the union in Step 5.
  - `export default function EntrainementApp()` — route container.

- [ ] **Step 1: Change the QuizHome card title — `src/features/quiz/QuizHome.tsx`**

Replace the heading line:

```tsx
      <h2 className="text-fg text-lg font-bold mt-0 mb-3">Lancer une session</h2>
```

(was `S'entraîner`.) Nothing else in QuizHome changes; the button stays `Commencer`.

- [ ] **Step 2: Rewrite the hub view — `src/features/entrainement/EntrainementHome.tsx`**

```tsx
import { Dashboard } from "../dashboard/Dashboard.tsx";
import { ProgressChart } from "./ProgressChart.tsx";
import { QuizHome } from "../quiz/QuizHome.tsx";
import { ResumeBanner } from "../quiz/ResumeBanner.tsx";
import type { DashboardModel } from "../../lib/scoring.ts";
import type { ResumeState } from "../quiz/useQuiz.ts";
import type { Skill } from "../../types/progress.ts";

// Diagnostic/SRS deferred to a later slice — shown as disabled «bientôt disponible» cards
// so the hub's shape matches the eventual full app.
const STUBS = [
  { key: "diagnostic", label: "Diagnostic", desc: "Évalue ton niveau réel" },
  { key: "apprendre", label: "Apprendre", desc: "Cours et nouveaux points" },
  { key: "erreurs", label: "Réviser les erreurs", desc: "Reprends tes fautes" },
];

/** Entraînement hub (phase "home"): resumable-session banner + progress overview (reused
 *  `Dashboard`) + session-score chart + the quiz start card (`QuizHome`) + deferred stubs.
 *  Réglages + synchro now live on the Paramétrage route. Pure/prop-driven. */
export function EntrainementHome(props: {
  model: DashboardModel | null;
  days: number;
  scores: number[];
  selected: Set<Skill>;
  minutes: number;
  resume: ResumeState | null;
  onToggleCat: (c: Skill) => void;
  onSetMinutes: (m: number) => void;
  onStart: () => void;
  onResumeNow: () => void;
  onDismissResume: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ResumeBanner resume={props.resume} onResume={props.onResumeNow} onDismiss={props.onDismissResume} />
      <Dashboard model={props.model} days={props.days} />
      <section className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
        <h2 className="text-fg text-lg font-bold mt-0 mb-3">Progression</h2>
        <ProgressChart scores={props.scores} />
      </section>
      <QuizHome
        selected={props.selected}
        minutes={props.minutes}
        onToggleCat={props.onToggleCat}
        onSetMinutes={props.onSetMinutes}
        onStart={props.onStart}
      />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STUBS.map((s) => (
          <div
            key={s.key}
            aria-disabled="true"
            className="bg-panel border border-line rounded-xl p-4 shadow-card surface-blur opacity-60"
          >
            <h3 className="text-fg text-sm font-bold m-0">{s.label}</h3>
            <p className="text-fg-dim text-xs mt-1 mb-2">{s.desc}</p>
            <span className="text-meta text-fg-muted">bientôt disponible</span>
          </div>
        ))}
      </section>
    </div>
  );
}
```

(The quiz `ResumeBanner` returns `null` when `resume` is `null`, so no extra guard is needed.)

- [ ] **Step 3: Rewrite the container + merged view — `src/EntrainementApp.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { EntrainementHome } from "./features/entrainement/EntrainementHome.tsx";
import { QuestionCard } from "./features/quiz/QuestionCard.tsx";
import { Corrige } from "./features/quiz/Corrige.tsx";
import { Results } from "./features/quiz/Results.tsx";
import { useQuiz, type Phase, type ResumeState } from "./features/quiz/useQuiz.ts";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { readSessionScores } from "./lib/history.ts";
import { speak, sentenceFromG } from "./lib/tts.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { Skill } from "./types/progress.ts";
import type { Question } from "./types/quiz.ts";

/** Pure, prop-driven Entraînement content: the hub (phase "home") or the quiz flow
 *  (question/corrigé/résultats). SSR-renderable — all effects live in the container +
 *  leaves. Merges the former EntrainementHome hub with the QuizApp phase switch. */
export function EntrainementAppView(props: {
  model: DashboardModel | null; days: number; scores: number[];
  phase: Phase; question: Question | null; count: number; right: number;
  selected: Set<Skill>; minutes: number; resume: ResumeState | null;
  answered: boolean; chosen: number | null;
  onStart: () => void; onChoose: (i: number) => void; onNext: () => void; onRestart: () => void;
  onToggleCat: (c: Skill) => void; onSetMinutes: (m: number) => void;
  onResumeNow: () => void; onDismissResume: () => void;
}) {
  const { question } = props;
  const onSpeak = () => {
    if (!question) return;
    const speakText = question.cat === "ecoute"
      ? (typeof question.script === "string" && question.script ? question.script : question.q)
      : sentenceFromG(question.g ?? question.q);
    speak(speakText);
  };

  if (props.phase === "home") {
    return (
      <EntrainementHome
        model={props.model} days={props.days} scores={props.scores}
        selected={props.selected} minutes={props.minutes} resume={props.resume}
        onToggleCat={props.onToggleCat} onSetMinutes={props.onSetMinutes} onStart={props.onStart}
        onResumeNow={props.onResumeNow} onDismissResume={props.onDismissResume}
      />
    );
  }

  return (
    <>
      {props.phase === "question" && question && (
        <QuestionCard question={question} chosen={null} answered={false} onChoose={props.onChoose} onSpeak={onSpeak} />
      )}
      {props.phase === "corrige" && question && (
        <div className="flex flex-col gap-4">
          <QuestionCard question={question} chosen={props.chosen} answered={true} onChoose={() => {}} onSpeak={onSpeak} />
          <Corrige question={question} correct={props.chosen != null && props.chosen === question.a} />
          <button
            type="button"
            onClick={props.onNext}
            className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
          >
            Suivant
          </button>
        </div>
      )}
      {props.phase === "results" && (
        <Results count={props.count} right={props.right} onRestart={props.onRestart} />
      )}
    </>
  );
}

/** Single Entraînement route: drives `useQuiz` (hub + quiz flow) and the progress/scores
 *  overview. Returning to the hub (`phase === "home"`) re-reads progress + session scores
 *  so the Dashboard/chart reflect a just-finished session. */
export default function EntrainementApp() {
  const quiz = useQuiz();
  const [progress, refreshProgress] = useProgress();
  const [scores, setScores] = useState<number[]>([]);
  const [resumeDismissed, setResumeDismissed] = useState(false);

  const refreshHub = useCallback(() => {
    refreshProgress();
    setScores(readSessionScores());
  }, [refreshProgress]);

  useEffect(() => {
    if (quiz.phase === "home") refreshHub();
  }, [quiz.phase, refreshHub]);

  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;

  return (
    <EntrainementAppView
      model={model} days={daysUntilExam(now)} scores={scores}
      phase={quiz.phase} question={quiz.question} count={quiz.count} right={quiz.right}
      selected={quiz.selected} minutes={quiz.minutes}
      resume={resumeDismissed ? null : quiz.resume}
      answered={quiz.answered} chosen={quiz.chosen}
      onStart={quiz.start} onChoose={quiz.choose} onNext={quiz.next} onRestart={quiz.restart}
      onToggleCat={quiz.toggleCat} onSetMinutes={quiz.setMinutes}
      onResumeNow={quiz.resumeNow} onDismissResume={() => setResumeDismissed(true)}
    />
  );
}
```

- [ ] **Step 4: Move Settings into the Paramétrage feature**

```bash
git mv src/features/entrainement/Settings.tsx src/features/parametrage/Settings.tsx
git mv src/features/entrainement/Settings.handlers.test.tsx src/features/parametrage/Settings.handlers.test.tsx
```

`Settings.handlers.test.tsx` imports `./Settings.tsx` (same dir) → unaffected. Update `Parametrage.tsx`'s import:

```tsx
import { Settings } from "./Settings.tsx";
```

- [ ] **Step 5: Delete the now-dead hub files**

```bash
git rm src/features/entrainement/SessionLauncher.tsx \
       src/features/entrainement/ResumeBanner.tsx \
       src/features/entrainement/nav.ts \
       src/features/entrainement/nav.test.ts \
       src/features/entrainement/entrainement.test.tsx
```

- [ ] **Step 6: Rewrite the SSR test — `src/EntrainementApp.test.tsx`**

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import { SKILLS } from "./types/progress.ts";
import type { Progress } from "./types/progress.ts";
import type { Phase } from "./features/quiz/useQuiz.ts";
import type { Question } from "./types/quiz.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R, t: 60 }, vocabulaire: { R, t: 60 }, kanji: { R, t: 60 }, lecture: { R, t: 60 } },
});

const q: Question = {
  id: 0, cat: "grammaire", d: 1, q: "家に帰っ___、電話します。",
  o: ["たら", "なら", "ば", "と"], a: 0, e: "<b>〜たら</b>", g: "帰る→帰ったら", od: ["ok", "b", "c", "d"],
};

const handlers = {
  onStart: () => {}, onChoose: () => {}, onNext: () => {}, onRestart: () => {},
  onToggleCat: () => {}, onSetMinutes: () => {}, onResumeNow: () => {}, onDismissResume: () => {},
};

function view(phase: Phase, question: Question | null, scores: number[]) {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  return renderToStaticMarkup(
    <EntrainementAppView
      model={model} days={model.days} scores={scores}
      phase={phase} question={question} count={1} right={0}
      selected={new Set(SKILLS)} minutes={10} resume={null}
      answered={false} chosen={null}
      {...handlers}
    />,
  );
}

test("home phase renders the hub: dashboard stat + start card + categories + stubs", () => {
  const html = view("home", null, []);
  expect(html).toContain("17%");                 // Dashboard stat (réussite estimée)
  expect(html).toContain("Lancer une session");  // QuizHome start card title
  expect(html).toContain("Grammaire");           // category chip
  expect(html).toContain("Commencer");           // start button
  expect(html).toContain("bientôt");             // deferred stubs
});

test("home phase no longer renders settings or sync (moved to Paramétrage)", () => {
  const html = view("home", null, []);
  expect(html).not.toContain("Réglages");
  expect(html).not.toContain("Synchronisation multi-appareils");
});

test("home phase shows the empty chart state with <2 session scores", () => {
  expect(view("home", null, [])).toContain("Au moins 2 diagnostics");
});

test("question phase renders the question card, not the hub", () => {
  const html = view("question", q, []);
  expect(html).toContain("電話します");
  expect(html).not.toContain("Lancer une session");
});
```

- [ ] **Step 7: Rewrite the runtime test — `src/EntrainementApp.runtime.test.tsx`**

```tsx
import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";

// Runtime smoke: mounts the FULL container (useQuiz + useProgress effects) under happy-dom.
// EntrainementApp is a route component → wrap in MemoryRouter (useSearchParams). No search
// params → no auto-start; phase stays "home" and the hub renders.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({
    total: 60,
    skill: { grammaire: { R: 1600, t: 60 }, vocabulaire: { R: 1600, t: 60 }, kanji: { R: 1600, t: 60 }, lecture: { R: 1600, t: 60 } },
    history: [{ mode: "session", score: 90 }, { mode: "session", score: 120 }],
  }));
  localStorage.setItem("jlptN3quiz_resume", JSON.stringify({ kind: "quiz", ids: [1, 2, 3], qi: 1, right: 1, t: Date.now() }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function renderApp() {
  act(() => {
    root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>);
  });
}

test("mounts live and renders the hub (start card + dashboard stats)", () => {
  renderApp();
  const text = container.textContent ?? "";
  expect(text).toContain("Lancer une session"); // QuizHome start card
  expect(text).toContain("%");                   // Dashboard progress stats
});

test("hub no longer shows settings or sync (moved to Paramétrage)", () => {
  renderApp();
  const text = container.textContent ?? "";
  expect(text).not.toContain("Réglages");
  expect(text).not.toContain("Synchronisation multi-appareils");
});

test("reads the session-score history into the progress chart", () => {
  renderApp();
  const text = container.textContent ?? "";
  expect(text).toContain("estimé /180");
  expect(text).not.toContain("Au moins 2 diagnostics");
});

test("resume banner appears when a valid quiz session is stored", () => {
  renderApp();
  expect(container.textContent ?? "").toContain("Reprendre ma session");
});
```

- [ ] **Step 8: Run the full suite + typecheck**

Run: `bun test && bun run typecheck`
Expected: PASS. `/quiz` is still served by the unchanged `QuizApp` at this point (removed in Task 4); the "Quiz" tab still works.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Entraînement : fusion hub + quiz dans une seule route (useQuiz) ; Settings déplacé dans Paramétrage"
```

---

### Task 4: Rediriger `/quiz` + retirer l'onglet Quiz + nettoyage

`/quiz` redirige vers `/entrainement` (query préservée) ; l'onglet Quiz disparaît ; `QuizApp` est supprimé.

**Files:**
- Create: `src/features/quiz/QuizRedirect.tsx`
- Create: `src/features/quiz/QuizRedirect.test.tsx`
- Modify: `src/entries/index.tsx` (route `/quiz` → `QuizRedirect`, retirer l'import `QuizApp`)
- Modify: `src/ui/TopNav.tsx` (retirer l'entrée Quiz)
- Modify: `src/ui/TopNav.test.tsx` (asserter l'absence de Quiz)
- Delete: `src/QuizApp.tsx`
- Delete: `src/QuizApp.test.tsx`

**Interfaces:**
- Produces: `export function quizRedirectTarget(search: string): string`; `export function QuizRedirect()`.

- [ ] **Step 1: Write the failing helper test — `src/features/quiz/QuizRedirect.test.tsx`**

```tsx
import { test, expect } from "bun:test";
import { quizRedirectTarget } from "./QuizRedirect.tsx";

test("quizRedirectTarget preserves ?resume=1", () => {
  expect(quizRedirectTarget("?resume=1")).toBe("/entrainement?resume=1");
});
test("quizRedirectTarget preserves ?min=15", () => {
  expect(quizRedirectTarget("?min=15")).toBe("/entrainement?min=15");
});
test("quizRedirectTarget with no query points at /entrainement", () => {
  expect(quizRedirectTarget("")).toBe("/entrainement");
  expect(quizRedirectTarget("?")).toBe("/entrainement");
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `bun test src/features/quiz/QuizRedirect.test.tsx`
Expected: FAIL (`Cannot find module './QuizRedirect.tsx'`).

- [ ] **Step 3: Create `src/features/quiz/QuizRedirect.tsx`**

```tsx
import { Navigate, useSearchParams } from "react-router-dom";

/** Pure target for the retired /quiz route → the merged Entraînement tab, preserving the
 *  query string so /quiz?resume=1 and /quiz?min=N still auto-resume / auto-start. */
export function quizRedirectTarget(search: string): string {
  const s = new URLSearchParams(search).toString();
  return `/entrainement${s ? "?" + s : ""}`;
}

/** Redirects /quiz (and old bookmarks) to /entrainement, keeping any query string. */
export function QuizRedirect() {
  const [params] = useSearchParams();
  return <Navigate to={quizRedirectTarget("?" + params.toString())} replace />;
}
```

- [ ] **Step 4: Run it — verify it passes**

Run: `bun test src/features/quiz/QuizRedirect.test.tsx`
Expected: PASS (4 assertions).

- [ ] **Step 5: Rewire `/quiz` in `src/entries/index.tsx`**

Remove the `QuizApp` import:

```tsx
import QuizApp from "../QuizApp.tsx";   // ← delete this line
```

Add the `QuizRedirect` import next to the other quiz-feature imports:

```tsx
import { QuizRedirect } from "../features/quiz/QuizRedirect.tsx";
```

Change the `quiz` route element:

```tsx
          <Route path="quiz" element={<QuizRedirect />} />
```

- [ ] **Step 6: Remove the Quiz tab in `src/ui/TopNav.tsx`**

`ROUTES` becomes:

```tsx
const ROUTES = [
  { to: "/", label: "Accueil", end: true },
  { to: "/entrainement", label: "Entraînement" },
  { to: "/cours", label: "Cours" },
  { to: "/planning", label: "Planning" },
  { to: "/parametrage", label: "Paramétrage" },
];
```

- [ ] **Step 7: Extend `src/ui/TopNav.test.tsx`**

Append:

```tsx
test("TopNav no longer lists a separate Quiz tab", () => {
  const html = nav();
  expect(html).toContain("Entraînement");
  expect(html).not.toContain(">Quiz<");
});
```

- [ ] **Step 8: Delete `QuizApp`**

```bash
git rm src/QuizApp.tsx src/QuizApp.test.tsx
```

- [ ] **Step 9: Run the full suite + typecheck**

Run: `bun test && bun run typecheck`
Expected: PASS; no dangling imports of `QuizApp` / `nav.ts` / `SessionLauncher`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Nav : retirer l'onglet Quiz ; /quiz redirige vers /entrainement"
```

---

### Task 5: Vérification finale (build + app réelle)

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + full test suite**

Run: `bun run typecheck && bun test`
Expected: PASS, aucun test rouge.

- [ ] **Step 2: Grep — aucun import mort**

Run: `grep -rn "SessionLauncher\|entrainement/nav\|entrainement/ResumeBanner\|QuizApp\|entrainement/Settings" src/`
Expected: **aucune** correspondance (hors ce fichier de plan).

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: build OK, `_site/` régénéré (CSS + `bun build ./index.html` + copie statique).

- [ ] **Step 4: Drive the app**

Run: `bunx serve _site` puis ouvrir `http://localhost:3000/#/entrainement`.
Vérifier :
- L'onglet **Entraînement** affiche le hub (Dashboard + graphe + carte « Lancer une session » avec catégories + minutes + stubs). Cliquer **Commencer** → une question s'affiche ; répondre → corrigé + **Suivant** ; à la fin → résultats + **Recommencer** → retour au hub.
- La barre de nav liste **Accueil / Entraînement / Cours / Planning / Paramétrage** (pas de « Quiz »).
- L'onglet **Paramétrage** affiche Police (A−/A+), Thème, Données (Exporter/Importer/Réinitialiser) et Synchronisation multi-appareils.
- **Accueil** n'affiche plus la synchro.
- Naviguer vers `#/quiz` redirige vers `#/entrainement`.

- [ ] **Step 5: Push**

```bash
git push -u origin feat/fusion-entrainement-parametrage
```

---

## Self-Review

- **Spec coverage** — Navigation (Task 1+4), Entraînement fusionné (Task 3), Paramétrage = Settings+Sync (Task 1, Settings déplacé Task 3), Accueil sans sync (Task 2), `/quiz` redirect query-préservé (Task 4), `ふ`/`☾` conservés (TopNav intact hors ROUTES), pas de bump SW (aucun asset livré touché), tests neufs/supprimés/déplacés (toutes tâches). ✔ Couvert.
- **Placeholder scan** — aucun TODO/TBD ; code complet à chaque étape. ✔
- **Type consistency** — `EntrainementAppView`/`EntrainementHome` props alignées entre Task 3 Steps 2/3/6/7 ; `quizRedirectTarget` signature identique Task 4 Steps 1/3 ; `Phase`/`ResumeState` importés de `useQuiz.ts`. ✔
