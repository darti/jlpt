# Retrait de l'onglet Planning — salvage « Méthode N3 »

**Date** : 2026-07-13
**Type** : refactor / nettoyage (retrait d'une feature obsolète + salvage de contenu)
**Branche** : `retrait-planning-methode`

## Contexte & motivation

L'onglet **Planning** (`/planning`, `src/features/planning/`) est un portage verbatim de
l'ancienne page vanilla `planning-n3.html`. Il rend cinq blocs :

1. Compte à rebours vers l'examen (6 déc. 2026) + barre de progression du plan
2. « Ce qu'il faut maîtriser » (grille de stats) + carte « Structure de l'examen »
3. Tableau des 4 phases
4. Routine quotidienne
5. Accordéon 20 semaines avec cases à cocher (persistées dans `jlptN3progress_v1`)

Les sous-projets #1–#5 ont transformé l'app en **moteur adaptatif** (diagnostic, mode
« Apprendre », « Réviser mes erreurs », rappel de cours) : c'est désormais l'**Entraînement**
qui décide quoi étudier, dynamiquement. L'onglet Planning est donc devenu obsolète pour
trois raisons vérifiées dans le code :

- **Contenu figé qui dérive** : l'accordéon (`weeks.ts`) référence « leçons 1–2 », « leçons
  18–20 » codés en dur, sans lien avec `data/cours-*.json`. Dès que le cours bouge, le
  planning ment.
- **Compte à rebours dupliqué** : `App.tsx` (Accueil) affiche déjà `daysUntilExam(now)`. Il
  existe **deux** `daysUntilExam` (`lib/scoring.ts` **et** `lib/planning.ts`) ; le dashboard
  utilise celui de `scoring`, celui de `planning` ne sert qu'à cet onglet.
- **État orphelin** : la checklist écrit dans `jlptN3progress_v1`, clé localStorage que
  **personne d'autre ne lit** (l'adaptatif vit dans `jlptN3adapt_v2`).

**Décision produit** (validée) : **sauver la méthode, supprimer la checklist**. Les blocs 2–4
sont du contenu d'orientation intemporel que le moteur adaptatif ne remplace pas ; seuls le
compte à rebours (déjà ailleurs), la barre de progression du plan et l'accordéon 20 semaines
sont redondants.

**Emplacement du salvage** (validé) : Accueil, dans une section repliable.

## Objectif

Retirer l'onglet Planning et toute sa machinerie ; rapatrier les 3 blocs de méthode dans une
section repliable **« La méthode N3 »** sur l'Accueil, sous le dashboard et le graphe de
progression.

## Design

### Nouveau composant — `src/features/dashboard/MethodeN3.tsx`

Co-localisé avec `Dashboard.tsx` / `ProgressChart.tsx` (contenu d'Accueil). Exporte
`MethodeN3()`. Rend un `<details>` **replié par défaut** (pas d'attribut `open`), résumé
« La méthode N3 », contenant les trois blocs repris de `Planning.tsx` :

1. **« Ce qu'il faut maîtriser »** — grille de 4 stats (`~650` kanji, `~3 700` mots,
   `~150` points de grammaire, `95 / 180` score visé) + carte « Structure de l'examen »
   (言語知識 / 読解 / 聴解, seuils ≥ 19/60 et ≥ 95/180).
2. **« Les 4 phases »** — tableau (Phase, Semaines, Focus, But). Les 4 lignes et les
   libellés de phase (« Phase 1 »…) sont **inlinés** dans le composant.
3. **« Routine quotidienne »** — grille horaire (15/20/20/15 min + week-end) avec liens
   `Link` vers `/entrainement` et `/cours`.

**Aucune dépendance à `weeks.ts`** : tout le contenu conservé était déjà des littéraux inline
dans `Planning.tsx`. Le compte à rebours et la barre de progression du plan **ne sont pas**
repris.

Réutilise les mêmes classes utilitaires (constantes locales `PILL`, `CARD`, `H2`, styles de
phase) que l'original, copiées dans le composant.

### Câblage — `src/App.tsx`

`DashboardView` rend `<MethodeN3 />` **après** la section « Progression » :

```tsx
<>
  <Dashboard model={model} days={days} coverage={coverage} />
  <section …>… ProgressChart …</section>
  <MethodeN3 />
</>
```

### Suppressions

- `src/features/planning/` en entier :
  `Planning.tsx`, `usePlanning.ts`, `weeks.ts`, `planning.test.tsx`, `usePlanning.test.ts`
- `src/lib/planning.ts` + `src/lib/planning.test.ts` — 100 % planning-only :
  `mondayOf`, `fmtDay`, `readPlanStart`, `currentWeekIdx`, `weekRange`, et le **doublon**
  `daysUntilExam` (le dashboard conserve celui de `scoring.ts`).
- `src/entries/index.tsx` : import `Planning` + route `/planning` (remplacée, voir compat).
- `src/ui/TopNav.tsx` : entrée nav `{ to: "/planning", label: "Planning" }`.

### Compat bookmarks — redirection `/planning` → `/`

La route `/planning` est remplacée par une redirection `<Navigate to="/" replace />`
(react-router-dom), sur le modèle du précédent `/quiz` → `/entrainement`. Un `#/planning`
en favori atterrit sur l'Accueil au lieu d'une route morte.

### Non-changements

- **Aucun `data/*.json` ni asset livré ne change** → **pas de bump `CACHE` dans `sw.js`**.
  Le HTML est network-first : le nouveau bundle JS arrive au `location.reload()`.
- `tools/copy-static.mjs` : à vérifier qu'aucun stub `planning*.html` n'y est listé (le
  planning était une route hash, pas un fichier livré — a priori rien à retirer).
- Clé localStorage `jlptN3progress_v1` : reste inerte chez les utilisateurs existants,
  plus personne ne la lit. **Pas de migration ni de nettoyage** (YAGNI).

## Tests

- **`src/features/dashboard/MethodeN3.test.tsx`** (nouveau) — SSR smoke via
  `renderToStaticMarkup`, enveloppé dans `<MemoryRouter>` (à cause des `Link`). Asserts sur
  des sous-chaînes **sans apostrophe** (gotcha `renderToStaticMarkup` : `'` → `&#x27;`) :
  « Les 4 phases », « Routine », `650`. Pour les liens : sous `<MemoryRouter>`, `Link`
  rend `href="/entrainement"` (**sans** le `#`, contrairement à `HashRouter`) — asserter
  sur les sous-chaînes `/entrainement` et `/cours`, pas sur `#/…`.
- **`src/ui/shell.test.tsx`** — mettre à jour : la nav ne contient plus « Planning » ;
  vérifier la redirection `/planning` → Accueil si le test couvre le routage.
- Suppression des tests planning (`planning.test.tsx`, `usePlanning.test.ts`,
  `lib/planning.test.ts`).
- `bun test` et `bun run typecheck` verts.

## Critères d'acceptation

1. L'onglet « Planning » a disparu de la barre de navigation.
2. Naviguer vers `#/planning` redirige vers l'Accueil (`#/`).
3. L'Accueil affiche, sous le graphe, une section repliable « La méthode N3 » contenant
   les 3 blocs (à maîtriser + structure examen, 4 phases, routine), repliée par défaut,
   avec liens fonctionnels vers Entraînement et Cours.
4. Aucune référence morte à `features/planning` ou `lib/planning` (grep `.ts` **et** `.tsx`).
5. `bun test` + `bun run typecheck` verts ; `bun run build` réussit.

## Hors périmètre

- Rebrancher un fil d'étude dynamique sur `data/cours` + `jlptN3adapt_v2` (option écartée).
- Nettoyage de la clé `jlptN3progress_v1` côté clients existants.
