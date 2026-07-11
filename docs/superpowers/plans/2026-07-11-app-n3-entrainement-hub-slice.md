# app-n3 Entraînement Hub (replace app-n3.html) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3.2MB vanilla `app-n3.html` with a React "entraînement hub": progress overview + an ECharts progress chart + a session launcher («J'ai xx minutes») + resume + settings (font scale, theme, export/import/reset) + Gist sync, launching the shipped `quiz.html`.

**Architecture:** Third strangler page. Reuses `scoring.ts`/`storage.ts`/`gist.ts`/`useTheme`/`SyncSection`/shell. New pure libs (`fontscale`, `datajson`) TDD'd; ECharts added tree-shaken for the chart (built with the dataviz skill). The hub picks session params; `quiz.html` (extended to read `?min`/`?resume`) executes. Diagnostic/SRS become «bientôt» stubs (their vanilla code drops from the tree, recoverable from git).

**Tech Stack:** Bun, React 19 + TS, Tailwind v4 + oku tokens, ECharts (bundled, tree-shaken), `dict.js` (global).

## Global Constraints

- **bun exclusively — never `node`.**
- **`jlptN3adapt_v2` blob** read for the numbers (via `scoring.ts`) + `S.history` for the chart; export/import/reset handle the full blob without corruption.
- **Reads (%/score/level/days) via `scoring.ts`/`progress.js`** — no re-derivation.
- **ECharts bundled, tree-shaken** (`echarts/core` + LineChart + Grid/MarkLine/Tooltip + SVGRenderer) — never a CDN (PWA/offline/CSP). Chart built with the **dataviz skill**.
- Font-scale keys `jlptN3_fsUi`/`jlptN3_fsJp` (valid 0.7–2, clamp on bump 0.8–1.8) → `--fs-ui`/`--fs-jp`; theme key `jlptN3_theme`. Every write bumps `jlptN3_updatedAt`.
- Nord Frost oku tokens only (no arbitrary colors / hardcoded type sizes); **French UI** matching `app-n3.html`.
- Existing links to `app-n3.html` (index topnav, quiz) keep working — it's the React hub now.
- SSR-safe: all `window`/ECharts/`localStorage` in effects/handlers; `renderToStaticMarkup` must not touch the DOM.
- Work on branch `entrainement-hub`; `main` stays deployable.

---

## File Structure

- `src/lib/fontscale.ts` (+ test) — read/apply/bump font scale
- `src/lib/datajson.ts` (+ test) — export/import/reset (reuses `gist.ts` `collectData`/`applyData`)
- `src/features/entrainement/ProgressChart.tsx` — ECharts diagnostic-score chart
- `src/features/entrainement/SessionLauncher.tsx`, `ResumeBanner.tsx`, `Settings.tsx`, `EntrainementHome.tsx`
- `src/EntrainementApp.tsx`, `src/entries/app-n3.tsx`
- `src/features/quiz/useQuiz.ts` (extend: read `?min`/`?resume`)
- `app-n3.html` (→ thin React shell), `sw.js`, `.github/workflows/deploy.yml`, `scripts/dev.ts`, `package.json`

---

## Task 1: fontscale.ts (TDD)

**Files:** Create `src/lib/fontscale.ts`, `src/lib/fontscale.test.ts`.
**Interfaces:** Produces `type FsKind = "Ui" | "Jp"`; `readFs(kind, store?): number` (0.8–1.8, default 1); `bumpFs(kind, dir, store?): number` (±0.1, clamp, persists `jlptN3_fs{kind}` + `jlptN3_updatedAt`, returns new value); `applyFontScale(root?, store?): void` (sets `--fs-ui`/`--fs-jp`).

- [ ] **Step 1: Write the failing test `src/lib/fontscale.test.ts`**

```ts
import { test, expect } from "bun:test";
import { readFs, bumpFs, applyFontScale } from "./fontscale.ts";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
           setItem: (k: string, v: string) => void m.set(k, v), _get: (k: string) => m.get(k) };
}

test("readFs defaults to 1 when unset or out of range", () => {
  expect(readFs("Ui", memStore())).toBe(1);
  expect(readFs("Jp", memStore({ jlptN3_fsJp: "9" }))).toBe(1);
  expect(readFs("Ui", memStore({ jlptN3_fsUi: "1.3" }))).toBe(1.3);
});

test("bumpFs steps by 0.1, clamps to [0.8,1.8], persists key + updatedAt", () => {
  const s = memStore({ jlptN3_fsUi: "1.0" });
  expect(bumpFs("Ui", +1, s)).toBe(1.1);
  expect(s._get("jlptN3_fsUi")).toBe("1.1");
  expect(typeof s._get("jlptN3_updatedAt")).toBe("string");
  const hi = memStore({ jlptN3_fsUi: "1.8" });
  expect(bumpFs("Ui", +1, hi)).toBe(1.8); // clamp high
  const lo = memStore({ jlptN3_fsJp: "0.8" });
  expect(bumpFs("Jp", -1, lo)).toBe(0.8); // clamp low
});

test("applyFontScale sets --fs-ui/--fs-jp from stored values", () => {
  const props: Record<string, string> = {};
  const root = { style: { setProperty: (k: string, v: string) => { props[k] = v; } } } as unknown as HTMLElement;
  applyFontScale(root, memStore({ jlptN3_fsUi: "1.2", jlptN3_fsJp: "1.4" }));
  expect(props["--fs-ui"]).toBe("1.2");
  expect(props["--fs-jp"]).toBe("1.4");
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/lib/fontscale.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/fontscale.ts`** (port legacy `getFs`/`applyFontScale`/`bumpFs`)

```ts
export type FsKind = "Ui" | "Jp";
const UPDATED_KEY = "jlptN3_updatedAt";

export function readFs(kind: FsKind, store: Pick<Storage, "getItem"> = globalThis.localStorage): number {
  try {
    const v = parseFloat(store.getItem("jlptN3_fs" + kind) ?? "");
    return v >= 0.7 && v <= 2 ? v : 1;
  } catch { return 1; }
}

export function bumpFs(kind: FsKind, dir: number, store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage): number {
  let v = Math.round((readFs(kind, store) + dir * 0.1) * 10) / 10;
  v = Math.max(0.8, Math.min(1.8, v));
  try { store.setItem("jlptN3_fs" + kind, String(v)); store.setItem(UPDATED_KEY, new Date().toISOString()); } catch { /* best-effort */ }
  return v;
}

export function applyFontScale(
  root: HTMLElement = document.documentElement,
  store: Pick<Storage, "getItem"> = globalThis.localStorage,
): void {
  root.style.setProperty("--fs-ui", String(readFs("Ui", store)));
  root.style.setProperty("--fs-jp", String(readFs("Jp", store)));
}
```

- [ ] **Step 4: Run — verify GREEN** — `bun test src/lib/fontscale.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/lib/fontscale.ts src/lib/fontscale.test.ts && git commit -m "Hub : échelle de police (fontscale.ts) + tests"`

---

## Task 2: datajson.ts (TDD)

**Files:** Create `src/lib/datajson.ts`, `src/lib/datajson.test.ts`.
**Interfaces:** Consumes `collectData`/`applyData` from `src/lib/gist.ts` (reuse — do NOT reimplement). Produces:
- `exportJson(store?): string` — `JSON.stringify(collectData(store, nowIso), null, 2)`. **NOTE (C1):** `collectData` (gist.ts:88) intentionally EXCLUDES `jlptN3_gh` (the GitHub token) — backups must never carry the token. The export is `{app, updatedAt, store}` over `jlptN3*` keys minus the token.
- `importJson(json: string, store?, confirmFn?): boolean` — parse; require `payload.store` is an object; `confirmFn` gate; **strip `jlptN3_gh` from `payload.store` before applying (M1 — never let an untrusted file inject a GitHub-token config)**; `applyData(store, payload)`; bump `updatedAt`; returns applied?
- `resetProgress(store?): void` — write a fresh blank `jlptN3adapt_v2` blob **matching the legacy `load()` default EXACTLY** (M3): `{ skill: blankSkills(), total:0, right:0, bestStreak:0, streak:0, wrong:[], history:[], lastDiag:null, gram:{} }` — note `gram:{}` (vanilla SRS state) MUST be included or reset would wipe/desync it. Does NOT touch theme/gist/fontscale keys.

> Read `src/lib/gist.ts` to confirm the exact `collectData`/`applyData` signatures before wiring. Verified: `collectData(store, nowIso)`, `applyData(store, payload)`, and `collectData` excludes `jlptN3_gh`.

- [ ] **Step 1: Write the failing test `src/lib/datajson.test.ts`**

```ts
import { test, expect } from "bun:test";
import { exportJson, importJson, resetProgress } from "./datajson.ts";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
           setItem: (k: string, v: string) => void m.set(k, v),
           removeItem: (k: string) => void m.delete(k),
           key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; }, _dump: () => Object.fromEntries(m) };
}

test("exportJson round-trips progress but NEVER carries the GitHub token (C1)", () => {
  const src = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 7, skill: {} }), jlptN3_theme: "dark", jlptN3_gh: JSON.stringify({ token: "SECRET" }) });
  const json = exportJson(src);
  expect(json).not.toContain("SECRET");            // token excluded by design (collectData)
  const dst = memStore();
  expect(importJson(json, dst, () => true)).toBe(true);
  expect(JSON.parse((dst as any).getItem("jlptN3adapt_v2")).total).toBe(7);
});

test("importJson strips a jlptN3_gh injected into a hostile file (M1)", () => {
  const hostile = JSON.stringify({ app: "jlpt-n3", store: { jlptN3adapt_v2: JSON.stringify({ total: 3, skill: {} }), jlptN3_gh: JSON.stringify({ token: "STOLEN" }) } });
  const dst = memStore();
  expect(importJson(hostile, dst, () => true)).toBe(true);
  expect((dst as any).getItem("jlptN3_gh")).toBeNull();   // token NOT imported
  expect(JSON.parse((dst as any).getItem("jlptN3adapt_v2")).total).toBe(3); // progress imported
});

test("importJson returns false (no write) when confirm declines", () => {
  const src = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 1, skill: {} }) });
  const dst = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 99, skill: {} }) });
  expect(importJson(exportJson(src), dst, () => false)).toBe(false);
  expect(JSON.parse((dst as any).getItem("jlptN3adapt_v2")).total).toBe(99); // unchanged
});

test("importJson returns false on malformed / missing store", () => {
  expect(importJson("{not json", memStore(), () => true)).toBe(false);
  expect(importJson(JSON.stringify({ nope: 1 }), memStore(), () => true)).toBe(false);
});

test("resetProgress writes a blank progress blob, leaves theme/gist untouched", () => {
  const s = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 50 }), jlptN3_theme: "light", jlptN3_gh: "keep" });
  resetProgress(s);
  const blob = JSON.parse((s as any).getItem("jlptN3adapt_v2"));
  expect(blob.total).toBe(0);
  expect(blob.skill.kanji).toEqual({ R: 1450, t: 0, r: 0 });
  expect(blob.gram).toEqual({});                    // M3: gram preserved in blank shape
  expect((s as any).getItem("jlptN3_theme")).toBe("light");
  expect((s as any).getItem("jlptN3_gh")).toBe("keep");
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/lib/datajson.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/lib/datajson.ts`** (reuse `gist.ts`; `resetProgress` uses `blankSkills`)

```ts
import { collectData, applyData } from "./gist.ts";
import { blankSkills } from "./elo.ts";

type Store = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem" | "key" | "length">>;
const PROGRESS_KEY = "jlptN3adapt_v2";
const UPDATED_KEY = "jlptN3_updatedAt";

export function exportJson(store: Store = globalThis.localStorage): string {
  return JSON.stringify(collectData(store as Storage, new Date().toISOString()), null, 2);
}

export function importJson(json: string, store: Store = globalThis.localStorage, confirmFn: () => boolean = () => true): boolean {
  let payload: { store?: Record<string, string> };
  try { payload = JSON.parse(json); } catch { return false; }
  if (!payload || typeof payload.store !== "object" || payload.store === null) return false;
  if (!confirmFn()) return false;
  try {
    // M1: never import a GitHub-token config from an untrusted file.
    const safe = { ...payload, store: { ...payload.store } };
    delete (safe.store as Record<string, string>).jlptN3_gh;
    applyData(store as Storage, safe as { store: Record<string, string> });
    store.setItem(UPDATED_KEY, new Date().toISOString());
    return true;
  } catch { return false; }
}

export function resetProgress(store: Store = globalThis.localStorage): void {
  // M3: mirror legacy load() default EXACTLY, incl. gram:{} (vanilla SRS state).
  const blank = { skill: blankSkills(), total: 0, right: 0, bestStreak: 0, streak: 0, wrong: [], history: [], lastDiag: null, gram: {} };
  try { store.setItem(PROGRESS_KEY, JSON.stringify(blank)); store.setItem(UPDATED_KEY, new Date().toISOString()); } catch { /* best-effort */ }
}
```

> If `collectData`/`applyData` signatures differ from `(store, nowIso)` / `(store, payload)`, adapt the calls to their actual shape (read `gist.ts`) — the behavior (backup shape, restore) must match.

- [ ] **Step 4: Run — verify GREEN** — `bun test src/lib/datajson.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/lib/datajson.ts src/lib/datajson.test.ts && git commit -m "Hub : export/import/réinitialisation des données (datajson.ts) + tests"`

---

## Task 3: quiz.html handoff — useQuiz reads `?min` / `?resume`

**Files:** Modify `src/features/quiz/useQuiz.ts`; add a test to `src/features/quiz/` (or a small `useQuiz.test.ts` for the pure param parse).
**Interfaces:** Produces a pure helper `parseSessionParams(search: string): { min?: number; resume: boolean }` (exported, tested); `useQuiz` uses it at mount to auto-start (`start` with `min`) or auto-resume (`resumeNow`).

- [ ] **Step 1: Write the failing test** (pure parser) `src/features/quiz/sessionParams.test.ts`

```ts
import { test, expect } from "bun:test";
import { parseSessionParams } from "./useQuiz.ts";

test("parses ?min=15", () => { expect(parseSessionParams("?min=15")).toEqual({ min: 15, resume: false }); });
test("parses ?resume=1", () => { expect(parseSessionParams("?resume=1")).toEqual({ resume: true }); });
test("ignores junk / clamps absurd min to 45 (allocate caps a session at 45 questions)", () => {
  expect(parseSessionParams("")).toEqual({ resume: false });
  expect(parseSessionParams("?min=abc")).toEqual({ resume: false });
  expect(parseSessionParams("?min=999").min).toBe(45); // M4: allocate() caps total at 45 (round(min*1.5)); ≥30 min already yields 45
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/features/quiz/sessionParams.test.ts` → FAIL (`parseSessionParams` not exported).

- [ ] **Step 3: Implement** — add to `src/features/quiz/useQuiz.ts`:

```ts
/** Pure parse of quiz session params from a URL query string. */
export function parseSessionParams(search: string): { min?: number; resume: boolean } {
  const p = new URLSearchParams(search);
  if (p.get("resume") === "1") return { resume: true };
  const raw = Number(p.get("min"));
  if (Number.isFinite(raw) && raw > 0) return { min: Math.min(45, Math.max(1, Math.round(raw))), resume: false };
  return { resume: false };
}
```

**C3 — fix the auto-start/auto-resume wiring (real React bugs in the earlier sketch):**
1. **`start` must take the minutes explicitly** so it doesn't depend on pending `minutes` state. Change its signature to `start(minArg?: number)` and use `const min = minArg ?? minutes;` inside (feed `allocate(masteryOf, min)`). Then a `?min=15` auto-start calls `start(15)` directly — no stale-closure bug.
2. **Auto-resume must NOT depend on the async `resume` state** (it's `null` at mount, set by a later effect). Drive it off `readResumeState()` directly.

A dedicated one-shot mount effect (separate from the resume-state effect), guarded and consume-once:
```ts
const didAutoRef = useRef(false);
useEffect(() => {
  if (didAutoRef.current || typeof window === "undefined") return;
  didAutoRef.current = true;
  const params = parseSessionParams(window.location.search);
  if (params.resume && readResumeState()) { resumeNow(); }
  else if (params.min) { setMinutes(params.min); void start(params.min); }
}, []); // run once; uses readResumeState() + start(min) directly, not the `resume`/`minutes` state
```
`?min` auto-starts a session of that length (all categories, the default selection); `?resume=1` auto-resumes only when a valid `jlptN3quiz_resume` exists; no param → unchanged `home` phase.

**C2 — record session history so the ProgressChart has a real data source.** The shipped React quiz never writes `history`, and diagnostics are deferred, so the chart would be permanently empty. In `useQuiz`'s finish path (where the session transitions to `results` — see the `next()` end-of-session branch), append a history entry mirroring legacy `finish()` (app-n3.html:971), via `writeProgress`:
```ts
// on session finish, after the last writeProgress:
const raw = readRawProgress() ?? {};
const score = dashboardModel(asProgress(raw), new Date()).sectionTotal; // estimated /180 at session end
const prevHist = Array.isArray(raw.history) ? (raw.history as unknown[]) : [];
writeProgress({ history: [...prevHist, { mode: "session", score, right: rightRef.current, n: questions.length }].slice(-40) });
```
(Import `dashboardModel` from `scoring.ts`; reuse the file's existing `asProgress`/`readRawProgress`. This gives `ProgressChart` real per-session scores.)

- [ ] **Step 4: Run — verify GREEN + full suite** — `bun test` (parser passes; existing quiz tests still green — the auto-start path only triggers with a param, never in `renderToStaticMarkup`).
- [ ] **Step 5: Commit** — `git add src/features/quiz/useQuiz.ts src/features/quiz/sessionParams.test.ts && git commit -m "Quiz : useQuiz lit ?min (démarrage direct) et ?resume (reprise auto)"`

---

## Task 4: ProgressChart (ECharts) — **load the dataviz skill first**

**Files:** `bun add echarts`; create `src/lib/history.ts` (+ test), `src/features/entrainement/ProgressChart.tsx`, `src/features/entrainement/ProgressChart.test.tsx`.
**Interfaces:** `readSessionScores(store?): number[]` (pure — reads raw `jlptN3adapt_v2.history`, returns each entry's numeric `score` in order); `ProgressChart({ scores: number[] })` — `scores` = **session** scores /180 in order (fed from `readSessionScores`; source is the history the quiz now writes — Task 3 C2). Renders a line chart (x = session index, y = 0–180) with a « seuil 95 » markLine; **empty-state** (« Au moins 2 diagnostics… ») when `scores.length < 2`.

- [ ] **Step 0: `readSessionScores` (TDD)** — create `src/lib/history.ts`:
```ts
import { readRawProgress } from "./storage.ts";
/** Session scores /180 over time, from the raw blob's history. */
export function readSessionScores(store: Pick<Storage, "getItem"> = globalThis.localStorage): number[] {
  const raw = readRawProgress(store as Storage);
  const hist = raw && Array.isArray((raw as { history?: unknown }).history) ? (raw as { history: unknown[] }).history : [];
  return hist.map((h) => (h && typeof (h as { score?: unknown }).score === "number" ? (h as { score: number }).score : NaN)).filter((n) => Number.isFinite(n));
}
```
Test (`src/lib/history.test.ts`): a store with `history:[{score:80},{score:110}]` → `[80,110]`; missing/empty history → `[]`; non-numeric scores filtered.

- [ ] **Step 1: Install ECharts** — `bun add echarts`. **Budget (M2):** after the build, check the ECharts chunk gzipped size; target **< ~180 KB**. If exceeded, reconsider a lighter option (uPlot / inline SVG) for a single line chart — note it in the report either way.
  > **Measured (2026-07-11):** tree-shaken `echarts/core` + LineChart + Grid/MarkLine/Tooltip + SVGRenderer = **~389 KB gz** — over the ~180 KB target. **Decision (user):** keep ECharts, but as a **lazy, SW-cached chunk** via the component's dynamic `import()` — the app-n3 *entry* stays ~1 KB; the ECharts weight loads only when the chart renders (scores.length ≥ 2) and is runtime-cached. **This REQUIRES `--splitting` in the production build (Task 8 Step 1)** or the dynamic imports inline back into the initial bundle.

- [ ] **Step 2: Load the dataviz skill** before writing chart code (palette, axes, legend, accessibility). Apply its guidance to the config below.

- [ ] **Step 3: Write the smoke test `src/features/entrainement/ProgressChart.test.tsx`**

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressChart } from "./ProgressChart.tsx";

test("empty-state when <2 diagnostics (SSR renders without touching ECharts/DOM)", () => {
  const html = renderToStaticMarkup(<ProgressChart scores={[]} />);
  expect(html).toContain("Au moins 2 diagnostics");
});

test("renders a chart container when there is data (no throw under SSR)", () => {
  const html = renderToStaticMarkup(<ProgressChart scores={[80, 95, 110]} />);
  expect(html).toContain("progress-chart"); // the container div; ECharts inits in useEffect only
});
```

- [ ] **Step 4: Run — verify RED** — `bun test src/features/entrainement/ProgressChart.test.tsx` → FAIL.

- [ ] **Step 5: Implement `src/features/entrainement/ProgressChart.tsx`** (tree-shaken ECharts; init/dispose in effect; SSR-safe)

```tsx
import { useEffect, useRef } from "react";

// cssVar is only ever called inside the effect (browser), so `document` is defined there (m1).
function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function ProgressChart({ scores }: { scores: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scores.length < 2 || !ref.current) return;
    let chart: { resize: () => void; dispose: () => void } | null = null;
    let onResize: (() => void) | null = null;
    let disposed = false;
    // Dynamic import → ECharts is a separate runtime-cached chunk (keeps the app-n3
    // bundle small; M2). If it can't load (offline first visit, chunk uncached) the
    // delta summary below still renders — graceful degradation.
    (async () => {
      try {
        const echarts = await import("echarts/core");
        const { LineChart } = await import("echarts/charts");
        const { GridComponent, MarkLineComponent, TooltipComponent } = await import("echarts/components");
        const { SVGRenderer } = await import("echarts/renderers");
        echarts.use([LineChart, GridComponent, MarkLineComponent, TooltipComponent, SVGRenderer]);
        if (disposed || !ref.current) return;
        chart = echarts.init(ref.current, undefined, { renderer: "svg" });
        const accent = cssVar("--color-accent", "#88c0d0");
        const ok = cssVar("--color-status-completed", "#a3be8c");
        chart.setOption({
          grid: { left: 36, right: 12, top: 12, bottom: 24 },
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: scores.map((_, i) => (i === 0 ? "1er" : i === scores.length - 1 ? "récent" : String(i + 1))) },
          yAxis: { type: "value", min: 0, max: 180 },
          series: [{
            type: "line", data: scores, smooth: true, symbolSize: 7,
            lineStyle: { color: accent, width: 2.5 }, itemStyle: { color: accent },
            markLine: { silent: true, symbol: "none", lineStyle: { color: ok, type: "dashed" },
              data: [{ yAxis: 95, label: { formatter: "seuil 95", color: ok } }] },
          }],
        });
        onResize = () => chart?.resize();
        window.addEventListener("resize", onResize);
      } catch { /* ECharts chunk unavailable (offline) → summary-only fallback */ }
    })();
    return () => { disposed = true; if (onResize) window.removeEventListener("resize", onResize); chart?.dispose(); };
  }, [scores]);

  if (scores.length < 2) {
    return <p className="text-fg-dim text-sm">Au moins 2 diagnostics sont nécessaires pour tracer la courbe. Continue !</p>;
  }
  const delta = Math.round(scores[scores.length - 1] - scores[0]);
  return (
    <div>
      <div ref={ref} className="progress-chart" style={{ width: "100%", height: 150 }} />
      <p className="text-fg-dim text-sm mt-1">
        Évolution : <b className={delta >= 0 ? "text-status-completed" : "text-status-failed"}>{delta >= 0 ? "+" : ""}{delta} pts</b> sur {scores.length} diagnostics (estimé /180).
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Run — verify GREEN + build** — `bun test src/features/entrainement/ProgressChart.test.tsx` (PASS); `bun run typecheck` (0); `bun build ./index.html --minify --outdir=_site` (confirm ECharts tree-shakes — note the chart chunk size in the report).
- [ ] **Step 7: Commit** — `git add package.json bun.lock src/features/entrainement/ProgressChart.tsx src/features/entrainement/ProgressChart.test.tsx && git commit -m "Hub : graphe de progression ECharts (diagnostics /180 + seuil 95) + tests"`

---

## Task 5: SessionLauncher + ResumeBanner (hub)

**Files:** Create `src/features/entrainement/nav.ts` (+ test), `SessionLauncher.tsx`, `ResumeBanner.tsx`, `entrainement.test.tsx`.
**Interfaces:** **Pure helpers (M5 — the real logic, unit-tested without a DOM):** `sessionHref(minutes: number): string` = `"quiz.html?min=" + clamp(minutes)`; `resumeHref(): string` = `"quiz.html?resume=1"`. `SessionLauncher()` — «J'ai [xx] minutes» chips (5/10/15) + free input, «Démarrer ma session» → `window.location.href = sessionHref(minutes)`. `ResumeBanner()` — reads `jlptN3quiz_resume`; if a valid session exists, «Reprendre ma session» (+ progress `qi+1`/`ids.length`) → `window.location.href = resumeHref()`; else renders nothing.

- [ ] **Step 0: `nav.ts` (TDD)** — pure href builders:
```ts
export function sessionHref(minutes: number): string {
  const m = Math.min(45, Math.max(1, Math.round(minutes) || 10));
  return "quiz.html?min=" + m;
}
export function resumeHref(): string { return "quiz.html?resume=1"; }
```
Test (`nav.test.ts`): `sessionHref(15) === "quiz.html?min=15"`; `sessionHref(999) === "quiz.html?min=45"`; `sessionHref(NaN) === "quiz.html?min=10"`; `resumeHref() === "quiz.html?resume=1"`.

- [ ] **Step 1: Write the failing smoke test `src/features/entrainement/entrainement.test.tsx`**

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionLauncher } from "./SessionLauncher.tsx";

test("SessionLauncher shows the minutes prompt and start button", () => {
  const html = renderToStaticMarkup(<SessionLauncher />);
  expect(html).toContain("minutes");
  expect(html).toContain("Démarrer ma session");
});
```

- [ ] **Step 2: Run — verify RED** — `bun test src/features/entrainement/entrainement.test.tsx` → FAIL.

- [ ] **Step 3: Implement both components** — SSR-safe (navigation + `localStorage` read in handlers/effects). `SessionLauncher`: local `minutes` state (default 10, chips 5/10/15 + number input), «Démarrer ma session» button → `location.href = "quiz.html?min=" + minutes`. `ResumeBanner`: a mount effect reads `jlptN3quiz_resume` (guarded) into state; if present, render the banner with progress and a «Reprendre ma session» link to `quiz.html?resume=1`; the pure render returns `null` when no resume (so SSR test doesn't need localStorage). Nord Frost tokens; French wording.

- [ ] **Step 4: Run — verify GREEN** — `bun test src/features/entrainement/entrainement.test.tsx` → PASS.
- [ ] **Step 5: Commit** — `git add src/features/entrainement/SessionLauncher.tsx src/features/entrainement/ResumeBanner.tsx src/features/entrainement/entrainement.test.tsx && git commit -m "Hub : lanceur de session (J'ai xx minutes) + reprise → quiz.html"`

---

## Task 6: Settings

**Files:** Create `src/features/entrainement/Settings.tsx`; extend `entrainement.test.tsx`.
**Interfaces:** `Settings({ theme, onToggleTheme })` — font-scale ± controls (UI/JP, via `bumpFs` + `applyFontScale`), theme toggle (reuse `useTheme` values passed in), and export / import (file) / reset buttons (via `datajson.ts`, with `confirm`). Pure-view where possible; side effects in handlers.

- [ ] **Step 1: Write the failing test** — extend `entrainement.test.tsx`:

```tsx
import { Settings } from "./Settings.tsx";
test("Settings renders font-scale, theme, and data controls", () => {
  const html = renderToStaticMarkup(<Settings theme="dark" onToggleTheme={() => {}} />);
  expect(html).toContain("Police");
  expect(html).toContain("Exporter");
  expect(html).toContain("Réinitialiser");
});
```

- [ ] **Step 2: Run — verify RED**, then **Step 3: implement** `Settings.tsx` (font ± calls `bumpFs("Ui"/"Jp", ±1)` then `applyFontScale()`; « Exporter » downloads `exportJson()` as `jlpt-n3-backup.json`; « Importer » reads a file → `importJson(text, undefined, () => confirm("Remplacer la progression actuelle ?"))`; « Réinitialiser » → `if (confirm("Effacer tout ?")) resetProgress()`; theme toggle uses the passed `onToggleTheme`). French labels per legacy. **Step 4: GREEN**, **Step 5: commit** `git add src/features/entrainement/Settings.tsx src/features/entrainement/entrainement.test.tsx && git commit -m "Hub : réglages (police, thème, export/import/réinitialisation)"`.

> **Added during Task 6 (pre-commit review gate, user-approved):** the SSR smoke test alone didn't satisfy the review — the side-effecting handlers needed behavioral coverage. Introduced the project's **first DOM test infra**: devDep `@happy-dom/global-registrator` + `happydom.ts` preloaded via `bunfig.toml [test]`, and `Settings.handlers.test.tsx` (createRoot + `act`) asserting: font A+/A− persists `jlptN3_fs{Ui,Jp}` + applies `--fs-{ui,jp}` live; `Réinitialiser`/`Importer` are confirm-gated (declined ⇒ no write). Verified all pre-existing tests stay green under the global DOM (no blast radius). Also hardened the import call site (named `confirmReplace` + comment) and applied a11y/anchor/DRY minors.

---

## Task 7: EntrainementHome + EntrainementApp + app-n3.html shell

**Files:** Create `src/features/entrainement/EntrainementHome.tsx`, `src/EntrainementApp.tsx`, `src/entries/app-n3.tsx`, `src/EntrainementApp.test.tsx`; **replace** `app-n3.html` with a thin shell.
**Interfaces:** `EntrainementApp` composes the shell (`Header`/`TopNav`) + `EntrainementHome`. `EntrainementHome` = progress overview (jauge + stats via `dashboardModel(progress, now)`) + `ProgressChart` (scores from `readSessionScores()` — Task 4; NOT from a non-existent typed `history` field) + `ResumeBanner` + `SessionLauncher` + deferred stubs («Diagnostic»/«Apprendre»/«Réviser les erreurs» → «bientôt disponible») + `Settings` + the reused `SyncSection`. `EntrainementApp` also runs a mount effect: `applyFontScale()` and `window.initDefs?.({ singleTap: true })`.

- [ ] **Step 1: Replace `app-n3.html`** with the thin shell (mirror `quiz.html`):

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Entraînement — JLPT N3</title>
<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#2e3440">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="JLPT N3">
<link rel="apple-touch-icon" href="icon-180.png">
<script>(function(){try{var t=localStorage.getItem('jlptN3_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();</script>
<script src="dict.js"></script>
</head>
<body><div id="root"></div><script type="module" src="./src/entries/app-n3.tsx"></script></body>
</html>
```

- [ ] **Step 2: Create `src/entries/app-n3.tsx`** (mirror `quiz.tsx`, mount `EntrainementApp`, import `styles.gen.css`).
- [ ] **Step 3: Write `src/EntrainementApp.test.tsx`** — a pure `EntrainementAppView` composed-render smoke test (progress stats + «Démarrer ma session» + «bientôt» stubs render; no data → empty-state chart).
- [ ] **Step 4: Implement `EntrainementHome.tsx` + `EntrainementApp.tsx`** (`EntrainementAppView` pure + `EntrainementApp` wiring `useProgress`/`useTheme`/`useServiceWorker` + the `applyFontScale`/`initDefs` mount effect). Run tests → PASS.
- [ ] **Step 5: Verify** — `bun test` (all green), `bun run typecheck` (0), `bun build ./index.html ./quiz.html ./app-n3.html --minify --outdir=_site` (all 3 entries).
- [ ] **Step 6: Commit** — `git add src/features/entrainement/EntrainementHome.tsx src/EntrainementApp.tsx src/entries/app-n3.tsx src/EntrainementApp.test.tsx app-n3.html && git commit -m "Hub : EntrainementHome + App + coquille app-n3.html (remplace le vanilla)"`

---

## Task 8: build / dev / deploy / SW wiring

**Files:** Modify `package.json`, `scripts/dev.ts`, `.github/workflows/deploy.yml`, `sw.js`.

- [ ] **Step 1: `package.json`** — `"build": "bun run css -- --minify && bun build ./index.html ./quiz.html ./app-n3.html --minify --splitting --outdir=_site"`. **`--splitting` is REQUIRED** (M2 decision, Task 4 Step 1): it keeps ECharts in lazy, runtime-cached chunks instead of inlining ~389 KB gz into app-n3's initial bundle. Confirm after building that the ECharts weight lives in separate hashed chunks, not the app-n3 entry.
- [ ] **Step 2: `scripts/dev.ts`** — add `import appn3 from "../app-n3.html";` + `"/app-n3.html": appn3` to `routes`; **remove** `"/app-n3.html"` from the `STATIC_FILES` allowlist (it's a React entry now, not a static vanilla file).
- [ ] **Step 3: `.github/workflows/deploy.yml`** — `bun run build` now emits all 3 HTML; **remove `app-n3.html` from the `cp` line** (keep `cours-n3.html planning-n3.html` + assets + `data/`).
- [ ] **Step 4: `sw.js`** — bump `CACHE` (v82 → v83). `app-n3.html` stays in `SHELL` (still a served URL). The hashed ECharts chunk is runtime-cached (leave out of precache).
- [ ] **Step 5: Verify full artifact** — `bun run build && mkdir -p _site/data && cp data/bank-*.json data/bank-index.json _site/data/ && cp cours-n3.html planning-n3.html theme.css progress.js dict.js vocab-data.js manifest.webmanifest sw.js icon-*.png _site/ && ls _site/app-n3.html _site/quiz.html _site/index.html && echo OK` (all 3 React pages present; `app-n3.html` NOT double-copied from vanilla).
- [ ] **Step 6: Verify (manual, controller)** — serve `_site`, load `/app-n3.html`: progress renders, «Démarrer ma session» → `quiz.html?min=…` starts a session, «Reprendre» works, settings apply, «bientôt» stubs show. (Browser — controller/user.)
- [ ] **Step 7: Commit** — `git add package.json scripts/dev.ts .github/workflows/deploy.yml sw.js && git commit -m "Hub : câblage build/dev/déploiement/SW (app-n3.html = 3e entrée React)"`

---

## Self-Review

**1. Spec coverage:** progress overview (Task 7 via scoring.ts); ECharts chart + empty-state (Task 4); session launcher «J'ai xx min» + resume → quiz.html (Tasks 3/5); settings font/theme/export/import/reset (Tasks 1/2/6); Gist SyncSection reused (Task 7); app-n3.html replaced + deferred stubs (Tasks 7/8); ECharts bundled tree-shaken + dataviz (Task 4); links preserved (shell keeps the URL). ✓
**2. Placeholders:** Tasks 1–4 carry complete code + tests; Tasks 5–7 carry complete tests + precise behavior specs (UI porting from `app-n3.html`, cited); Task 8 concrete edits. The `datajson.ts` step flags verifying `gist.ts` signatures. No silent TODOs.
**3. Type consistency:** `readFs`/`bumpFs`/`applyFontScale` (T1) used in Settings (T6); `exportJson`/`importJson`/`resetProgress` (T2) in Settings (T6); `parseSessionParams` (T3) in useQuiz; `ProgressChart({scores})` (T4) in EntrainementHome (T7) fed from `readSessionScores()` (T4, reading the session history the quiz writes in T3 — not a non-existent typed `history` field); `dashboardModel`/`masteryOf` (scoring.ts) reused. Font keys `jlptN3_fsUi/Jp`, resume key `jlptN3quiz_resume` consistent throughout.
**4. Ambiguity:** the `datajson`↔`gist.ts` signature coupling is the one spot needing a read of `gist.ts` first (flagged in Task 2); the chart's exact ECharts styling is deferred to the dataviz skill (Task 4 Step 2), bounded by the empty-state + markLine tests.

---

## Risques / différé (suite à la revue auto)

Les points ci-dessous sont **assumés hors périmètre de cette tranche** ; ils sont notés pour la tranche diagnostic/SRS afin qu'aucune décision implicite ne se perde.

- **D1 — Réconciliation `history`/`lastDiag` au portage diagnostic.** Le graphe trace ici les **scores de session** (`readSessionScores`, `mode:"session"`), pas les diagnostics (`mode:"diagnostic"`), qui n'existent pas encore en React. Quand la tranche diagnostic sera portée depuis `git show <commit>:app-n3.html`, il faudra : (a) réécrire `ProgressChart` pour filtrer/superposer `diagnostic` vs `session` (le legacy filtrait `mode==='diagnostic'`), et (b) restaurer l'écriture de `lastDiag` + l'entrée `history{mode:'diagnostic',score,p,right,n}` que le quiz React n'émet pas. La forme de l'entrée `history` reste **compatible legacy** (mêmes clés) pour ne pas casser la lecture vanilla ni la sync Gist.
- **D2 — Clés de reprise séparées.** La reprise du hub lit `jlptN3quiz_resume` (écrit par le quiz React). Le SRS/diagnostic vanilla utilisaient d'autres clés de session ; à leur portage, documenter/segmenter l'espace de clés `jlptN3*` pour éviter qu'une reprise de quiz et une reprise de diagnostic se marchent dessus.
- **D3 — Poids ECharts à revérifier.** **Mesuré (2026-07-11) : ~389 Ko gz** pour `echarts/core` + LineChart + Grid/MarkLine/Tooltip + SVGRenderer — **au-dessus** de la cible ~180 Ko. **Décision (utilisateur) : garder ECharts** (des graphes supplémentaires viendront dans une tranche ultérieure, ce qui amortit le coût), mais en **chunk paresseux SW-caché** via l'`import()` dynamique du composant + `--splitting` au build (Task 8 Step 1) : l'entrée app-n3 reste ~1 Ko, le poids ECharts ne se charge qu'à l'affichage du graphe (scores ≥ 2) puis est runtime-caché. Si une tranche future ajoute d'autres types de graphe (barres, heatmap), chaque `echarts.use([...])` supplémentaire alourdit le chunk — re-mesurer. Le SW runtime-cache les chunks hashés — purger l'ancien au bump `CACHE` (m3).
- **D5 — `dict.js` (120 Ko de données inline) était bundlé dans CHAQUE entrée React — RÉSOLU 2026-07-11.** **Diagnostic initial ERRONÉ** (« bun supprime `<script src="dict.js">` → `initDefs` undefined en prod ») : en réalité le bundler HTML de `bun build` **bundle** le `<script src="dict.js">` classique dans le chunk JS de l'entrée (il retire la balise du HTML mais **exécute** le code — `window.initDefs`/`furi`/`visualBreak` étaient bien définis en prod ; **le tap-pour-définir n'a jamais été cassé**). Le vrai problème (soulevé par l'utilisateur) : `dict.js` (135 Ko, dont ~120 Ko de données) était bundlé dans `quiz.html` ET `app-n3.html`, à l'encontre du principe « données via JSON au runtime ». **Correctif appliqué :** balise `<script src="dict.js">` retirée de `quiz.html` + `app-n3.html` ; le hub ne charge plus rien (UI 100 % française) ; le quiz utilise `src/lib/dict.ts` (logique portée de `dict.js`, ~15 Ko) qui `fetch("data/dict.json")` au runtime + expose `window.furi/visualBreak/initDefs`. `data/dict.json` ajouté au déploiement + dev + SW (v84). Pages vanilla `cours-n3`/`planning-n3` inchangées (gardent `dict.js` inline). Voir [[bun-bundles-html-script-tags]].
- **D4 — Handoff hub → quiz non couvert e2e.** Les helpers `sessionHref`/`resumeHref` (T5) et la lecture `?min`/`?resume` (T3) sont testés **des deux côtés séparément** (unit sur les builders, unit sur `parseSessionParams`), mais aucun test ne parcourt le trajet complet hub→`quiz.html`→session démarrée. Vérification manuelle au Task 8 Step 6 (navigateur, contrôleur). Un vrai e2e (Playwright/bun) est différé — noté pour quand une tranche introduira un harnais e2e.

### Notes mineures pour l'implémenteur (non bloquantes)

- **m2 — asymétrie `readFs` vs `bumpFs`.** `readFs` lit sans re-borner (valeur déjà en storage) ; `bumpFs` borne 0.8–1.8. C'est le comportement legacy fidèle — **ne pas** ajouter de clamp dans `readFs` (une valeur legacy hors bornes doit rester lisible telle quelle).
- **m3 — chunks ECharts périmés dans le SW.** Au bump `CACHE` (v82→v83, Task 8), les anciens chunks hashés restent en runtime-cache jusqu'à éviction. Acceptable (URL hashées, jamais servies périmées) ; ne pas précacher les chunks ECharts.
- **m4 — imports en double dans `entrainement.test.tsx`.** Tasks 5 et 6 étendent le **même** fichier ; l'implémenteur de Task 6 doit **ajouter** son import `Settings` sans redéclarer `test`/`expect`/`renderToStaticMarkup` déjà importés par Task 5.
