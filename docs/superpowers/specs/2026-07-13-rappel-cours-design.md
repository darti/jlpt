# Rappel de cours (corrigé grammaire) — design

**Date** : 2026-07-13
**Statut** : approuvé (design), spec en relecture
**Portée** : sous-projet #5 (Partie B du #4) — le pont quiz↔cours

## Objectif

Afficher, en bas du corrigé de **toute question de grammaire**, un bloc **« Rappel de cours »** :
le point de grammaire testé (forme, niveau, sens) retrouvé dans le cours + un lien vers la leçon ;
et, quand aucun point ne matche, un **repli** : un lien générique « Revoir la grammaire dans le cours ».
C'est la vraie intégration quiz↔cours — via la forme déjà présente en gras dans le corrigé.

## Contexte (données)

- `data/cours-gram.json` : structure imbriquée `lessons`/`table`. La table `('Forme', 'Niv.', 'Sens')`
  contient **148 lignes** de points N3/N4 (les autres tables — conjugaison, keigo — ont d'autres headers
  et sont ignorées). Cellule `Forme` : formes simples (`〜うちに`), **alternatives** (`〜について / 〜に対して`),
  ou **préfixées** (`〜place : 〜場合は`, la forme réelle est après `:`).
- `data/bank-grammaire.json` : **76 %** des questions (897/1174) ont la forme testée en gras dans `e`
  (`e = "<b>〜たら</b> = …"`). Style identique au cours (`〜うちに` présent des deux côtés).
- `/cours` = route hash `#/cours` (`src/features/cours`), chargée via `useCours()`. Sections
  `id="cours-<sectionId>"` ; **pas d'ancre par point de grammaire** → le lien pointe la route, pas un point.
- `Corrige` (`src/features/quiz/Corrige.tsx`, `{ question, correct }`) est rendu **deux fois** : phase
  `corrige` du quiz (`EntrainementApp`) **et** recap du diagnostic (`DiagnosticResults`). Pur / SSR-safe.

## Décisions (validées)

- **Point matché + repli lien** : match quand possible ; sinon lien générique. Toute question grammaire
  non matchée (24 % sans gras + formes absentes du cours) affiche le repli.
- **Grammaire uniquement** : aucun bloc pour vocab/kanji/lecture/écoute.
- **Lien** = `<a href="#/cours">` (HashRouter, SSR-safe, pas de contexte Router requis) — section grammaire,
  **pas d'ancre par forme** (le cours n'en a pas).
- **`Corrige` reste pur** : reçoit un `rappel?: GrammarRappel | null` déjà résolu ; ne fetch pas.
- **Loader mémoïsé** : `cours-gram.json` fetché une seule fois (déjà mis en cache par le SW / la route `/cours`).

## Ce qu'on construit

### 1. `coursGramIndex.ts` (nouveau, `src/features/cours/`) — logique pure + loader
- `interface GrammarRappel { forme: string; niv: string; sens: string }`
- `type CoursGramIndex = Map<string, GrammarRappel>` (clé = forme normalisée).
- `normalizeForm(s): string` (pur) : split alternatives sur `/` géré en amont ; prend la partie après le
  dernier `:` si présente ; retire `〜`, espaces. (Utilisé pour la clé d'index **et** la forme extraite.)
- `buildCoursGramIndex(coursGram): CoursGramIndex` (pur) : parcourt récursivement les `lessons`, ne garde
  que les tables dont les headers sont `['Forme','Niv.','Sens']` ; pour chaque ligne, split la cellule Forme
  sur ` / ` → chaque alternative devient une clé (`normalizeForm`) → `{forme: alternative, niv, sens}`.
- `extractGrammarForm(e): string | null` (pur) : contenu du 1ᵉʳ `<b>…</b>` (dé-taggé), sinon `null`.
- `resolveGrammarRappel(question, index): GrammarRappel | null` (pur) : si `cat!=="grammaire"` → `null` ;
  sinon `extractGrammarForm(e)` → `normalizeForm` → `index.get(clé)` (ou `null`).
- `loadCoursGramIndex(fetchImpl?): Promise<CoursGramIndex>` : fetch `data/cours-gram.json`, `buildCoursGramIndex`,
  mémoïsé (module-level, patron `loadCategory`). `clearCoursGramCache()` pour l'isolation des tests.

### 2. Hook `useCoursGramIndex(): CoursGramIndex | null`
Charge l'index une fois (effet + `loadCoursGramIndex`), `null` pendant le chargement. Dans un module hook
adéquat (`src/features/cours/useCoursGramIndex.ts` ou à côté de l'index).

### 3. `Corrige` — bloc « Rappel de cours »
Nouvelle prop `rappel?: GrammarRappel | null`. **Uniquement si `question.cat === "grammaire"`**, ajouter en
bas un bloc :
- `rappel` non null → « Rappel de cours : **{forme}** ({niv}) — {sens} · [voir la leçon](#/cours) ».
- `rappel` null (non matché ou index encore en chargement) → repli « 📖 Revoir la grammaire dans le cours »
  (lien `#/cours`).
`Corrige` reste pur.

### 4. Câblage
- `EntrainementApp` (conteneur) : `const coursIndex = useCoursGramIndex();` passé à `EntrainementAppView`.
- Phase `corrige` : `<Corrige question correct rappel={resolveGrammarRappel(question, coursIndex)} />`
  (`resolveGrammarRappel` tolère `coursIndex` null → `null` → repli).
- `DiagnosticResults` : nouvelle prop `coursIndex: CoursGramIndex | null` ; par réponse,
  `<Corrige … rappel={resolveGrammarRappel(a.question, coursIndex)} />`.
- `EntrainementAppView` : thread `coursIndex` (optionnel, défaut `null`) vers la phase corrigé et `DiagnosticResults`.

## Tests (TDD)

- `coursGramIndex.test.ts` : `normalizeForm` (strip `〜`/espaces, après `:`) ; `buildCoursGramIndex` (ne garde que
  la table Forme/Niv./Sens, split alternatives, clés normalisées) ; `extractGrammarForm` (gras présent/absent) ;
  `resolveGrammarRappel` (grammaire matché → point ; non matché → null ; non-grammaire → null ; index null → null) ;
  `loadCoursGramIndex` (fetch mocké + mémoïsation + `clearCoursGramCache`).
- `Corrige` (SSR smoke) : question grammaire + `rappel` → « Rappel de cours » + forme + « voir la leçon » ;
  grammaire + `rappel:null` → repli « Revoir la grammaire » ; question **non-grammaire** → **aucun** bloc rappel.
  ⚠ `renderToStaticMarkup` échappe les apostrophes.
- Intégration (happy-dom) : dans un flux quiz, un corrigé de question grammaire (avec un `e` dont la forme est
  dans le cours mocké) affiche le point matché ; une forme absente affiche le repli. (fetch `cours-gram.json` mocké.)

## Fichiers

- **Nouveau** : `src/features/cours/coursGramIndex.ts` (+ `.test.ts`), `src/features/cours/useCoursGramIndex.ts`.
- **Modifié** : `src/features/quiz/Corrige.tsx` (+ prop `rappel` + bloc) & test ; `src/EntrainementApp.tsx`
  (hook + thread `coursIndex` + `resolveGrammarRappel` en phase corrigé) ; `src/features/quiz/DiagnosticResults.tsx`
  (prop `coursIndex` + résolution par réponse) & test.
- **Livré** : `data/cours-gram.json` est **déjà** servi (route `/cours`) — aucune entrée à ajouter à `copy-static.mjs`.

## Hors périmètre

- Rappel pour vocab/kanji/lecture/écoute (grammaire seulement).
- Ancre profonde vers un point de cours précis (le cours n'en a pas) — lien de section.
- Amélioration du taux de match (fuzzy, synonymes) — repli couvre les non-matchés.

## Note (robustesse du match)

Le match est **best-effort** : ~76 % des questions ont une forme extractible, et toutes ne seront pas dans les
148 lignes du cours (formes composées `辞書形＋ところ`, variantes). Le repli garantit qu'un bloc « Rappel de cours »
utile apparaît sur **toute** question grammaire, matché ou non. Améliorer le taux = backlog.
