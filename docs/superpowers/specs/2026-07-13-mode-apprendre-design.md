# Mode « Apprendre » — ingrédient `learn` (questions inédites) — design

**Date** : 2026-07-13
**Statut** : approuvé (design), spec en relecture
**Portée** : sous-projet #4 (Partie A) du chantier « carte de session adaptative » — **ferme les 4 modes**.
La Partie B (« rappel de cours » dans le corrigé grammaire) est un sous-projet séparé (#5), specé à part.

## Objectif

Rendre réel l'ingrédient **`learn`** de la session composée : introduire des **questions inédites**
(items jamais rencontrés — bitmap `seen`), le **corrigé** faisant office de leçon. C'est le dernier
`cap` du cerveau à allumer ; après ça les 4 actions du hub d'origine sont toutes réelles.

## Contexte (état actuel, après #3)

- `pickSessionPlan` (`src/features/entrainement/sessionPlan.ts`) calcule déjà :
  `learn = caps.learn ? min(newCoursePoints, max(0, total − errors)) : 0`. `BUILT_CAPS.learn` est `false`,
  et `start()` passe `newCoursePoints: 0` en dur → `learn` toujours 0 aujourd'hui.
- `start()` compose : erreurs (`selectRecentErrors`→`questionsForIds`) + adaptatif
  (`allocateCount(adaptiveTarget)` + `pickAdaptive`) → `composeSession(errorQs, picked, total)`.
- **Couverture déjà en place** (`src/lib/coverage.ts`) : bitmap `seen` (base64 dans le blob progress),
  `decodeBits` / `hasBit(bits, id)` ; `coverageBySkill(seen, mastered, bankIndex)` bucketise par skill.
  `choose()` marque `seen` à chaque réponse.
- `ensureBankIndex()` (useQuiz) → `Record<number, Skill>` de **tous** les ids de banque.
- `allocateCount(masteryOf, total)`, `pickAdaptive(pool, R, exclude, wrong)`, `masteryOf`, `skillStateOf`
  disponibles.

## Décisions (validées)

- **`learn` = questions inédites** : items où `hasBit(seen, id) === false`. Le corrigé (`e`/`g`) = la leçon.
- **`newCoursePoints` = nombre total d'items non vus** (bank-index − seen).
- **Plafond 40 %** : `learn = min(newCoursePoints, ⌊0.40·total⌋, total − errors)` → `LEARN_CAP = 0.40`.
  Garantit ≥ ~30 % d'adaptatif (révision) : mix erreurs ≤30 % + nouveau ≤40 % + adaptatif = reste.
- **Sélection pondérée** : les non-vus répartis par maîtrise (`allocateCount`) et piochés près du niveau
  (`pickAdaptive` sur le sous-ensemble non-vu). Pas de mécanique nouvelle.
- **Carte inchangée** (« magique »), **aucun composant UI nouveau** : `learn` est un ingrédient caché,
  comme les erreurs.
- **Dégradation gracieuse** : si un skill n'a pas assez de non-vus, l'adaptatif comble (budget `total` tenu),
  même pattern que la tranche erreurs.

## Ce qu'on construit

### 1. `countUnseen(seen, bankIndex)` — helper pur (coverage.ts)
`countUnseen(seen: Uint8Array, bankIndex: Record<number, Skill>): number` — nombre d'ids de `bankIndex`
dont le bit `seen` est à 0. Pur, testable.

### 2. Plafond `learn` dans `pickSessionPlan` (sessionPlan.ts)
Ajouter `export const LEARN_CAP = 0.4;` et borner la formule :
`learn = caps.learn ? Math.min(state.newCoursePoints, Math.floor(LEARN_CAP * total), Math.max(0, total − errors)) : 0`.
`BUILT_CAPS.learn` reste `false` à cette étape (formule dormante ; testée avec `caps.learn:true` explicite) —
non-cassant.

### 3. Flip `BUILT_CAPS.learn = true` + tranche `learn` dans `start()`
- Charger `idx = await ensureBankIndex()` **avant** `pickSessionPlan` ; `seen = decodeBits(raw.seen)` ;
  `newCoursePoints = idx ? countUnseen(seen, idx) : 0` → injecté dans l'état du plan.
- Après la tranche erreurs (inchangée), **tranche `learn`** si `plan.alloc.learn > 0` :
  `allocateCount(masteryOf, plan.alloc.learn)` par catégorie ; pour chaque cat, `pickAdaptive` sur le pool
  **filtré aux non-vus** (`pool.filter(q => !hasBit(seen, q.id))`), en excluant les ids déjà pris ; accumuler
  dans `learnQs`, ajouter à `exclude`.
- Tranche **adaptatif** : `adaptiveTarget = total − errorQs.length − learnQs.length` ;
  `allocateCount(masteryOf, adaptiveTarget)` sur les pools **complets**, excluant erreurs+learn.
- Composition : `composeSession([...errorQs, ...learnQs], picked, total, Math.random)` (le 1ᵉʳ argument =
  socle garanti erreurs+nouveau ; `composeSession` réconcilie déjà `adaptiveTarget = total − garanti.length`).
- Flip `BUILT_CAPS.learn = true`.

## Tests (TDD)

- `coverage.test.ts` : `countUnseen` — aucun vu → = taille de l'index ; tous vus → 0 ; partiel → complément ;
  ids hors index ignorés.
- `sessionPlan.test.ts` : nouveau test du plafond (`caps.learn:true`, `newCoursePoints` grand, `total=10`
  → `learn = ⌊0.40·10⌋ = 4`) ; `learn` borné par `newCoursePoints` ; borné par `total − errors` ;
  + mettre à jour le contrat `BUILT_CAPS` (learn désormais émis quand `newCoursePoints>0`, cap 40%).
- Intégration (happy-dom, patron `EntrainementApp.start.test.tsx`) : avec **`diagAt` récent** (pas de diagnostic)
  et **aucun `seen`** (tout inédit), un *Commencer* produit une session de `total` questions incluant une
  tranche de non-vus, sans doublon ; avec un `seen` couvrant tout, `learn=0` et la session reste adaptatif+erreurs.

## Fichiers

- **Modifié** : `src/lib/coverage.ts` (+`countUnseen`) & `coverage.test.ts` ;
  `src/features/entrainement/sessionPlan.ts` (`LEARN_CAP` + formule + flip) & `sessionPlan.test.ts` ;
  `src/features/quiz/useQuiz.ts` (`start()` : `newCoursePoints`, tranche `learn`).
- Rappel : re-vérifier `EntrainementApp.start.test.tsx` / `.recording.test.tsx` / `.diagnostic.test.tsx`
  après le flip (ils seedent `diagAt` récent ; sans `seen` ils auront une tranche learn — vérifier que
  leurs assertions tiennent : session toujours de `total` questions « Q- », pas de doublon).

## Hors périmètre

- **Partie B / #5** : « rappel de cours » dans le corrigé grammaire (indexeur `cours-gram`, extraction de forme,
  bloc dans `Corrige`) — sous-projet séparé.
- Suivi par point de cours, mapping explicite point→question (inexistant dans les données).
- Tout affichage du mélange dans la carte (« magique » inchangée).

## Note (imperfection acceptée)

`allocateCount` répartit `plan.alloc.learn` entre catégories par maîtrise, **sans** tenir compte du nombre
de non-vus par catégorie ; une catégorie sans non-vus « gaspille » sa part (0 pick). La tranche learn peut
donc être < `plan.alloc.learn` même si le total de non-vus le permet ; l'adaptatif comble (budget tenu).
Suffisant pour le MVP (banques larges) ; raffinement possible en backlog.
