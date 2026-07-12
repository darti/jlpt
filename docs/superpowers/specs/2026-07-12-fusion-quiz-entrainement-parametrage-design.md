# Fusion Quiz + Entraînement & onglet Paramétrage — design

**Date** : 2026-07-12
**Statut** : approuvé (design), spec en relecture

## Objectif

Deux changements de navigation demandés :

1. **Fusionner** les onglets « Quiz » et « Entraînement » en un seul onglet **Entraînement**.
2. **Déplacer** la taille de police et la synchronisation (et, par extension, thème + données)
   vers un nouvel onglet **Paramétrage**.

## Contexte (état actuel)

- Routes montées dans `src/entries/index.tsx` sous un `AppShell` partagé ; barre d'onglets =
  `src/ui/TopNav.tsx` (Accueil / Entraînement / Quiz / Cours / Planning + boutons `ふ` furigana
  et `☾` thème).
- `/entrainement` (`EntrainementApp` → `EntrainementHome`) est un **hub** : `ResumeBanner`
  (version `Link` → `/quiz?resume=1`) + `Dashboard` + `ProgressChart` + `SessionLauncher`
  (minutes → `/quiz?min=N`) + 3 stubs « bientôt » + `Settings` (police/thème/données) +
  `SyncSection`.
- `/quiz` (`QuizApp` → `QuizAppView`) est le **moteur** : `QuizHome` (catégories + minutes) →
  `QuestionCard` → `Corrige` → `Results`, piloté par `useQuiz()`.
- `useQuiz()` est **autonome** : détient `phase` (`home|question|corrige|results`), `selected`
  (catégories), `minutes`, `resume`, tous les handlers, et lit `?min=`/`?resume=` de l'URL
  (`parseSessionParams` + effet d'auto-démarrage) pour l'ancien handoff hub→quiz.
- `/` (Accueil, `App.tsx`) affiche `InstallPrompt` + `Dashboard` + `SyncSection`.

## Décisions (validées)

- **Écran fusionné** : hub d'abord. On arrive sur le hub ; démarrer bascule vers le quiz
  **dans le même onglet** ; « Recommencer » revient au hub.
- **Paramétrage** contient : taille de police + synchronisation + **thème** + **données**
  (export/import/réinitialiser). **Pas** les furigana.
- **Nom & route** : onglet « Entraînement », route `/entrainement`. `/quiz` redirige vers
  `/entrainement`.
- **Accueil conservé** (`/`) = `Dashboard` seul ; la synchro en est retirée.
- **Barre de nav** : `ふ` (furigana) et `☾/☀` (thème) restent pour l'accès rapide ; le thème
  est *aussi* réglable dans Paramétrage (état partagé via le hook de thème).

## Architecture cible

### Navigation — `src/ui/TopNav.tsx`

`ROUTES` :

| Onglet        | Route           | Contenu                                   |
|---------------|-----------------|-------------------------------------------|
| Accueil       | `/`             | Dashboard seul (synchro retirée)          |
| Entraînement  | `/entrainement` | Hub + quiz fusionnés                      |
| Cours         | `/cours`        | inchangé                                  |
| Planning      | `/planning`     | inchangé                                  |
| Paramétrage   | `/parametrage`  | Police + Thème + Données + Synchro (neuf) |

L'entrée « Quiz » est supprimée. Les boutons `ふ` et `☾` de la barre sont conservés.

### Routage — `src/entries/index.tsx`

```
<Route index element={<App />} />                              // Accueil
<Route path="entrainement" element={<EntrainementApp />} />    // hub + quiz
<Route path="quiz" element={<QuizRedirect />} />               // → /entrainement (search préservé)
<Route path="planning" element={<Planning />} />
<Route path="cours" element={<Cours />} />
<Route path="parametrage" element={<Parametrage />} />         // neuf
<Route path="*" element={<App />} />
```

`QuizRedirect` = petit composant qui `<Navigate replace>` vers `/entrainement` en **préservant
la query string** (pour que `/quiz?resume=1` / `/quiz?min=N` continuent d'auto-reprendre /
auto-démarrer via l'effet de `useQuiz`).

### Onglet Entraînement fusionné — `src/EntrainementApp.tsx`

Le conteneur de route appelle **`useQuiz()`** **+** l'état progression/scores existant
(`useProgress`, `readSessionScores`), puis bascule selon `useQuiz().phase` :

- **`phase === "home"` → le hub** (vue « hub », réécriture de `EntrainementHome.tsx`) :
  - `ResumeBanner` (version quiz `features/quiz/ResumeBanner.tsx`, `onResume={resumeNow}`,
    `onDismiss`) — affiché seulement si `useQuiz().resume`.
  - `Dashboard` (résumé progression).
  - section `ProgressChart` (scores de session).
  - **carte de démarrage = `QuizHome`** (catégories + minutes + bouton), pilotée par
    `useQuiz` (`selected`, `minutes`, `toggleCat`, `setMinutes`, `start`). Titre affiché :
    **« Lancer une session »**.
  - les 3 stubs « bientôt disponible ».
  - **Plus de `Settings` ni `SyncSection`** dans le hub.
- **`phase === "question"/"corrige"/"results"` → le flux quiz** : `QuestionCard` / `Corrige` /
  `Results`, logique de phase reprise de l'actuel `QuizAppView` (TTS via `speak`/`sentenceFromG`
  inclus).
- **Retour au hub** : `restart()` remet `phase = "home"`. Au retour, **rafraîchir les scores +
  la progression** (via un effet sur `phase === "home"` appelant `onProgressChanged`) pour que
  la session qui vient de finir apparaisse dans le `Dashboard` et le `ProgressChart`.

**Fichiers supprimés** (subsumés par le flux inline) :

- `src/features/entrainement/SessionLauncher.tsx` (remplacé par `QuizHome` inline).
- `src/features/entrainement/ResumeBanner.tsx` (remplacé par la version quiz).
- `src/features/entrainement/nav.ts` (constructeur d'URL `/quiz?...`, plus aucun appelant).
- `src/QuizApp.tsx` (son rôle de conteneur passe dans `EntrainementApp`).

**Conservé** : `useQuiz.ts` (dont `parseSessionParams` + effet d'auto-démarrage, pour la compat
deep-link), `features/quiz/*` (QuizHome, QuestionCard, Corrige, Results, ResumeBanner).

### Onglet Paramétrage — `src/features/parametrage/Parametrage.tsx` (neuf)

```
Parametrage()  // route content
  = <Settings theme onToggleTheme />   // déplacé depuis features/entrainement/Settings.tsx
  + <SyncSection onProgressChanged />
```

- `Settings.tsx` est **déplacé** de `features/entrainement/` vers `features/parametrage/`
  (contenu inchangé : Police UI/JP + Thème + Données export/import/réinit). Le test
  `Settings.handlers.test.tsx` suit le déplacement.
- Le thème provient de `useThemeContext` (fourni par `AppShell`).
- `onProgressChanged` : Paramétrage n'affiche pas de progression ; un no-op suffit (les routes
  Accueil/Entraînement relisent la progression à leur montage via `useProgress`). `SyncSection`
  gère lui-même le rechargement après un pull/import.

### Accueil — `src/App.tsx`

Retirer `<SyncSection/>`. Accueil = `InstallPrompt` + `Dashboard`.

## Flux de données

- **Démarrage session** : hub (`QuizHome`) → `useQuiz.start()` → `phase = "question"` →
  re-render de la **même** route affichant le flux quiz. Aucune navigation d'URL.
- **Fin de session** : `next()` sur la dernière question → écrit l'historique → `phase =
  "results"`. « Recommencer » → `restart()` → `phase = "home"` → effet de rafraîchissement des
  scores/progression → hub à jour.
- **Reprise** : hub affiche `ResumeBanner` si `useQuiz.resume` ; `resumeNow()` reconstruit la
  session et passe en `phase = "question"`.
- **Deep-links compat** : `/quiz?resume=1` / `/quiz?min=N` → `QuizRedirect` → `/entrainement`
  (search préservé) → effet `useQuiz` auto-reprend / auto-démarre.
- **Synchro / import** dans Paramétrage : `SyncSection` écrit la progression ; les autres routes
  la relisent au montage.

## Gestion des erreurs / cas limites

- **Sélection de catégories vide** : déjà géré par `toggleCat` (jamais vide).
- **Session vide** (`start` ne produit aucune question) : `start` retourne sans changer de phase
  (comportement actuel conservé) → reste sur le hub.
- **Resume périmé** (>2 jours) : `readResumeState` le nettoie → pas de bannière.
- **SSR / happy-dom** : la vue hub et Paramétrage restent SSR-safe (effets gardés dans les
  leaves ; `renderToStaticMarkup` sous `<MemoryRouter>`).

## Tests (TDD)

- **Nouveaux / mis à jour** :
  - `EntrainementApp` : en `phase home` le hub s'affiche (Dashboard + carte « Lancer une
    session » + catégories) ; après `start`, le flux quiz s'affiche (une question).
  - `Parametrage` : les sections Police, Thème, Données et Synchro sont présentes.
  - `TopNav` : 5 onglets, présence de « Paramétrage », absence de « Quiz ».
  - `App` (Accueil) : la synchro n'est plus rendue.
- **Supprimés** : `entrainement.test.tsx` (SessionLauncher), `nav.test.ts`,
  `QuizApp.test.tsx`.
- **Conservés / déplacés** : `sessionParams.test.ts`, tests `useQuiz`,
  `Settings.handlers.test.tsx` (suit le déplacement de `Settings.tsx`).

## Hors périmètre / notes

- **Pas de bump `CACHE` du SW** : le changement est 100 % JS/TSX. Les stubs `quiz.html` /
  `app-n3.html` (assets livrés cachés) restent inchangés — ils atterrissent sur `#/quiz`, qui
  redirige désormais vers `#/entrainement`. Aucun asset livré n'est modifié.
- **Furigana** : le bouton `ふ` reste dans la barre ; pas déplacé dans Paramétrage.
- Aucun refactor non lié.
```
