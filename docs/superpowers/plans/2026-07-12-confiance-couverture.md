# Confiance + Couverture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-skill *coverage* metric (seen + mastered rings) beside the existing Elo ability estimate, and dampen the displayed ability bar when evidence is thin.

**Architecture:** Coverage is recorded as two base64 bitsets on the existing progress blob (`seen`, `mastered`), keyed by the dense global item ids from `bank-index.json`; per-skill % is computed at runtime so it self-rebases to whatever the banks hold. A new pure `coverage.ts` lib does the bit math; a `displayMastery` shrinkage lives in `scoring.ts`; a `useCoverage` hook feeds a dual-ring UI.

**Tech Stack:** React 18 + TypeScript, bundled by Bun. `bun:test` for units, happy-dom for mount tests, `renderToStaticMarkup` for SSR smoke. Vendored Tailwind v4 (subset).

## Global Constraints

- **Runtime & tooling: `bun` only — never `node`.** Tests: `bun test`. Types: `bun run typecheck`.
- **UI copy in French**, code comments in English (match existing files).
- **No `sw.js` CACHE bump** — no served asset changes (coverage lives in `localStorage`; `data/*.json` untouched).
- **Vendored Tailwind is a subset** — `stroke-*` utilities are NOT guaranteed. SVG strokes use **inline `style` with CSS vars** (`var(--color-…)`), never `stroke-*` classes.
- **`renderToStaticMarkup` escapes apostrophes** (`'` → `&#x27;`) — SSR tests assert on substrings WITHOUT apostrophes (`vu`, `appris` are safe).
- **`masteryOf` stays untouched** for `allocate()` and `successModel()`; only the *display* switches to `displayMastery`.
- **Side-by-side tests** (`foo.test.ts` next to `foo.ts`). Commit after each task (French style: `feat : …` / `test : …`, matching repo history; **no** Co-Authored-By line).
- **⚠ Concurrency:** a parallel session is editing `src/features/quiz/useQuiz.ts`. **Task 8 (the recording hook) is DEFERRED** — do not start it until that work has landed and the tree is clean. Tasks 1–7 do not touch `useQuiz.ts`.

---

### Task 1: `coverage.ts` — bitset primitives + per-skill coverage

**Files:**
- Create: `src/lib/coverage.ts`
- Test: `src/lib/coverage.test.ts`

**Interfaces:**
- Consumes: `Skill` from `src/types/progress.ts`.
- Produces:
  - `emptyBits(): Uint8Array`
  - `setBit(bits: Uint8Array, id: number): Uint8Array`
  - `hasBit(bits: Uint8Array, id: number): boolean`
  - `encodeBits(bits: Uint8Array): string`
  - `decodeBits(b64: string): Uint8Array`
  - `interface SkillCoverage { seen: number; mastered: number; seenN: number; masteredN: number; total: number }`
  - `coverageBySkill(seen: Uint8Array, mastered: Uint8Array, bankIndex: Record<number, Skill>): Record<Skill, SkillCoverage>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/coverage.test.ts
import { test, expect } from "bun:test";
import {
  emptyBits, setBit, hasBit, encodeBits, decodeBits, coverageBySkill,
} from "./coverage.ts";
import type { Skill } from "../types/progress.ts";

test("setBit/hasBit round-trip including growth beyond current capacity", () => {
  let b = emptyBits();
  b = setBit(b, 3);
  b = setBit(b, 10000); // forces the array to grow
  expect(hasBit(b, 3)).toBe(true);
  expect(hasBit(b, 10000)).toBe(true);
  expect(hasBit(b, 4)).toBe(false);
  expect(hasBit(b, 99999)).toBe(false); // out of range → false, no throw
});

test("encodeBits then decodeBits preserves every set bit", () => {
  let b = emptyBits();
  const ids = [0, 7, 8, 255, 4406];
  for (const id of ids) b = setBit(b, id);
  const round = decodeBits(encodeBits(b));
  for (const id of ids) expect(hasBit(round, id)).toBe(true);
});

test("decodeBits is best-effort on empty and garbage input", () => {
  expect(hasBit(decodeBits(""), 0)).toBe(false);
  expect(hasBit(decodeBits("@@@ not base64 @@@"), 0)).toBe(false);
});

test("coverageBySkill buckets denominators and numerators per skill", () => {
  const idx: Record<number, Skill> = { 0: "grammaire", 1: "grammaire", 2: "kanji" };
  let seen = emptyBits(); seen = setBit(seen, 0); seen = setBit(seen, 2);
  let mastered = emptyBits(); mastered = setBit(mastered, 0);
  const cov = coverageBySkill(seen, mastered, idx);
  expect(cov.grammaire).toEqual({ seen: 50, mastered: 50, seenN: 1, masteredN: 1, total: 2 });
  expect(cov.kanji).toEqual({ seen: 100, mastered: 0, seenN: 1, masteredN: 0, total: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/coverage.test.ts`
Expected: FAIL — `Cannot find module './coverage.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/coverage.ts
import type { Skill } from "../types/progress.ts";

/** Empty bitset — grows on demand via setBit. */
export function emptyBits(): Uint8Array {
  return new Uint8Array(0);
}

/** Set bit `id`, growing the backing array if needed. Returns the (possibly new) array. */
export function setBit(bits: Uint8Array, id: number): Uint8Array {
  const byte = id >> 3;
  let out = bits;
  if (byte >= bits.length) {
    out = new Uint8Array(byte + 1);
    out.set(bits);
  }
  out[byte] |= 1 << (id & 7);
  return out;
}

/** True if bit `id` is set. Out-of-range ids read as false. */
export function hasBit(bits: Uint8Array, id: number): boolean {
  const byte = id >> 3;
  if (byte < 0 || byte >= bits.length) return false;
  return (bits[byte] & (1 << (id & 7))) !== 0;
}

/** Encode a bitset to base64. Chunked so large arrays don't overflow the call stack. */
export function encodeBits(bits: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bits.length; i += CHUNK) {
    bin += String.fromCharCode(...bits.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Decode base64 → bitset. Best-effort: "" or invalid base64 → empty. Never throws. */
export function decodeBits(b64: string): Uint8Array {
  if (!b64) return emptyBits();
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return emptyBits();
  }
}

export interface SkillCoverage {
  seen: number;      // 0..100
  mastered: number;  // 0..100
  seenN: number;
  masteredN: number;
  total: number;
}

/** Per-skill coverage % from the seen/mastered bitsets, bucketed via bank-index. One O(N) pass. */
export function coverageBySkill(
  seen: Uint8Array,
  mastered: Uint8Array,
  bankIndex: Record<number, Skill>,
): Record<Skill, SkillCoverage> {
  const acc = {} as Record<Skill, SkillCoverage>;
  for (const key in bankIndex) {
    const id = Number(key);
    const c = bankIndex[id];
    const s = (acc[c] ??= { seen: 0, mastered: 0, seenN: 0, masteredN: 0, total: 0 });
    s.total++;
    if (hasBit(seen, id)) s.seenN++;
    if (hasBit(mastered, id)) s.masteredN++;
  }
  for (const c in acc) {
    const s = acc[c as Skill];
    s.seen = s.total ? Math.round((s.seenN / s.total) * 100) : 0;
    s.mastered = s.total ? Math.round((s.masteredN / s.total) * 100) : 0;
  }
  return acc;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/coverage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coverage.ts src/lib/coverage.test.ts
git commit -m "feat : lib coverage — bitsets vu/maîtrisé + couverture par compétence"
```

---

### Task 2: `loadBankIndex` — cached id→skill loader

**Files:**
- Modify: `src/lib/bank.ts` (add cached loader alongside the existing `cache`)
- Test: `src/lib/bank.test.ts` (append)

**Interfaces:**
- Consumes: `Skill`, the existing `FetchLike` type in `bank.ts`.
- Produces: `loadBankIndex(fetchImpl?: FetchLike): Promise<Record<number, Skill>>`

- [ ] **Step 1: Write the failing test** (append to `src/lib/bank.test.ts`)

```ts
import { loadBankIndex } from "./bank.ts";

test("loadBankIndex caches the fetch (called once, same promise)", async () => {
  let calls = 0;
  const fetchImpl = ((_: string) => {
    calls++;
    return Promise.resolve({ json: () => Promise.resolve({ 0: "grammaire", 2: "kanji" }) });
  }) as unknown as typeof fetch;
  const a = await loadBankIndex(fetchImpl as any);
  const b = await loadBankIndex(fetchImpl as any);
  expect(a).toBe(b);
  expect(calls).toBe(1);
  expect(a[0]).toBe("grammaire");
});
```

> Note: `loadBankIndex` caches at module scope (parity with the existing `loadCategory` cache). This must be the **first** `loadBankIndex` call in the test file for `calls===1` to hold.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/bank.test.ts`
Expected: FAIL — `loadBankIndex is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation** (add near the top of `src/lib/bank.ts`, after the existing `const cache = …` line)

```ts
let bankIndexPromise: Promise<Record<number, Skill>> | null = null;

/** Cached id→skill index (`data/bank-index.json`). Shared by the coverage hook. */
export function loadBankIndex(fetchImpl: FetchLike = fetch as FetchLike): Promise<Record<number, Skill>> {
  if (!bankIndexPromise) {
    bankIndexPromise = fetchImpl("data/bank-index.json").then(
      (r) => r.json() as Promise<Record<number, Skill>>,
    );
  }
  return bankIndexPromise;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/bank.test.ts`
Expected: PASS (existing + new test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bank.ts src/lib/bank.test.ts
git commit -m "feat : loadBankIndex — index id→compétence caché (couverture)"
```

---

### Task 3: `displayMastery` — evidence-shrunk ability bar

**Files:**
- Modify: `src/lib/scoring.ts` (add constants + `displayMastery`; swap `barMastery` source)
- Test: `src/lib/scoring.test.ts` (append)

**Interfaces:**
- Consumes: `Progress`, `Skill`, existing private `skR`/`skT`, `PASS_RATING`.
- Produces: `displayMastery(p: Progress, c: Skill): number`. `dashboardModel.barMastery` now derives from `displayMastery`.

- [ ] **Step 1: Write the failing test** (append to `src/lib/scoring.test.ts`)

```ts
import { displayMastery, masteryOf } from "./scoring.ts";
import type { Progress } from "../types/progress.ts";

test("displayMastery with t=0 equals the blank-skill masteryOf (no discontinuity)", () => {
  const p: Progress = { total: 0, skill: {} };
  expect(displayMastery(p, "vocabulaire")).toBeCloseTo(masteryOf(p, "vocabulaire"), 10);
});

test("displayMastery is shrunk below raw when R is high but t is small", () => {
  const p: Progress = { total: 8, skill: { vocabulaire: { R: 1800, t: 8 } } };
  expect(displayMastery(p, "vocabulaire")).toBeLessThan(masteryOf(p, "vocabulaire"));
});

test("displayMastery converges toward raw as t grows", () => {
  const lo: Progress = { total: 5, skill: { kanji: { R: 1800, t: 5 } } };
  const hi: Progress = { total: 500, skill: { kanji: { R: 1800, t: 500 } } };
  const raw = masteryOf(hi, "kanji");
  const dLo = Math.abs(displayMastery(lo, "kanji") - raw);
  const dHi = Math.abs(displayMastery(hi, "kanji") - raw);
  expect(dHi).toBeLessThan(dLo);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/scoring.test.ts`
Expected: FAIL — `displayMastery` not exported.

- [ ] **Step 3: Write minimal implementation** (in `src/lib/scoring.ts`, after `masteryOf`)

```ts
const PRIOR_R = 1450;   // neutral rating (= blankSkills)
const SHRINK_M = 10;    // pseudo-count — aligned with the Elo K breakpoint (t < 10)

/** Display mastery (0..1): the rating is shrunk toward the neutral prior by evidence `t`,
 *  then run through the same logistic. At t=0 it equals a blank skill's masteryOf; it
 *  converges to masteryOf(R) as t grows. Used for the dashboard bars ONLY. */
export function displayMastery(p: Progress, c: Skill): number {
  const R = skR(p, c);
  const t = skT(p, c);
  const Reff = (t * R + SHRINK_M * PRIOR_R) / (t + SHRINK_M);
  return 1 / (1 + Math.pow(10, (PASS_RATING - Reff) / 400));
}
```

- [ ] **Step 4: Swap the dashboard bar source** (in `dashboardModel`, change the `barMastery` map)

```ts
  const barMastery = Object.fromEntries(
    BAR_SKILLS.map((c) => [c, Math.round(displayMastery(p, c) * 100)]),
  ) as Record<Skill, number>;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/lib/scoring.test.ts`
Expected: PASS. (If an existing `dashboardModel` bar-value assertion now differs, update it to the shrunk value — that change is intended.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat : displayMastery — barre de maîtrise amortie selon l'évidence t"
```

---

### Task 4: Extend the `Progress` type

**Files:**
- Modify: `src/types/progress.ts`

**Interfaces:**
- Produces: `Progress` gains optional `seen?: string; mastered?: string;` (base64 bitsets). Consumed by Task 5 (`useCoverage`) and Task 8 (recording).

- [ ] **Step 1: Edit the interface**

```ts
export interface Progress {
  total: number;
  skill: Partial<Record<Skill, { R: number; t: number }>>;
  seen?: string;      // base64 bitset over global ids — answered ≥ 1×
  mastered?: string;  // base64 bitset — answered correctly ≥ 1× (⊆ seen)
}
```

- [ ] **Step 2: Verify types still compile**

Run: `bun run typecheck`
Expected: PASS (no consumers break — fields are optional; `readProgress` returns the parsed object as-is).

- [ ] **Step 3: Commit**

```bash
git add src/types/progress.ts
git commit -m "feat : Progress — champs optionnels seen/mastered (bitsets couverture)"
```

---

### Task 5: `useCoverage` hook

**Files:**
- Create: `src/features/dashboard/useCoverage.ts`
- Test: `src/features/dashboard/useCoverage.test.tsx`

**Interfaces:**
- Consumes: `Progress`, `Skill` (Task 4); `loadBankIndex` (Task 2); `coverageBySkill`, `decodeBits`, `SkillCoverage` (Task 1).
- Produces: `useCoverage(p: Progress | null): Record<Skill, SkillCoverage> | null` (`null` until the index resolves, or if it fails).

- [ ] **Step 1: Write the failing test** (happy-dom mount; the repo preloads happy-dom via `bunfig.toml`)

```tsx
// src/features/dashboard/useCoverage.test.tsx
import { test, expect, afterEach } from "bun:test";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useCoverage } from "./useCoverage.ts";
import { setBit, encodeBits, emptyBits, type SkillCoverage } from "../../lib/coverage.ts";
import type { Progress, Skill } from "../../types/progress.ts";

const origFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = origFetch; });

test("useCoverage returns per-skill % once the index loads", async () => {
  globalThis.fetch = ((_: string) =>
    Promise.resolve({ json: () => Promise.resolve({ 0: "grammaire", 1: "grammaire", 2: "kanji" } as Record<number, Skill>) }),
  ) as unknown as typeof fetch;

  let seen = emptyBits(); seen = setBit(seen, 0);
  const p: Progress = { total: 1, skill: {}, seen: encodeBits(seen), mastered: encodeBits(emptyBits()) };

  let captured: Record<Skill, SkillCoverage> | null = null;
  function Probe() { captured = useCoverage(p); return null; }

  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  await act(async () => { await Promise.resolve(); }); // flush the index promise

  expect(captured).not.toBeNull();
  expect(captured!.grammaire.seen).toBe(50);   // 1 of 2 grammaire ids seen
  expect(captured!.kanji.seen).toBe(0);
  await act(async () => { root.unmount(); });
});
```

> Note: `loadBankIndex` caches module-scope. Keep this the only file that drives `loadBankIndex` with a stub, or the cached promise from another test can win.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/dashboard/useCoverage.test.tsx`
Expected: FAIL — `Cannot find module './useCoverage.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/dashboard/useCoverage.ts
import { useEffect, useMemo, useState } from "react";
import type { Progress, Skill } from "../../types/progress.ts";
import { loadBankIndex } from "../../lib/bank.ts";
import { coverageBySkill, decodeBits, type SkillCoverage } from "../../lib/coverage.ts";

/** Per-skill coverage from the progress bitsets + bank-index. `null` until the index resolves
 *  (or if it fails — offline first visit), so callers can hide the rings gracefully. */
export function useCoverage(p: Progress | null): Record<Skill, SkillCoverage> | null {
  const [index, setIndex] = useState<Record<number, Skill> | null>(null);
  useEffect(() => {
    let alive = true;
    loadBankIndex().then((idx) => { if (alive) setIndex(idx); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const seenB64 = typeof p?.seen === "string" ? p.seen : "";
  const masteredB64 = typeof p?.mastered === "string" ? p.mastered : "";
  return useMemo(() => {
    if (!p || !index) return null;
    return coverageBySkill(decodeBits(seenB64), decodeBits(masteredB64), index);
  }, [p, index, seenB64, masteredB64]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/dashboard/useCoverage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/useCoverage.ts src/features/dashboard/useCoverage.test.tsx
git commit -m "feat : hook useCoverage — couverture par compétence via bank-index"
```

---

### Task 6: `CoverageRings` + Dashboard integration + route wiring

**Files:**
- Create: `src/features/dashboard/CoverageRings.tsx`
- Create: `src/features/dashboard/CoverageRings.test.tsx`
- Modify: `src/features/dashboard/Dashboard.tsx` (accept `coverage`, render rings)
- Modify: `src/App.tsx` (compute + pass `coverage`)
- Modify: `src/EntrainementApp.tsx` (compute + thread `coverage`)
- Modify: `src/features/entrainement/EntrainementHome.tsx` (thread `coverage` to `Dashboard`)

**Interfaces:**
- Consumes: `SkillCoverage` (Task 1), `BAR_SKILLS`/`Skill`, `useCoverage` (Task 5).
- Produces: `CoverageRings({ coverage }: { coverage: Record<Skill, SkillCoverage> })`; `Dashboard` gains a `coverage?: Record<Skill, SkillCoverage> | null` prop; `EntrainementHome` gains the same optional prop.

- [ ] **Step 1: Write the failing test** (SSR smoke — remember apostrophe escaping; `vu`/`appris` are apostrophe-free)

```tsx
// src/features/dashboard/CoverageRings.test.tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverageRings } from "./CoverageRings.tsx";
import type { SkillCoverage } from "../../lib/coverage.ts";
import type { Skill } from "../../types/progress.ts";

const cov = {
  grammaire: { seen: 12, mastered: 8, seenN: 141, masteredN: 94, total: 1174 },
  vocabulaire: { seen: 3, mastered: 1, seenN: 177, masteredN: 59, total: 5904 },
  kanji: { seen: 5, mastered: 2, seenN: 157, masteredN: 63, total: 3148 },
  lecture: { seen: 40, mastered: 25, seenN: 21, masteredN: 13, total: 52 },
} as Record<Skill, SkillCoverage>;

test("CoverageRings renders vu/appris labels and percentages", () => {
  const html = renderToStaticMarkup(<CoverageRings coverage={cov} />);
  expect(html).toContain("Grammaire");
  expect(html).toContain("vu");
  expect(html).toContain("appris");
  expect(html).toContain("12%");
  expect(html).toContain("8%");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/dashboard/CoverageRings.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `CoverageRings`** (inline SVG strokes via CSS vars — NOT `stroke-*` classes)

```tsx
// src/features/dashboard/CoverageRings.tsx
import { BAR_SKILLS, type Skill } from "../../types/progress.ts";
import type { SkillCoverage } from "../../lib/coverage.ts";

const LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture", ecoute: "Écoute",
};
// Outer ring hue = per-skill identity token; inner ring = accent (mastered).
const SKILL_VAR: Record<Skill, string> = {
  grammaire: "--color-skill-grammaire", vocabulaire: "--color-skill-vocabulaire",
  kanji: "--color-skill-kanji", lecture: "--color-skill-lecture", ecoute: "--color-skill-lecture",
};

const R_OUT = 20, R_IN = 13;
const C_OUT = 2 * Math.PI * R_OUT, C_IN = 2 * Math.PI * R_IN;
const TRACK = "var(--color-line, rgba(236,239,244,0.14))";

/** Dual-ring coverage per BAR_SKILL: outer = vu %, inner = appris %. Numeric labels below
 *  carry exact values (dataviz: never color alone) + are the accessible/offline fallback. */
export function CoverageRings({ coverage }: { coverage: Record<Skill, SkillCoverage> }) {
  return (
    <div className="flex flex-wrap justify-center gap-5 mt-3">
      {BAR_SKILLS.map((s) => {
        const cov = coverage[s] ?? { seen: 0, mastered: 0, seenN: 0, masteredN: 0, total: 0 };
        return (
          <div key={s} className="flex flex-col items-center gap-1 text-center">
            <svg
              width="52" height="52" viewBox="0 0 52 52"
              role="img" aria-label={`${LABELS[s]} : vu ${cov.seen} %, appris ${cov.mastered} %`}
            >
              <circle cx="26" cy="26" r={R_OUT} fill="none" strokeWidth="4" style={{ stroke: TRACK }} />
              <circle
                cx="26" cy="26" r={R_OUT} fill="none" strokeWidth="4" strokeLinecap="round"
                transform="rotate(-90 26 26)"
                strokeDasharray={C_OUT} strokeDashoffset={C_OUT * (1 - cov.seen / 100)}
                style={{ stroke: `var(${SKILL_VAR[s]}, var(--color-accent))` }}
              />
              <circle cx="26" cy="26" r={R_IN} fill="none" strokeWidth="4" style={{ stroke: TRACK }} />
              <circle
                cx="26" cy="26" r={R_IN} fill="none" strokeWidth="4" strokeLinecap="round"
                transform="rotate(-90 26 26)"
                strokeDasharray={C_IN} strokeDashoffset={C_IN * (1 - cov.mastered / 100)}
                style={{ stroke: "var(--color-accent)" }}
              />
            </svg>
            <span className="text-meta text-fg-dim">{LABELS[s]}</span>
            <span className="text-meta text-fg-dim">
              vu <b className="text-fg">{cov.seen}%</b> · appris <b className="text-fg">{cov.mastered}%</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

> During implementation, confirm the rings against the **dataviz** skill (contrast, secondary encoding). The numeric labels already satisfy "never color alone".

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/dashboard/CoverageRings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire `Dashboard` to accept + render coverage** (`src/features/dashboard/Dashboard.tsx`)

Change the import line and signature, and render the rings under `<SkillChart>`:

```tsx
import { passTier, type DashboardModel } from "../../lib/scoring.ts";
import { SkillChart } from "./SkillChart.tsx";
import { CoverageRings } from "./CoverageRings.tsx";
import type { SkillCoverage } from "../../lib/coverage.ts";
import type { Skill } from "../../types/progress.ts";

export function Dashboard(
  { model, days, coverage }:
  { model: DashboardModel | null; days: number; coverage?: Record<Skill, SkillCoverage> | null },
) {
```

Then, immediately after `<SkillChart mastery={model.barMastery} />`:

```tsx
      <SkillChart mastery={model.barMastery} />
      {coverage && <CoverageRings coverage={coverage} />}
```

- [ ] **Step 6: Wire `App.tsx`**

```tsx
import { InstallPrompt } from "./features/pwa/InstallPrompt.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { useCoverage } from "./features/dashboard/useCoverage.ts";
import { coverageBySkill, type SkillCoverage } from "./lib/coverage.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { Skill } from "./types/progress.ts";

export function DashboardView(
  { model, days, coverage }:
  { model: DashboardModel | null; days: number; coverage?: Record<Skill, SkillCoverage> | null },
) {
  return (
    <>
      <InstallPrompt />
      <Dashboard model={model} days={days} coverage={coverage} />
    </>
  );
}

export default function App() {
  const [progress] = useProgress();
  const coverage = useCoverage(progress);
  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;
  return <DashboardView model={model} days={daysUntilExam(now)} coverage={coverage} />;
}
```

> `coverageBySkill`/`SkillCoverage` are imported for the type only if needed; keep only the imports you use (typecheck will flag unused). Minimal set: `useCoverage`, `SkillCoverage`, `Skill`.

- [ ] **Step 7: Wire `EntrainementApp.tsx` + `EntrainementHome.tsx`**

In `EntrainementApp.tsx`, add the hook + thread the prop:

```tsx
import { useCoverage } from "./features/dashboard/useCoverage.ts";
import type { SkillCoverage } from "./lib/coverage.ts";
// … in EntrainementAppView props type, add:
//   coverage?: Record<Skill, SkillCoverage> | null;
// … pass it into <EntrainementHome … coverage={props.coverage} />
// … in EntrainementApp():
  const coverage = useCoverage(progress);
// … in the returned <EntrainementAppView … coverage={coverage} />
```

In `EntrainementHome.tsx`, add `coverage?: Record<Skill, SkillCoverage> | null` to the props type (import `SkillCoverage` from `../../lib/coverage.ts`) and forward it: `<Dashboard model={props.model} days={props.days} coverage={props.coverage} />`.

- [ ] **Step 8: Verify the whole build + tests**

Run: `bun run typecheck && bun test`
Expected: PASS. Fix any unused-import or prop-threading type errors surfaced.

- [ ] **Step 9: Commit**

```bash
git add src/features/dashboard/CoverageRings.tsx src/features/dashboard/CoverageRings.test.tsx \
        src/features/dashboard/Dashboard.tsx src/App.tsx src/EntrainementApp.tsx \
        src/features/entrainement/EntrainementHome.tsx
git commit -m "feat : anneaux de couverture (vu/appris) sous le radar du tableau de bord"
```

---

### Task 7: `resetProgress` clears the coverage bitsets

**Files:**
- Modify: `src/lib/datajson.ts` (`resetProgress`, ~l.39)
- Test: `src/lib/datajson.test.ts` (append)

**Interfaces:**
- Consumes: nothing new. Produces: the blank blob written by `resetProgress` now includes `seen: "", mastered: ""`.

- [ ] **Step 1: Write the failing test** (append to `src/lib/datajson.test.ts`)

```ts
test("resetProgress writes empty coverage bitsets", () => {
  const s = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 9, skill: {}, seen: "AAA", mastered: "BBB" }) });
  resetProgress(s as any);
  const blob = JSON.parse((s as any).getItem("jlptN3adapt_v2"));
  expect(blob.seen).toBe("");
  expect(blob.mastered).toBe("");
  expect(blob.total).toBe(0);
});
```

> Use the same `memStore` / `resetProgress` imports the existing tests in this file already use.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/datajson.test.ts`
Expected: FAIL — `blob.seen` is `undefined`, not `""`.

- [ ] **Step 3: Edit `resetProgress`** — add the two fields to the blank blob:

```ts
    const blank = { skill: blankSkills(), total: 0, right: 0, bestStreak: 0, streak: 0, wrong: [], history: [], lastDiag: null, gram: {}, seen: "", mastered: "" };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/datajson.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/datajson.ts src/lib/datajson.test.ts
git commit -m "feat : réinitialiser efface aussi la couverture (seen/mastered)"
```

---

### Task 8 (⚠ DEFERRED): record seen/mastered in `useQuiz.choose()`

> **Do NOT start until the parallel `useQuiz.ts` work has landed and `git status` is clean.**
> This is the single collision point with the concurrent session. Re-read `choose()` before editing — line numbers below may have shifted.

**Files:**
- Modify: `src/features/quiz/useQuiz.ts` (imports + inside `choose`)
- Test: `src/features/quiz/useQuiz.recording.test.tsx` (new file to avoid clashing with the parallel session's `useQuiz.test.ts`)

**Interfaces:**
- Consumes: `setBit`, `hasBit`, `decodeBits`, `encodeBits` (Task 1); `Progress.seen/mastered` (Task 4).
- Produces: after `choose(i)`, the persisted blob's `seen` bit for `q.id` is set; `mastered` bit is set iff the answer was correct.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/quiz/useQuiz.recording.test.tsx
import { test, expect } from "bun:test";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { decodeBits, hasBit, encodeBits, emptyBits, setBit } from "../../lib/coverage.ts";

// Unit-level proof of the read-modify-write the hook performs (mirrors choose()'s logic).
test("recording sets seen always and mastered only when correct", () => {
  localStorage.clear();
  writeProgress({ total: 0, skill: {} });

  const record = (id: number, correct: boolean) => {
    const raw = readRawProgress();
    const seen = encodeBits(setBit(decodeBits(typeof raw?.seen === "string" ? raw.seen : ""), id));
    const patch: Record<string, unknown> = { seen };
    if (correct) patch.mastered = encodeBits(setBit(decodeBits(typeof raw?.mastered === "string" ? raw.mastered : ""), id));
    writeProgress(patch);
  };

  record(4406, true);
  record(15, false);

  const raw = readRawProgress()!;
  expect(hasBit(decodeBits(raw.seen as string), 4406)).toBe(true);
  expect(hasBit(decodeBits(raw.mastered as string), 4406)).toBe(true);
  expect(hasBit(decodeBits(raw.seen as string), 15)).toBe(true);
  expect(hasBit(decodeBits(raw.mastered as string), 15)).toBe(false); // wrong → not mastered
});
```

Run: `bun test src/features/quiz/useQuiz.recording.test.tsx` → Expected: PASS immediately (it exercises Task 1 + storage, proving the recipe). This locks the contract the hook edit must satisfy.

- [ ] **Step 2: Add imports to `useQuiz.ts`**

```ts
import { decodeBits, encodeBits, setBit } from "../../lib/coverage.ts";
```

- [ ] **Step 3: Edit `choose()`** — replace the existing `writeProgress({ … })` call with the coverage-aware version:

```ts
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
```

(`raw` here is the `readRawProgress()` already captured at the top of `choose`; `q`, `correct`, `nextSkill`, `nextWrong`, `numField` are all in scope.)

- [ ] **Step 4: Verify**

Run: `bun run typecheck && bun test`
Expected: PASS (including the parallel session's `useQuiz.test.ts` — the new fields are additive).

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz/useQuiz.ts src/features/quiz/useQuiz.recording.test.tsx
git commit -m "feat : quiz enregistre la couverture (vu toujours, maîtrisé si correct)"
```

---

## Final verification

- [ ] `bun run typecheck` — clean.
- [ ] `bun test` — all green.
- [ ] `bun run build` then `bunx serve _site` — open `/#/entrainement`, answer a few questions, return to the hub, confirm the rings fill (vu ≥ appris) and the mastery bars read lower early then climb. (No `sw.js` bump needed — the HTML is network-first; a real `location.reload()` loads the new bundle.)

## Notes / backlog (not in this plan)

- Cross-device coverage is last-write-wins (same as R/t today). Union-merge (OR of bitsets) in `gist.ts` → future ticket.
- "Mastered = recent/spaced" (SRS) — deliberately not done; we use correct-once.
- Unifying `useQuiz.ensureBankIndex` onto `loadBankIndex` — optional consolidation.
- Écoute coverage is available in the model but not shown (dashboard shows the 4 `BAR_SKILLS`, matching today's radar).
