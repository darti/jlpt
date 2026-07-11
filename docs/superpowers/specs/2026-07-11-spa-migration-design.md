# SPA Migration — collapse the multi-page app into one React SPA (design)

**Status:** approved shape, decomposed into 3 slices (each gets its own plan).
**Date:** 2026-07-11.

## Goal

Finish the strangler migration: replace the multi-entry setup (5 separate pages, 2 of
them still vanilla) with **one React single-page app** using client-side routing, and
**delete every remaining vanilla file** (`dict.js`, `theme.css`, `progress.js`, the
`sync-dict`/`sync-examples` tools, and the per-page HTML shells).

**Non-goals / out of scope:** no new features (the deferred hub stubs — Diagnostic,
Apprendre, Réviser les erreurs — stay `bientôt`); no redesign; existing URLs are NOT
preserved (breaking URL changes are fine).

## Target architecture

One HTML entry (`index.html`) mounts a **`react-router-dom` `HashRouter`** SPA. Hash
routing (`/#/quiz`) is chosen because GitHub Pages is a static host with no server
rewrites — hash routes need no `404.html` redirect hack and survive refresh/deep-links.

### Route table

| Route | Content | Source |
|-------|---------|--------|
| `/` | Tableau de bord | existing `App` (dashboard) |
| `/quiz` | Quiz adaptatif | existing `QuizApp` |
| `/entrainement` | Hub Entraînement | existing `EntrainementApp` |
| `/planning` | Planning 20 semaines | **new** (ported from `planning-n3.html`) |
| `/cours` | Cours N3 | **new** (ported from `cours-n3.html`) |

### Shell / layout (the key refactor)

Today each of `App` / `QuizApp` / `EntrainementApp` renders its **own** `Header` +
`TopNav` + `Footer` + `UpdateBanner`, and each calls `useTheme` / `useServiceWorker`.
In the SPA that shell is hoisted **once** into an `AppShell` layout that wraps the
`<Routes>` (React Router layout route + `<Outlet/>`):

- `AppShell` owns: `useTheme` (theme + toggle), `useServiceWorker` (update banner +
  version), the `Header`/`TopNav`/`Footer`/`UpdateBanner`, and a **one-time
  `setupDict()`** at mount (furigana/tap available app-wide, data from `data/dict.json`).
- Each route component becomes **content-only** — the existing pure `*View` components
  (`AppView`, `QuizAppView`, `EntrainementAppView`) are refactored to drop the shell
  (`Header`/`TopNav`/`Footer`), keeping only their page content.
- Theme is shared via a small `ThemeContext` (or props from the layout) so `TopNav`'s
  toggle and the hub `Settings` toggle both drive the one `useTheme`.

### `TopNav` → router nav

`TopNav`'s `<a href="*.html">` links become `<NavLink to="…">`; `active` is derived from
the current route (`NavLink`'s active state), not a hardcoded flag.

### Quiz session handoff (params)

The hub→quiz handoff moves from `window.location.search` to the router:
- `nav.ts` `sessionHref(min)` / `resumeHref()` → return router paths (`/quiz?min=15`,
  `/quiz?resume=1`); `SessionLauncher`/`ResumeBanner` use `useNavigate` (in-app nav, no
  full reload).
- `useQuiz`'s `parseSessionParams` reads from React Router's `useSearchParams` instead of
  `window.location.search` (the pure `parseSessionParams(search)` helper is unchanged and
  still unit-tested; only its caller changes).

## Data flow (unchanged)

`data/*.json` stay the source of truth, loaded at runtime: quiz banks
(`data/bank-*.json`), dict (`data/dict.json` via `src/lib/dict.ts`), and — after the
cours port — examples (`data/examples.json`). No inline-sync remains.

## PWA / service worker

Single entry simplifies `sw.js`: precache `index.html` + the hashed JS/CSS chunks isn't
practical (hashes change per build), so keep the current strategy — **network-first for
the one HTML** (`index.html`), **cache-first runtime** for same-origin assets (hashed
chunks + `data/*.json` cached on first fetch). `SHELL` precache shrinks to `./`,
`index.html`, `manifest.webmanifest`, icons. Bump `CACHE` on each slice that ships.

## Build / deploy

- Build collapses to a single entry: `bun build ./index.html --minify --splitting
  --outdir=_site` (ECharts stays lazy).
- `deploy.yml` stops copying vanilla files as they're deleted; end state copies only
  `data/`, icons, `manifest.webmanifest`, `sw.js` (+ `README`). No per-page HTML, no
  `dict.js`/`theme.css`/`progress.js`.
- `dev.ts` collapses its `routes` to the single entry; `STATIC_FILES` keeps only
  `data/*.json` + icons/manifest/sw (drops vanilla pages as they port).
- `validate.yml`: drop `sync-dict --check` / `sync-examples --check` once their targets
  are deleted; `validate.mjs` (data/*.json validation) stays.

## Testing

- Route content: the existing `*View` SSR smoke tests keep working (they render content
  components with props). Components that call router hooks (`useSearchParams`,
  `useNavigate`, `NavLink`) are tested wrapped in `<MemoryRouter>`.
- `AppShell` gets a smoke test (renders nav + outlet under `MemoryRouter`).
- New `/planning` and `/cours` components: pure logic unit-tested (planner date/state,
  cours example rendering), SSR smoke for the views, happy-dom for stateful handlers
  (planner checkboxes).

## Deletions (final state)

Removed by the end of slice 3: `quiz.html` + `app-n3.html` (redirect stubs from slice 1,
deleted here once no vanilla page links to them), `cours-n3.html`, `planning-n3.html`
(shells → routes), `dict.js`, `theme.css`, `progress.js` (already dead),
`tools/sync-dict.mjs`, `tools/sync-examples.mjs`, `vocab-data.js` (already gone).
Kept: `index.html` (the SPA entry), `sw.js`, `manifest.webmanifest`, `tools/validate.mjs`,
all `data/*.json`, all `src/`.

## Decomposition — 3 slices (each its own plan)

**Slice 1 — SPA shell.** Add `react-router-dom`; make `index.html`/`index.tsx` the single
entry mounting `<HashRouter>` + `AppShell` (hoisted Header/TopNav/Footer/UpdateBanner +
theme + SW + one-time `setupDict`). Routes `/`, `/quiz`, `/entrainement` (refactor the
three `*View`s to content-only). `TopNav` → `NavLink`; quiz param handoff → router.
`cours`/`planning` nav links point to the still-vanilla `*.html` (external) for now.
Replace `quiz.html` + `app-n3.html` with **redirect stubs** (→ `index.html#/quiz`,
`index.html#/entrainement`) — NOT deleted yet — so links FROM the still-vanilla
cours/planning pages (whose nav points at `app-n3.html`) keep working during the
transition. Merge `quiz.tsx`/`app-n3.tsx` into the single entry. Single-entry build +
`dev.ts` + `deploy.yml` + `sw.js` (bump CACHE). App works at every step.

**Slice 2 — port `planning-n3`.** New `/planning` route: React port of the 20-week
planner (start-date `jlptN3_planStart`, per-task state `jlptN3progress_v1`, font-scale),
oku tokens. `TopNav` `/planning` becomes an internal route. Delete `planning-n3.html`.

**Slice 3 — port `cours-n3` + final cleanup.** New `/cours` route: course content
(examples from `data/examples.json`, furigana via `src/lib/dict.ts`), oku tokens. Content
strategy (how to bring ~2500 lines of authored prose into React — structured data vs
imported HTML/MDX) is decided in this slice's own plan. Delete `cours-n3.html` — and since
that removes the last consumer of `dict.js`/`theme.css`, delete `dict.js`, `theme.css`,
`progress.js`, `sync-dict.mjs`, `sync-examples.mjs`; trim `deploy.yml`/`dev.ts`/
`validate.yml`; bump CACHE.

## Risks / open questions

- **R1 — cours content port (slice 3) is the biggest unknown:** ~2500 lines of authored
  HTML + 138 examples. Its plan must pick a content strategy that preserves the material
  exactly without hand-rebuilding every line. Flagged, decided in that slice.
- **R2 — theme sharing:** hoisting `useTheme` to `AppShell` means the hub `Settings`
  toggle must reach it (context or lifted callback) — verify no double theme source.
- **R3 — hash routing + PWA:** confirm the SW's network-first HTML rule + hash routes play
  well offline (the single `index.html` serves all routes; hash never hits the network).
- **R4 — in-repo links:** any hardcoded `*.html` links (nav, quiz handoff, dashboard CTAs)
  must move to router paths; grep for `.html` references during slice 1.
