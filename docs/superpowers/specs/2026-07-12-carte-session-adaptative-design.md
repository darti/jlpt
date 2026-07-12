# Carte de session adaptative — le cerveau + la carte unique — design

**Date** : 2026-07-12
**Statut** : approuvé (design), spec en relecture
**Portée** : sous-projet #1 d'un chantier découpé en 4 (voir « Découpage » ci-dessous)

## Objectif

Remplacer les **4 actions** du hub `/entrainement` (la carte « Lancer une session » +
les 3 stubs « bientôt disponible » Diagnostic / Apprendre / Réviser les erreurs) par **une
seule carte auto-pilotée par l'état courant**.

Principe directeur : **c'est toujours le temps disponible qui pilote la session.** L'apprenant
ne choisit plus ni le mode ni les catégories ; il choisit combien de minutes il a, et le cerveau
compose la session pour lui.

## Découpage du chantier global (rappel)

Le « next-best-action » complet est découpé en 4 sous-projets indépendants, chacun avec son
propre cycle spec → plan → build :

| # | Sous-projet | Ce qu'il construit | Poids |
|---|---|---|---|
| **1** | **Le cerveau + la carte unique** *(ce spec)* | Moteur de décision `état → plan` (capability-aware) + UI de la carte adaptative. | moyen |
| 2 | Mode « Réviser les erreurs » | Ingrédient de session alimenté par `wrong[]`. | petit |
| 3 | Mode « Diagnostic » | Nouveau moteur : test de niveau, calibrage Elo large, écran « niveau estimé ». | gros |
| 4 | Mode « Apprendre » | Branché sur `/cours` : nouveaux points → quiz de consolidation. | gros |

Ordre : 1 → 2 → 3 → 4. Le cerveau est écrit **en entier** dès le #1 ; chaque sous-projet
suivant n'allume qu'une **capacité** (`caps.*`) et implémente le lancement de son ingrédient.

## Contexte (état actuel)

- `/entrainement` (`EntrainementApp` → `EntrainementAppView` → `EntrainementHome`) est un hub
  (phase `home`) : `ResumeBanner` + `QuizHome` (chips catégories + durée 5/10/15 + *Commencer*)
  + 3 stubs désactivés (`STUBS` dans `EntrainementHome.tsx`).
- `useQuiz()` (`src/features/quiz/useQuiz.ts`) est le moteur : détient `phase`
  (`home|question|corrige|results`), `selected` (catégories, défaut `new Set(SKILLS)`),
  `minutes` (défaut 10), `resume`, et les handlers `start` / `choose` / `next` / `restart`
  / `toggleCat` / `setMinutes` / `resumeNow`.
- `start(minArg?)` fait déjà l'allocation adaptative : `allocate((c) => masteryOf(progress, c), min)`
  répartit un budget de questions entre catégories selon la maîtrise, puis `pickAdaptive` pioche
  par catégorie en évitant les doublons et en re-priorisant `wrong[]`.
- État persistant disponible pour le cerveau : `resume` (`readResumeState`, session < 2 j),
  ratings Elo + maîtrise par catégorie (`skillStateOf` / `masteryOf`), et `wrong[]` (les ~80
  derniers items ratés).

## Décisions (validées)

- **Modèle = compositeur de session, pas sélecteur de mode.** Le temps est le budget ;
  l'état pondère la **répartition** du budget entre ingrédients. (Un cap % sur les erreurs
  n'a de sens que dans un mélange.)
- **Deux prises de contrôle totales** (ne se mélangent pas) : `resume` et `diagnostic`.
- **Deux ingrédients** du mélange : `errors` (cap **30 %** du budget) et `learn` (nouveaux
  points de cours) ; l'**adaptatif** remplit le reste.
- **Diagnostic récurrent** : dû si jamais fait **ou** ≥ **7 jours** depuis le dernier.
- **Catégories 100 % auto** : plus de sélection manuelle. `selected` reste `new Set(SKILLS)`.
- **Carte minimale (« magique »)** : la carte n'affiche que le sélecteur de temps + *Commencer* ;
  le mélange reste caché. Exception : l'état « Reprendre » est une action distincte.
- **Cap erreurs rend le seuil minimal inutile** : s'il y a des fautes on en met jusqu'à 30 %,
  sinon l'ingrédient disparaît de lui-même. Pas de seuil « ≥ N ».

## Le cerveau — `pickSessionPlan()` (fonction pure)

Nouveau module `src/features/entrainement/sessionPlan.ts`. Une fonction pure, **capability-aware** :
elle n'émet un mode que si la capacité correspondante est déclarée construite.

```ts
interface SessionState {
  resume: boolean;                    // une session en cours (< 2 j) existe
  daysSinceDiagnostic: number | null; // null = jamais évalué
  wrongCount: number;                 // wrong[].length
  newCoursePoints: number;            // points de cours non travaillés (0 tant que #4 absent)
}

interface Caps {
  diagnostic: boolean;
  errors: boolean;
  learn: boolean;
}

type SessionPlan =
  | { kind: "resume" }                                             // override total
  | { kind: "diagnostic" }                                         // override total
  | { kind: "composed"; alloc: { errors: number; learn: number; adaptive: number } };

function pickSessionPlan(state: SessionState, total: number, caps: Caps): SessionPlan;
```

**`total`** = nombre de questions du budget temps, dérivé des minutes en amont (réutilise
`allocate()` pour le mapping temps → nombre ; voir « Câblage »).

**Décision — premier match gagne :**

1. `state.resume` → `{ kind: "resume" }`
2. `caps.diagnostic && (state.daysSinceDiagnostic == null || state.daysSinceDiagnostic >= 7)`
   → `{ kind: "diagnostic" }`
3. sinon `{ kind: "composed", alloc }` avec :
   - `errors  = caps.errors ? Math.min(state.wrongCount, Math.floor(0.30 * total)) : 0`
   - `learn   = caps.learn  ? Math.min(state.newCoursePoints, total - errors) : 0`
   - `adaptive = total - errors - learn` (jamais négatif ; l'adaptatif absorbe le reste)

**Contrat du #1** : `caps = { diagnostic: false, errors: false, learn: false }` ⇒ le plan est
**toujours** `composed` avec `errors = learn = 0`, `adaptive = total`. Soit exactement la
session adaptative actuelle, moins la sélection manuelle de catégories. Aucune branche morte :
une capacité `false` n'émet simplement pas son mode.

## La carte — `SessionCard` (remplace `QuizHome` + les stubs)

Nouveau composant `src/features/entrainement/SessionCard.tsx`, pur / prop-driven. Deux états :

- **Reprendre** (`resume` présent) : titre « Reprendre ta session » + bouton *[Continuer]*.
  Pas de sélecteur de temps (on reprend l'existant). **Absorbe l'actuelle `ResumeBanner`.**
- **Session** (sinon, minimal) : titre « Ta session du moment » + chips **[5] [10] [15] min**
  + bouton *[Commencer]*. Le mélange (errors/learn/adaptive/diagnostic) reste **caché**.

*[Commencer]* appelle `onStart` (le dispatch réel selon `plan.kind` vit dans le câblage ;
en #1 tout retombe sur le lancement adaptatif existant). *[Continuer]* appelle `onResumeNow`.

## Câblage

- `EntrainementHome.tsx` : retire `QuizHome` + `STUBS`, monte `SessionCard` (reçoit `resume`,
  `minutes`, `onSetMinutes`, `onStart`, `onResumeNow`).
- `useQuiz.ts` :
  - `start()` devient *plan-aware* : calcule `total` via `allocate()`, appelle `pickSessionPlan`
    avec `caps = { diagnostic:false, errors:false, learn:false }` (constantes de #1), puis lance
    selon `plan.kind`. En #1, `composed` (adaptive-only) = le chemin `start()` actuel.
  - **Retrait de la sélection manuelle de catégories** : `toggleCat` et l'usage des chips
    disparaissent ; `selected` reste `new Set(SKILLS)` (déjà le défaut).
  - « Reprendre » recâble le `resumeNow` existant.
- `EntrainementApp.tsx` (`EntrainementAppView`) : retire les props `selected`/`onToggleCat`
  devenues inutiles ; passe les props de `SessionCard`.

## Suppressions (MVP — pas de code mort)

- `src/features/quiz/QuizHome.tsx` (remplacé par `SessionCard`).
- `src/features/quiz/ResumeBanner.tsx` (absorbé dans l'état « Reprendre » de `SessionCard`).

Vérifier par grep (`.ts` **et** `.tsx`) qu'aucune autre référence ne subsiste avant suppression.

## Tests (TDD, RED → GREEN)

- `sessionPlan.test.ts` (pur, exhaustif) :
  - `resume` gagne toujours, même si diagnostic dû.
  - diagnostic émis **seulement** si `caps.diagnostic` **et** (`daysSinceDiagnostic == null` ou `≥ 7`).
  - cap erreurs : `errors = min(wrongCount, ⌊0.30·total⌋)` ; `learn` borné ; `adaptive` = reste.
  - **contrat #1** : `caps` tout-off ⇒ toujours `composed` avec `adaptive = total`.
- `SessionCard` : SSR smoke des deux états (Reprendre vs Session). Rappel :
  `renderToStaticMarkup` échappe les apostrophes → asserter sur des sous-chaînes sans `'`.

## Fichiers

- **Nouveau** : `src/features/entrainement/sessionPlan.ts` (+ `sessionPlan.test.ts`),
  `src/features/entrainement/SessionCard.tsx` (+ smoke test éventuel).
- **Modifié** : `EntrainementHome.tsx`, `EntrainementApp.tsx`, `useQuiz.ts`.
- **Supprimé** : `QuizHome.tsx`, `ResumeBanner.tsx`.

## Ce que #1 livre pour l'utilisateur

Les 4 cartes disparaissent, remplacées par **une** carte « temps → Commencer » (+ « Reprendre »
quand une session est en cours). Sous le capot, le cerveau complet est en place, prêt à s'allumer
mode par mode dans les sous-projets #2 → #4.

## Hors périmètre (sous-projets suivants)

- L'implémentation réelle des modes Erreurs (#2), Diagnostic (#3, incl. persistance de
  `lastDiagnosticAt` alimentant `daysSinceDiagnostic`), Apprendre (#4, incl. calcul de
  `newCoursePoints`).
- Tout affichage du mélange dans la carte (choix « magique » : mix caché).

### ⚠️ Piège pour le #2 (réconciliation budget adaptatif)

Dans `useQuiz.start()`, la boucle de pioche répartit le **`total`** entier d'`allocate()` entre
catégories (`alloc[cat]`, dont la somme = `total`), **indépendamment** de `plan.alloc.adaptive`.
Invisible en #1 (`adaptive === total`). Dès que le #2 passe `errors: true` dans `BUILT_CAPS`,
`adaptive` devient `total − errors` : la boucle sur-pioche alors des questions adaptatives puis
tronque à `adaptive`, et le #2 doit **injecter séparément** ses questions d'erreurs. Le #2 doit
donc réconcilier la répartition `total`-based d'`allocate` avec le budget `adaptive` réduit —
ne pas supposer que la boucle respecte déjà `plan.alloc.adaptive`.
