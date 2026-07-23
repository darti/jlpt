# Confusion lot 2 — piloter la sélection depuis les pièges actifs

**Date** : 2026-07-23
**Statut** : conçu, prêt à planifier

## 1. Problème

Le graphe de confusion (lot 1) MESURE par quel type de piège l'apprenant se fait avoir
(`trapModel.active` : les kinds encore actifs sur 30 jours, triés par fréquence récente), mais
ne change RIEN à ce qu'on lui resert. Un apprenant qui confond systématiquement les
`kanji-partage` (影像/影響) ne reçoit des questions de ce type que par le hasard de `pickAdaptive`.

Le levier existe déjà dans les données : chaque question kanji/vocabulaire porte `trap[]` — le
type de piège de CHAQUE option (`""` à l'index de la réponse). Une question **exerce** un kind K
ssi `K ∈ q.trap`. On peut donc, sans contenu nouveau, réserver dans la session des questions qui
exercent les kinds que l'apprenant confond — pour **entraîner le motif**, pas seulement rejouer
l'item manqué (ce que la tranche `errors` fait déjà via `wrong[]`).

## 2. Périmètre

Une nouvelle **tranche « confusion »** dans la composition de session, entre `errors` et
`revision`. Elle sélectionne des questions exerçant les kinds ACTIFS de `trapModel`, pondérées
par la récence. Aucun contenu nouveau, aucune modification du graphe, aucun asset livré
(**pas de bump `sw.js`**), aucune UI nouvelle.

**Hors périmètre v1** (notés futurs) : cibler la PAIRE d'entités précise (影/映) plutôt que le
kind — `trap[]` ne porte que le kind ; afficher un libellé « on cible ta confusion 影/映 » dans
le corrigé/hub — le lot ne touche QUE la sélection.

## 3. Architecture

Une nouvelle ressource pure (sélecteur + proxy de comptage) et un nouvel ingrédient dans le
moteur de plan. Le tout suit EXACTEMENT le patron des tranches existantes (errors / revision /
learn) : un cap, un compteur d'état, un sélecteur pur, réconciliation par `composeSession`.

### 3.1 `traps.ts` — deux fonctions pures nouvelles

    /** Proxy de comptage pour le plan : nb d'événements de confusion dans la fenêtre récente.
     *  Sur-compte (inclut untyped/outOfScope) mais ce n'est qu'un CAP : `selectConfusion` fait
     *  le tri fin par kind et `composeSession` réconcilie tout écart. Ne nécessite PAS les pools. */
    export function activeConfusionCount(confusions: Confusion[], today: number, windowDays = 30): number

    /** Questions exerçant un kind ACTIF (`K ∈ q.trap`), pondérées par la récence du kind, hors
     *  `exclude`, au plus `n`. `active` = `trapModel.active`. Pur (rng injecté). */
    export function selectConfusion(
      active: TrapCount[], pool: Question[], exclude: Set<number>, n: number, rng?: () => number,
    ): Question[]

`selectConfusion` : construit `weight = Map(kind → recent)` depuis `active` ; pour chaque
question du pool non exclue portant `trap[]`, score = **max** des poids des kinds actifs qu'elle
exerce ; garde les questions de score > 0 ; trie par score décroissant (+ jitter `rng` pour
départager) ; rend les `n` premières. `""`/`"autre"` ne sont jamais dans `weight` (le
`trapModel` les exclut de `active`), donc seuls les distracteurs de kind actif comptent — l'index
de la réponse (`""`) n'apporte jamais de score.

### 3.2 `sessionPlan.ts` — nouvel ingrédient « confusion »

- `export const CONFUSION_CAP = 0.25;`
- `SessionState` : `confusionCount: number` (0 tant qu'aucune confusion récente).
- `Caps` : `confusion: boolean` ; `BUILT_CAPS.confusion = true`.
- `SessionPlan` composé : `alloc: { errors, confusion, revision, learn, adaptive }`.
- `pickSessionPlan`, ordre de priorité (premier servi, chacun borné par son cap ET le budget
  restant) : **errors → confusion → revision → learn → adaptive**.

  ```
  errors    = min(wrongCount, ERRORS_CAP·total)
  confusion = min(confusionCount, CONFUSION_CAP·total, total−errors)
  revision  = min(revisionDue, REVISION_CAP·total, total−errors−confusion)
  learn     = min(newCoursePoints, LEARN_CAP·total, total−errors−confusion−revision)
  adaptive  = total − errors − confusion − revision − learn
  ```

**Ordre — justification.** `errors` (les items exacts ratés) puis `confusion` (le MOTIF
répété) forment le bloc « correction d'erreurs », `confusion` généralisant `errors`. Le cap 0,25
ne comprime PAS le cap 0,4 de `revision` dans une session normale : pour `total=15`,
`errors≤4`, `confusion≤3`, `revision≤min(due, 6, 8)=6` — révision garde son plein cap. La
priorité haute documentée de la révision (« à 4,5 mois de l'examen, l'oubli prime ») est
préservée.

### 3.3 `useQuiz.start()` — câblage

1. **Avant le plan** (à côté de `revisionDue`) : `confusionCount = activeConfusionCount(asConfusions(raw), jourRevision)`. Passé dans l'état à `pickSessionPlan`.
2. **Après le chargement des pools** (`allPool` disponible), à côté de la tranche révision :
   ```
   const trapM = trapModel(asConfusions(raw), kindIndex(allPool), jourRevision); // même fenêtre 30 j que l'affichage
   const confusionQs = plan.alloc.confusion > 0
     ? selectConfusion(trapM.active, allPool, exclude, plan.alloc.confusion, Math.random)
     : [];
   for (const q of confusionQs) exclude.add(q.id);
   ```
   Placé APRÈS `errorQs`/`revisionQs` dans le calcul d'`exclude` pour ne jamais dédoubler.
3. Ajouté aux tranches garanties : `composeSession([...errorQs, ...confusionQs, ...revisionQs, ...learnQs], picked, total, ...)`.
4. `adaptiveTarget = max(0, total − errorQs.length − confusionQs.length − revisionQs.length − learnQs.length)`.

Réutilise la MÊME fenêtre 30 jours que l'affichage (`trapModel` défaut) : les pièges qui pilotent
la session sont exactement ceux montrés à l'apprenant.

## 4. Flux de données

    raw.confusions ──asConfusions──▶ Confusion[]
        │                               │
        │ activeConfusionCount (proxy)  │ trapModel(·, kindIndex(allPool), jour) → active[]
        ▼                               ▼
    plan.alloc.confusion  ───────▶ selectConfusion(active, allPool, exclude, n)
        (cap)                          │  (kind ∈ q.trap, pondéré récence)
                                       ▼
                    confusionQs ──▶ tranche garantie de composeSession
                                    (exclue des tranches suivantes)

## 5. Graceful zero (invariant)

Aucune confusion récente ⇒ `activeConfusionCount = 0` ⇒ `plan.alloc.confusion = 0` ⇒
`confusionQs = []` ⇒ session **identique** à aujourd'hui. Et même si le proxy est > 0 mais que
`trapModel.active` est vide (tout « autre »/hors périmètre), `selectConfusion` rend `[]` et
`composeSession` comble par l'adaptatif. La feature est **inerte tant qu'il n'y a pas de signal
de confusion répétée**, exactement comme la révision tant que la mémoire FSRS ne s'est pas
accumulée.

## 6. Tests

- **traps.ts** :
  - `activeConfusionCount` : compte les événements dans la fenêtre, ignore les anciens ; 0 sur `[]`.
  - `selectConfusion` : pioche des questions exerçant un kind actif ; priorise le kind le plus
    récent (poids max) ; respecte `exclude` ; rend `[]` si `active` vide ou `n≤0` ; ne pioche
    JAMAIS une question dont seul l'index réponse matcherait (impossible : `""` hors `weight`) ;
    déterministe avec un `rng` injecté.
- **sessionPlan.ts** :
  - `confusion` alloué et borné par `CONFUSION_CAP` ; l'ordre errors→confusion→revision→learn ;
    `confusionCount=0` ⇒ `alloc.confusion=0` (et révision/learn inchangés) ; caps sommant à
    `total` (adaptive absorbe) ; `caps.confusion=false` ⇒ 0 (gel de capacité).
- **useQuiz** (léger) : la tranche confusion est exclue des tranches suivantes (pas de doublon) —
  garanti par l'ajout à `exclude` ; couvert par les tests purs + typecheck (le câblage
  n'introduit pas de nouvelle règle testable hors des couches pures).

## 7. Invariants

- Aucune écriture `data/graph/`, aucun asset livré → **pas de bump `sw.js`**.
- `jlpt:ord` intact.
- Graceful zero : session inchangée sans signal de confusion.
- La tranche confusion ne dédouble jamais errors/revision/learn (`exclude`).
- Fenêtre de sélection = fenêtre d'affichage (30 j), une seule source.
