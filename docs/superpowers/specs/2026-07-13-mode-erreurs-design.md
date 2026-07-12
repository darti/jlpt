# Mode « Réviser les erreurs » (ingrédient de session) — design

**Date** : 2026-07-13
**Statut** : approuvé (design), spec en relecture
**Portée** : sous-projet #2 du chantier « carte de session adaptative » (voir #1)

## Objectif

Rendre réel l'ingrédient **erreurs** de la session composée : garantir qu'une session inclut un
socle de fautes **récentes**, toutes catégories confondues, alimenté par `wrong[]`. Le cerveau du
#1 (`pickSessionPlan`) calcule déjà la part (`alloc.errors`, plafonnée à 30 % du budget) ; ce
sous-projet **allume** la capacité et implémente l'injection réelle des questions d'erreurs.

## Contexte (état actuel, après #1)

- `useQuiz.start()` (`src/features/quiz/useQuiz.ts:171-216`) : dérive `total`+`alloc` d'`allocate()`,
  consulte `pickSessionPlan(..., BUILT_CAPS)`, puis pioche `alloc[cat]` questions adaptatives par
  catégorie (`pickAdaptive`) et tronque à `plan.alloc.adaptive`.
- `BUILT_CAPS` (`src/features/entrainement/sessionPlan.ts`) = `{ diagnostic:false, errors:false, learn:false }`.
  Tant que `errors:false`, `alloc.errors = 0`.
- `wrong[]` (`asWrong(raw)`) : ids des ~80 dernières fautes, **uniques**, ordre chronologique
  (la plus récente en **queue** — cf. `choose()` : `[...withoutId, q.id]`). Une bonne réponse
  retire l'id de `wrong[]` (auto-purge déjà en place).
- `pickAdaptive` (`src/lib/bank.ts:50-58`) **booste déjà** (+150) tout id de `wrong[]` présent dans
  le pool pioché — un re-surfaçage adaptatif partiel existe donc, mais seulement pour les catégories
  que la pondération par maîtrise charge.
- `resumeNow` (`useQuiz.ts`) résout `ids → Question[]` via `ensureBankIndex()` (id→catégorie,
  `data/bank-index.json`) + `loadCategory()` des pools concernés. **Ce bloc de résolution est
  exactement ce dont la tranche erreurs a besoin.**
- ⚠ **Piège épinglé au #1** : la boucle de pioche répartit le `total` entier d'`allocate` entre
  catégories, indépendamment de `plan.alloc.adaptive`. Invisible tant que `adaptive === total` ;
  dès que `errors > 0`, il faut réconcilier le budget adaptatif.

## Décisions (validées)

- **Ingrédient**, pas override : part = `plan.alloc.errors = min(wrongCount, ⌊0.30·total⌋)` (déjà
  calculée par le cerveau). Aucun changement au cerveau hormis le flag.
- **Sélection = les plus récentes** : on prend la **queue** de `wrong[]` (les `n` derniers ids).
- **Cap = plancher souple** : le boost +150 de `pickAdaptive` **reste actif** dans la part adaptative.
  Les 30 % sont un **minimum garanti**, pas un plafond dur ; la part erreurs effective peut dépasser
  30 % via le re-surfaçage adaptatif. (Choix explicite de l'utilisateur.)
- **Carte inchangée** (« magique ») : aucun affichage du mélange. Zéro changement UI.
- **Consolidation (DRY)** : extraire le résolveur `ids → Question[]` partagé par `resumeNow` **et**
  la tranche erreurs (aujourd'hui dupliqué dans `resumeNow`).

## Ce qu'on construit

### 1. `sessionPlan.ts` — allumer la capacité
`BUILT_CAPS.errors = true`. Une ligne. Le reste de la décision (part 30 %, fallback quand `wrong[]`
est court via le `min`) était déjà écrit et testé au #1.

### 2. `selectRecentErrors(wrong, n)` — fonction pure
Nouveau helper pur (dans `src/lib/bank.ts`, à côté de `pickAdaptive`) :
retourne les `n` ids les plus récents de `wrong[]` (sa queue), **plus récent en tête**.
`n ≤ 0` ou `wrong` vide → `[]` ; `n ≥ wrong.length` → tout `wrong` (renversé).
L'ordre de tête est cosmétique (la session finale est `shuffle`), mais explicite et testable.

### 3. `questionsForIds(ids, idx)` — résolveur partagé (consolidation)
Extraire de `resumeNow` le bloc « ids → Question[] » vers `src/lib/bank.ts` :
prend des `ids` + l'index id→catégorie déjà résolu, charge les pools nécessaires via `loadCategory`,
retourne les questions dans l'ordre des `ids` (ids non résolus filtrés). `resumeNow` s'en resert.

### 4. `composeSession(errorQs, adaptiveCandidates, total, rng)` — fonction pure
Nouvelle fonction pure (dans `src/lib/bank.ts`, avec `shuffle`/`pickAdaptive`) qui isole **toute la
réconciliation du budget** — donc testable sans `fetch` :
- `adaptiveTarget = total − errorQs.length` (le nombre **résolu**, pas `plan.alloc.errors`) ;
- `adaptiveQs = shuffle(adaptiveCandidates, rng).slice(0, max(0, adaptiveTarget))` ;
- retourne `shuffle([...errorQs, ...adaptiveQs], rng)`.
Les doublons sont évités en amont (l'appelant seed `exclude` avec les ids d'erreurs avant la pioche),
donc `adaptiveCandidates` ne contient déjà pas d'id d'erreur.

### 5. `useQuiz.start()` — câbler la tranche erreurs
Après le calcul du `plan` :
1. `errorIds = selectRecentErrors(wrong, plan.alloc.errors)`.
2. `errorQs = questionsForIds(errorIds, await ensureBankIndex())` (`[]` si l'index échoue).
3. `exclude` **initialisé avec les ids de `errorQs`** (évite les doublons dans la pioche adaptative).
4. La boucle par catégorie pioche les candidats adaptatifs (inchangée, `exclude` déjà seedé).
5. `session = composeSession(errorQs, picked, total, Math.random)`.

Le boost +150 reste inchangé (on continue de passer `wrong` à `pickAdaptive`) → plancher souple.
Les ids d'erreurs non résolus retombent gracieusement dans l'adaptatif (`adaptiveTarget` monte),
le budget `total` reste tenu.

> **Durcissement post-revue (C1/C2).** La réconciliation du budget se fait désormais **à
> l'allocation** : `bank.ts` expose `questionCount(minutes)` + `allocateCount(masteryOf, total)`, et
> `start()` alloue la boucle adaptative à `adaptiveTarget = total − nbErreurs` (au lieu de piocher
> `total` puis d'en jeter au hasard via le slice de `composeSession`) — la **pondération par maîtrise
> est ainsi préservée exactement**, plus diluée. `composeSession` garde son slice comme filet de
> sécurité (désormais no-op). **C2** : si `ensureBankIndex()` échoue (réseau `null`), le socle
> d'erreurs est ignoré et la session dégrade en adaptatif-seul (le boost +150 re-surface quand même
> les fautes) — contrat documenté dans `start()` et couvert par un test index-null.

## Tests (TDD)

- `bank.test.ts` : `selectRecentErrors` — vide, `n=0`, `n<len` (prend la queue, plus récent en tête),
  `n≥len`. `questionsForIds` — ordre préservé, ids inconnus filtrés, pools multi-catégories (fetch
  mocké + `clearCategoryCache`/`clearBankIndexCache`, patron existant dans `bank.test.ts`).
- `sessionPlan.test.ts` : **mettre à jour** le test contrat — avec `BUILT_CAPS` (désormais
  `errors:true`), un état à `wrongCount>0` doit émettre `alloc.errors = min(wrongCount, ⌊0.30·total⌋)`
  (et non plus 0). Ajouter le cas `wrongCount=0` ⇒ `errors:0`.
- `bank.test.ts` : `composeSession` (pur, `rng` injecté) — erreurs toutes présentes ;
  `session.length === total` avec `errorQs` long (= 30 %) **et** court (fallback → adaptatif comble) ;
  `adaptiveTarget` négatif borné à 0 ; aucun doublon (les candidats ne contiennent pas d'id d'erreur).

## Fichiers

- **Modifié** : `src/features/entrainement/sessionPlan.ts` (flag), `src/lib/bank.ts`
  (+`selectRecentErrors`, +`questionsForIds`, +`composeSession`), `src/features/quiz/useQuiz.ts`
  (`start()` câble la tranche erreurs ; `resumeNow` réutilise `questionsForIds`).
- **Tests** : `src/lib/bank.test.ts` (les 3 helpers), `src/features/entrainement/sessionPlan.test.ts`
  (contrat `BUILT_CAPS` mis à jour).

## Ce que ça change pour l'utilisateur

Aucun changement visible (carte inchangée). Sous le capot : une session garantit désormais un socle
de fautes récentes toutes catégories confondues, en plus du re-surfaçage adaptatif existant.

## Hors périmètre

- Diagnostic (#3, incl. persistance de `lastDiagnosticAt`) et Apprendre (#4, incl. `newCoursePoints`).
- Tout affichage du mélange / réglage manuel (la carte reste « magique »).
- Modifier la sémantique du boost +150 (on la conserve — plancher souple).
