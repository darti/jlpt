# Mode « Diagnostic » (override total, récurrent) — design

**Date** : 2026-07-13
**Statut** : approuvé (design), spec en relecture
**Portée** : sous-projet #3 du chantier « carte de session adaptative » (après #1, #2)

## Objectif

Rendre réel le mode **Diagnostic** : une session-test qui évalue le niveau réel de l'apprenant
(toutes catégories, difficultés variées), **sans corrigé au fil de l'eau**, et affiche à la fin
un **niveau estimé** + une **correction complète**. Proposé au 1ᵉʳ lancement (jamais évalué) puis
**tous les 7 jours**. C'est une **prise de contrôle totale** de la session (pas un ingrédient).

## Contexte (état actuel, après #2)

- `pickSessionPlan` (`src/features/entrainement/sessionPlan.ts`) émet déjà `{ kind: "diagnostic" }`
  quand `caps.diagnostic && (daysSinceDiagnostic == null || ≥ DIAGNOSTIC_INTERVAL_DAYS=7)`. `BUILT_CAPS.diagnostic`
  est `false` et `start()` passe `daysSinceDiagnostic: null` en dur → jamais émis aujourd'hui.
- `useQuiz.start()` gère aujourd'hui uniquement `plan.kind === "composed"` (`if (plan.kind !== "composed") return;`).
- **Notation déjà en place** : `updateRating` (`src/lib/elo.ts`) — K=**40** si `t<10` (calibration rapide),
  sinon 24 ; `dashboardModel` (`src/lib/scoring.ts`) produit `level` (N4-/N4+/N3-/N3/N3+ via `ratingLabel`),
  `passPct`, `barMastery` par skill, à partir des ratings Elo.
- Flux quiz : phases `home | question | corrige | results` ; `choose(i)` écrit le rating +
  progression puis passe en `corrige` ; `next()` avance ou finit (`results`). `QuestionCard` et
  `Corrige` (correct/faux + explication + analyse + `od`) sont réutilisables tels quels.
- Persistance : blob `jlptN3adapt_v2` via `readRawProgress`/`writeProgress`.
- `questionCount(minutes)` (bank.ts, ajouté au #2) : minutes → nb de questions [4,45].

## Décisions (validées)

- **Longueur pilotée par le temps** : budget = `questionCount(min)` (comme une session normale).
- **Mesure** (Elo normal) : les réponses alimentent `updateRating` comme d'habitude. Aucun moteur de
  notation nouveau, aucun reset de `t`. Au 1ᵉʳ passage `t=0` → K=40 calibre vite ; ensuite ça confirme.
- **Tout droit** : répondre → question suivante directement (on **saute** la phase `corrige`).
- **Notifier au début** : un écran d'intro « mode test » avant la 1ᵉʳ question.
- **Correction à la fin** : après le niveau estimé, le bilan complet des questions (réutilise `Corrige`).
- **Non bloquant** : l'intro offre **[Plus tard]** → lance une **session normale** cette fois, **sans
  reset** du timer 7 j (re-proposé au prochain *Commencer*). On ne force jamais le test.
- **Carte inchangée** (« magique ») : le diagnostic se déclenche sur *Commencer* quand il est dû.

## Ce qu'on construit

### 1. `selectDiagnostic(poolsBySkill, total, rng)` — sélection large (pure)
Nouveau helper pur (`src/lib/bank.ts`, avec les autres utilitaires de pioche) :
- répartit `total` ~également sur les 5 skills (`floor(total/5)` + reste distribué) ;
- **étale les difficultés** dans chaque skill (rotation d=1/2/3) pour trianguler le niveau — au lieu
  de la pondération par maîtrise de `pickAdaptive` ;
- renvoie la liste `shuffle`-ée. Pas de doublon (pioche par skill dans des pools disjoints).

### 2. Persistance `lastDiagnosticAt` + câblage `daysSinceDiagnostic`
- À la fin du test, `writeProgress({ diagAt: <timestamp> })`. Nouveau champ `diagAt` (number) dans le blob.
- `start()` lit `diagAt` et calcule `daysSinceDiagnostic = diagAt ? (now − diagAt)/JOUR : null`, injecté
  dans l'état de `pickSessionPlan`.
- Flip **`BUILT_CAPS.diagnostic = true`**.

### 3. `start()` — branche diagnostic
Quand `plan.kind === "diagnostic"` : charger les 5 pools (`loadCategory`), `selectDiagnostic(...)`,
entrer en **mode diagnostic**, `phase = "diag-intro"` (on ne démarre pas encore les questions).
`start(minArg, { skipDiagnostic: true })` (appelé par **[Plus tard]**) force `caps.diagnostic=false`
pour ce lancement → chemin `composed` normal.

### 4. Machine à états — mode diagnostic
Ajout d'un état `mode: "normal" | "diagnostic"` et d'un accumulateur `diagAnswers: { question, chosen }[]`.
Nouvelles phases : `diag-intro`, `diag-results`.
- **`diag-intro`** : `DiagnosticIntro` — notifie (N questions, sans corrigé au fil de l'eau, bilan à la
  fin) + boutons **[Commencer le test]** (`beginDiagnostic()` → `phase="question"`, index 0) et
  **[Plus tard]** (`start(min, { skipDiagnostic:true })`).
- **`question`** (mode diag) : `choose(i)` écrit le rating (`updateRating`, identique au normal) **et**
  pousse `{ question, chosen }` dans `diagAnswers`, puis **avance directement** — index++ (reste
  `question`) ou, à la dernière, `writeProgress({ diagAt: now })` + `phase="diag-results"`. **Pas de
  phase `corrige`.**
- **`diag-results`** : `DiagnosticResults` — en tête « Ton niveau estimé : N3- » (`dashboardModel` :
  `level` + `passPct` + barres) ; en dessous, la **correction** : pour chaque `diagAnswers[i]`, un
  `QuestionCard` (répondu) + `Corrige`. Bouton **[Terminé]** → `phase="home"`, `mode="normal"`,
  `diagAnswers=[]`.

### 5. Composants
- `src/features/quiz/DiagnosticIntro.tsx` : `{ count, onStart, onLater }`, pur.
- `src/features/quiz/DiagnosticResults.tsx` : `{ model: DashboardModel, answers: { question, chosen }[], onDone }`,
  pur. Rend son **propre** résumé de niveau compact (label + `passPct` + barres par skill) **depuis `model`**
  (pas de couplage au composant `Dashboard` de l'Accueil, potentiellement lié à sa mise en page), suivi de
  `QuestionCard`/`Corrige` par question. (`dashboardModel(progress, now)` est calculé dans le conteneur
  `EntrainementApp` et passé en prop — `now` reste hors des composants purs.)

## Flux résumé

`Commencer` → `start()` : si diagnostic dû → `diag-intro` → [Commencer le test] → `question`×N (tout
droit) → `diag-results` (niveau + correction) → [Terminé] → hub. [Plus tard] → session normale.

## Tests (TDD)

- `bank.test.ts` : `selectDiagnostic` — répartition ~égale sur 5 skills (somme = total, ±reste) ;
  étalement des difficultés (les 3 niveaux présents quand le pool le permet) ; pas de doublon ; borne
  quand un pool est petit.
- `sessionPlan.test.ts` : mettre à jour le contrat `BUILT_CAPS` (diagnostic désormais émis quand dû) ;
  cas `daysSinceDiagnostic < 7` ⇒ composed, `null`/`≥7` ⇒ diagnostic.
- `DiagnosticIntro` / `DiagnosticResults` : SSR smoke (le titre « mode test », le niveau estimé, la
  présence d'un `Corrige` par réponse). ⚠ `renderToStaticMarkup` échappe les apostrophes.
- Intégration (happy-dom, patron `EntrainementApp.start.test.tsx`) : avec `diagAt` absent (jamais évalué)
  et l'index mocké, un *Commencer* mène à `diag-intro` ; [Commencer le test] enchaîne les questions
  **sans** `corrige` ; à la fin, `diag-results` affiche le niveau et écrit `diagAt`. Vérifier aussi
  qu'un `diagAt` récent (< 7 j) mène à une session composée normale.

## Fichiers

- **Modifié** : `src/lib/bank.ts` (+`selectDiagnostic`), `src/features/entrainement/sessionPlan.ts`
  (flip flag), `src/features/quiz/useQuiz.ts` (mode/phases diagnostic, `start()` branche + `skipDiagnostic`,
  `choose()` branche diag, persistance `diagAt`), `src/EntrainementApp.tsx` (routage phases `diag-intro`/
  `diag-results` + calcul `dashboardModel`), + tests correspondants.
- **Nouveau** : `src/features/quiz/DiagnosticIntro.tsx`, `src/features/quiz/DiagnosticResults.tsx` (+ smoke tests).
- **Types** : étendre le blob progress lu/écrit avec `diagAt?: number` (storage helpers).

## Hors périmètre

- Apprendre (#4, `newCoursePoints`, `BUILT_CAPS.learn`).
- Sélection **adaptative** type CAT (on reste sur un étalement fixe des difficultés — suffisant avec la
  calibration K=40).
- Comparatif avant/après entre diagnostics, historique des diagnostics (le dashboard Accueil suffit).
- Toute modification de la carte (« magique » inchangée) ou du mode Erreurs/adaptatif.
