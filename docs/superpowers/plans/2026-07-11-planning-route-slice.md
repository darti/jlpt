# Planning Route (slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Port `planning-n3.html` (interactive 20-week planner) to a React `/planning` route in the SPA, then delete the vanilla file.

**Architecture:** Pure schedule logic (`src/lib/planning.ts`, TDD) + static `WEEKS` content const + a `usePlanning` checkbox-state hook (localStorage `jlptN3progress_v1`) + a `Planning.tsx` route component (countdown, progress, this-week banner, static sections, weeks accordion via `<details>`). Wired into the router; `TopNav` "Planning" becomes an internal route. Shell (SW/theme/font/dict) already in `AppShell`.

**Tech Stack:** Bun, React 19 + TS, react-router-dom, Tailwind + oku tokens.

## Global Constraints

- **bun exclusively — never `node`.** SSR-safe (browser access in effects/handlers).
- Nord oku tokens only (no vanilla `theme.css`); **French UI** matching the original.
- localStorage keys **unchanged**: `jlptN3progress_v1` (checkbox state), `jlptN3_planStart` (plan anchor Monday). Exam date `2026-12-06T09:00:00`.
- The app must build, test-pass, work at every task boundary; `main` stays deployable.

---

## File Structure

- `src/lib/planning.ts` (+ test) — pure date/schedule logic.
- `src/features/planning/weeks.ts` — `WEEKS` data + `PHASES` + `EXAM`.
- `src/features/planning/usePlanning.ts` (+ test for the pure progress calc) — checkbox state.
- `src/features/planning/Planning.tsx` (+ test) — the route component.
- `src/entries/index.tsx` (modify) — add `/planning` route.
- `src/ui/TopNav.tsx` (modify) — move "Planning" from EXTERNAL to ROUTES.
- `planning-n3.html` (delete), `scripts/dev.ts` / `.github/workflows/deploy.yml` / `sw.js` (modify).

---

## Task 1: `planning.ts` — pure schedule logic (TDD)

**Files:** Create `src/lib/planning.ts`, `src/lib/planning.test.ts`.
**Interfaces:** Produces `mondayOf(d: Date): Date`; `addDays(d: Date, n: number): Date`; `fmtDay(d: Date): string` (e.g. `"6 déc."`); `readPlanStart(store, now): Date` (reads/persists `jlptN3_planStart` = Monday of first use); `currentWeekIdx(nWeeks, store, now): number` (0-based; −1 before, ≥nWeeks after); `daysUntilExam(now): number`; `weekRange(start, i): string` (e.g. `"6 déc. → 12 déc."`). `EXAM_ISO = "2026-12-06T09:00:00"`.

- [ ] **Step 1: Write the failing test** `src/lib/planning.test.ts`

```ts
import { test, expect } from "bun:test";
import { mondayOf, addDays, fmtDay, readPlanStart, currentWeekIdx, daysUntilExam, weekRange } from "./planning.ts";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
           setItem: (k: string, v: string) => void m.set(k, v), _get: (k: string) => m.get(k) };
}

test("mondayOf returns the Monday of the week (00:00)", () => {
  expect(mondayOf(new Date("2026-07-08T15:00:00")).toISOString().slice(0, 10)).toBe("2026-07-06"); // Wed → Mon
  expect(mondayOf(new Date("2026-07-06T00:00:00")).toISOString().slice(0, 10)).toBe("2026-07-06"); // Mon → Mon
});

test("fmtDay formats day + short French month", () => {
  expect(fmtDay(new Date("2026-12-06T00:00:00"))).toBe("6 déc.");
});

test("readPlanStart persists the Monday of first use, then stays stable", () => {
  const s = memStore();
  const first = readPlanStart(s, new Date("2026-07-08T10:00:00")); // Wed
  expect(first.toISOString().slice(0, 10)).toBe("2026-07-06");
  expect(s._get("jlptN3_planStart")).toBe("2026-07-06");
  const later = readPlanStart(s, new Date("2026-08-01T10:00:00")); // unchanged
  expect(later.toISOString().slice(0, 10)).toBe("2026-07-06");
});

test("currentWeekIdx is 0 on the start week and grows weekly", () => {
  const s = memStore({ jlptN3_planStart: "2026-07-06" });
  expect(currentWeekIdx(20, s, new Date("2026-07-08T10:00:00"))).toBe(0);
  expect(currentWeekIdx(20, s, new Date("2026-07-20T10:00:00"))).toBe(2);
});

test("weekRange formats the Mon→Sun span for week i", () => {
  expect(weekRange(new Date("2026-07-06T00:00:00"), 0)).toBe("6 juil. → 12 juil.");
});

test("daysUntilExam counts down to the exam (never negative)", () => {
  expect(daysUntilExam(new Date("2026-12-01T09:00:00"))).toBe(5);
  expect(daysUntilExam(new Date("2027-01-01T00:00:00"))).toBe(0);
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/lib/planning.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/planning.ts` (port of the vanilla date helpers)

```ts
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const EXAM_ISO = "2026-12-06T09:00:00";
const PLAN_START_KEY = "jlptN3_planStart";

export function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x;
}
export function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function fmtDay(d: Date): string { return d.getDate() + " " + MONTHS[d.getMonth()]; }

/** Monday of the week the plan was first opened — persisted once, then stable. */
export function readPlanStart(store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage, now: Date = new Date()): Date {
  let s: string | null = null;
  try { s = store.getItem(PLAN_START_KEY); } catch { /* ignore */ }
  if (!s) { s = mondayOf(now).toISOString().slice(0, 10); try { store.setItem(PLAN_START_KEY, s); } catch { /* ignore */ } }
  return new Date(s + "T00:00:00");
}

/** 0-based index of the current plan week; −1 before the start, ≥nWeeks once finished. */
export function currentWeekIdx(nWeeks: number, store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage, now: Date = new Date()): number {
  const start = readPlanStart(store, now);
  return Math.round((mondayOf(now).getTime() - start.getTime()) / (7 * 864e5));
}

export function weekRange(start: Date, i: number): string {
  const mon = addDays(start, i * 7);
  return fmtDay(mon) + " → " + fmtDay(addDays(mon, 6));
}

export function daysUntilExam(now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(EXAM_ISO).getTime() - now.getTime()) / 86400000));
}
```

- [ ] **Step 4: Run — verify GREEN** — `bun test src/lib/planning.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/lib/planning.ts src/lib/planning.test.ts && git commit -m "Planning : logique de calendrier pure (planning.ts) + tests"`

---

## Task 2: `weeks.ts` — the 20-week content

**Files:** Create `src/features/planning/weeks.ts`.
**Interfaces:** Produces `type Phase = "p1"|"p2"|"p3"|"p4"`; `interface Week { p: Phase; t: string; items: string[] }`; `WEEKS: Week[]` (the 20 weeks, copied verbatim from `planning-n3.html:204-225`); `PHASE_NAME: Record<Phase, string>`.

- [ ] **Step 1: Create `src/features/planning/weeks.ts`** — transcribe the vanilla `WEEKS` array (20 entries) + `PHNAME` exactly. (Copy every week's `p`/`t`/`items` from `planning-n3.html`; no paraphrasing.)

```ts
export type Phase = "p1" | "p2" | "p3" | "p4";
export interface Week { p: Phase; t: string; items: string[] }

export const PHASE_NAME: Record<Phase, string> = { p1: "Phase 1", p2: "Phase 2", p3: "Phase 3", p4: "Phase 4" };

export const WEEKS: Week[] = [
  { p: "p1", t: "Mise en route", items: ["Faire un 1ᵉʳ diagnostic dans l'app pour situer son niveau", "Parcourir le Cours : leçons 1–2 de grammaire", "Définir un créneau quotidien fixe (même heure)", "Activer la synchro (facultatif) pour suivre sa progression"] },
  // … transcribe weeks 2–20 verbatim from planning-n3.html:206-224 …
];
```

- [ ] **Step 2: Verify count** — `bun -e 'import("./src/features/planning/weeks.ts").then(m=>console.log(m.WEEKS.length))'` → `20`. (No test file — it's static data; the count check + typecheck suffice.)
- [ ] **Step 3: Commit** — `git add src/features/planning/weeks.ts && git commit -m "Planning : données des 20 semaines (weeks.ts)"`

---

## Task 3: `usePlanning` — checkbox state (TDD on the pure calc)

**Files:** Create `src/features/planning/usePlanning.ts`, `src/features/planning/usePlanning.test.ts`.
**Interfaces:** Produces pure `progressOf(state, weeks): { done: number; total: number; pct: number }` and `weekDone(state, weekNo, itemCount): number` (exported, tested). Hook `usePlanning()` returns `{ state, toggle(weekNo, itemIdx), reset(), progress }` backed by `jlptN3progress_v1`. State key format `"${weekNo}_${itemIdx}"` (unchanged from vanilla).

- [ ] **Step 1: Write the failing test** `src/features/planning/usePlanning.test.ts`

```ts
import { test, expect } from "bun:test";
import { progressOf, weekDone } from "./usePlanning.ts";
import type { Week } from "./weeks.ts";

const WEEKS: Week[] = [
  { p: "p1", t: "A", items: ["a", "b"] },
  { p: "p1", t: "B", items: ["c"] },
];

test("progressOf counts checked items over the total", () => {
  expect(progressOf({}, WEEKS)).toEqual({ done: 0, total: 3, pct: 0 });
  expect(progressOf({ "1_0": true, "2_0": true }, WEEKS)).toEqual({ done: 2, total: 3, pct: 67 });
});

test("weekDone counts checked items in one week (1-based week number)", () => {
  expect(weekDone({ "1_0": true, "1_1": true }, 1, 2)).toBe(2);
  expect(weekDone({ "1_0": true }, 1, 2)).toBe(1);
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/features/planning/usePlanning.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/features/planning/usePlanning.ts`

```ts
import { useCallback, useState } from "react";
import type { Week } from "./weeks.ts";

export type PlanState = Record<string, boolean>;
const KEY = "jlptN3progress_v1";
const UPDATED_KEY = "jlptN3_updatedAt";

export function progressOf(state: PlanState, weeks: Week[]): { done: number; total: number; pct: number } {
  const total = weeks.reduce((s, w) => s + w.items.length, 0);
  const done = Object.values(state).filter(Boolean).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
export function weekDone(state: PlanState, weekNo: number, itemCount: number): number {
  let n = 0; for (let j = 0; j < itemCount; j++) if (state[`${weekNo}_${j}`]) n++; return n;
}

function read(): PlanState {
  try { const v = JSON.parse(globalThis.localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; }
  catch { return {}; }
}
function write(state: PlanState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.setItem(UPDATED_KEY, new Date().toISOString()); }
  catch { /* best-effort */ }
}

/** Checkbox state for the planner, persisted to `jlptN3progress_v1`. Read lazily (SSR-safe:
 *  the initial render uses `{}`; a mount effect hydrates from localStorage). */
export function usePlanning() {
  const [state, setState] = useState<PlanState>({});
  const [hydrated, setHydrated] = useState(false);
  // hydrate once on mount (client only)
  if (!hydrated && typeof window !== "undefined") { /* set in effect below */ }
  const toggle = useCallback((weekNo: number, itemIdx: number) => {
    setState((prev) => { const next = { ...prev, [`${weekNo}_${itemIdx}`]: !prev[`${weekNo}_${itemIdx}`] }; write(next); return next; });
  }, []);
  const reset = useCallback(() => { setState({}); write({}); }, []);
  return { state, setState, hydrated, setHydrated, read, toggle, reset };
}
```

> **NOTE (implementer):** hydrate in `Planning.tsx` via a mount `useEffect(() => setState(read()), [])` (kept out of the pure hook body to stay SSR-clean). The exported `progressOf`/`weekDone` are the tested units; the hook is thin.

- [ ] **Step 4: Run — verify GREEN** — `bun test src/features/planning/usePlanning.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/features/planning/usePlanning.ts src/features/planning/usePlanning.test.ts && git commit -m "Planning : état des cases (usePlanning) + calcul de progression + tests"`

---

## Task 4: `Planning.tsx` — the route component

**Files:** Create `src/features/planning/Planning.tsx`, `src/features/planning/planning.test.tsx`.
**Interfaces:** `Planning()` — route content (no shell). Renders: countdown (days/weeks/exam via `daysUntilExam`), progress bar + text (`progressOf`), «cette semaine» banner (`currentWeekIdx`), the static intro sections (stats, phases table, routine, «tout dans l'app» — links via `<Link>`/`<a>`), and the weeks accordion (`<details class="week">` per week, current week `open`, checkboxes wired to `toggle`), + a reset button (confirm). Nord oku tokens; French copy from the vanilla page.

- [ ] **Step 1: Write the failing smoke test** `src/features/planning/planning.test.tsx`

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Planning } from "./Planning.tsx";

test("Planning renders the 20-week plan with phases + a reset", () => {
  const html = renderToStaticMarkup(<MemoryRouter><Planning /></MemoryRouter>);
  expect(html).toContain("Mise en route");     // week 1 title
  expect(html).toContain("Phase 1");            // phase label
  expect(html).toContain("Semaine de l'examen"); // week 20 title
  expect(html).toContain("Réinitialiser");      // reset control
  expect(html).toContain("jours restants");     // countdown
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/features/planning/planning.test.tsx` → FAIL.

- [ ] **Step 3: Implement `src/features/planning/Planning.tsx`.** Port the vanilla render: header block (countdown pills + progress bar + this-week banner + reset), the four static `<section>`s (stats grid, exam-structure note, phases table, routine, «tout dans l'app» — replace `app-n3.html`/`cours-n3.html` links with `<Link to="/entrainement">`/`<a href="cours-n3.html">` since cours is still vanilla this slice), then the weeks accordion. Use oku token classes (`bg-panel`/`bg-surface-2`/`border-line`/`text-fg`/`text-fg-dim`/`text-accent`/`text-status-completed`). Hydrate checkbox state in a mount effect; compute `now`/`currentWeekIdx`/`daysUntilExam` at render (client) with a `now = new Date()`. Phase pill colors map p1→accent, p2→prio-high, p3→status-completed, p4→status-failed (nearest oku tokens). Full component body — no placeholders — mirrors `planning-n3.html:94-174` + `render()/updateProg()/countdown()/thisWeek()`.

- [ ] **Step 4: Run — verify GREEN + typecheck** — `bun test src/features/planning/planning.test.tsx` (PASS); `bun run typecheck` (0).
- [ ] **Step 5: Commit** — `git add src/features/planning/Planning.tsx src/features/planning/planning.test.tsx && git commit -m "Planning : composant de route (checklist 20 semaines + compte à rebours)"`

---

## Task 5: Wire the route + delete the vanilla page

**Files:** Modify `src/entries/index.tsx`, `src/ui/TopNav.tsx`, `src/ui/shell.test.tsx`; delete `planning-n3.html`; modify `scripts/dev.ts`, `.github/workflows/deploy.yml`, `sw.js`.

- [ ] **Step 1: `src/entries/index.tsx`** — add the route: `import { Planning } from "../features/planning/Planning.tsx";` and `<Route path="planning" element={<Planning />} />` inside the `AppShell` layout route.
- [ ] **Step 2: `src/ui/TopNav.tsx`** — move Planning from `EXTERNAL` to `ROUTES`: add `{ to: "/planning", label: "Planning" }` to `ROUTES`; remove the planning entry from `EXTERNAL` (leaving only `{ href: "cours-n3.html", label: "Cours" }`).
- [ ] **Step 3: `src/ui/shell.test.tsx`** — update the TopNav test: assert `href="/planning"` (internal route) now present; `cours-n3.html` still external.
- [ ] **Step 4: Delete** — `git rm planning-n3.html`.
- [ ] **Step 5: `scripts/dev.ts`** — remove `"/planning-n3.html"` from `STATIC_FILES`.
- [ ] **Step 6: `.github/workflows/deploy.yml`** — drop `planning-n3.html` from the `cp` line (keep `quiz.html app-n3.html cours-n3.html`).
- [ ] **Step 7: `sw.js`** — remove `'planning-n3.html'` from `SHELL`; bump `CACHE` v86 → v87.
- [ ] **Step 8: Verify** — `bun test` (all green), `bun run typecheck` (0), `bun run build` (index emits), assemble `_site` and confirm `/planning` route renders.
- [ ] **Step 9: Verify (browser)** — load `#/planning`: countdown + progress + this-week + weeks accordion render; checking a box persists (`jlptN3progress_v1`) and updates progress; nav «Planning» is in-app; reset works.
- [ ] **Step 10: Commit** — `git add -A && git commit -m "Planning : route /planning câblée + suppression de planning-n3.html (dev/déploiement/SW)"`

---

## Self-Review

**1. Spec coverage:** planner ported to `/planning` (T4), schedule logic (T1), 20-week data verbatim (T2), checkbox state `jlptN3progress_v1` + progress (T3), route wired + vanilla page deleted + config (T5). Shell (SW/theme/font/dict) already in AppShell. ✓
**2. Placeholders:** T1/T3 full code + tests; T2 transcribes data verbatim (implementer copies weeks 2–20); T4 is a faithful port cited to `planning-n3.html` line ranges; T5 concrete edits. `dict.js`/`theme.css` NOT deletable yet (cours-n3 still vanilla — that's slice 3).
**3. Type consistency:** `Week`/`Phase`/`WEEKS`/`PHASE_NAME` (T2) used by `progressOf`/`weekDone` (T3) + `Planning` (T4); `currentWeekIdx`/`daysUntilExam`/`weekRange`/`readPlanStart` (T1) used by `Planning` (T4). Keys `jlptN3progress_v1`/`jlptN3_planStart` verbatim.
**4. Ambiguity:** phase→token color mapping is the one judgment call (T4) — mapped to nearest oku tokens, bounded by the smoke test (phase labels render).
