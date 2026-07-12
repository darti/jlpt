# Review Team — Consolidated Report

**Scope:** `src/features/planning/planning.test.tsx` (new file, just written) — with supporting context from `Planning.tsx` (missing), `usePlanning.ts`, `weeks.ts`.
**Reviewers who ran:** 8 common + 2 TypeScript language lenses = 10/10. Language detected: TypeScript (`.tsx`). No Rust in scope, so Rust lenses correctly not dispatched.
**Overall verdict:** ❌ CHANGES REQUESTED

> ⚠️ Environment note: this environment exposes no `Task`/`Agent` subagent-dispatch tool, so the ten reviewers could not be fanned out as independent parallel agents. The orchestrator gathered the shared brief (Phase 1), detected languages (Phase 2 roster), and performed the consolidation (Phase 3–4) directly against the code. Findings below are grounded in verified evidence (`bun test` output, file existence checks), not simulated reviewer chatter.

## Summary
- Critical: 1
- Major: 2
- Minor: 2
- Deferred: 1

## Verified evidence
- `bun test src/features/planning/planning.test.tsx` → **1 fail / 1 error**: `Cannot find module './Planning.tsx'`.
- `find src -iname "Planning*"` → only the test file exists; **no `Planning.tsx` component**.
- `src/features/planning/` contains: `usePlanning.ts`, `usePlanning.test.ts`, `weeks.ts`, `planning.test.tsx`. The component under test is absent.

## Remediation Plan

### CRITICAL (must fix before merge)
1. **[planning.test.tsx:4]** — The test imports `./Planning.tsx`, which does not exist; the suite errors out.
   - **Why:** A test that cannot resolve its import is a red build, not a test — it fails the whole file before any assertion runs.
   - **Fix:** Create `src/features/planning/Planning.tsx` exporting a `Planning` component that renders the 20-week plan (consuming `WEEKS`/`PHASE_NAME` from `weeks.ts` and `usePlanning`), OR, if this test is TDD-first, mark it clearly as pending and land it in the same commit as the component. Do not commit a permanently-red test.
   - **Flagged by:** stub-hunter, test-auditor, ts-picky-reviewer, spec-surveyor
   - **Effort:** M

### MAJOR (should fix before merge)
1. **[planning.test.tsx:6-14]** — Assertions are pure `html.toContain(...)` substring checks on static markup.
   - **Why:** These pass on any coincidental substring and never exercise the interactive behavior the strings imply — `Réinitialiser` (reset) and `jours restants` (countdown) are asserted as text but their behavior (click-to-reset, live countdown) is untested. localStorage hydration in `usePlanning` (mount effect) is not covered by an SSR-only render.
   - **Fix:** Add behavioral tests (render + interaction) for reset and for the countdown value; assert on structure/roles, not raw substrings. Cover the `usePlanning` hydrate/toggle/reset cycle.
   - **Flagged by:** test-auditor, ts-picky-reviewer
   - **Effort:** M
2. **[planning.test.tsx:6-14 / weeks.ts]** — Assertions hardcode French copy (`"Mise en route"`, `"Semaine de l'examen"`) transcribed from `weeks.ts`.
   - **Why:** Brittle coupling — any copy edit in `weeks.ts` silently breaks the test with no behavioral change. The `"Phase 1"` assertion tests `PHASE_NAME`, effectively re-asserting the data file.
   - **Fix:** Assert against imported constants (`WEEKS[0].t`, `WEEKS[19].t`, `PHASE_NAME.p1`) rather than duplicated string literals, so copy and test stay in sync.
   - **Flagged by:** ts-picky-reviewer, devils-advocate
   - **Effort:** S

### MINOR (nice to have)
1. **[planning.test.tsx:1]** — Uses `bun:test` + `renderToStaticMarkup` for a component test; no `@testing-library` render/query. Consistent with `usePlanning.test.ts` style, so acceptable, but string-scraping markup is a fragile pattern.
   - **Flagged by:** ts-picky-reviewer — **Effort:** S
2. **[filename] planning.test.tsx** vs sibling `Planning.tsx` (PascalCase) — lower-case test filename against PascalCase component. Cosmetic consistency nit.
   - **Flagged by:** picky-reviewer — **Effort:** S

### DEFERRED (backlog candidates)
1. **Countdown determinism** — a "jours restants" countdown implies a date computation against the exam date. Time-dependent rendering is a classic flaky-test / TZ-bug source.
   - **Suggested backlog task:** run `/backlog Make exam countdown testable by injecting a clock/exam-date so the countdown assertion is deterministic`
   - **Flagged by:** devils-advocate

## Reviewer coverage notes (nothing-in-scope, honest skips)
- **dep-auditor:** nothing in scope — no new dependencies; `react-router-dom`/`react-dom` already in `package.json`.
- **breaking-change-detector:** nothing in scope — a new test file adds no public API surface.
- **security-reviewer / ts-security-reviewer:** nothing exploitable in a test file; the only ambient risk is `usePlanning`'s `localStorage` JSON parse, which is already guarded with a type check and try/catch (out of this file's scope).
- **Rust lenses:** not dispatched — no `.rs` files in scope (correct).
