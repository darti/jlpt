# Review Team — Consolidated Report

**Scope:** `docs/superpowers/plans/2026-07-10-dashboard-react-bun-slice.md` (implementation plan for the first strangler slice: migrating `index.html` to React + Bun), checked against the live codebase (`index.html`, `progress.js`, `sw.js`, both `.github/workflows/*.yml`, `theme.css`, `CLAUDE.md`) and the design spec `docs/superpowers/specs/2026-07-10-react-bun-migration-design.md`.

**Reviewers who ran:** 7/7 axes evaluated. Environment note: the specialized subagent launcher (`Agent`/`Task` with named `team-*` reviewer types) is **not available in this session** — no agent-spawning tool surfaced via ToolSearch, and the only team tools present (`TaskCreate`/`SendMessage`) spawn generic teammates, which the skill forbids substituting. Each reviewer's **axis** was therefore evaluated directly by the orchestrator against fully-gathered Phase-1 context. This is disclosed honestly per the skill's "be honest about skips" rule; findings are backed by concrete file:line evidence rather than agent verdicts.

**Overall verdict:** **CHANGES REQUESTED** — the plan is well-structured and mostly faithful to the design, but it is built on a **factually wrong premise about where the scoring math lives**, and its reimplementation **diverges from the real source of truth**, violating the plan's own "scoring math identical" hard constraint. Two deploy/PWA edits would **break the still-live vanilla pages in production**.

### Summary
- Critical: 4
- Major: 5
- Minor: 4
- Deferred: 5

---

## Remediation Plan

### CRITICAL (must fix before merge)

1. **[Plan Task 2 / whole-plan premise]** — Scoring math is NOT "duplicated inline in index.html"; it lives in the shared module `progress.js` (`window.JLPTProgress`). Re-anchor the extraction on that file.
   - **Why:** The plan's Architecture/Task 2 says scoring is "identical to current `index.html`" and the design spec (§72) says it's "dupliqué inline dans index.html ET app-n3.html". In reality `index.html:131` loads `<script src="progress.js">` and calls `JLPTProgress.successModel / mastery / ratingLabel / daysToExam` (`index.html:142,148,151,155`). `app-n3.html` also delegates to the *same* module (`app-n3.html:361,658,659`). The math is already extracted and shared — the plan re-derives it from a misreading, which is how the divergences below crept in.
   - **Fix:** Change Task 2 to port `progress.js` verbatim into `src/lib/scoring.ts`, preserving every formula. Use `progress.js` as the golden reference for the tests (ideally cross-check TS output against the JS module on shared fixtures).
   - **Flagged by:** spec-surveyor, picky-reviewer, devils-advocate
   - **Effort:** M

2. **[Plan Task 2, `scoring.ts` — `level()` and `SKILLS`]** — The level/rating average drops the `ecoute` skill, changing the "niveau" output vs. production.
   - **Why:** `progress.js:6,40-47` computes `ratingLabel` averaging over **five** categories `['grammaire','vocabulaire','kanji','lecture','ecoute']`. The plan's `SKILLS` has only four (no `ecoute`) and `level()` averages `SKILLS` (Task 2, Step 4). For any user with an `ecoute` rating ≠ the others, the displayed level differs — a direct violation of the "Scoring math identical" hard constraint. (The plan's unit test masks this by using an all-equal `flat()` fixture where 4-avg == 5-avg.)
   - **Fix:** Include `ecoute` in the rating average (or replicate `skR`'s default of `1450` for a missing `ecoute` entry, which is what production does). Decide deliberately whether the dashboard's skill *bars* still show 4 skills while the *level* average uses 5 — production shows 4 bars but averages 5.
   - **Flagged by:** picky-reviewer, spec-surveyor, test-auditor
   - **Effort:** S

3. **[Plan Task 2, `scoring.ts` — listening section]** — `dashboardModel` hardcodes the listening *fallback* and ignores real `ecoute` data, changing pass% and score for any user who has done listening.
   - **Why:** `progress.js:17-23` computes `listening = skT(ecoute) >= 3 ? mastery(ecoute) : 0.85*((langage+grammLect)/2)`. The plan's `dashboardModel` only ever computes `list = 0.85 * ((lang+gram)/2)` — it never reads `ecoute` mastery or the `t` (attempt-count) field. Users with ≥3 listening attempts get a *different* estimated pass % and /180 score than production. Also violates "scoring math identical." The plan's `Progress` type omits the `t` field entirely, so the branch is unrepresentable.
   - **Fix:** Add `t?: number` to the per-skill shape, include `ecoute` in `Skill`/`SKILLS`, and replicate the `skT(ecoute) >= 3` branch verbatim. Add a test fixture *with* listening data to cover the real branch.
   - **Flagged by:** picky-reviewer, spec-surveyor, test-auditor
   - **Effort:** M

4. **[Plan Task 9, `sw.js` + deploy `cp` list]** — Dropping `progress.js` from the precache SHELL and the deploy artifact **breaks the still-vanilla `app-n3.html` in production**.
   - **Why:** `app-n3.html` (untouched this slice) does `<script src="progress.js">` and hard-depends on `JLPTProgress` (`app-n3.html:361,658,659`; 7 refs total). The current deploy `cp`s `progress.js` (`deploy.yml:42`) and `sw.js` precaches it (`sw.js:14`). The plan's Task 9 replacement SHELL and `cp` lines **omit `progress.js`**, so after deploy the training page would 404 on its scoring module and the dashboard's own ported logic loses its cross-check reference. This is a production regression, not a dashboard-only change.
   - **Fix:** Keep `progress.js` in both the `sw.js` SHELL array and the deploy `cp` line until `app-n3.html` is migrated. (It is the shared module — it only leaves the `cp` list when the *last* consumer is ported.)
   - **Flagged by:** breaking-change-detector, spec-surveyor, picky-reviewer
   - **Effort:** S

### MAJOR (should fix before merge)

5. **[Plan Task 9, `sw.js` version]** — `CACHE` is set to `jlpt-n3-v79`, but the current live value is **already `v79`** (`sw.js:6`). No bump = clients never invalidate the old cache.
   - **Why:** The whole point of the SW version bump (CLAUDE.md "Gotchas", `sw.js:6`) is to force clients to pick up new assets. Reusing the current version defeats it; the React shell would not reach existing installed users.
   - **Fix:** Bump to `jlpt-n3-v80` (or next). Add a plan note that the number must be re-checked against `main` at implementation time, since other commits may also bump it.
   - **Flagged by:** picky-reviewer, spec-surveyor
   - **Effort:** S

6. **[Global Constraints / Task 9]** — "bun exclusively — never node" is contradicted by an existing CI workflow the plan doesn't touch. The deploy edit also silently drops the `README.md` copy line.
   - **Why:** `.github/workflows/` contains a second workflow, **`Validation du contenu`**, which runs `node tools/validate.mjs`, `node tools/sync-dict.mjs --check`, etc. on every push/PR. The plan's global "never node" rule and its Task 9 (which only edits `deploy.yml`) ignore it, so either the constraint is already false repo-wide or that workflow needs porting — unaddressed scope. Separately, the plan's replacement deploy step omits the existing `cp README.md _site/ 2>/dev/null || true` line (`deploy.yml:44`).
   - **Fix:** Scope the "bun only" rule to the migration's own new code, explicitly acknowledging the pre-existing node-based content-validation CI as out-of-slice (or add a task to port it). Restore the `README.md` copy line in the Task 9 deploy snippet.
   - **Flagged by:** spec-surveyor, devils-advocate, dep-auditor
   - **Effort:** S

7. **[Plan Task 1, Step 4 — vendoring]** — Task depends on an absolute, machine-local path `~/Projects/darticorp/oku-theory/oku-ui/packages/ui/src/styles.css` that no CI or teammate has. Vendored content is unspecified.
   - **Why:** `cp ~/Projects/darticorp/...` only works on the author's machine; the CI `bun install --frozen-lockfile` build (Task 9) has no access to it, and a subagent executing this plan will fail at Step 4. Because the file is "copied verbatim," the plan can't state what tokens/utilities it actually provides — yet later tasks assume tokens like `text-meta`, `z-toast`, `shadow-hover`, `bg-surface-2`, `text-card` exist.
   - **Fix:** Vendor the file into the repo as part of *this* commit (it's git-tracked per the File Structure), and enumerate the specific tokens/utilities the dashboard relies on so their existence is verifiable. Remove the machine-local `cp` from the runtime steps.
   - **Flagged by:** stub-hunter, dep-auditor, devils-advocate
   - **Effort:** M

8. **[Plan Tasks 6-8 — token usage vs. vendored layer]** — Multiple utility classes are used that are not shown to exist in the vendored token layer, risking silent no-style output.
   - **Why:** `UpdateBanner` uses `z-toast` and `shadow-hover`; `Dashboard` uses `text-meta` and `bg-surface-2`/`text-status-completed`/`text-prio-high`; `TopNav`/`Footer` use `text-fg-dim`. `themes.css` (Task 1, Step 5) defines `--color-*` custom properties, but Tailwind v4 only generates a `bg-surface-2` utility if `--color-surface-2` is registered in `@theme` (not just in a `[data-theme]` block). The plan registers the four `--color-skill-*` in `@theme` (Step 4) but the *semantic* tokens (`surface-2`, `status-completed`, `prio-high`, `fg-dim`, …) are only asserted to come "from oku-ui" — unverified. If any is missing, the class emits nothing and the look silently breaks. The "no arbitrary values" rule is also self-violated: `h-[9px]`, `max-w-[680px]`, `max-w-[560px]` are arbitrary values (Task 6/7/8).
   - **Fix:** After vendoring, add a Task-1 verification step that greps the generated `styles.gen.css` for each semantic utility the dashboard uses. Either add tokens for the pixel values (`--spacing`/a `text-*` token) or explicitly carve out `[px]` sizing as an allowed exception in the Global Constraints.
   - **Flagged by:** picky-reviewer, spec-surveyor, test-auditor
   - **Effort:** M

9. **[Plan Tasks 6-8 — component smoke tests assert nothing about parity]** — Tests check for substrings that are trivially present and skip the values most likely to regress.
   - **Why:** `shell.test.tsx` asserts `"JLPT N3"`, `"app-n3.html"`, `"Recharger"` — none of which exercise the scoring/parity risk. The `Dashboard` test asserts `"86/180"` and `"17%"` for the all-1600 fixture, but those numbers were derived from the plan's *own* (diverging) formula, not from `progress.js`; a test that encodes the wrong oracle passes while the behavior is wrong. No test covers: listening-data branch, `ecoute` in the level average, the `?`/`—` low-data placeholders with the real model, or theme persistence writing both `jlptN3_theme` and `jlptN3_updatedAt`.
   - **Fix:** Derive expected scoring values by running the fixtures through the *actual* `progress.js` and asserting the TS port matches. Add the listening-branch and 5-skill-average cases.
   - **Flagged by:** test-auditor, picky-reviewer
   - **Effort:** M

### MINOR (nice to have)

10. **[Plan Task 1, Step 8 — thin-shell `index.html`]** — The rewritten shell drops several head tags present in production: `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` (`index.html:9-12`). These affect installed-PWA appearance on iOS.
    - **Fix:** Preserve the four meta tags in the thin shell. **Flagged by:** spec-surveyor, picky-reviewer. **Effort:** S

11. **[Plan Task 7 — Dashboard omits UI present today]** — The current dashboard renders a gauge marker (`.seg`/`.mk`, `index.html:165`), the install button + iOS guide, and the version label (`verLabel`). The plan's `Dashboard`/`AppView` drop the gauge and defer `InstallPrompt` (listed in File Structure but never implemented in any task) and the version label.
    - **Fix:** Either implement `InstallPrompt`/version label in this slice or explicitly list them as deferred debt in the Self-Review (currently they silently vanish). **Flagged by:** spec-surveyor, stub-hunter. **Effort:** M

12. **[Plan Task 8, Step 6 — manual parity step]** — "Verify visual parity in the browser" is the only guard for the whole look-identical constraint and is manual/subjective. Given the token-existence risk (#8) it is under-specified.
    - **Fix:** Add a concrete before/after screenshot comparison against the live dashboard with a known `jlptN3adapt_v2` fixture. **Flagged by:** test-auditor, devils-advocate. **Effort:** S

13. **[Plan Task 1, `scripts/dev.ts`]** — Design §103 specifies `bun --hot ./index.html` for HMR; the plan's dev script uses `bun ./index.html` (no `--hot`), losing hot reload.
    - **Fix:** Use `bun --hot ./index.html` per the design. **Flagged by:** spec-surveyor. **Effort:** S

### DEFERRED (backlog candidates)

1. **Gist sync (PAT scope `gist`) not addressed.** — Design §27 lists Gist multi-device sync as a hard "must not regress" constraint, but the plan never mentions it. It appears to live in `app-n3.html` (still vanilla), so likely fine this slice — but it should be explicitly confirmed as out-of-scope rather than omitted.
   - **Suggested backlog task:** run `/backlog Confirm Gist sync is untouched by the dashboard slice and ticket its migration for the app-n3 slice`
   - **Flagged by:** spec-surveyor, devils-advocate

2. **`dict.js` global not loaded on the new shell.** — The plan defers it (Self-Review notes it), matching design §168. Worth a tracked ticket so the furigana/`initDefs` path isn't forgotten when `cours-n3` is migrated.
   - **Suggested backlog task:** run `/backlog Port dict.js furigana/definition globals during the cours-n3 slice`
   - **Flagged by:** devils-advocate

3. **`_site` build output pollution / `.gitignore`.** — Plan ignores `_site/` and `styles.gen.css` but the build writes hashed chunks referenced by a network-first SW; verify no stale `_site` is ever committed and that local `bun run build` before deploy matches CI.
   - **Suggested backlog task:** run `/backlog Add a CI guard that _site is never committed and that the local build matches CI output`
   - **Flagged by:** devils-advocate, dep-auditor

4. **New dependency surface (React 19, react-dom, tailwind v4 CLI, TS 5.7, @types).** — All are justified by the design decision to move to React+TS; none are known-vulnerable. `@types/bun: "latest"` is an unpinned floating range — minor supply-chain hygiene concern.
   - **Suggested backlog task:** run `/backlog Pin @types/bun to a fixed version range in package.json`
   - **Flagged by:** dep-auditor

5. **SPA collapse / routing future.** — Design §68-69 flags the eventual multi-entry→SPA collapse as optional follow-up. Not a blocker; capture so the "migration ledger" (deploy cp list) is periodically revisited.
   - **Suggested backlog task:** run `/backlog Revisit multi-entry→SPA collapse after all four pages are migrated`
   - **Flagged by:** devils-advocate

---

## Per-axis notes (orchestrator's synthesis)

- **team-spec-surveyor:** Plan covers the design's task decomposition well and the Self-Review's spec-coverage table is a genuine strength. But it inherits the design's factual error about the scoring location, drops the 5th skill and listening branch (breaking "identical math"), misses the Gist constraint and the four iOS meta tags, deviates from `--hot`, and its "bun only" rule collides with the existing node CI. Findings #1,2,3,6,10,13; deferred #1.
- **team-devils-advocate:** Biggest design risk is re-deriving math the codebase already centralizes in `progress.js` — a maintenance and correctness trap. Machine-local vendoring path is a single point of failure for CI and any executing agent. Manual-only parity verification is weak given token uncertainty. Findings #1,6,7,12; deferred #2,3,5.
- **team-stub-hunter:** No literal TODO/TBD markers (Self-Review §2 is correct on that narrow point). But `InstallPrompt.tsx` is listed in File Structure and never implemented by any task — a structural stub. Vendored CSS content is unspecified. Findings #7,11.
- **team-test-auditor:** Tests are present and follow RED→GREEN, but the scoring oracle is self-referential (derived from the plan's own diverging formula, not `progress.js`), and the highest-risk branches (listening data, 5-skill level average, theme dual-key persistence) are untested. All-equal fixtures hide the divergences. Findings #2,3,8,9,12.
- **team-dep-auditor:** New deps are justified and scoped to the migration decision; none known-vulnerable. Concerns: `@types/bun: latest` floating range; the machine-local oku-ui source is an unmanaged "dependency"; the node-based content CI is an undeclared toolchain the "bun only" claim ignores. Findings #6,7; deferred #4.
- **team-breaking-change-detector:** The consumer-facing break is dropping `progress.js` from precache + deploy while `app-n3.html` still imports it → production 404 on a live page. The un-bumped SW version is a second consumer-update failure (clients keep stale cache). Findings #4,5.
- **team-picky-reviewer:** Correctness bugs #2,3 (math divergence), #4,5 (deploy/SW), plus style/rule self-violations: arbitrary `[px]` values used despite the "no arbitrary values" rule, and semantic utilities used without verifying the vendored `@theme` registers them. Findings #2,3,4,5,8,9.
