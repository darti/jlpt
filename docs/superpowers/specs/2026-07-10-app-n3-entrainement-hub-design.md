# Design — Migration app-n3, tranche « hub Entraînement » (React + Bun)

- **Date** : 2026-07-10
- **Statut** : validé (brainstorming) — prêt pour plan d'implémentation
- **Contexte** : 3ᵉ page du portage strangler (après `index.html` tableau de bord et
  `quiz.html` quiz adaptatif). On migre le **hub / accueil d'`app-n3.html`** :
  l'écran d'atterrissage de l'entraînement (vue de progression + graphe + réglages
  + lanceurs de mode). `app-n3.html` (vanilla) est **remplacée** par cette page React.

## 1. Objectif

Remplacer `app-n3.html` (3,2 Mo vanilla) par une page React (le **hub
Entraînement**) : coquille fine + `src/entries/app-n3.tsx`. La page affiche la
progression (via `scoring.ts`), le **graphe de progression (ECharts)**, streak /
reprise, les **réglages**, et des **boutons de lancement** — « Commencer » ouvre
`quiz.html` (déjà portée) ; Diagnostic / Apprendre / Réviser les erreurs sont des
**stubs « bientôt disponible »** (tranches ultérieures).

## 2. Périmètre

**Dans la tranche :**
- Vue de progression : proba de réussite, score /180, niveau, jours restants
  (lecture via `scoring.ts`/`progress.js`, source unique).
- **Graphe de progression (ECharts)** : courbe des scores de **diagnostic** /180
  dans le temps + ligne « seuil 95 », état vide (« ≥2 diagnostics ») tant que la
  tranche diagnostic n'existe pas.
- **Lanceur de session** : « J'ai [xx] minutes » (sélecteur — chips 5/10/15 +
  saisie libre) + « Démarrer ma session » → ouvre `quiz.html?min=xx` ; le quiz
  démarre **directement** une session de xx minutes (toutes catégories).
- **Reprendre ma session** : si une session quiz interrompue existe
  (`jlptN3quiz_resume`), bannière « Reprendre ma session » (avec l'avancement,
  ex. 5/15) → `quiz.html?resume=1` (reprise automatique).
- Streak quotidien (affichage).
- **Réglages** : échelle de police (`jlptN3_fsUi`/`jlptN3_fsJp` → `--fs-ui`/`--fs-jp`),
  thème (réutilise `useTheme`), **export / import / réinitialisation** du blob.
- Section **Synchronisation** (réutilise `SyncSection` déjà portée).
- Autres modes : Diagnostic / Apprendre / Réviser les erreurs → stubs « bientôt ».
- **Remplacement d'`app-n3.html`** par la coquille React.

**Hors tranche (différé) :** examens diagnostiques, mode SRS « Apprendre ». Leur
code vanilla est **retiré de l'arbre de travail** avec ce remplacement — **récupérable
depuis l'historique git** (`app-n3.html` avant ce commit) pour leurs tranches.

## 3. Contraintes dures (rien ne doit régresser)

- **Compat blob `jlptN3adapt_v2`** : lecture seule ici (progression + `S.history`) ;
  export/import/reset manipulent le blob complet sans corrompre les champs.
- **Chiffres via `scoring.ts`/`progress.js`** — aucune duplication.
- **Liens existants** : `index.html` (tableau de bord) et `quiz.html` pointent vers
  `app-n3.html` — doivent continuer de fonctionner (pointent désormais sur le hub React).
- **ECharts bundlé** (pas de CDN — respecte le modèle hors-ligne/PWA/CSP), **tree-shaken**
  (`echarts/core` + graphe ligne + composants nécessaires uniquement) pour limiter le poids.
- **UI française**, look **Nord Frost** (tokens oku : aurore, verre dépoli, élévations,
  rayons 12/18/22), **PWA/hors-ligne**, **bun exclusivement**.
- Réglages : échelle de police (`jlptN3_fs*`) et thème (`jlptN3_theme`) au format legacy,
  appliqués à tout le site (variables CSS globales).

## 4. Décisions (brainstorming)

| Sujet | Décision |
|---|---|
| Périmètre | Hub/accueil + progression + graphe ECharts + réglages ; diagnostic/SRS différés |
| Bascule | **Remplacer `app-n3.html`** par le hub React ; modes différés = stubs « bientôt » |
| Graphe | **ECharts** (bundlé, tree-shaken) ; courbe des scores diagnostic /180 + seuil 95 ; état vide |
| Code vanilla diagnostic/SRS | **Retiré** de l'arbre ; récupérable via git pour les tranches futures |
| Lancement de session | Sur le hub : « J'ai xx minutes → Démarrer » + « Reprendre ma session » ; `quiz.html` exécute (lit `?min`/`?resume`) |

## 5. Architecture

**Réutilisé (déjà construit) :** `scoring.ts` (`successModel`/`dashboardModel`/
`masteryOf`/`ratingLabel`/`daysUntilExam`), la coquille (`Header`/`TopNav`),
`useTheme`, `readRawProgress`/`writeProgress` (storage), `SyncSection` +
`useGistSync` (sync Gist), `dict.js` (global), tokens oku.

**Nouveau :**
- `src/lib/fontscale.ts` (+ tests) — `readFs(kind)`, `applyFontScale(root)`,
  `bumpFs(kind, dir)` : lit `jlptN3_fsUi`/`jlptN3_fsJp` (bornes 0.8–1.8), pose
  `--fs-ui`/`--fs-jp` (port fidèle de `getFs`/`applyFontScale`/`bumpFs` legacy).
- `src/lib/datajson.ts` (+ tests) — `exportBlob(store)` (sérialise tous les `jlptN3*`),
  `importBlob(json, store)` (restaure), `resetAll(store)` (efface) — pur, injectable.
- `src/features/entrainement/ProgressChart.tsx` — composant **ECharts** :
  courbe des scores diagnostic /180 (`history.filter(mode==='diagnostic')`) + ligne
  seuil 95 + delta d'évolution ; **état vide** si <2 points ; init/dispose dans un
  `useEffect` (navigateur seulement — SSR-safe, `renderToStaticMarkup` ne touche pas au DOM).
- `src/features/entrainement/Settings.tsx` — réglages (police ±, thème, export/import/reset).
- `src/features/entrainement/SessionLauncher.tsx` — « J'ai [xx] minutes » (chips + saisie)
  + « Démarrer ma session » → navigue vers `quiz.html?min=xx`.
- `src/features/entrainement/ResumeBanner.tsx` — lit `jlptN3quiz_resume` ; si présent,
  « Reprendre ma session » (+ avancement) → `quiz.html?resume=1`.
- `src/features/entrainement/EntrainementHome.tsx` — composition : vue de progression
  (jauge + stats via `dashboardModel`) + `ProgressChart` + `ResumeBanner` +
  `SessionLauncher` + lanceurs différés (stubs « bientôt ») + `Settings` + `SyncSection`.
- `src/EntrainementApp.tsx` (`EntrainementAppView` pur + wiring), `src/entries/app-n3.tsx`.
- `app-n3.html` → **coquille fine** (comme `index.html`/`quiz.html`) : `<div id=root>` +
  script pré-peinture thème + `<script src="dict.js">` + `<script src=./src/entries/app-n3.tsx>`.

**ECharts** : `bun add echarts`. Import tree-shaken :
`import * as echarts from "echarts/core"; import { LineChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers"; echarts.use([...])`.
Utiliser la **skill dataviz** au moment de construire le graphe (couleurs, axes, légende).

## 6. Graphe de progression (ECharts)

- Données : `S.history.filter(x => x.mode === 'diagnostic').map(p => p.score)` (score /180).
- Ligne + points, axe x = index du diagnostic (« 1er » … « récent »), axe y = 0–180.
- **Ligne de repère « seuil 95 »** (markLine) en `--color-status-completed`.
- Delta d'évolution (premier vs dernier) sous le graphe.
- **État vide** (<2 diagnostics) : message « Au moins 2 diagnostics… » (comme legacy).
- Couleurs via tokens Nord Frost (résolus depuis les variables CSS au montage).

## 7. Réglages

- **Police** : boutons ± pour UI et JP ; `bumpFs` borne 0.8–1.8 ; `applyFontScale`
  pose `--fs-ui`/`--fs-jp` sur `:root` (appliqué à tout le site, même origine).
- **Thème** : réutilise `useTheme` (toggle clair/sombre, `jlptN3_theme`).
- **Données** : « Exporter » (télécharge le JSON du blob), « Importer » (fichier →
  restaure), « Réinitialiser » (confirme puis efface `jlptN3*`). Port fidèle de
  `exportData`/`importData`/`resetAll`, avec `confirm()` injectable pour les tests.

## 8. Bascule (remplacement d'app-n3.html)

- `app-n3.html` passe de la liste `cp` du déploiement aux **entrées `bun build`**
  (3ᵉ page React) ; retirée de l'allowlist du serveur de dev.
- Le contenu vanilla (quiz/diagnostic/SRS/réglages inline) est **remplacé** ; le
  quiz vit dans `quiz.html`. Diagnostic/SRS = stubs « bientôt » dans le hub, à
  porter depuis l'historique git (`git show <commit>:app-n3.html`) à leurs tranches.
- `quiz.html` : retirer/ajuster son lien retour vers `app-n3.html` (pointe désormais
  le hub React — OK). `index.html` topnav → `app-n3.html` (hub React) — OK.

### 8bis. Passage hub → quiz (paramètres de session)

Le hub choisit les paramètres, `quiz.html` exécute. Petite extension de `quiz.html`
(déjà en prod sur `main`) dans cette tranche :
- `quiz.html?min=xx` : au montage, `useQuiz` lit `?min` (`URLSearchParams`), et si
  présent **démarre directement** une session de `xx` minutes (toutes catégories) —
  saute l'écran `QuizHome`.
- `quiz.html?resume=1` : au montage, si un `jlptN3quiz_resume` valide existe,
  **reprend automatiquement** (`resumeNow`) au lieu d'afficher seulement la bannière.
- Sans paramètre : comportement actuel inchangé (écran `QuizHome`).
Ces lectures se font dans un effet (navigateur), SSR-safe.

## 9. Build / dev / déploiement / SW

- Entrées : `bun build ./index.html ./quiz.html ./app-n3.html --minify --outdir=_site`.
- `scripts/dev.ts` : ajouter `app-n3.html` en route bundlée ; **retirer** `/app-n3.html`
  de l'allowlist statique (c'est désormais une page React, plus un fichier vanilla).
- Déploiement : `bun run build` émet les 3 HTML ; **ne plus `cp app-n3.html`**.
- `sw.js` : bumper `CACHE` (v82 → v83) ; `app-n3.html` reste dans SHELL (toujours une
  URL servie). Les chunks ECharts (hashés) sont mis en cache runtime.

## 10. Tests (TDD)

- `fontscale.ts` : `readFs` bornes/défaut, `bumpFs` incréments/bornes, `applyFontScale`
  pose les variables (fake root).
- `datajson.ts` : export/import round-trip ; reset efface les `jlptN3*` ; jamais throw.
- `ProgressChart` : smoke SSR (état vide + rendu conteneur) — ECharts init dans un effet,
  jamais au rendu ; test avec/sans historique.
- `Settings`/`EntrainementHome` : smoke `renderToStaticMarkup` (labels, stubs « bientôt »,
  bouton « Commencer » → `quiz.html`).
- Suite complète + `bun run typecheck` + `bun run build` (3 entrées) verts.

## 11. Risques / différé

- **ECharts poids** : tree-shaking (`echarts/core` + LineChart + Grid/MarkLine/Tooltip +
  SVGRenderer) ; vérifier la taille du chunk hashé.
- **Graphe vide au départ** : aucun nouveau diagnostic tant que la tranche diagnostic
  n'est pas portée → le graphe montre l'historique existant ou l'état vide. Acceptable.
- **Régression visible** diagnostic/SRS (stubs « bientôt ») pendant la transition —
  choix assumé ; code récupérable depuis git.
- **dict.js** reste global (furigana + définition au tap sur le hub).
- **Compat export/import** : le format d'export doit rester lisible par la page (blob
  complet `jlptN3*`), compatible avec l'export legacy.
