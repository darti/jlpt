# Review Team — Consolidated Report

**Scope:** `docs/superpowers/plans/2026-07-11-app-n3-entrainement-hub-slice.md` (implementation plan for the app-n3 Entraînement hub)
**Intent:** Replace vanilla `app-n3.html` with a React "entraînement hub" (progress + ECharts chart + session launcher + settings + Gist sync) that launches the shipped `quiz.html`.

> **Dispatch note (honest disclosure — required by the skill's "Be honest about skips" rule):**
> The `/review` skill specifies dispatching seven named subagents (`team-spec-surveyor`, `team-devils-advocate`, `team-stub-hunter`, `team-test-auditor`, `team-dep-auditor`, `team-breaking-change-detector`, `team-picky-reviewer`) in parallel. **This environment exposes no `Agent`/`Task` subagent-dispatch tool** (only the `TaskCreate`/`TaskUpdate` list tools and `SendMessage`, and the seven `team-*` subagent types are not registered). I therefore could **not** spawn the seven parallel agents. Rather than fabricate seven verdict blocks (an explicit anti-pattern), I ran the review **myself as orchestrator across all seven axes**, verifying every claim against the actual codebase (`gist.ts`, `elo.ts`, `scoring.ts`, `storage.ts`, `useQuiz.ts`, `sw.js`, `scripts/dev.ts`, `package.json`, `quiz.html`, `src/types/progress.ts`). Findings below are grounded in that source inspection, organized by the seven axes so nothing is dropped.

**Reviewers who ran:** 0/7 as isolated agents (tool unavailable) — all 7 axes covered by orchestrator against ground truth.
**Overall verdict:** **CHANGES REQUESTED** — the plan ships two data-model assumptions that don't hold and one React closure bug; tests as written will fail against the real reused code.

### Summary
- Critical: 3
- Major: 5
- Minor: 4
- Deferred: 4

---

## Remediation Plan

### CRITICAL (must fix before merge)

**C1. Task 2 — `exportJson` cannot round-trip `jlptN3_gh`; the test asserts it does.**
- **Axis:** test-auditor, spec-surveyor, picky-reviewer
- **Why:** `collectData` (gist.ts:84) filters to keys starting with `jlptN3` **and explicitly excludes `GH_CFG_KEY` (`jlptN3_gh`)**. The plan's Task 2 test seeds `jlptN3_gh: "SECRET"` and round-trips through `importJson`; but `exportJson` will *drop* `jlptN3_gh`, so it is never in the payload. The round-trip test's `total` assertion still passes, but the plan's stated backup shape ("handle the full blob") and the implicit expectation that gist config survives export are wrong. Worse: the plan's Task 2 test #1 comment says "preserving progress keys" while seeding a token that is deliberately *not* a progress key — misleading and a latent security expectation (users may assume export contains their token; it must not, by design).
- **Fix:** Remove `jlptN3_gh` from the Task 2 test fixtures (or assert it is **absent** from the export). State explicitly in the plan that the GitHub token is intentionally excluded from backups (matches `collectData`). Keep the `total`-round-trip assertion.
- **Effort:** S

**C2. Tasks 4 & 7 — `ProgressChart` data source (`S.history` diagnostic scores /180) does not exist in the reused model.**
- **Axis:** spec-surveyor, devils-advocate, picky-reviewer
- **Why:** Task 7 feeds the chart from `S.history.filter(mode==='diagnostic').map(p=>p.score)`. But the typed `Progress` (`src/types/progress.ts`) is only `{ total, skill }` — **no `history`**. `readProgress`/`readRawProgress`/`asProgress` never surface a `history` array, and `dashboardModel` (scoring.ts) exposes **no `score`/180 field** — it works in Elo ratings + a `sectionTotal` (0–180-ish) that is *not* a per-diagnostic score. The plan asserts "Reads (%/score/level/days) via `scoring.ts` — no re-derivation", but a diagnostic-score-over-time series is **not derivable** from `scoring.ts` as it stands. The chart, its empty-state, and the `resetProgress` `history: []` field all rest on a shape the reused code doesn't model.
- **Fix:** Before Task 4, decide and document the real data source: (a) read the raw `jlptN3adapt_v2.history` via `readRawProgress` (untyped) and define its element shape `{ mode, score, t }` explicitly with a typed accessor + test, OR (b) drop the "diagnostics /180" framing and chart something the model *does* expose (e.g. `sectionTotal` snapshots, or per-skill Elo). Do not assume `S.history` exists — verify the vanilla `app-n3.html` actually writes it and in what shape. Add a `readDiagnosticScores(store): number[]` pure helper (TDD) so Task 4 has a real, tested input.
- **Effort:** M

**C3. Task 3 — mount-effect auto-start uses a stale `start` closure and reads `resume` before it is set.**
- **Axis:** picky-reviewer, test-auditor, devils-advocate
- **Why:** Two concrete React bugs in the wiring sketch:
  1. `start` is `useCallback(async () => {…}, [selected, minutes])` — it closes over `minutes` **state**. The plan's `setMinutes(params.min); start(…)` in one synchronous pass calls the **previous** `start` bound to the old `minutes` (10), so `?min=15` starts a 10-minute session. `setMinutes` won't have re-rendered/rebuilt `start` yet.
  2. `resume` is populated by an effect (`setResume(readResumeState())`, useQuiz.ts:136-139) that runs *after* first paint. A sibling mount effect calling `resumeNow()` for `?resume=1` sees `resume === null` (resumeNow.ts:253 `if (!r) return;`) and silently no-ops. Also `start()` takes **no argument** today, so `start(/* using params.min */)` is not implementable without an API change.
- **Fix:** Give `start` an explicit optional `minutesArg`/`catsArg` so it doesn't depend on pending state (`start(min?: number)` reading `min ?? minutes`); or compute the session length from a ref. For resume, drive off `readResumeState()` directly in the auto-resume path (not the async `resume` state), or gate the auto-effect on `resume !== null` with a "consume once" ref. Update Task 3 Step 3 to modify `start`'s signature and add a test that `?min=15` actually yields a 15-minute allocation.
- **Effort:** M

---

### MAJOR (should fix before merge)

**M1. Task 2 — `importJson` will import a `jlptN3_gh` token if present in an untrusted JSON file.**
- **Axis:** picky-reviewer (security), dep-auditor
- **Why:** `applyData` writes **every** key in `payload.store` verbatim (gist.ts:97-100). `importJson` gates only on `payload.store` being an object. A hand-crafted/hostile backup file could inject `jlptN3_gh` (a GitHub token config) or arbitrary `jlptN3*` keys into the user's localStorage on import. `exportJson` never emits the token (C1), so a legitimate export can't carry it — meaning any `jlptN3_gh` in an import is by definition foreign.
- **Fix:** In `importJson`, strip/deny `jlptN3_gh` (and ideally whitelist known keys) before `applyData`, or document the trust boundary. At minimum, don't let import overwrite the Gist credential.
- **Effort:** S

**M2. Task 4 — ECharts is a heavy new dependency; the plan under-specifies the bundle-size gate and offline caching.**
- **Axis:** dep-auditor, devils-advocate
- **Why:** `bun add echarts` pulls a large lib into a PWA that today ships hand-rolled vanilla + small React. The plan says "note the chart chunk size" but sets **no budget/threshold** and no fail condition. Task 8 Step 4 says "hashed ECharts chunk is runtime-cached (leave out of precache)" — but a PWA that must work **offline** (a stated constraint) will show a broken chart on first offline load if the chunk was never precached. The chart is lazy by nature; that's fine, but the offline story must be explicit.
- **Fix:** Set a concrete budget (e.g. "chart chunk gzipped < 120 KB, else reconsider a lighter lib / inline SVG"). Decide the offline contract: either precache the chart chunk, or make the empty/loading state graceful when the chunk can't load offline. Justify ECharts vs. a lighter alternative (uPlot, or hand-rolled SVG) given only one line chart is needed.
- **Effort:** M

**M3. Task 2 — `resetProgress` blob shape is invented, not verified against the vanilla writer.**
- **Axis:** spec-surveyor, stub-hunter
- **Why:** The reset blob hardcodes `{ skill: blankSkills(), total, right, bestStreak, streak, wrong: [], history: [], lastDiag: null }`. Only `total`/`skill` are in the typed `Progress`; `bestStreak`/`streak`/`history`/`lastDiag`/`gram` are vanilla-owned fields the plan is *guessing* at. `writeProgress` deep-merges and preserves unknown fields, but `resetProgress` **overwrites** the whole blob — so any vanilla field not listed here (e.g. `gram`, seen in storage.ts comments) is silently wiped, potentially corrupting what the still-live vanilla diagnostic path reads.
- **Fix:** Read the actual initial/blank blob the vanilla `app-n3.html` creates and mirror it exactly, or reset by clearing to `{}` and letting the vanilla lazy-defaults rebuild. Enumerate every field the vanilla app owns before hardcoding a replacement.
- **Effort:** M

**M4. Task 3 — `?min` clamp max (60) is asserted but never justified against session allocation.**
- **Axis:** test-auditor, devils-advocate
- **Why:** The test asserts `parseSessionParams("?min=999").min === 60`. But `allocate((c)=>mastery, minutes)` (bank.ts) may not produce a sane session at 60, and the launcher chips are 5/10/15 — 60 is arbitrary and untested end-to-end. A clamp that silently rewrites 999→60 also hides launcher bugs.
- **Fix:** Pick the clamp bound from the actual `allocate` behavior / question-bank size, and add a test that `min=60` yields a non-empty session. Keep chips and clamp bounds consistent.
- **Effort:** S

**M5. Test coverage — every new component test is an SSR `renderToStaticMarkup` smoke test; the effect-side behavior (the actual logic) is untested.**
- **Axis:** test-auditor
- **Why:** `ProgressChart` (ECharts init/dispose/resize), `SessionLauncher` navigation (`location.href=…`), `ResumeBanner` localStorage read, and `Settings` export/import/reset handlers all live in effects/handlers that `renderToStaticMarkup` **never runs**. The plan's tests only assert static French strings render. The genuinely risky code (URL building, `bumpFs`+`applyFontScale` wiring, confirm-gated import) has zero behavioral coverage.
- **Fix:** Add at least one DOM/handler test per interactive component (happy-dom / jsdom, or extract pure helpers: `sessionHref(minutes)`, `resumeHref()`, already-pure `parseSessionParams`). The pure-helper extraction is cheap and testable without a DOM.
- **Effort:** M

---

### MINOR (nice to have)

**m1. `cssVar` reads `getComputedStyle` guard but not `document` guard.**
- **Axis:** picky-reviewer
- `ProgressChart#cssVar` guards `typeof getComputedStyle === "undefined"` but then calls `document.documentElement`. It's only called from inside the effect (browser-only), so it's safe today — but the guard is misleading. Either guard `document` too or drop the half-guard and rely on the effect being browser-only.
- **Effort:** S

**m2. `readFs` accepts 0.7–2.0 but `bumpFs` clamps to 0.8–1.8 — asymmetric ranges are a footgun.**
- **Axis:** picky-reviewer
- `readFs` returns a stored `1.9` as valid (in [0.7,2]) but `bumpFs` can never *produce* 1.9. A value outside [0.8,1.8] persists until the user bumps. Documented in the plan as intentional ("valid 0.7–2, clamp on bump 0.8–1.8"), so this is a nit — but consider clamping reads to the same window applied to CSS.
- **Effort:** S

**m3. Task 8 SW cache bump (v82→v83) but ECharts chunk hash changes every build.**
- **Axis:** picky-reviewer, dep-auditor
- Leaving the hashed chunk out of precache means the SW's `CACHE` version bump doesn't cover it; fine, but document that the runtime cache can accumulate stale ECharts chunks across deploys (no cleanup in the `activate` handler for runtime-cached hashed assets — it only deletes non-current *caches*, and these live in the same `CACHE`). Minor storage growth.
- **Effort:** S

**m4. `entrainement.test.tsx` is imported/extended across Tasks 5 & 6 with duplicate top-of-file imports.**
- **Axis:** picky-reviewer
- Task 5 and Task 6 both add `import … from` lines to the same test file; the plan's snippets each re-declare `test`/`renderToStaticMarkup` imports. Ensure the final file has single imports (a copy-paste hazard for the implementing agent).
- **Effort:** S

---

### DEFERRED (backlog candidates)

**D1. Strangler leaves Diagnostic/SRS as «bientôt» stubs — vanilla code drops from the tree.**
- The plan notes the vanilla diagnostic/SRS code becomes unreachable (recoverable from git). But `resetProgress`/import still write `lastDiag`/`history` fields those flows own. Track the eventual re-port so the data model and the UI don't drift.
- **Suggested backlog task:** `/backlog Re-port diagnostic + SRS flows to React (currently «bientôt» stubs); reconcile history/lastDiag data model`

**D2. Two apps share `jlptN3adapt_v2` but use different resume keys (`jlptN3_resume` vs `jlptN3quiz_resume`).**
- Intentional (documented in useQuiz.ts:21-24) but a latent source of "why didn't my session resume" confusion once app-n3 is the React hub launching quiz.html. Worth a note in user-facing docs.
- **Suggested backlog task:** `/backlog Document/unify resume-key split between hub and quiz after app-n3 becomes React`

**D3. ECharts choice vs. a single line chart — revisit lib weight post-ship.**
- Captured under M2; if the budget is exceeded, this becomes a real swap. Keep as a follow-up even if it ships.
- **Suggested backlog task:** `/backlog Evaluate replacing ECharts with uPlot/inline-SVG for the single progress line chart`

**D4. No end-to-end test that the hub→quiz handoff (`?min`/`?resume`) actually starts/resumes a session.**
- Task 8 Step 6 is a manual controller check. Worth a headless smoke (playwright/happy-dom) so the handoff doesn't silently regress.
- **Suggested backlog task:** `/backlog Add e2e smoke: app-n3 hub launches quiz.html?min=… and ?resume=1 correctly`

---

## Axis coverage (what each of the 7 lenses found)

| Axis | Verdict | Key findings |
|------|---------|--------------|
| **spec-surveyor** | PARTIAL | C1 (export shape), C2 (no history/score in model), M3 (reset shape guessed) |
| **devils-advocate** | RISKS | C2, M2 (ECharts weight/offline), M4 (clamp), D1–D4 |
| **stub-hunter** | MINOR | M3 (guessed blob fields); plan is otherwise unusually complete (real code + tests in Tasks 1–4). `start(/* … */)` and `params.resume && /* valid resume */` are unfilled sketches (rolled into C3). |
| **test-auditor** | GAPS | C1 (test asserts impossible round-trip), C3 (untested stale-closure path), M4, M5 (SSR-only smoke tests miss all effect logic) |
| **dep-auditor** | CONCERN | M2 (ECharts unbudgeted, offline caching underspecified), m3 |
| **breaking-change-detector** | LOW | `app-n3.html` URL preserved; `useQuiz` gains an export (`parseSessionParams`) + a signature change to `start` (C3) — internal, no external consumers. SW cache bump handled. No public API break. |
| **picky-reviewer** | BUGS | C3 (React closures), M1 (import injects token), m1, m2, m4 |

---

## Next steps (Phase 5 — your call)

1. **Fix CRITICAL now** — I can revise the plan doc to correct C1 (export/token test), C2 (real chart data source + TDD helper), and C3 (`start` signature + resume wiring). These are plan edits, not code.
2. **Capture DEFERRED** — run `/backlog` for D1–D4 (commands above).
3. **Re-review after edits** — re-run once the plan reflects the real `gist.ts`/`scoring.ts`/`useQuiz.ts` contracts.
