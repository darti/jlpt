# Dashboard (index.html) → React + Bun — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `index.html`'s hand-written dashboard with a React + TypeScript app bundled by Bun and styled with vendored oku-ui tokens, preserving the exact look, the localStorage contract, and the PWA — as the first strangler slice.

**Architecture:** Multi-entry (only `index.html` this slice). Bun bundles the TSX; the `@tailwindcss/cli` watcher compiles a vendored oku-ui token layer into a generated stylesheet. Pure domain logic (`scoring`, `storage`, `theme`) is extracted and TDD'd; React components are thin and smoke-tested via `renderToStaticMarkup` (no DOM harness needed). The other three pages stay vanilla and untouched.

**Tech Stack:** Bun (runtime/bundler/test), React 19 + TypeScript, Tailwind v4 (`@tailwindcss/cli`), oku-ui semantic tokens (vendored).

## Global Constraints

- **bun exclusively — never `node`.** All commands use `bun` / `bunx`.
- **localStorage contract unchanged:** `jlptN3adapt_v2` (progress, shape `{ total:number, skill:{ [cat]:{ R:number } } }`), `jlptN3_theme` (`'light'|'dark'`), `jlptN3_updatedAt` (ISO string).
- **Scoring math identical to current `index.html`** (constants: `PASS=1600`, `EXAM=2026-12-06T09:00:00` local).
- **Styling:** semantic oku tokens only — **no** built-in palette classes (`bg-gray-*`), **no** arbitrary colors (`bg-[#…]`), **no** hardcoded typography sizes (`text-[13px]`). Add a token first.
- **French UI**, identical wording to the current page.
- App stays shippable; `main` stays deployable (work on branch `react-bun-migration`).
- Tests are side-by-side `*.test.ts(x)`; run with `bun test`.

---

## File Structure

- `package.json`, `tsconfig.json`, `.gitignore`, `scripts/dev.ts` — toolchain
- `src/styles/tailwind.css` — vendored oku token layer (`@import "tailwindcss"` + `@theme` + `@utility` shims), git-tracked
- `src/styles/themes.css` — jlpt Nord values mapped onto oku token names, `[data-theme]` blocks, git-tracked
- `src/styles/styles.gen.css` — Tailwind output, **git-ignored**
- `src/types/progress.ts` — `Skill`, `SKILLS`, `Progress`
- `src/lib/scoring.ts` — pure adaptive-engine math + `dashboardModel()`
- `src/lib/storage.ts` — typed localStorage read of `jlptN3adapt_v2`
- `src/lib/theme.ts` — pure theme read/write/apply/toggle
- `src/lib/pwa.ts` — SW registration + update state (pure state machine + thin glue)
- `src/hooks/useTheme.ts`, `src/hooks/usePwa.ts`, `src/features/dashboard/useProgress.ts`
- `src/ui/Header.tsx`, `src/ui/TopNav.tsx`, `src/ui/Footer.tsx`, `src/ui/UpdateBanner.tsx`
- `src/features/dashboard/Dashboard.tsx`, `src/features/dashboard/InstallPrompt.tsx`
- `src/App.tsx`, `src/entries/index.tsx`
- `index.html` — rewritten to a thin shell
- `sw.js`, `.github/workflows/deploy.yml` — PWA + deploy updates

---

## Task 1: Bootstrap toolchain + vendored token layer

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `scripts/dev.ts`
- Create: `src/styles/tailwind.css`, `src/styles/themes.css`
- Create: `src/entries/index.tsx`, `src/App.tsx`
- Modify: `index.html` (thin shell)
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `App` (default React component, renders `<h1>` placeholder for now); npm scripts `dev`/`build`/`test`/`typecheck`/`css`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "jlpt-n3",
  "private": true,
  "type": "module",
  "scripts": {
    "css": "bunx @tailwindcss/cli -i src/styles/tailwind.css -o src/styles/styles.gen.css",
    "dev": "bun run scripts/dev.ts",
    "build": "bun run css -- --minify && bun build ./index.html --minify --outdir=_site",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/cli": "^4.2.4",
    "tailwindcss": "^4.2.4",
    "@types/bun": "latest",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun", "react", "react-dom"]
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Create `.gitignore` additions**

```
node_modules/
_site/
src/styles/styles.gen.css
```

- [ ] **Step 4: Vendor the oku token layer**

Copy oku-ui's token stylesheet verbatim (it is already clean — tokens + `@utility` shims + base reset, no app-specific rules):

```bash
cp ~/Projects/darticorp/oku-theory/oku-ui/packages/ui/src/styles.css src/styles/tailwind.css
```

Then append an `@source` + import of the theme blocks at the top of `src/styles/tailwind.css` (just under the existing `@import "tailwindcss";`):

```css
@import "tailwindcss";
@import "./themes.css";
@source "../";
@source "../../index.html";
```

Add the four skill-color tokens inside the existing `@theme { … }` block (so `bg-skill-*` / `text-skill-*` utilities generate):

```css
  --color-skill-grammaire: #81a1c1;
  --color-skill-vocabulaire: #88c0d0;
  --color-skill-kanji: #ebcb8b;
  --color-skill-lecture: #a3be8c;
```

- [ ] **Step 5: Create `src/styles/themes.css`** (jlpt Nord values → oku token names)

```css
/* jlpt Nord Frost look, expressed as oku semantic tokens.
   Dark is the default (:root); light overrides via [data-theme="light"].
   Values copied from the legacy theme.css semantic layer. */
:root,
:root[data-theme="dark"] {
  --color-bg: #2e3440;                        /* nord0 */
  --color-panel: rgba(59, 66, 82, 0.48);      /* nord1 .48 */
  --color-panel-2: rgba(67, 76, 94, 0.44);    /* nord2 .44 */
  --color-surface: rgba(59, 66, 82, 0.48);
  --color-surface-2: rgba(67, 76, 94, 0.44);
  --color-line: rgba(236, 239, 244, 0.07);    /* nord6 .07 */
  --color-line-soft: rgba(236, 239, 244, 0.07);
  --color-line-hi: rgba(236, 239, 244, 0.14);
  --color-fg: #eceff4;                         /* nord6 */
  --color-fg-dim: rgba(236, 239, 244, 0.62);
  --color-fg-soft: rgba(236, 239, 244, 0.62);
  --color-fg-muted: rgba(236, 239, 244, 0.45);
  --color-fg-on-accent: #eceff4;
  --color-accent: #88c0d0;                     /* nord8 (accent2 / bright) */
  --color-accent-hi: #8fbcbb;                  /* nord7 */
  --color-status-completed: #a3be8c;           /* nord14 = ok */
  --color-status-failed: #bf616a;              /* nord11 = bad */
  --color-prio-high: #ebcb8b;                  /* nord13 = warn */
  color-scheme: dark;
}

:root[data-theme="light"] {
  --color-bg: #eceff4;                         /* nord6 */
  --color-panel: rgba(255, 255, 255, 0.55);
  --color-panel-2: rgba(229, 233, 240, 0.60);  /* nord5 .60 */
  --color-surface: rgba(255, 255, 255, 0.55);
  --color-surface-2: rgba(229, 233, 240, 0.60);
  --color-line: rgba(46, 52, 64, 0.08);        /* nord0 .08 */
  --color-line-soft: rgba(46, 52, 64, 0.08);
  --color-line-hi: rgba(46, 52, 64, 0.14);
  --color-fg: #2e3440;                          /* nord0 */
  --color-fg-dim: rgba(46, 52, 64, 0.62);
  --color-fg-soft: rgba(46, 52, 64, 0.62);
  --color-fg-muted: rgba(46, 52, 64, 0.45);
  --color-fg-on-accent: #ffffff;
  --color-accent: #5e81ac;                      /* nord10 */
  --color-accent-hi: #5e81ac;
  --color-status-completed: #5e8c4f;            /* darkened for light contrast */
  --color-status-failed: #b04a52;
  --color-prio-high: #a9882f;
  --color-skill-grammaire: #5e81ac;
  --color-skill-vocabulaire: #5e81ac;
  --color-skill-kanji: #a9882f;
  --color-skill-lecture: #5e8c4f;
  color-scheme: light;
}
```

- [ ] **Step 6: Create `src/App.tsx` (placeholder)**

```tsx
export default function App() {
  return <h1 className="text-fg text-xl p-4">JLPT N3</h1>;
}
```

- [ ] **Step 7: Create `src/entries/index.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../App.tsx";
import "../styles/styles.gen.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
```

- [ ] **Step 8: Rewrite `index.html` to a thin shell**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JLPT N3 — Préparation</title>
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#2e3440">
<link rel="apple-touch-icon" href="icon-180.png">
<script>(function(){try{var t=localStorage.getItem('jlptN3_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();</script>
</head>
<body>
<div id="root"></div>
<script type="module" src="./src/entries/index.tsx"></script>
</body>
</html>
```

- [ ] **Step 9: Create `scripts/dev.ts`**

```ts
// Runs the Tailwind CLI watcher + Bun's HTML dev server together.
// (bun-plugin-tailwind is incompatible with Bun's runtime bundler — the CLI is the working path.)
await Bun.spawn(
  ["bunx", "@tailwindcss/cli", "-i", "src/styles/tailwind.css", "-o", "src/styles/styles.gen.css"],
  { stdout: "inherit", stderr: "inherit" },
).exited; // one-shot build first so the generated CSS exists

const css = Bun.spawn(
  ["bunx", "@tailwindcss/cli", "-i", "src/styles/tailwind.css", "-o", "src/styles/styles.gen.css", "--watch=always"],
  { stdout: "inherit", stderr: "inherit" },
);
const app = Bun.spawn(["bun", "./index.html"], { stdout: "inherit", stderr: "inherit" });
process.on("SIGINT", () => { css.kill(); app.kill(); process.exit(0); });
await Promise.race([css.exited, app.exited]);
```

- [ ] **Step 10: Install and write the smoke test `src/App.test.tsx`**

```bash
bun install
```

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App.tsx";

test("App renders the title", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("JLPT N3");
});
```

- [ ] **Step 11: Run the smoke test — verify it passes**

Run: `bun test src/App.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 12: Verify the production build works**

Run: `bun run build`
Expected: exits 0; `_site/index.html` exists and references a hashed JS + CSS asset.
Run: `test -f _site/index.html && echo OK`
Expected: `OK`.

- [ ] **Step 13: Commit**

```bash
git add package.json tsconfig.json .gitignore scripts/ src/ index.html
git commit -m "Tranche 1 : bootstrap Bun + React + tokens oku-ui (coquille index.html)"
```

---

## Task 2: Domain types + scoring engine (TDD)

**Files:**
- Create: `src/types/progress.ts`
- Create: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Skill = 'grammaire'|'vocabulaire'|'kanji'|'lecture'`; `const SKILLS: Skill[]`
  - `interface Progress { total: number; skill: Record<Skill, { R: number }> }`
  - `mastery(rating: number): number`
  - `interface DashboardModel { answers:number; passPct:number; sectionTotal:number; level:string; days:number; confidence:number; skillMastery:Record<Skill,number>; hasEnough:boolean }`
  - `dashboardModel(p: Progress, now: Date): DashboardModel`
  - `daysUntilExam(now: Date): number`
  - `const PASS_RATING: number`, `const EXAM_DATE: Date`

- [ ] **Step 1: Create `src/types/progress.ts`**

```ts
export type Skill = "grammaire" | "vocabulaire" | "kanji" | "lecture";
export const SKILLS: Skill[] = ["grammaire", "vocabulaire", "kanji", "lecture"];
export interface Progress {
  total: number;
  skill: Record<Skill, { R: number }>;
}
```

- [ ] **Step 2: Write the failing test `src/lib/scoring.test.ts`**

```ts
import { test, expect } from "bun:test";
import type { Progress } from "../types/progress.ts";
import { mastery, dashboardModel, daysUntilExam } from "./scoring.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R }, vocabulaire: { R }, kanji: { R }, lecture: { R } },
});

test("mastery at the pass rating is 0.5", () => {
  expect(mastery(1600)).toBeCloseTo(0.5, 10);
});

test("dashboardModel for all-1600 / 60 answers", () => {
  const m = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  expect(m.answers).toBe(60);
  expect(m.passPct).toBe(17);
  expect(m.sectionTotal).toBe(86);
  expect(m.level).toBe("N3-");
  expect(m.confidence).toBeCloseTo(1, 10);
  expect(m.skillMastery.kanji).toBeCloseTo(0.5, 10);
  expect(m.hasEnough).toBe(true);
});

test("hasEnough is false under 5 answers", () => {
  const p = flat(1600); p.total = 3;
  expect(dashboardModel(p, new Date("2026-07-10T00:00:00")).hasEnough).toBe(false);
});

test("daysUntilExam counts down and floors at 0", () => {
  expect(daysUntilExam(new Date("2026-07-10T00:00:00"))).toBe(150);
  expect(daysUntilExam(new Date("2027-01-01T00:00:00"))).toBe(0);
});
```

- [ ] **Step 3: Run the test — verify it fails**

Run: `bun test src/lib/scoring.test.ts`
Expected: FAIL ("Cannot find module './scoring.ts'").

- [ ] **Step 4: Implement `src/lib/scoring.ts`**

```ts
import type { Progress, Skill } from "../types/progress.ts";
import { SKILLS } from "../types/progress.ts";

export const PASS_RATING = 1600;
export const EXAM_DATE = new Date("2026-12-06T09:00:00");
const MS_PER_DAY = 864e5;

/** Elo→probability mastery for one rating (0..1). */
export function mastery(rating: number): number {
  return 1 / (1 + Math.pow(10, (PASS_RATING - rating) / 400));
}

export function daysUntilExam(now: Date): number {
  return Math.max(0, Math.ceil((EXAM_DATE.getTime() - now.getTime()) / MS_PER_DAY));
}

function level(avgRating: number): string {
  return avgRating < 1400 ? "N4-"
    : avgRating < 1520 ? "N4+"
    : avgRating < 1620 ? "N3-"
    : avgRating < 1720 ? "N3" : "N3+";
}

export interface DashboardModel {
  answers: number;
  passPct: number;
  sectionTotal: number;
  level: string;
  days: number;
  confidence: number;
  skillMastery: Record<Skill, number>;
  hasEnough: boolean;
}

export function dashboardModel(p: Progress, now: Date): DashboardModel {
  const m = (c: Skill) => mastery(p.skill[c].R);
  const lang = (m("vocabulaire") + m("kanji")) / 2;
  const gram = (m("grammaire") + m("lecture")) / 2;
  const list = 0.85 * ((lang + gram) / 2);
  const sec = { lang: lang * 60, gram: gram * 60, list: list * 60 };
  const sectionTotal = sec.lang + sec.gram + sec.list;

  const pSec = (v: number) => 1 / (1 + Math.exp(-(v - 22) / 4));
  const pTot = 1 / (1 + Math.exp(-(sectionTotal - 95) / 12));
  const confidence = Math.min(1, p.total / 60);
  let prob = pTot * pSec(sec.lang) * pSec(sec.gram) * pSec(sec.list);
  prob = confidence * prob + (1 - confidence) * 0.5 * pTot;

  const avg = SKILLS.reduce((a, c) => a + p.skill[c].R, 0) / SKILLS.length;
  const skillMastery = Object.fromEntries(SKILLS.map((c) => [c, m(c)])) as Record<Skill, number>;

  return {
    answers: p.total,
    passPct: Math.round(prob * 100),
    sectionTotal: Math.round(sectionTotal),
    level: level(avg),
    days: daysUntilExam(now),
    confidence,
    skillMastery,
    hasEnough: p.total >= 5,
  };
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `bun test src/lib/scoring.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/progress.ts src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "Tranche 1 : moteur de score extrait (scoring.ts) + tests"
```

---

## Task 3: Progress storage reader (TDD)

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `Progress`, `SKILLS` from `../types/progress.ts`.
- Produces: `readProgress(store?: Pick<Storage, "getItem">): Progress | null` (default store = `globalThis.localStorage`). Returns `null` when absent, unparseable, or missing required `total`/`skill` shape.

- [ ] **Step 1: Write the failing test `src/lib/storage.test.ts`**

```ts
import { test, expect } from "bun:test";
import { readProgress } from "./storage.ts";

const fake = (v: string | null) => ({ getItem: (_k: string) => v });

test("reads a valid progress blob", () => {
  const raw = JSON.stringify({ total: 12, skill: { grammaire: { R: 1600 }, vocabulaire: { R: 1500 }, kanji: { R: 1550 }, lecture: { R: 1620 } } });
  const p = readProgress(fake(raw));
  expect(p?.total).toBe(12);
  expect(p?.skill.lecture.R).toBe(1620);
});

test("returns null when absent", () => {
  expect(readProgress(fake(null))).toBeNull();
});

test("returns null on malformed JSON", () => {
  expect(readProgress(fake("{not json"))).toBeNull();
});

test("returns null when skill data is incomplete", () => {
  const raw = JSON.stringify({ total: 5, skill: { grammaire: { R: 1600 } } });
  expect(readProgress(fake(raw))).toBeNull();
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `bun test src/lib/storage.test.ts`
Expected: FAIL ("Cannot find module './storage.ts'").

- [ ] **Step 3: Implement `src/lib/storage.ts`**

```ts
import type { Progress } from "../types/progress.ts";
import { SKILLS } from "../types/progress.ts";

const PROGRESS_KEY = "jlptN3adapt_v2";

function isProgress(v: unknown): v is Progress {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.total !== "number") return false;
  const s = o.skill as Record<string, unknown> | undefined;
  if (typeof s !== "object" || s === null) return false;
  return SKILLS.every((c) => {
    const e = s[c] as Record<string, unknown> | undefined;
    return typeof e === "object" && e !== null && typeof e.R === "number";
  });
}

export function readProgress(store: Pick<Storage, "getItem"> = globalThis.localStorage): Progress | null {
  let raw: string | null;
  try { raw = store.getItem(PROGRESS_KEY); } catch { return null; }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : null;
  } catch { return null; }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `bun test src/lib/storage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "Tranche 1 : lecture typée de la progression (storage.ts) + tests"
```

---

## Task 4: Theme logic + hook (TDD on pure core)

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/hooks/useTheme.ts`
- Test: `src/lib/theme.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ThemeName = "light" | "dark"`
  - `readTheme(store?): ThemeName` (default `"dark"`)
  - `otherTheme(t: ThemeName): ThemeName`
  - `applyTheme(t, root, store): void` (sets `data-theme`, writes `jlptN3_theme` + `jlptN3_updatedAt`)
  - `useTheme(): { theme: ThemeName; toggle: () => void }`

- [ ] **Step 1: Write the failing test `src/lib/theme.test.ts`**

```ts
import { test, expect } from "bun:test";
import { readTheme, otherTheme, applyTheme } from "./theme.ts";

function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    _dump: () => Object.fromEntries(m),
  };
}

test("readTheme defaults to dark", () => {
  expect(readTheme(fakeStore())).toBe("dark");
});

test("readTheme reads a stored light preference", () => {
  expect(readTheme(fakeStore({ jlptN3_theme: "light" }))).toBe("light");
});

test("otherTheme flips", () => {
  expect(otherTheme("dark")).toBe("light");
  expect(otherTheme("light")).toBe("dark");
});

test("applyTheme sets the attribute and persists both keys", () => {
  const store = fakeStore();
  const root = { setAttribute: (() => {}) as unknown as HTMLElement["setAttribute"], attr: "" };
  const fakeRoot = { setAttribute: (_n: string, v: string) => { root.attr = v; } } as unknown as HTMLElement;
  applyTheme("light", fakeRoot, store);
  expect(root.attr).toBe("light");
  const dump = store._dump();
  expect(dump.jlptN3_theme).toBe("light");
  expect(typeof dump.jlptN3_updatedAt).toBe("string");
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `bun test src/lib/theme.test.ts`
Expected: FAIL ("Cannot find module './theme.ts'").

- [ ] **Step 3: Implement `src/lib/theme.ts`**

```ts
export type ThemeName = "light" | "dark";
const THEME_KEY = "jlptN3_theme";
const UPDATED_KEY = "jlptN3_updatedAt";

export function readTheme(store: Pick<Storage, "getItem"> = globalThis.localStorage): ThemeName {
  try { return store.getItem(THEME_KEY) === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}

export function otherTheme(t: ThemeName): ThemeName {
  return t === "light" ? "dark" : "light";
}

export function applyTheme(
  t: ThemeName,
  root: HTMLElement = document.documentElement,
  store: Pick<Storage, "setItem"> = globalThis.localStorage,
): void {
  root.setAttribute("data-theme", t);
  try {
    store.setItem(THEME_KEY, t);
    store.setItem(UPDATED_KEY, new Date().toISOString());
  } catch { /* best-effort */ }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `bun test src/lib/theme.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement `src/hooks/useTheme.ts`** (thin glue, not unit-tested)

```ts
import { useState, useCallback } from "react";
import { readTheme, otherTheme, applyTheme, type ThemeName } from "../lib/theme.ts";

export function useTheme(): { theme: ThemeName; toggle: () => void } {
  const [theme, setTheme] = useState<ThemeName>(() => readTheme());
  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next = otherTheme(cur);
      applyTheme(next);
      return next;
    });
  }, []);
  return { theme, toggle };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts src/hooks/useTheme.ts
git commit -m "Tranche 1 : thème (theme.ts + useTheme) + tests"
```

---

## Task 5: Service-worker registration + update state

**Files:**
- Create: `src/lib/pwa.ts`
- Create: `src/hooks/usePwa.ts`
- Test: `src/lib/pwa.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SwState = { updateReady: boolean }`
  - `applyUpdate(worker: { postMessage: (m: unknown) => void } | null): void` (posts `{type:"SKIP_WAITING"}`)
  - `forceRefresh(nav?, cacheStore?, reload?): Promise<void>` (unregisters SWs, clears caches, reloads)
  - `useServiceWorker(): { updateReady: boolean; apply: () => void; forceRefresh: () => void }`

- [ ] **Step 1: Write the failing test `src/lib/pwa.test.ts`**

```ts
import { test, expect } from "bun:test";
import { applyUpdate, forceRefresh } from "./pwa.ts";

test("applyUpdate posts SKIP_WAITING to the waiting worker", () => {
  const posted: unknown[] = [];
  applyUpdate({ postMessage: (m) => posted.push(m) });
  expect(posted).toEqual([{ type: "SKIP_WAITING" }]);
});

test("applyUpdate is a no-op with no worker", () => {
  expect(() => applyUpdate(null)).not.toThrow();
});

test("forceRefresh unregisters SWs, clears caches, then reloads", async () => {
  const calls: string[] = [];
  const nav = {
    serviceWorker: {
      getRegistrations: async () => [{ unregister: async () => { calls.push("unregister"); return true; } }],
    },
  };
  const cacheStore = {
    keys: async () => ["jlpt-n3-v78"],
    delete: async (k: string) => { calls.push("delete:" + k); return true; },
  };
  await forceRefresh(nav as any, cacheStore as any, () => calls.push("reload"));
  expect(calls).toContain("unregister");
  expect(calls).toContain("delete:jlpt-n3-v78");
  expect(calls[calls.length - 1]).toBe("reload");
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `bun test src/lib/pwa.test.ts`
Expected: FAIL ("Cannot find module './pwa.ts'").

- [ ] **Step 3: Implement `src/lib/pwa.ts`**

```ts
type Poster = { postMessage: (m: unknown) => void };

export function applyUpdate(worker: Poster | null): void {
  if (worker) worker.postMessage({ type: "SKIP_WAITING" });
}

export async function forceRefresh(
  nav: Navigator = navigator,
  cacheStore: CacheStorage = caches,
  reload: () => void = () => location.reload(),
): Promise<void> {
  try {
    if (nav.serviceWorker) {
      const regs = await nav.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (cacheStore?.keys) {
      const keys = await cacheStore.keys();
      await Promise.all(keys.map((k) => cacheStore.delete(k)));
    }
  } catch { /* best-effort */ }
  reload();
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `bun test src/lib/pwa.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `src/hooks/usePwa.ts`** (thin glue, not unit-tested)

```ts
import { useEffect, useRef, useState, useCallback } from "react";
import { applyUpdate, forceRefresh } from "../lib/pwa.ts";

export function useServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);
  const waiting = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return; reloaded = true; location.reload();
    });
    navigator.serviceWorker.register("sw.js").then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting.current = reg.waiting; setUpdateReady(true);
      }
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing; if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            waiting.current = reg.waiting ?? nw; setUpdateReady(true);
          }
        });
      });
      reg.update?.();
    }).catch(() => {});
  }, []);

  const apply = useCallback(() => {
    setUpdateReady(false);
    if (waiting.current) applyUpdate(waiting.current);
    else location.reload();
  }, []);

  return { updateReady, apply, forceRefresh: () => void forceRefresh() };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/pwa.ts src/lib/pwa.test.ts src/hooks/usePwa.ts
git commit -m "Tranche 1 : service worker (pwa.ts + usePwa) + tests"
```

---

## Task 6: UI shell components (smoke-tested)

**Files:**
- Create: `src/ui/Header.tsx`, `src/ui/TopNav.tsx`, `src/ui/Footer.tsx`, `src/ui/UpdateBanner.tsx`
- Test: `src/ui/shell.test.tsx`

**Interfaces:**
- Consumes: `ThemeName` (theme.ts).
- Produces:
  - `Header(): JSX.Element`
  - `TopNav(props: { theme: ThemeName; onToggleTheme: () => void }): JSX.Element`
  - `Footer(props: { onForceRefresh: () => void }): JSX.Element`
  - `UpdateBanner(props: { show: boolean; onApply: () => void }): JSX.Element | null`

- [ ] **Step 1: Write the failing test `src/ui/shell.test.tsx`**

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Header } from "./Header.tsx";
import { TopNav } from "./TopNav.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";

test("Header shows the French title", () => {
  expect(renderToStaticMarkup(<Header />)).toContain("JLPT N3");
});

test("TopNav links to the still-vanilla pages", () => {
  const html = renderToStaticMarkup(<TopNav theme="dark" onToggleTheme={() => {}} />);
  expect(html).toContain("app-n3.html");
  expect(html).toContain("cours-n3.html");
  expect(html).toContain("planning-n3.html");
});

test("UpdateBanner renders nothing when hidden", () => {
  expect(renderToStaticMarkup(<UpdateBanner show={false} onApply={() => {}} />)).toBe("");
});

test("UpdateBanner renders the reload prompt when shown", () => {
  expect(renderToStaticMarkup(<UpdateBanner show={true} onApply={() => {}} />)).toContain("Recharger");
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `bun test src/ui/shell.test.tsx`
Expected: FAIL ("Cannot find module './Header.tsx'").

- [ ] **Step 3: Implement `src/ui/Header.tsx`**

```tsx
export function Header() {
  return (
    <header className="px-5 pt-6 pb-3 text-center">
      <h1 className="text-xl text-fg m-0">
        Préparation <span className="text-accent">JLPT N3</span>
      </h1>
      <p className="text-fg-dim text-sm mt-1">
        Objectif : session de décembre 2026 · 5 mois de préparation
      </p>
    </header>
  );
}
```

- [ ] **Step 4: Implement `src/ui/TopNav.tsx`**

```tsx
import type { ThemeName } from "../lib/theme.ts";

const LINKS = [
  { href: "index.html", label: "Accueil", active: true },
  { href: "app-n3.html", label: "Entraînement", active: false },
  { href: "cours-n3.html", label: "Cours", active: false },
  { href: "planning-n3.html", label: "Planning", active: false },
];

export function TopNav({ theme, onToggleTheme }: { theme: ThemeName; onToggleTheme: () => void }) {
  return (
    <nav className="sticky top-0 z-10 flex gap-4 flex-wrap justify-center items-center px-3 py-2.5">
      {LINKS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className={l.active ? "text-fg font-semibold text-sm" : "text-fg-dim font-semibold text-sm"}
        >
          {l.label}
        </a>
      ))}
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label="Basculer le thème"
        className="text-fg-dim rounded-full min-w-8 h-8 cursor-pointer border-none bg-transparent"
      >
        {theme === "light" ? "☾" : "☀"}
      </button>
    </nav>
  );
}
```

- [ ] **Step 5: Implement `src/ui/Footer.tsx`**

```tsx
export function Footer({ onForceRefresh }: { onForceRefresh: () => void }) {
  return (
    <footer className="text-center text-fg-dim text-sm mt-8">
      頑張ってください！ — Bon courage
      <br />
      <button
        type="button"
        onClick={onForceRefresh}
        className="mt-2 text-accent bg-transparent border border-line rounded-full px-3 py-1 cursor-pointer text-sm"
      >
        ↻ Forcer la mise à jour
      </button>
    </footer>
  );
}
```

- [ ] **Step 6: Implement `src/ui/UpdateBanner.tsx`**

```tsx
export function UpdateBanner({ show, onApply }: { show: boolean; onApply: () => void }) {
  if (!show) return null;
  return (
    <div className="fixed left-3 right-3 bottom-3 z-toast bg-accent text-fg-on-accent rounded-xl px-4 py-3 flex items-center gap-3 shadow-hover max-w-[560px] mx-auto" role="alert">
      <span>Nouvelle version disponible.</span>
      <button
        type="button"
        onClick={onApply}
        className="ml-auto bg-fg-on-accent text-bg border-none rounded-lg px-4 py-2 font-bold cursor-pointer"
      >
        Recharger
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Run the test — verify it passes**

Run: `bun test src/ui/shell.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/ui/ && git commit -m "Tranche 1 : composants de coquille (Header/TopNav/Footer/UpdateBanner) + tests"
```

---

## Task 7: Dashboard feature (smoke-tested)

**Files:**
- Create: `src/features/dashboard/useProgress.ts`
- Create: `src/features/dashboard/Dashboard.tsx`
- Test: `src/features/dashboard/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `readProgress` (storage.ts), `dashboardModel` (scoring.ts), `SKILLS` (progress.ts).
- Produces:
  - `useProgress(): Progress | null`
  - `Dashboard(props: { model: DashboardModel | null; days: number }): JSX.Element` — pure/presentational; takes a precomputed model so it can be tested without globals. Empty state when `model` is `null`.

- [ ] **Step 1: Write the failing test `src/features/dashboard/Dashboard.test.tsx`**

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Dashboard } from "./Dashboard.tsx";
import { dashboardModel } from "../../lib/scoring.ts";
import type { Progress } from "../../types/progress.ts";

const flat = (R: number, total: number): Progress => ({
  total,
  skill: { grammaire: { R }, vocabulaire: { R }, kanji: { R }, lecture: { R } },
});

test("empty state prompts to start a quiz", () => {
  const html = renderToStaticMarkup(<Dashboard model={null} days={150} />);
  expect(html).toContain("Aucune donnée");
  expect(html).toContain("150");
});

test("renders pass %, score, level once there is data", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("17%");
  expect(html).toContain("86/180");
  expect(html).toContain("N3-");
});

test("shows placeholders under 5 answers", () => {
  const m = dashboardModel(flat(1600, 3), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("?");
  expect(html).toContain("—");
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `bun test src/features/dashboard/Dashboard.test.tsx`
Expected: FAIL ("Cannot find module './Dashboard.tsx'").

- [ ] **Step 3: Implement `src/features/dashboard/Dashboard.tsx`**

```tsx
import type { DashboardModel } from "../../lib/scoring.ts";
import { SKILLS, type Skill } from "../../types/progress.ts";

const LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture",
};
const BAR: Record<Skill, string> = {
  grammaire: "bg-skill-grammaire", vocabulaire: "bg-skill-vocabulaire",
  kanji: "bg-skill-kanji", lecture: "bg-skill-lecture",
};

export function Dashboard({ model, days }: { model: DashboardModel | null; days: number }) {
  if (!model || model.answers === 0) {
    return (
      <div className="bg-panel border border-line rounded-xl px-6 py-5 mb-6">
        <p className="text-fg-dim text-sm m-0">
          Aucune donnée pour l'instant — lance un quiz dans l'entraînement adaptatif
          pour générer ton analyse. ({days} jours avant l'examen)
        </p>
      </div>
    );
  }
  const pct = model.hasEnough ? `${model.passPct}%` : "?";
  const score = model.hasEnough ? `${model.sectionTotal}/180` : "—";
  return (
    <div className="bg-panel border border-line rounded-xl px-6 py-5 mb-6">
      <div className="grid grid-cols-2 gap-2 text-center mb-3">
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className="text-xl font-bold text-status-completed">{pct}</div>
          <div className="text-meta text-fg-dim">réussite estimée</div>
        </div>
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className="text-xl font-bold text-accent">{score}</div>
          <div className="text-meta text-fg-dim">score estimé</div>
        </div>
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className="text-xl font-bold text-prio-high">{model.level}</div>
          <div className="text-meta text-fg-dim">niveau</div>
        </div>
        <div className="bg-surface-2 border border-line rounded-lg py-2 px-1">
          <div className="text-xl font-bold text-status-completed">{days}</div>
          <div className="text-meta text-fg-dim">jours restants</div>
        </div>
      </div>
      {SKILLS.map((c) => {
        const m = Math.round(model.skillMastery[c] * 100);
        return (
          <div key={c} className="flex items-center gap-2 my-1 text-sm">
            <span className="w-24 text-fg-dim">{LABELS[c]}</span>
            <div className="flex-1 h-[9px] bg-surface-2 rounded-full overflow-hidden border border-line">
              <div className={`h-full ${BAR[c]}`} style={{ width: `${m}%` }} />
            </div>
            <span className="w-9 text-right text-fg-dim">{m}%</span>
          </div>
        );
      })}
      <p className="text-fg-dim text-sm mt-2">
        {model.answers} réponses · fiabilité {Math.round(model.confidence * 100)}%
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/features/dashboard/useProgress.ts`**

```ts
import { useState, useEffect } from "react";
import { readProgress } from "../../lib/storage.ts";
import type { Progress } from "../../types/progress.ts";

export function useProgress(): Progress | null {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => { setProgress(readProgress()); }, []);
  return progress;
}
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `bun test src/features/dashboard/Dashboard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/ && git commit -m "Tranche 1 : tableau de bord (Dashboard + useProgress) + tests"
```

---

## Task 8: Compose the App + finalize the shell

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx` (replace the placeholder test)

**Interfaces:**
- Consumes: `Header`, `TopNav`, `Footer`, `UpdateBanner`, `Dashboard`, `useProgress`, `useTheme`, `useServiceWorker`, `dashboardModel`, `daysUntilExam`.
- Produces: `App(): JSX.Element` (full dashboard page).

- [ ] **Step 1: Replace `src/App.test.tsx` with a composed-render test**

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppView } from "./App.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import type { Progress } from "./types/progress.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R }, vocabulaire: { R }, kanji: { R }, lecture: { R } },
});

test("AppView composes shell + dashboard", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(
    <AppView theme="dark" onToggleTheme={() => {}} updateReady={false}
             onApplyUpdate={() => {}} onForceRefresh={() => {}}
             model={model} days={model.days} />,
  );
  expect(html).toContain("JLPT N3");
  expect(html).toContain("app-n3.html");
  expect(html).toContain("17%");
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `bun test src/App.test.tsx`
Expected: FAIL ("AppView is not exported").

- [ ] **Step 3: Implement `src/App.tsx`**

```tsx
import { Header } from "./ui/Header.tsx";
import { TopNav } from "./ui/TopNav.tsx";
import { Footer } from "./ui/Footer.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { useServiceWorker } from "./hooks/usePwa.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { ThemeName } from "./lib/theme.ts";

/** Pure, prop-driven view — unit-testable without globals. */
export function AppView(props: {
  theme: ThemeName; onToggleTheme: () => void;
  updateReady: boolean; onApplyUpdate: () => void; onForceRefresh: () => void;
  model: DashboardModel | null; days: number;
}) {
  return (
    <>
      <Header />
      <TopNav theme={props.theme} onToggleTheme={props.onToggleTheme} />
      <div className="max-w-[680px] mx-auto px-5 pt-6 pb-10">
        <Dashboard model={props.model} days={props.days} />
      </div>
      <Footer onForceRefresh={props.onForceRefresh} />
      <UpdateBanner show={props.updateReady} onApply={props.onApplyUpdate} />
    </>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();
  const { updateReady, apply, forceRefresh } = useServiceWorker();
  const progress = useProgress();
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return (
    <AppView
      theme={theme} onToggleTheme={toggle}
      updateReady={updateReady} onApplyUpdate={apply} onForceRefresh={forceRefresh}
      model={model} days={daysUntilExam(now)}
    />
  );
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `bun test src/App.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Run the whole suite + typecheck + build**

Run: `bun test`
Expected: all tests PASS.
Run: `bun run typecheck`
Expected: exits 0, no errors.
Run: `bun run build`
Expected: exits 0; `_site/index.html` produced.

- [ ] **Step 6: Verify visual parity in the browser** (manual, uses `/verify` discipline)

Run: `bun run dev`, open the served URL. Confirm against the current live dashboard: same header/nav, theme toggle flips light/dark and persists after reload, and — with existing `jlptN3adapt_v2` present — the stat grid/bars match. With no progress, the empty-state message shows.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "Tranche 1 : composition App (coquille + tableau de bord)"
```

---

## Task 9: Service worker + deploy workflow

**Files:**
- Modify: `sw.js` (precache list + version)
- Modify: `.github/workflows/deploy.yml` (build step)

**Interfaces:**
- Consumes: the `_site` build output from `bun run build`.
- Produces: an updated SW cache manifest and a CI pipeline that builds `index.html` via Bun while `cp`-ing the still-vanilla pages.

- [ ] **Step 1: Update `sw.js`** — bump version, drop the removed inline assets from precache

Change the `CACHE` constant and the `SHELL` array (top of `sw.js`):

```js
const CACHE = 'jlpt-n3-v79';
const SHELL = [
  './',
  'index.html',
  'app-n3.html',
  'cours-n3.html',
  'planning-n3.html',
  'theme.css',
  'dict.js',
  'vocab-data.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png'
];
```

Rationale: the React dashboard's hashed JS/CSS chunks are **not** precached (their names change per build); the existing cache-first `fetch` handler caches them at runtime on first load. HTML stays network-first. `theme.css` remains for the still-vanilla pages.

- [ ] **Step 2: Update `.github/workflows/deploy.yml`** — build the migrated page with Bun

Replace the "Préparer l'artefact du site" step with:

```yaml
      - name: Installer Bun
        uses: oven-sh/setup-bun@v2

      - name: Construire (Bun) + préparer l'artefact
        run: |
          bun install --frozen-lockfile
          bun run build          # génère _site/index.html (React) + assets hashés
          # Pages encore en vanilla : copiées telles quelles
          cp app-n3.html cours-n3.html planning-n3.html _site/
          cp theme.css dict.js vocab-data.js _site/
          cp manifest.webmanifest sw.js icon-180.png icon-192.png icon-512.png _site/
          cp README.md _site/ 2>/dev/null || true
```

Note for future slices: as each page migrates, move it from the `cp` line into the `bun build` inputs — this list is the migration ledger.

- [ ] **Step 3: Verify the build locally produces a complete `_site`**

Run: `bun run build && cp app-n3.html cours-n3.html planning-n3.html theme.css dict.js vocab-data.js manifest.webmanifest sw.js icon-180.png icon-192.png icon-512.png _site/ && ls _site`
Expected: `_site` contains `index.html`, the three vanilla pages, `sw.js`, `theme.css`, `dict.js`, icons, manifest.

- [ ] **Step 4: Verify offline** (manual)

Serve `_site` (`bunx serve _site`), load it, then reload with the network throttled to offline in devtools. The dashboard still renders (SW cache-first served the hashed chunks after first load).

- [ ] **Step 5: Commit**

```bash
git add sw.js .github/workflows/deploy.yml
git commit -m "Tranche 1 : SW (précache stable + cache runtime) + build Bun en CI"
```

---

## Self-Review

**1. Spec coverage** (against `2026-07-10-react-bun-migration-design.md`):
- §2 hard constraints — localStorage keys (Tasks 3/4), PWA (Tasks 5/9), GH Pages (Task 9), French UI (Tasks 6/7), identical look (Task 1 tokens + Task 8 parity check). ✓
- §5 styling (oku vendored tokens, Nord `[data-theme]`, no arbitrary values) — Task 1. ✓
- §6 build (Bun bundler + Tailwind CLI, decoupled) — Task 1 + Task 9. ✓
- §8 dashboard decomposition (storage/scoring/theme/pwa/ui/dashboard) — Tasks 2–8. ✓
- §9 SW precache/runtime split + deploy ledger — Task 9. ✓
- §10 TDD — every logic module RED→GREEN (Tasks 2–5); components smoke-tested (6–8). ✓
- §7 data layer — correctly NOT exercised (dashboard needs no content data), matching the spec. ✓
- Deferred per spec: `dict.js` not loaded on the new shell this slice (footer furigana isn't needed on the dashboard); revisit in the cours-n3 slice. Noted as acceptable debt in the design §12.

**2. Placeholder scan:** No TBD/TODO; every code step carries full code; every run step states the exact command and expected result. ✓

**3. Type consistency:** `Progress`/`Skill`/`SKILLS` (Task 2) reused verbatim in Tasks 3/7/8. `dashboardModel`/`DashboardModel`/`daysUntilExam` (Task 2) consumed in Tasks 7/8. `ThemeName` (Task 4) consumed in Tasks 6/8. `readProgress`/`readTheme`/`applyTheme`/`otherTheme`/`applyUpdate`/`forceRefresh` names match across definition and use. ✓
