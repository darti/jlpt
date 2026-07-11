# SPA Shell (slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the three React entries (dashboard, quiz, hub) into ONE `HashRouter` SPA with a shared `AppShell` layout, keeping the app fully working; `cours`/`planning` stay vanilla (linked externally, reached via redirect stubs).

**Architecture:** `index.html` mounts `<HashRouter>` → an `AppShell` layout route (owns `Header`/`TopNav`/`Footer`/`UpdateBanner`, `useTheme`, `useServiceWorker`, and a one-time `setupDict()`/`applyFontScale()`), with child routes `/` (dashboard), `/quiz`, `/entrainement` whose content components are the existing `*View`s stripped of the shell. Theme is shared via a `ThemeContext`. The quiz `?min`/`?resume` handoff moves to React Router (`useSearchParams`/`useNavigate`).

**Tech Stack:** Bun, React 19 + TS, **react-router-dom** (HashRouter), Tailwind v4 + oku tokens, happy-dom for behavioral tests.

## Global Constraints

- **bun exclusively — never `node`.**
- **Hash routing** (`/#/quiz`) — GitHub Pages static host; no `404.html` hack.
- Routes: `/` (dashboard), `/quiz`, `/entrainement`. `cours`/`planning` stay vanilla `*.html` (external links) this slice.
- Nord oku tokens only (no vanilla `theme.css`); **French UI**; SSR-safe (browser access in effects/handlers).
- The app must build, test-pass, and work at **every task boundary**. `main` stays deployable.
- Existing URLs are NOT preserved; `quiz.html`/`app-n3.html` become **redirect stubs** (not deleted) so still-vanilla cours/planning nav keeps working.
- Tests: pure logic → unit; components → `renderToStaticMarkup` SSR smoke (wrap router-hook components in `<MemoryRouter>`); DOM effects/handlers → happy-dom (`createRoot` + `act`).

---

## File Structure

- `src/hooks/useThemeContext.tsx` (new) — `ThemeContext` + `useThemeContext()`.
- `src/AppShell.tsx` (new) — layout route: shell + theme/SW hooks + `Outlet` + one-time dict/font-scale.
- `src/ui/TopNav.tsx` (modify) — `NavLink` router links + external anchors; theme from context.
- `src/App.tsx` (modify) — `AppView` → content-only `DashboardView`; `App` → route (drops theme/SW).
- `src/QuizApp.tsx` (modify) — `QuizAppView` → content-only; `QuizApp` → route (drops theme/SW).
- `src/EntrainementApp.tsx` (modify) — `EntrainementAppView` → content-only; `EntrainementApp` → route (theme from context).
- `src/features/quiz/useQuiz.ts` (modify) — auto-effect reads `useSearchParams`, not `window.location.search`.
- `src/features/entrainement/nav.ts` (modify) — `sessionHref`/`resumeHref` return router paths.
- `src/features/entrainement/SessionLauncher.tsx`, `ResumeBanner.tsx` (modify) — `useNavigate`/`Link`.
- `src/entries/index.tsx` (modify) — mount `<HashRouter>` + routes.
- `src/entries/quiz.tsx`, `src/entries/app-n3.tsx` (delete).
- `quiz.html`, `app-n3.html` (→ redirect stubs).
- `package.json`, `scripts/dev.ts`, `.github/workflows/deploy.yml`, `sw.js` (modify).
- Tests: `src/hooks/useThemeContext.test.tsx`, `src/AppShell.test.tsx`, plus updates to `src/ui/shell.test.tsx`, `src/App.test.tsx`, `src/QuizApp.test.tsx`, `src/EntrainementApp.test.tsx`, `src/EntrainementApp.runtime.test.tsx`, `src/features/entrainement/nav.test.ts`.

---

## Task 1: react-router-dom + ThemeContext

**Files:** `bun add react-router-dom`; create `src/hooks/useThemeContext.tsx` + `src/hooks/useThemeContext.test.tsx`.
**Interfaces:** Produces `ThemeContext: React.Context<ThemeCtx>`, `useThemeContext(): ThemeCtx` where `ThemeCtx = { theme: ThemeName; toggle: () => void }`.

- [ ] **Step 1: Install** — `bun add react-router-dom`. Expected: adds to `package.json` dependencies.

- [ ] **Step 2: Write the failing test** `src/hooks/useThemeContext.test.tsx`

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeContext, useThemeContext } from "./useThemeContext.tsx";

function Probe() {
  const { theme } = useThemeContext();
  return <span>{theme}</span>;
}

test("useThemeContext reads the provided theme", () => {
  const html = renderToStaticMarkup(
    <ThemeContext.Provider value={{ theme: "light", toggle: () => {} }}>
      <Probe />
    </ThemeContext.Provider>,
  );
  expect(html).toContain("light");
});
```

- [ ] **Step 3: Run — verify RED** — `bun test src/hooks/useThemeContext.test.tsx` → FAIL (module missing).

- [ ] **Step 4: Implement** `src/hooks/useThemeContext.tsx`

```tsx
import { createContext, useContext } from "react";
import type { ThemeName } from "../lib/theme.ts";

export interface ThemeCtx { theme: ThemeName; toggle: () => void }

/** App-wide theme + toggle, provided by AppShell so TopNav and the hub Settings share
 *  one `useTheme` instance. */
export const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });
export const useThemeContext = (): ThemeCtx => useContext(ThemeContext);
```

- [ ] **Step 5: Run — verify GREEN** — `bun test src/hooks/useThemeContext.test.tsx` → PASS.
- [ ] **Step 6: Commit** — `git add package.json bun.lock src/hooks/useThemeContext.tsx src/hooks/useThemeContext.test.tsx && git commit -m "SPA : ajouter react-router-dom + ThemeContext"`

---

## Task 2: TopNav → NavLink (theme from context)

**Files:** Modify `src/ui/TopNav.tsx`; update `src/ui/shell.test.tsx`.
**Interfaces:** Produces `TopNav()` — **no props** (reads `useThemeContext`); must render inside a Router + `ThemeContext`. Internal routes use `NavLink to="/…"`; cours/planning use plain `<a href="…-n3.html">` (still vanilla).

- [ ] **Step 1: Update the test** `src/ui/shell.test.tsx` — wrap in `MemoryRouter` + `ThemeContext`, assert router links + theme emoji.

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { TopNav } from "./TopNav.tsx";
import { ThemeContext } from "../hooks/useThemeContext.tsx";

function nav(theme: "light" | "dark") {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ThemeContext.Provider value={{ theme, toggle: () => {} }}>
        <TopNav />
      </ThemeContext.Provider>
    </MemoryRouter>,
  );
}

test("TopNav renders internal router links + external vanilla links", () => {
  const html = nav("dark");
  expect(html).toContain('href="#/quiz"');          // NavLink → hash route
  expect(html).toContain('href="#/entrainement"');
  expect(html).toContain('href="cours-n3.html"');    // still-vanilla external
  expect(html).toContain("Planning");
});

test("TopNav theme toggle shows the right emoji", () => {
  expect(nav("dark")).toContain("☀");
  expect(nav("light")).toContain("☾");
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/ui/shell.test.tsx` → FAIL (TopNav still takes props / no router).

- [ ] **Step 3: Implement** `src/ui/TopNav.tsx`

```tsx
import { NavLink } from "react-router-dom";
import { useThemeContext } from "../hooks/useThemeContext.tsx";

const ROUTES = [
  { to: "/", label: "Accueil", end: true },
  { to: "/entrainement", label: "Entraînement" },
  { to: "/quiz", label: "Quiz" },
];
// Still-vanilla pages (ported in later slices) — plain external links for now.
const EXTERNAL = [
  { href: "cours-n3.html", label: "Cours" },
  { href: "planning-n3.html", label: "Planning" },
];
const ON = "text-fg font-semibold text-sm";
const OFF = "text-fg-dim font-semibold text-sm";

export function TopNav() {
  const { theme, toggle } = useThemeContext();
  return (
    <nav className="sticky top-0 z-10 flex gap-4 flex-wrap justify-center items-center px-3 py-2.5">
      {ROUTES.map((r) => (
        <NavLink key={r.to} to={r.to} end={r.end} className={({ isActive }) => (isActive ? ON : OFF)}>
          {r.label}
        </NavLink>
      ))}
      {EXTERNAL.map((e) => (
        <a key={e.href} href={e.href} className={OFF}>{e.label}</a>
      ))}
      <button
        type="button"
        onClick={toggle}
        aria-label="Basculer le thème"
        className="text-fg-dim rounded-full min-w-8 h-8 cursor-pointer border-none bg-transparent"
      >
        {theme === "light" ? "☾" : "☀"}
      </button>
    </nav>
  );
}
```

- [ ] **Step 4: Run — verify GREEN** — `bun test src/ui/shell.test.tsx` → PASS. (`bun run typecheck` will still fail where old callers pass props — fixed in later tasks.)
- [ ] **Step 5: Commit** — `git add src/ui/TopNav.tsx src/ui/shell.test.tsx && git commit -m "SPA : TopNav en NavLink (routes hash) + thème via contexte"`

---

## Task 3: AppShell layout

**Files:** Create `src/AppShell.tsx` + `src/AppShell.test.tsx`.
**Interfaces:** Consumes `useTheme` (`{theme, toggle}`), `useServiceWorker` (`{updateReady, apply, forceRefresh, version}`), `setupDict`, `applyFontScale`, `ThemeContext`, `Header`/`TopNav`/`Footer`/`UpdateBanner`, react-router `Outlet`. Produces `AppShell()` — a layout route element rendering the shell + `<Outlet/>`.

- [ ] **Step 1: Write the failing test** `src/AppShell.test.tsx`

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./AppShell.tsx";

test("AppShell renders the shell + child route outlet", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>ROUTE_CONTENT</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(html).toContain("JLPT N3");        // Header
  expect(html).toContain("Accueil");        // TopNav
  expect(html).toContain("ROUTE_CONTENT");  // Outlet
  expect(html).toContain("Bon courage");    // Footer
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/AppShell.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/AppShell.tsx`

```tsx
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./ui/Header.tsx";
import { TopNav } from "./ui/TopNav.tsx";
import { Footer } from "./ui/Footer.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { ThemeContext } from "./hooks/useThemeContext.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import { useServiceWorker } from "./hooks/usePwa.ts";
import { setupDict } from "./lib/dict.ts";
import { applyFontScale } from "./lib/fontscale.ts";

/** Single shared layout for every route: shell chrome + theme/SW state (once) + a
 *  one-time dict-data load + persisted font scale. Route content renders in `<Outlet/>`. */
export function AppShell() {
  const { theme, toggle } = useTheme();
  const { updateReady, apply, forceRefresh, version } = useServiceWorker();

  useEffect(() => {
    void setupDict();       // expose window.furi/visualBreak/initDefs + load data/dict.json
    applyFontScale();       // apply persisted --fs-ui/--fs-jp
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <Header />
      <TopNav />
      <div className="max-w-[680px] mx-auto px-5 pt-6 pb-10">
        <Outlet />
      </div>
      <Footer onForceRefresh={forceRefresh} version={version} />
      <UpdateBanner show={updateReady} onApply={apply} />
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 4: Run — verify GREEN** — `bun test src/AppShell.test.tsx` → PASS.
- [ ] **Step 5: Commit** — `git add src/AppShell.tsx src/AppShell.test.tsx && git commit -m "SPA : layout AppShell (chrome + thème/SW + dict/police une fois)"`

---

## Task 4: Dashboard route — strip shell from AppView

**Files:** Modify `src/App.tsx`; update `src/App.test.tsx`.
**Interfaces:** Produces content-only `DashboardView(props: { model, days, version, onForceRefresh, updateReady, onApplyUpdate, onProgressChanged })`? → NO. The shell (Footer/UpdateBanner/version/forceRefresh) now lives in AppShell. `DashboardView` keeps ONLY the content: `{ model: DashboardModel | null; days: number; onProgressChanged: () => void }`. `App` (route) uses `useProgress` only.

- [ ] **Step 1: Update the test** `src/App.test.tsx` — render the content-only view (no theme/SW/version props).

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardView } from "./App.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import type { Progress } from "./types/progress.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R, t: 60 }, vocabulaire: { R, t: 60 }, kanji: { R, t: 60 }, lecture: { R, t: 60 } },
});

test("DashboardView renders the dashboard stats + install/sync sections", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<DashboardView model={model} days={model.days} onProgressChanged={() => {}} />);
  expect(html).toContain("17%");                           // stat
  expect(html).toContain("Installer");                     // InstallPrompt
  expect(html).toContain("Synchronisation multi-appareils"); // SyncSection
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/App.test.tsx` → FAIL (`DashboardView` not exported / signature changed).

- [ ] **Step 3: Implement** `src/App.tsx` — replace the file with the content-only view + route container:

```tsx
import { InstallPrompt } from "./features/pwa/InstallPrompt.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { SyncSection } from "./features/sync/SyncSection.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";

/** Dashboard route content (shell now lives in AppShell). Pure/prop-driven. */
export function DashboardView({ model, days, onProgressChanged }: {
  model: DashboardModel | null; days: number; onProgressChanged: () => void;
}) {
  return (
    <>
      <InstallPrompt />
      <Dashboard model={model} days={days} />
      <SyncSection onProgressChanged={onProgressChanged} />
    </>
  );
}

/** Route container: owns progress state only. */
export default function App() {
  const [progress, refreshProgress] = useProgress();
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return <DashboardView model={model} days={daysUntilExam(now)} onProgressChanged={refreshProgress} />;
}
```

- [ ] **Step 4: Run — verify GREEN** — `bun test src/App.test.tsx` → PASS.
- [ ] **Step 5: Commit** — `git add src/App.tsx src/App.test.tsx && git commit -m "SPA : Dashboard en contenu de route (retire le shell d'AppView)"`

---

## Task 5: Quiz route — strip shell + router params

**Files:** Modify `src/QuizApp.tsx`, `src/features/quiz/useQuiz.ts`; update `src/QuizApp.test.tsx`.
**Interfaces:** `QuizAppView` keeps content only (drops `theme`/`onToggleTheme` + `Header`/`TopNav`); `QuizApp` (route) drops `useTheme` (the shell's `setupDict` already wires `window.initDefs`; keep the `initDefs` mount call for the quiz's tap-to-define since the shell runs it app-wide — REMOVE the now-redundant `initDefs` effect from `QuizApp`). `useQuiz`'s one-shot auto-effect reads `useSearchParams()` instead of `window.location.search`.

- [ ] **Step 1: Update `useQuiz` auto-effect to router search.** In `src/features/quiz/useQuiz.ts`:
  - Add import: `import { useSearchParams } from "react-router-dom";`
  - Inside `useQuiz()`, near the top: `const [searchParams] = useSearchParams();`
  - Replace the one-shot effect body's param read:

```ts
  // One-shot hub → quiz handoff, now from the router (?min / ?resume live in the hash route).
  useEffect(() => {
    if (didAutoRef.current) return;
    didAutoRef.current = true;
    const params = parseSessionParams("?" + searchParams.toString());
    const saved = readResumeState();
    if (params.resume && saved) { void resumeNow(saved); }
    else if (params.min) { setMinutes(params.min); void start(params.min); }
  }, [resumeNow, start, setMinutes, searchParams]);
```

  (The pure `parseSessionParams(search)` helper is UNCHANGED; `sessionParams.test.ts` stays green.)

- [ ] **Step 2: Strip shell from `QuizApp.tsx`.** Replace `QuizAppView`'s `<><Header/><TopNav .../><div…>…</div></>` wrapper with just the content `<>…</>` (remove `Header`, `TopNav` imports + JSX + the `theme`/`onToggleTheme` props); remove `useTheme` + the `initDefs` `useEffect` from the `QuizApp` container (dict is wired once by AppShell). The content (home/question/corrige/results branches) is unchanged. Resulting container:

```tsx
export default function QuizApp() {
  const quiz = useQuiz();
  const [resumeDismissed, setResumeDismissed] = useState(false);
  return (
    <QuizAppView
      phase={quiz.phase} question={quiz.question}
      count={quiz.count} right={quiz.right}
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
  And `QuizAppView`'s props type drops `theme`/`onToggleTheme`; its JSX drops `<Header/>`/`<TopNav/>` and returns the `<div className="flex flex-col gap-4">…</div>` content (the corrige-phase wrapper already added) plus the home/question/results branches, wrapped in a single fragment.

- [ ] **Step 3: Update `src/QuizApp.test.tsx`** — render `QuizAppView` content-only, wrapped in `MemoryRouter` (in case any child uses router later); assert a phase renders (e.g. home shows category chips). Example:

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QuizAppView } from "./QuizApp.tsx";
import { SKILLS } from "./types/progress.ts";

test("QuizAppView home phase renders the launcher content (no shell)", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <QuizAppView phase="home" question={null} count={0} right={0}
        selected={new Set(SKILLS)} minutes={10} resume={null} answered={false} chosen={null}
        onStart={() => {}} onChoose={() => {}} onNext={() => {}} onRestart={() => {}}
        onToggleCat={() => {}} onSetMinutes={() => {}} onResumeNow={() => {}} onDismissResume={() => {}} />
    </MemoryRouter>,
  );
  expect(html).not.toContain("Accueil");   // shell removed
  expect(html).toContain("Commencer");     // QuizHome content
});
```

- [ ] **Step 4: Run — verify GREEN** — `bun test src/QuizApp.test.tsx src/features/quiz/` → PASS.
- [ ] **Step 5: Commit** — `git add src/QuizApp.tsx src/features/quiz/useQuiz.ts src/QuizApp.test.tsx && git commit -m "SPA : Quiz en contenu de route + handoff ?min/?resume via useSearchParams"`

---

## Task 6: Entrainement route — strip shell + theme via context + router nav

**Files:** Modify `src/EntrainementApp.tsx`, `src/features/entrainement/nav.ts`, `SessionLauncher.tsx`, `ResumeBanner.tsx`; update `src/features/entrainement/nav.test.ts`, `src/EntrainementApp.test.tsx`, `src/EntrainementApp.runtime.test.tsx`.
**Interfaces:** `nav.ts` produces `sessionHref(min): string = "/quiz?min=" + clamp` and `resumeHref(): string = "/quiz?resume=1"` (router paths). `SessionLauncher`/`ResumeBanner` navigate via `useNavigate`/`Link`. `EntrainementAppView` drops the shell; `EntrainementApp` reads theme from `useThemeContext` for `Settings`.

- [ ] **Step 1: Update `nav.test.ts`** to router paths:

```ts
import { test, expect } from "bun:test";
import { sessionHref, resumeHref } from "./nav.ts";

test("sessionHref builds /quiz?min=N", () => { expect(sessionHref(15)).toBe("/quiz?min=15"); });
test("sessionHref clamps to 45", () => { expect(sessionHref(999)).toBe("/quiz?min=45"); });
test("sessionHref falls back to 10", () => { expect(sessionHref(NaN)).toBe("/quiz?min=10"); expect(sessionHref(0)).toBe("/quiz?min=10"); });
test("resumeHref is /quiz?resume=1", () => { expect(resumeHref()).toBe("/quiz?resume=1"); });
```

- [ ] **Step 2: Run — verify RED** — `bun test src/features/entrainement/nav.test.ts` → FAIL.

- [ ] **Step 3: Implement `nav.ts`** — router paths:

```ts
/** Router path to launch a fresh quiz session of `minutes` (clamped 1–45, default 10). */
export function sessionHref(minutes: number): string {
  const m = Math.min(45, Math.max(1, Math.round(minutes) || 10));
  return "/quiz?min=" + m;
}
/** Router path to resume the in-progress quiz session. */
export function resumeHref(): string { return "/quiz?resume=1"; }
```

- [ ] **Step 4: `SessionLauncher.tsx`** — navigate via router. Replace `const go = () => { window.location.href = sessionHref(minutes); };` with:

```tsx
import { useNavigate } from "react-router-dom";
// …inside the component:
const navigate = useNavigate();
const go = () => { navigate(sessionHref(minutes)); };
```

- [ ] **Step 5: `ResumeBanner.tsx`** — replace the `<a href={resumeHref()} …>` with a router `Link`:

```tsx
import { Link } from "react-router-dom";
// …
<Link to={resumeHref()} className="bg-accent text-fg-on-accent no-underline rounded-lg px-3 py-2 text-sm font-bold shrink-0">
  Reprendre ma session
</Link>
```

- [ ] **Step 6: `EntrainementApp.tsx`** — drop the shell from `EntrainementAppView` (remove `Header`/`TopNav`/`Footer`/`UpdateBanner` + their props: `theme`, `onToggleTheme`, `updateReady`, `onApplyUpdate`, `onForceRefresh`, `version`), keeping only the content `<div className="max-w-[680px]…">`? — NO, AppShell already provides that wrapper; `EntrainementAppView` returns just `<EntrainementHome …/>`. The container reads theme from context:

```tsx
import { useCallback, useEffect, useState } from "react";
import { EntrainementHome } from "./features/entrainement/EntrainementHome.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { readSessionScores } from "./lib/history.ts";
import { useThemeContext } from "./hooks/useThemeContext.tsx";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { ThemeName } from "./lib/theme.ts";

/** Entrainement route content (shell + dict/font-scale now in AppShell). */
export function EntrainementAppView(props: {
  theme: ThemeName; onToggleTheme: () => void;
  model: DashboardModel | null; days: number; scores: number[]; onProgressChanged: () => void;
}) {
  return (
    <EntrainementHome
      model={props.model} days={props.days} scores={props.scores}
      theme={props.theme} onToggleTheme={props.onToggleTheme}
      onProgressChanged={props.onProgressChanged}
    />
  );
}

export default function EntrainementApp() {
  const { theme, toggle } = useThemeContext();
  const [progress, refreshProgress] = useProgress();
  const [scores, setScores] = useState<number[]>([]);
  const onProgressChanged = useCallback(() => { refreshProgress(); setScores(readSessionScores()); }, [refreshProgress]);
  useEffect(() => { setScores(readSessionScores()); }, []);
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return (
    <EntrainementAppView
      theme={theme} onToggleTheme={toggle}
      model={model} days={daysUntilExam(now)} scores={scores} onProgressChanged={onProgressChanged}
    />
  );
}
```

- [ ] **Step 7: Update `EntrainementApp.test.tsx`** — render `EntrainementAppView` (now content-only) inside `MemoryRouter` (SessionLauncher/ResumeBanner use router hooks); drop the shell props (`updateReady`/`version`/etc.). Assert `Démarrer ma session`, `bientôt`, empty chart, `Synchronisation multi-appareils` still render. Wrap in `<MemoryRouter>`.

- [ ] **Step 8: Update `EntrainementApp.runtime.test.tsx`** — wrap the `root.render(<EntrainementApp/>)` in `<MemoryRouter>` (it now uses `useThemeContext` + child router hooks). Provide a `ThemeContext` via a small wrapper, OR render `<MemoryRouter><ThemeContext.Provider value={{theme:"dark",toggle(){}}}><EntrainementApp/></ThemeContext.Provider></MemoryRouter>`. Keep the `--fs-ui` assertion (font scale now applied by AppShell — so in this isolated mount, call `applyFontScale()` in the test setup OR assert the launcher/settings render instead). Adjust: assert the hub renders (`Démarrer ma session`, `Réglages`, resume banner) rather than `--fs-ui` (which AppShell owns now).

- [ ] **Step 9: Run — verify GREEN** — `bun test src/features/entrainement/ src/EntrainementApp.test.tsx src/EntrainementApp.runtime.test.tsx` → PASS.
- [ ] **Step 10: Commit** — `git add src/EntrainementApp.tsx src/features/entrainement/ src/EntrainementApp.test.tsx src/EntrainementApp.runtime.test.tsx && git commit -m "SPA : Entrainement en contenu de route + nav quiz via router + thème par contexte"`

---

## Task 7: Single entry + router + redirect stubs + build/dev/deploy/SW

**Files:** Modify `src/entries/index.tsx`, `package.json`, `scripts/dev.ts`, `.github/workflows/deploy.yml`, `sw.js`; delete `src/entries/quiz.tsx`, `src/entries/app-n3.tsx`; replace `quiz.html`, `app-n3.html` with redirect stubs.

- [ ] **Step 1: `src/entries/index.tsx`** → mount the router:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "../AppShell.tsx";
import App from "../App.tsx";
import QuizApp from "../QuizApp.tsx";
import EntrainementApp from "../EntrainementApp.tsx";
import "../styles/styles.gen.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<App />} />
          <Route path="quiz" element={<QuizApp />} />
          <Route path="entrainement" element={<EntrainementApp />} />
          <Route path="*" element={<App />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
```

- [ ] **Step 2: Delete old entries** — `git rm src/entries/quiz.tsx src/entries/app-n3.tsx`. Also delete `src/entries/dict-bundle.test.ts`'s app-n3 case OR update it: it builds `src/entries/app-n3.tsx` (now gone). Update `dict-bundle.test.ts` to build `src/entries/index.tsx` for the "bundles dict logic not data" assertions, and drop the app-n3 test.

- [ ] **Step 3: Redirect stubs** — replace `quiz.html` and `app-n3.html` with hash redirects (so still-vanilla cours/planning nav to them lands in the SPA). `quiz.html`:

```html
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Quiz — JLPT N3</title>
<script>location.replace("index.html#/quiz" + location.search);</script>
</head><body></body></html>
```
`app-n3.html`:

```html
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Entraînement — JLPT N3</title>
<script>location.replace("index.html#/entrainement");</script>
</head><body></body></html>
```

- [ ] **Step 4: `package.json` build** — single entry:

```
"build": "bun run css -- --minify && bun build ./index.html --minify --splitting --outdir=_site",
```

- [ ] **Step 5: `scripts/dev.ts`** — remove the `quiz`/`appn3` imports + their `routes` entries (keep only `"/": index, "/index.html": index`); ADD `"/quiz.html"` and `"/app-n3.html"` to `STATIC_FILES` (they're redirect stubs served from disk now); keep cours/planning + data in `STATIC_FILES`.

- [ ] **Step 6: `.github/workflows/deploy.yml`** — `bun run build` now emits only `index.html`; the redirect stubs `quiz.html`/`app-n3.html` are vanilla → add them to the `cp` line (`cp quiz.html app-n3.html cours-n3.html planning-n3.html _site/`). Keep the rest.

- [ ] **Step 7: `sw.js`** — shrink `SHELL` to `['./','index.html','cours-n3.html','planning-n3.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png']` (redirect stubs + hashed chunks are runtime-cached); bump `CACHE` v85 → v86.

- [ ] **Step 8: Verify** — `bun test` (all green), `bun run typecheck` (0 errors — all old `theme`/`onToggleTheme` callers resolved), `bun run build` then confirm `_site/index.html` exists and references one hashed entry; `grep -c '#/quiz' _site/quiz.html` (redirect stub present).

- [ ] **Step 9: Verify (browser, controller/user)** — serve `_site`, load `/index.html`: dashboard renders; nav `Entraînement`→`#/entrainement`, `Quiz`→`#/quiz` (in-app, no reload); `Cours`/`Planning`→ vanilla pages; hub «Démarrer ma session» → `#/quiz?min=…` starts a session; theme toggle + furigana/tap work; `/quiz.html`/`/app-n3.html` redirect into the SPA.
- [ ] **Step 10: Commit** — `git add -A && git commit -m "SPA : entrée unique HashRouter + stubs de redirection + câblage build/dev/déploiement/SW"`

---

## Self-Review

**1. Spec coverage:** SPA shell + HashRouter (T3/T7); routes `/`,`/quiz`,`/entrainement` (T4/5/6/7); shell hoisted once + theme context + one-time setupDict (T3); TopNav→NavLink (T2); quiz param handoff via router (T5/6); redirect stubs (T7); single-entry build/dev/deploy/SW (T7). cours/planning stay vanilla external (T2 EXTERNAL links). ✓ (Slice-1 scope of the SPA design; planning/cours ports are slices 2–3.)
**2. Placeholders:** New files carry full code; refactor tasks show the resulting containers/views + exact removals. No TODO/TBD.
**3. Type consistency:** `ThemeCtx {theme,toggle}` (T1) consumed by TopNav (T2) + EntrainementApp (T6); `sessionHref`/`resumeHref` return `/quiz?…` (T6) consumed by SessionLauncher/ResumeBanner (T6) + parsed by `parseSessionParams` via `useSearchParams` (T5); `AppShell` `<Outlet/>` hosts `App`/`QuizApp`/`EntrainementApp` (T7). `DashboardView`/`QuizAppView`/`EntrainementAppView` are content-only after T4/5/6.
**4. Ambiguity:** The one nuance is the runtime test (T6 Step 8) — `--fs-ui` now applied by AppShell, so that mount asserts hub content instead; made explicit.
