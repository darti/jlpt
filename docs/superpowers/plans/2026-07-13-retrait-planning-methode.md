# Retrait de l'onglet Planning + salvage « Méthode N3 » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer l'onglet Planning obsolète et rapatrier ses 3 blocs de méthode intemporels dans une section repliable « La méthode N3 » sur l'Accueil.

**Architecture:** Un nouveau composant statique `MethodeN3` (contenu d'Accueil, co-localisé avec le dashboard) rendu par `DashboardView`. La route `/planning` devient une redirection vers l'Accueil ; toute la feature `planning` et la lib `lib/planning` (planning-only) sont supprimées.

**Tech Stack:** React + TypeScript, bundlé par Bun. react-router-dom (HashRouter en prod, MemoryRouter en test). Tests : `bun test` + `renderToStaticMarkup` (SSR smoke).

## Global Constraints

- **Runtime & outils : `bun` exclusivement — jamais `node`.**
- Tout le travail se fait dans le worktree `.worktrees/retrait-planning-methode`.
- UI en **français**, contenu en **japonais**.
- Tests de composants : envelopper dans `<MemoryRouter>` dès qu'il y a un `Link`/`NavLink`.
- `renderToStaticMarkup` échappe les apostrophes (`'` → `&#x27;`) — **asserter uniquement sur des sous-chaînes sans apostrophe**.
- Sous `<MemoryRouter>`, `Link to="/x"` rend `href="/x"` (**sans** le `#`, contrairement à `HashRouter`).
- **Aucun `data/*.json` ni asset livré ne change → NE PAS bumper `CACHE` dans `sw.js`.**
- Commits fréquents, style du repo : `feat : …`, `refactor : …`, `test : …`. **Pas** de ligne `Co-Authored-By`.

---

### Task 1: Composant `MethodeN3` (TDD)

**Files:**
- Create: `src/features/dashboard/MethodeN3.tsx`
- Test: `src/features/dashboard/MethodeN3.test.tsx`

**Interfaces:**
- Consumes: `Link` de `react-router-dom`.
- Produces: `export function MethodeN3(): JSX.Element` — sans props ; rend un `<details>` repliable.

- [ ] **Step 1: Écrire le test qui échoue**

Create `src/features/dashboard/MethodeN3.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MethodeN3 } from "./MethodeN3.tsx";

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MethodeN3 />
    </MemoryRouter>,
  );
}

test("MethodeN3 rend les 3 blocs de méthode dans une section repliable", () => {
  const html = render();
  expect(html).toContain("<details");                 // repliable
  expect(html).toContain("La méthode N3");             // titre du summary
  expect(html).toContain("Ce qu&#x27;il faut");        // bloc 1 (apostrophe échappée)
  expect(html).toContain("Les 4 phases");              // bloc 2
  expect(html).toContain("Routine quotidienne");       // bloc 3
  expect(html).toContain("650");                        // stat kanji (~650)
});

test("MethodeN3 lie Entraînement et Cours", () => {
  const html = render();
  // MemoryRouter rend les hrefs en chemins nus (sans #, contrairement à HashRouter)
  expect(html).toContain('href="/entrainement"');
  expect(html).toContain('href="/cours"');
});
```

- [ ] **Step 2: Lancer le test — vérifier l'échec**

Run: `bun test src/features/dashboard/MethodeN3.test.tsx`
Expected: FAIL — `Cannot find module "./MethodeN3.tsx"` (le composant n'existe pas).

- [ ] **Step 3: Écrire le composant**

Create `src/features/dashboard/MethodeN3.tsx` :

```tsx
import { Link } from "react-router-dom";

type Phase = "p1" | "p2" | "p3" | "p4";

const CARD = "bg-panel border border-line rounded-xl p-5 shadow-card surface-blur";
const H2 = "text-fg text-lg font-bold border-l-4 border-accent pl-2.5 mt-2 mb-1";
const PHASE_CLS: Record<Phase, string> = {
  p1: "bg-surface-2 text-accent",
  p2: "bg-surface-2 text-prio-high",
  p3: "bg-surface-2 text-status-completed",
  p4: "bg-surface-2 text-status-failed",
};

const STATS: [string, string][] = [
  ["~650", "kanji"],
  ["~3 700", "mots de vocabulaire"],
  ["~150", "points de grammaire"],
  ["95 / 180", "score visé (sécurité)"],
];

const PHASES: [Phase, string, string, string, string][] = [
  ["p1", "Phase 1", "1–5", "Fondations", "Réviser N4, démarrer kanji & grammaire N3, routine quotidienne"],
  ["p2", "Phase 2", "6–11", "Construction", "Gros volume vocab/kanji, grammaire N3 complète, écoute"],
  ["p3", "Phase 3", "12–16", "Consolidation", "Compréhension écrite/orale intensive, révisions espacées"],
  ["p4", "Phase 4", "17–20", "Examen blanc", "Tests chronométrés, points faibles, conditions réelles"],
];

/** Repliable « Méthode N3 » sur l'Accueil : ce qu'il faut maîtriser, les 4 phases,
 *  la routine quotidienne. Contenu d'orientation intemporel récupéré de l'onglet Planning retiré. */
export function MethodeN3() {
  return (
    <details className="bg-panel border border-line rounded-xl shadow-card surface-blur overflow-hidden">
      <summary className="cursor-pointer px-5 py-4 font-bold text-fg text-lg">
        La méthode N3
      </summary>
      <div className="px-5 pb-5 pt-1 flex flex-col gap-5 border-t border-line">

        {/* Ce qu'il faut maîtriser + structure de l'examen */}
        <section>
          <h2 className={H2}>Ce qu'il faut maîtriser au N3</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {STATS.map(([n, l]) => (
              <div key={l} className="bg-surface-2 border border-line rounded-xl p-4">
                <div className="text-xl font-bold text-accent">{n}</div>
                <div className="text-fg-dim text-meta">{l}</div>
              </div>
            ))}
          </div>
          <div className={`${CARD} text-fg-dim text-sm mt-3`}>
            <b className="text-fg">Structure de l'examen :</b> 言語知識 (vocabulaire/kanji 30 min) · 言語知識・読解 (grammaire + compréhension écrite 70 min) · 聴解 (compréhension orale 40 min).
            Il faut <b className="text-fg">≥ 19/60 par section</b> ET un total <b className="text-fg">≥ 95/180</b>. Ne néglige aucune section.
          </div>
        </section>

        {/* Les 4 phases */}
        <section>
          <h2 className={H2}>Les 4 phases</h2>
          <div className={`${CARD} mt-3 overflow-x-auto`}>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-fg-dim">{["Phase", "Semaines", "Focus", "But"].map((h) => <th key={h} className="text-left py-2 px-2 border-b border-line font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {PHASES.map(([p, name, wk, focus, but]) => (
                  <tr key={p} className="align-top">
                    <td className="py-2 px-2 border-b border-line"><span className={`${PHASE_CLS[p]} text-meta font-bold rounded-full px-2 py-0.5 whitespace-nowrap`}>{name}</span></td>
                    <td className="py-2 px-2 border-b border-line text-fg-dim">{wk}</td>
                    <td className="py-2 px-2 border-b border-line text-fg">{focus}</td>
                    <td className="py-2 px-2 border-b border-line text-fg-dim">{but}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Routine quotidienne */}
        <section>
          <h2 className={H2}>Routine quotidienne (≈ 60–90 min/jour)</h2>
          <div className={`${CARD} mt-3 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-sm`}>
            <b className="text-accent">15 min</b><span className="text-fg-dim"><Link to="/entrainement" className="text-accent">Entraînement</Link> — un quiz du jour (kanji + vocabulaire), puis « Réviser mes erreurs ».</span>
            <b className="text-accent">20 min</b><span className="text-fg-dim"><Link to="/cours" className="text-accent">Cours de grammaire</Link> : 1 à 2 nouveaux points + écris 2 phrases à toi avec chacun.</span>
            <b className="text-accent">20 min</b><span className="text-fg-dim">Compréhension écrite : relis les exemples du cours à voix haute, puis quiz « 読解 » de l'app.</span>
            <b className="text-accent">15 min</b><span className="text-fg-dim">Écoute : écoute du japonais autour de toi (audio, vidéos sans sous-titres FR), même en passif.</span>
            <b className="text-accent">+ week-end</b><span className="text-fg-dim">Bilan : un <b className="text-fg">diagnostic complet</b> dans l'app + écris un court journal en japonais.</span>
          </div>
          <p className="text-fg-dim text-sm mt-2">Règle d'or : <b className="text-fg">la régularité bat l'intensité</b>. 60 min/jour valent mieux que 7 h le dimanche.</p>
        </section>

      </div>
    </details>
  );
}
```

- [ ] **Step 4: Lancer le test — vérifier le succès**

Run: `bun test src/features/dashboard/MethodeN3.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/MethodeN3.tsx src/features/dashboard/MethodeN3.test.tsx
git commit -m "feat : composant « Méthode N3 » repliable (à maîtriser / 4 phases / routine)"
```

---

### Task 2: Câbler `MethodeN3` dans l'Accueil (TDD)

**Files:**
- Modify: `src/App.tsx` (`DashboardView`, ~lignes 1-26)
- Test: `src/App.test.tsx` (existant — l'envelopper dans `<MemoryRouter>` + nouvelle assertion)

**Interfaces:**
- Consumes: `MethodeN3` de `./features/dashboard/MethodeN3.tsx`.
- Produces: `DashboardView` rend désormais `<MethodeN3 />` après la section « Progression ».

**⚠️ Note critique :** `App.test.tsx` rend actuellement `DashboardView` **sans** Router. `MethodeN3` utilise `Link`, qui **lève une exception hors contexte Router**. Il faut donc envelopper le rendu du test existant dans `<MemoryRouter>`, sinon TOUT le fichier de test casse.

- [ ] **Step 1: Mettre à jour le test (RED)**

Dans `src/App.test.tsx`, ajouter l'import `MemoryRouter`, envelopper le rendu, et ajouter l'assertion « Méthode N3 ». Remplacer le contenu par :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { DashboardView } from "./App.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import type { Progress } from "./types/progress.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R, t: 60 }, vocabulaire: { R, t: 60 }, kanji: { R, t: 60 }, lecture: { R, t: 60 } },
});

test("DashboardView renders stats + progression chart + méthode (install + sync live on Paramétrage)", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <DashboardView model={model} days={model.days} scores={[]} />
    </MemoryRouter>,
  );
  expect(html).toContain("17%");                                 // Dashboard stat
  expect(html).toContain("Progression");                         // chart section moved from Entraînement
  expect(html).toContain("Au moins 2 diagnostics");              // ProgressChart empty state
  expect(html).toContain("La méthode N3");                       // section méthode rapatriée du Planning
  expect(html).not.toContain("Installer");                       // InstallPrompt moved to Paramétrage
  expect(html).not.toContain("Synchronisation multi-appareils"); // sync moved to Paramétrage
});
```

- [ ] **Step 2: Lancer le test — vérifier l'échec**

Run: `bun test src/App.test.tsx`
Expected: FAIL — l'assertion `toContain("La méthode N3")` échoue (DashboardView ne rend pas encore `MethodeN3`).

- [ ] **Step 3: Câbler le composant dans `App.tsx`**

Ajouter l'import en tête de `src/App.tsx` (après les autres imports `./features/dashboard/…`) :

```tsx
import { MethodeN3 } from "./features/dashboard/MethodeN3.tsx";
```

Puis dans `DashboardView`, ajouter `<MethodeN3 />` après la section Progression :

```tsx
  return (
    <>
      <Dashboard model={model} days={days} coverage={coverage} />
      <section className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
        <h2 className="text-fg text-lg font-bold mt-0 mb-3">Progression</h2>
        <ProgressChart scores={scores} />
      </section>
      <MethodeN3 />
    </>
  );
```

- [ ] **Step 4: Lancer le test — vérifier le succès**

Run: `bun test src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat : afficher « Méthode N3 » sur l'Accueil (sous le graphe de progression)"
```

---

### Task 3: Retirer la route + la nav Planning, ajouter la redirection (TDD)

**Files:**
- Modify: `src/entries/index.tsx` (imports + route `planning`)
- Modify: `src/ui/TopNav.tsx` (tableau `ROUTES`)
- Modify: `src/ui/shell.test.tsx:29` (assertion nav)

**Interfaces:**
- Consumes: `Navigate` de `react-router-dom`.
- Produces: nav sans entrée « Planning » ; `#/planning` redirige vers `#/`.

- [ ] **Step 1: Mettre à jour le test de la nav (RED)**

Dans `src/ui/shell.test.tsx`, remplacer la ligne 29 :

```tsx
  expect(html).toContain('href="/planning"');       // Planning internal route
```

par :

```tsx
  expect(html).not.toContain('href="/planning"');    // onglet Planning retiré (méthode rapatriée sur l'Accueil)
```

- [ ] **Step 2: Lancer le test — vérifier l'échec**

Run: `bun test src/ui/shell.test.tsx`
Expected: FAIL — la nav contient encore `href="/planning"` (TopNav pas encore modifié).

- [ ] **Step 3: Retirer l'entrée nav dans `TopNav.tsx`**

Dans `src/ui/TopNav.tsx`, supprimer la ligne du tableau `ROUTES` :

```tsx
  { to: "/planning", label: "Planning" },
```

`ROUTES` devient :

```tsx
const ROUTES = [
  { to: "/", label: "Accueil", end: true },
  { to: "/entrainement", label: "Entraînement" },
  { to: "/cours", label: "Cours" },
  { to: "/parametrage", label: "Paramétrage" },
];
```

- [ ] **Step 4: Remplacer la route par une redirection dans `entries/index.tsx`**

Dans `src/entries/index.tsx` :

1. Ajouter `Navigate` à l'import react-router-dom (ligne 3) :

```tsx
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
```

2. Supprimer l'import de `Planning` (ligne 8) :

```tsx
import { Planning } from "../features/planning/Planning.tsx";
```

3. Remplacer la route `planning` (ligne 22) :

```tsx
          <Route path="planning" element={<Planning />} />
```

par :

```tsx
          <Route path="planning" element={<Navigate to="/" replace />} />
```

- [ ] **Step 5: Lancer les tests — vérifier le succès**

Run: `bun test src/ui/shell.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/entries/index.tsx src/ui/TopNav.tsx src/ui/shell.test.tsx
git commit -m "refactor : retirer l'onglet Planning de la nav + rediriger /planning vers l'Accueil"
```

---

### Task 4: Supprimer la feature `planning` et la lib `lib/planning`

**Files:**
- Delete: `src/features/planning/Planning.tsx`, `usePlanning.ts`, `weeks.ts`, `planning.test.tsx`, `usePlanning.test.ts`
- Delete: `src/lib/planning.ts`, `src/lib/planning.test.ts`

**Interfaces:**
- Rien ne consomme plus ces fichiers après la Task 3 (vérifié : seuls la feature planning et ses tests importaient `lib/planning` ; `entries/index.tsx` n'importe plus `Planning`). Le dashboard utilise `daysUntilExam` de `lib/scoring.ts`, pas de `lib/planning.ts`.

- [ ] **Step 1: Supprimer les fichiers**

```bash
git rm src/features/planning/Planning.tsx \
       src/features/planning/usePlanning.ts \
       src/features/planning/weeks.ts \
       src/features/planning/planning.test.tsx \
       src/features/planning/usePlanning.test.ts \
       src/lib/planning.ts \
       src/lib/planning.test.ts
```

- [ ] **Step 2: Vérifier l'absence de référence morte (`.ts` ET `.tsx`)**

Run:
```bash
grep -rniE "features/planning|lib/planning|usePlanning|from \"\.\./\.\./lib/planning" src --include="*.ts" --include="*.tsx"
```
Expected: aucune sortie (exit 1). Si une référence subsiste, la corriger avant de continuer.

- [ ] **Step 3: Suite de tests complète + typecheck + build**

Run:
```bash
bun test
bun run typecheck
bun run build
```
Expected: tous verts ; `bun run build` réussit sans erreur.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor : supprimer la feature planning + lib/planning (obsolètes, méthode rapatriée)"
```

---

## Vérification finale (manuelle, hors steps)

Après la Task 4, servir le build et contrôler visuellement (cf. gotcha HashRouter : faire un vrai `location.reload()`, pas juste changer le hash) :

```bash
bunx serve _site
```
- La barre de nav n'affiche plus « Planning ».
- `#/planning` redirige vers l'Accueil (`#/`).
- L'Accueil affiche, sous le graphe, la section repliable « La méthode N3 » (repliée par défaut) ; l'ouvrir montre les 3 blocs ; les liens « Entraînement » et « Cours de grammaire » naviguent correctement.

## Self-review (renseigné par l'auteur du plan)

- **Couverture spec** : composant MethodeN3 (T1) ✓ ; câblage Accueil (T2) ✓ ; suppression route + nav (T3) ✓ ; redirection /planning (T3) ✓ ; suppression feature + lib + tests (T4) ✓ ; pas de bump sw (contrainte globale) ✓ ; clé `jlptN3progress_v1` laissée inerte (hors périmètre) ✓.
- **Placeholders** : aucun — chaque step porte le code/commande complet.
- **Cohérence des types** : `MethodeN3()` sans props, importé identiquement en T1/T2 ; `Navigate` importé en T3.
