# Crédit production renforcé (FSRS)

**Date** : 2026-07-23
**Statut** : conçu, prêt à planifier

## 1. Problème

Une réponse **tapée juste** (rappel actif) est une preuve de mémoire plus forte qu'un QCM juste :
pas de plancher de hasard à 25 %, il faut produire la lecture. Or aujourd'hui les deux donnent le
même grade FSRS `Good(3)` — la production n'est pas mieux récompensée dans la planification des
révisions. Résultat : un item maîtrisé en production est revu aussi souvent qu'un item seulement
reconnu, alors qu'on pourrait l'espacer davantage.

**Le moteur supporte déjà `Easy(4)`** : `fsrsReview` applique le bonus `W[16]` (grade 4) et
`fsrsInit` prend `W[3]` pour S0(Easy) — mais le mapping binaire `correct ? 3 : 1` ne l'a jamais
émis (commentaire fsrs.ts : « Easy jamais déclenché, conservé pour rester fidèle aux poids »). La
production correcte est **exactement** le cas qui le justifie.

## 2. Décision pédagogique

- **Production correcte → `Easy(4)`** : intervalle de révision plus long (mémoire plus forte).
- **Production fausse → `Again(1)`** : une faute reste une faute, comme en QCM.
- **QCM inchangé** : correct → `Good(3)`, faux → `Again(1)`.
- **Elo inchangé** : la difficulté de la question ne change pas selon le mode ; seule la
  planification mémoire (FSRS) distingue la force de preuve. (Le plancher de hasard concerne la
  *confiance* dans la réponse, pas la *cote* de difficulté de l'item.)

Choix conservateur et **réglable en un point** (`fsrsPatch`) : si l'on préférait garder `Good` en
production (aucun bonus d'intervalle), c'est une seule ligne.

## 3. Architecture

Aucune modif du math FSRS (grade 4 déjà câblé). On **émet** grade 4 pour la production correcte, et
on **threade** le signal `production` — car `chosen` ne distingue pas production-correct
(`chosen = q.a`) de QCM-correct (`chosen = i`) : les deux portent un index réel.

### 3.1 `revision.ts` — `fsrsPatch` prend le mode

    export function fsrsPatch(
      map: FsrsMap, iris: string[], correct: boolean, jour: number, production = false,
    ): FsrsMap | undefined {
      const g: Grade = correct ? (production ? 4 : 3) : 1;
      ...
    }

Paramètre **optionnel** défaut `false` → les appels existants (dont les tests de `revision.test.ts`
à 4 args) restent valides et **inchangés** en comportement. QCM (`production=false`) →
`correct ? 3 : 1` = mapping actuel, **bit-identique**.

### 3.2 `fsrs.ts` — commentaires

Les commentaires « Hard(2)/Easy(4) ne se déclenchent jamais » / « en binaire, seuls 1 et 3 sont
émis » deviennent faux : mettre à jour pour noter que **la production correcte émet `Easy(4)`**
(Hard(2) reste non émis).

### 3.3 `useQuiz.ts` — threader `production`

- `answerPatch(raw, q, correct, chosen, today, nowMs, isLastDiag, production)` : nouveau paramètre
  `production: boolean`, passé à `fsrsPatch(asFsrs(raw), tests, correct, today, production)`.
- `commitAnswer(q, correct, chosen, production)` : nouveau paramètre, passé à `answerPatch`.
- `choose(i)` → `commitAnswer(q, i === q.a, i, false)`.
- `submitTyped(text)` → `commitAnswer(q, correct, correct ? q.a : null, true)`.

Rien d'autre ne change : Elo, graphe de confusion, `seen`/`mastered`, `wrong[]`, `diagAt`,
transitions de phase — tous **identiques**.

## 4. Flux

    submitTyped ──production=true──▶ commitAnswer ──▶ answerPatch(…, production=true)
                                                          └─ fsrsPatch(…, correct, jour, true)
                                                                └─ grade = correct ? 4(Easy) : 1
    choose ──────production=false─▶ commitAnswer ──▶ answerPatch(…, production=false)
                                                          └─ fsrsPatch(…, correct, jour, false)
                                                                └─ grade = correct ? 3(Good) : 1   (inchangé)

## 5. Tests

- **`revision.ts`** (`fsrsPatch`) :
  - production correcte → la carte a une **stabilité STRICTEMENT plus grande** qu'en QCM correct
    (Easy > Good) — sur le même item, même jour ; assertion comparative (pas un nombre en dur).
  - production fausse → `Again` (stabilité chute), identique à QCM faux.
  - QCM correct/faux inchangés (grades 3/1).
  - défaut `production` omis = QCM (`Good/Again`).
- **`answerPatch`** (useQuiz) : `production=true` + correct → le patch `fsrs` reflète Easy
  (stabilité > celle de `production=false` + correct, sur le même item) ; `production=false` →
  patch fsrs identique à avant.
- **Golden** : capture des sorties `answerPatch` sur des vecteurs QCM (production=false) AVANT/APRÈS
  → **bit-identique** (le chemin QCM ne bouge pas). Le chemin production est une **nouvelle**
  branche, non couverte par le golden QCM ; testée par les assertions comparatives ci-dessus.
- Les tests e2e production existants (`submitTyped`) restent verts ; on peut ajouter une assertion
  que le patch fsrs d'une production correcte porte une stabilité > Good.

## 6. Invariants

- **QCM + Elo strictement inchangés** ; prouvé bit-identique (golden) pour QCM.
- Aucune écriture `data/graph/`, aucun asset livré → **pas de bump `sw.js`**.
- Aucun changement du math FSRS (grade 4 déjà supporté) — seulement l'**émission** du grade.
- Rétro-compatible : blobs `fsrs` existants inchangés ; un item déjà révisé reçoit simplement un
  grade Easy à sa prochaine production correcte.
