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
- `exportJson(store?): string` — `JSON.stringify(collectData(store), null, 2)` (the `{app,updatedAt,store}` backup shape).
- `importJson(json: string, store?, confirmFn?): boolean` — parse; require `payload.store`; `confirmFn` gate; `applyData(store, payload)`; bump `updatedAt`; returns applied?
- `resetProgress(store?): void` — write a fresh blank `jlptN3adapt_v2` blob (does NOT touch theme/gist/fontscale keys).

> Read `src/lib/gist.ts` to confirm the exact `collectData`/`applyData` signatures before wiring.

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

test("exportJson round-trips through importJson, preserving progress keys", () => {
  const src = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 7, skill: {} }), jlptN3_theme: "dark", jlptN3_gh: "SECRET" });
  const json = exportJson(src);
  const dst = memStore();
  expect(importJson(json, dst, () => true)).toBe(true);
  expect(JSON.parse(dst._get?.("jlptN3adapt_v2") ?? (dst as any).getItem("jlptN3adapt_v2")).total).toBe(7);
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
  if (!payload || typeof payload.store !== "object") return false;
  if (!confirmFn()) return false;
  try {
    applyData(store as Storage, payload as { store: Record<string, string> });
    store.setItem(UPDATED_KEY, new Date().toISOString());
    return true;
  } catch { return false; }
}

export function resetProgress(store: Store = globalThis.localStorage): void {
  const blank = { skill: blankSkills(), total: 0, right: 0, bestStreak: 0, streak: 0, wrong: [], history: [], lastDiag: null };
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
test("ignores junk / clamps absurd min", () => {
  expect(parseSessionParams("")).toEqual({ resume: false });
  expect(parseSessionParams("?min=abc")).toEqual({ resume: false });
  expect(parseSessionParams("?min=999").min).toBe(60); // clamp to a sane max
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
  if (Number.isFinite(raw) && raw > 0) return { min: Math.min(60, Math.max(1, Math.round(raw))), resume: false };
  return { resume: false };
}
```

Then in `useQuiz`'s mount effect (browser-only, after the resume state is read), add:
```ts
const params = parseSessionParams(typeof window !== "undefined" ? window.location.search : "");
if (params.resume && /* a valid resume exists */) { resumeNow(); }
else if (params.min) { setMinutes(params.min); start(/* using params.min */); }
```
(Wire it so `?min` auto-starts a session of that length with all categories selected, and `?resume=1` auto-resumes when a valid `jlptN3quiz_resume` is present; no param → unchanged `home` phase. Keep it in the existing mount effect, SSR-guarded.)

- [ ] **Step 4: Run — verify GREEN + full suite** — `bun test` (parser passes; existing quiz tests still green — the auto-start path only triggers with a param, never in `renderToStaticMarkup`).
- [ ] **Step 5: Commit** — `git add src/features/quiz/useQuiz.ts src/features/quiz/sessionParams.test.ts && git commit -m "Quiz : useQuiz lit ?min (démarrage direct) et ?resume (reprise auto)"`

---

## Task 4: ProgressChart (ECharts) — **load the dataviz skill first**

**Files:** `bun add echarts`; create `src/features/entrainement/ProgressChart.tsx`, `src/features/entrainement/ProgressChart.test.tsx`.
**Interfaces:** `ProgressChart({ scores: number[] })` — `scores` = diagnostic scores /180 in order. Renders an ECharts line chart (x = diagnostic index, y = 0–180) with a « seuil 95 » markLine; **empty-state** (« Au moins 2 diagnostics… ») when `scores.length < 2`.

- [ ] **Step 1: Install ECharts (tree-shaken usage)** — `bun add echarts`

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
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
echarts.use([LineChart, GridComponent, MarkLineComponent, TooltipComponent, SVGRenderer]);

function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function ProgressChart({ scores }: { scores: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scores.length < 2 || !ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
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
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); chart.dispose(); };
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

**Files:** Create `src/features/entrainement/SessionLauncher.tsx`, `ResumeBanner.tsx`, `entrainement.test.tsx`.
**Interfaces:** `SessionLauncher()` — «J'ai [xx] minutes» chips (5/10/15) + free input, «Démarrer ma session» → sets `window.location.href = "quiz.html?min=" + minutes`. `ResumeBanner()` — reads `jlptN3quiz_resume`; if a valid session exists, «Reprendre ma session» (+ progress `qi+1`/`ids.length`) → `quiz.html?resume=1`; else renders nothing.

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

---

## Task 7: EntrainementHome + EntrainementApp + app-n3.html shell

**Files:** Create `src/features/entrainement/EntrainementHome.tsx`, `src/EntrainementApp.tsx`, `src/entries/app-n3.tsx`, `src/EntrainementApp.test.tsx`; **replace** `app-n3.html` with a thin shell.
**Interfaces:** `EntrainementApp` composes the shell (`Header`/`TopNav`) + `EntrainementHome`. `EntrainementHome` = progress overview (jauge + stats via `dashboardModel(progress, now)`) + `ProgressChart` (scores from `S.history.filter(mode==='diagnostic').map(p=>p.score)`) + `ResumeBanner` + `SessionLauncher` + deferred stubs («Diagnostic»/«Apprendre»/«Réviser les erreurs» → «bientôt disponible») + `Settings` + the reused `SyncSection`. `EntrainementApp` also runs a mount effect: `applyFontScale()` and `window.initDefs?.({ singleTap: true })`.

- [ ] **Step 1: Replace `app-n3.html`** with the thin shell (mirror `quiz.html`):

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Entraînement — JLPT N3</title>
<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#2e3440">
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

- [ ] **Step 1: `package.json`** — `"build": "bun run css -- --minify && bun build ./index.html ./quiz.html ./app-n3.html --minify --outdir=_site"`.
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
**3. Type consistency:** `readFs`/`bumpFs`/`applyFontScale` (T1) used in Settings (T6); `exportJson`/`importJson`/`resetProgress` (T2) in Settings (T6); `parseSessionParams` (T3) in useQuiz; `ProgressChart({scores})` (T4) in EntrainementHome (T7) fed from `S.history`; `dashboardModel`/`masteryOf` (scoring.ts) reused. Font keys `jlptN3_fsUi/Jp`, resume key `jlptN3quiz_resume` consistent throughout.
**4. Ambiguity:** the `datajson`↔`gist.ts` signature coupling is the one spot needing a read of `gist.ts` first (flagged in Task 2); the chart's exact ECharts styling is deferred to the dataviz skill (Task 4 Step 2), bounded by the empty-state + markLine tests.
