# Design — Migration app-n3, tranche « quiz adaptatif » (React + Bun)

- **Date** : 2026-07-10
- **Statut** : validé (brainstorming) — prêt pour plan d'implémentation
- **Contexte** : 2ᵉ page du portage strangler (après le tableau de bord `index.html`).
  `app-n3.html` est en réalité ~5 sous-systèmes ; on migre d'abord **le cœur : le
  quiz adaptatif**. Diagnostic, mode SRS « Apprendre », accueil+graphes, réglages
  = tranches ultérieures.

## 1. Objectif

Porter le quiz adaptatif d'`app-n3.html` en React/TS bundlé par Bun, en tant que
**nouvelle page `quiz.html`** vivant **à côté** de `app-n3.html` (qui reste vanilla
et pleinement fonctionnelle). Les deux partagent le même état `localStorage`
(`jlptN3adapt_v2`). Session complète, toutes les catégories, chiffres identiques
à l'existant.

## 2. Périmètre

**Dans la tranche :**
- Session complète : N questions (durée réglable), difficulté adaptative par
  compétence, corrigé après chaque réponse, écran de résultats, **reprise** d'une
  session interrompue.
- **Toutes les catégories** : grammaire, kanji, vocabulaire, **écoute (TTS)**,
  **lecture (passages)**.
- Écriture de la progression (Elo) + **push Gist automatique** (sync déjà portée).

**Hors tranche (différé, chacun sa tranche) :** examens diagnostiques, mode SRS
« Apprendre » (grammaire), accueil + **graphes (ECharts)**, réglages/import-export.
Tant que ces modes ne sont pas portés, ils restent dans `app-n3.html` (vanilla).

## 3. Contraintes dures (rien ne doit régresser)

- **Compat blob `jlptN3adapt_v2`** : le quiz **écrit** l'état (skill `{R,t,r}`,
  `total`, `right`, streak, reprise…). Il doit rester **compatible au bit près**
  pour que le tableau de bord (index React), la sync Gist et `app-n3.html`
  (vanilla) affichent/lisent tous la même chose.
- **Elo identique à l'existant** (`updateRating`) : `DRATING={1:1400,2:1600,3:1800}`,
  `K = t<10 ? 40 : 24`, `R += K*((correct?1:0) - 1/(1+10^((Q-R)/400)))`,
  `clamp(1200, R, 2000)`, `t++`, `if(correct) r++`, init `R:1450`.
  **Verrouillé par un test de parité** (comme `scoring.ts` l'est vs `progress.js`).
- **Lecture des chiffres** via `scoring.ts`/`progress.js` (source unique) — aucune
  duplication du calcul de proba/score/niveau.
- **Furigana + définition au tap** (`dict.js`) sur les questions.
- **UI française**, look **Nord Frost** (tokens oku : aurore, verre dépoli,
  élévations, rayons 12/18/22), **PWA/hors-ligne**, **bun exclusivement**.

## 4. Décisions (brainstorming)

| Sujet | Décision |
|---|---|
| Modèle de session | Session complète + résultats + reprise |
| Catégories v1 | **Toutes** (incl. écoute/TTS + lecture/passages) |
| Chargement banque | **Découpée par catégorie**, chargée à la demande |
| Graphes | **ECharts** (surtout tranche accueil/graphes ; minimal ici) |
| Coexistence | **Nouvelle page `quiz.html`** React à côté de `app-n3.html` vanilla, `localStorage` partagé |

## 5. Architecture

**Réutilisé (déjà construit) :** `scoring.ts`/`progress.js` (lecture %/score/niveau),
la sync Gist (`lib/gist.ts` + push auto après réponse), `dict.js` (furigana, global),
hooks thème/PWA, tokens oku.

**Nouvelles libs pures (TDD + parité) :**
- `src/lib/elo.ts` — `updateRating(skill, d, correct)`, `DRATING`, `blankProgress()`,
  bornage. **Test de parité** contre l'`updateRating` legacy (fixtures :
  correct/incorrect, `t<10` vs `t≥10`, bornes 1200/2000).
- `src/lib/storage.ts` (extension) — `writeProgress(progress)` : sérialise
  `jlptN3adapt_v2` + `jlptN3_updatedAt`, sans écraser les champs non gérés
  (préserver le blob complet — SRS/streak/etc.).
- `src/lib/bank.ts` — `loadCategory(cat)` (fetch `data/bank-{cat}.json`, mémoïsé),
  `pickAdaptive(questions, R, exclude)` (question de rating le plus proche),
  `buildSession(cats, minutes)` (assemblage).
- `src/lib/tts.ts` — `speechSynthesis` (choix voix ja-JP, `speak(text)`), pour
  l'écoute et la lecture à voix haute.

**Nouveau pipeline de données :** un script `tools/split-bank.mjs` (exécuté via
`bun`) émet `data/bank-{grammaire,kanji,ecoute,lecture,vocabulaire}.json` depuis
`data/bank.json` (+ vocab). Chaque fichier est copié dans `_site` (déploiement)
et mis en cache par le SW ; chargé à la demande à l'entrée de la catégorie.

**Nouvelle feature React `src/features/quiz/` :**
- `useQuiz()` — machine à états de session (`idle → question → corrige → … →
  results`), gère : sélection catégories + durée, chargement paresseux de la
  banque, `pickAdaptive`, réponse → `updateRating` + `writeProgress` + push Gist,
  streak, **reprise** (sauvegarde/restauration de session en cours).
- `QuestionCard` — énoncé avec furigana (`dict.js`), 4 options ; audio pour écoute
  (bouton TTS) ; passage pour lecture.
- `Corrige` — explication (`e`) + décomposition grammaticale (`g`) + analyse
  option par option (`od`), avec les mêmes couleurs de statut Nord Frost.
- `Results` — score de session, récap, bouton relancer / accueil.
- `Resume` — bannière « reprendre la session en cours ».
- carte Nord Frost (`shadow-card surface-blur`, rayon 18px) comme le reste.

**Étape strangler :** nouvelle entrée `quiz.html` (coquille fine + pré-peinture
thème + `<script src=./src/entries/quiz.tsx>`), ajoutée aux **entrées `bun build`**,
à l'**allowlist du serveur de dev** et à la **liste du déploiement**. `app-n3.html`
reste vanilla et gagne un lien vers `quiz.html`.

## 6. UX du quiz (fidèle à l'existant)

- Accueil du quiz : cases catégories (grammaire/kanji/vocab/écoute/lecture), durée
  (5/10/15 min), bouton « Commencer », bannière reprise si session en cours.
- Question : énoncé (furigana), options cliquables ; écoute → bouton lecture TTS ;
  lecture → passage + question.
- Réponse : marque juste/faux, ouvre le corrigé (explication + grammaire + options),
  met à jour l'Elo, écrit la progression, pousse vers le Gist (débattu 1,5 s).
- Fin de session : résultats (score, réponses), relancer / retour.

## 7. Écritures d'état

- `updateRating` mute `S.skill[cat].{R,t,r}` ; incrémente `S.total`, `S.right`.
- streak quotidien + reprise (`jlptN3*` dédiés) préservés au format legacy.
- `writeProgress` sauvegarde le blob **complet** (ne pas perdre les champs SRS/
  gram/daily gérés par la page vanilla) → merge sur le blob lu, pas remplacement.
- push Gist auto après réponse (réutilise `lib/gist.ts` `cloudPush`).

## 8. Build / dev / déploiement

- `quiz.html` ajoutée aux entrées : `bun build ./index.html ./quiz.html --minify --outdir=_site`.
- Serveur de dev : `quiz.html` bundlée (route) + `data/bank-*.json` servis (allowlist).
- Déploiement CI : build les 2 entrées React ; `cp` les pages vanilla restantes +
  `data/bank-*.json`. Bump `sw.js` + ajouter `quiz.html` et les `bank-*.json` au SHELL/runtime-cache.

## 9. Tests (TDD)

- `elo.ts` : RED→GREEN + **test de parité** (rejoue l'`updateRating` legacy sur des
  fixtures, assert égalité de `R/t/r`).
- `bank.ts` : `pickAdaptive` choisit le rating le plus proche ; `buildSession`
  respecte catégories/durée ; fetch mémoïsé (fake fetch).
- `storage.writeProgress` : round-trip + préservation des champs non gérés.
- Composants : smoke `renderToStaticMarkup` (question, corrigé, résultats),
  SSR-safe (TTS/audio dans effets/handlers).
- Suite complète `bun test` + `bun run typecheck` + `bun run build` verts.

## 10. Risques / différé

- **dict.js** reste global (furigana) — non porté cette tranche.
- **ECharts** : introduit à la tranche accueil/graphes (via skill dataviz) ; pas de
  gros graphe dans le quiz v1 (résultats = récap simple).
- **Deux quiz coexistent** temporairement (React `quiz.html` + vanilla `app-n3`),
  partageant `localStorage` — acceptable en strangler ; `app-n3` sera retirée quand
  tous les sous-systèmes seront portés.
- **Taille de la banque** : le découpage par catégorie borne le coût ; kanji
  (~3148 q) reste le plus lourd — vérifier le temps de chargement.
- **Compat blob** : le point le plus sensible ; `writeProgress` doit **merger** sur
  le blob complet, jamais le remplacer.
