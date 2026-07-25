# Cadence & série quotidienne

**Date** : 2026-07-25
**Statut** : conçu, prêt à planifier

## 1. Problème

L'app dit **quoi** faire chaque jour — « Routine quotidienne (≈ 60–90 min/jour) » dans la
méthode, « session de décembre 2026 » dans l'en-tête — mais ne remarque jamais **si** on l'a
fait. Aucun suivi d'assiduité : ni série (streak), ni objectif du jour, ni historique. Pour une
préparation de 5 mois, c'est le levier de motivation le plus direct qui manque.

On ajoute une **cadence quotidienne** : un objectif du jour dérivé du **rythme requis pour
atteindre une cible de maîtrise avant l'examen**, une **série** de jours consécutifs où cet
objectif est atteint, et un **journal** par jour (socle d'une future heatmap).

Aucun contenu nouveau, aucune touche au graphe. Tout se dérive de l'état déjà persisté (le
bitset `mastered`) et de la date d'examen (`EXAM_DATE`).

## 2. Modèle

Unité de progrès = **question nouvellement apprise** : une question qui passe de « pas encore
maîtrisée » à « maîtrisée » (1re bonne réponse). C'est la même devise que la cible — on ne
« tient » la série qu'en apprenant vraiment, pas en révisant.

**Objectif du jour** (adaptatif, rythme requis) :

    objectifDuJour = ⌈ (cibleApprises − apprisesActuelles) / max(1, joursAvantExamen) ⌉   (borné ≥ 0)

- `cibleApprises = round(CIBLE_PCT × total)` — **CIBLE_PCT = 0,70**, `total = 10 307` (corpus),
  donc `cibleApprises = 7 215`.
- `apprisesActuelles` = nombre de bits à 1 dans le bitset `mastered` (popcount).
- `joursAvantExamen = daysUntilExam(now)` (déjà dans `scoring.ts`, dérive de `EXAM_DATE`).
- Départ (progression ≈ 0, ~134 j avant l'examen) : `⌈7215 / 134⌉ ≈ 54 / jour`. L'objectif
  **décroît** si on tient le rythme (apprises monte plus vite que le reste), **remonte** si on
  prend du retard (le reste stagne, les jours fondent) — c'est l'auto-correction voulue.
- `cibleApprises − apprisesActuelles ≤ 0` (cible atteinte) → objectif 0.
- `joursAvantExamen = 0` (examen passé) → objectif 0, la feature se met en veille.

**Progrès du jour** = `byDay[jourCourant]` = nombre de questions nouvellement apprises
aujourd'hui.

**Série** = nombre de jours **consécutifs**, en remontant depuis aujourd'hui, où
`byDay[j] ≥ goalByDay[j]`. Un jour non ouvert n'a pas d'entrée `byDay` (compté 0) → il casse la
série. Aujourd'hui compte dans la série **dès que** son objectif est atteint (progrès live ≥
objectif live).

> L'objectif dérive chaque jour (il dépend de `apprisesActuelles` et `joursAvantExamen` **du
> jour**). On ne peut donc PAS recalculer après coup si un jour passé a été « atteint » : on
> **gèle** l'objectif de chaque jour actif dans `goalByDay[j]` au moment où ce jour est vécu.

## 3. Données & persistance

Nouvelle clé **`jlptN3_cadence`** (préfixe `jlptN3` obligatoire → balayée par
`gist.ts#collectData`, donc synchronisée). Clé **propre**, hors du blob de progression : la
cadence n'est pas de la progression de quiz, et `writeProgress` (deep-merge de `skill`) n'a pas
à la connaître.

    interface Cadence {
      byDay: Record<number, number>;     // jour → questions nouvellement apprises
      goalByDay: Record<number, number>; // jour → objectif gelé ce jour-là
      best: number;                      // record de série (dérivé, mis en cache au rollover)
    }

- `jour` = `dayNumber(now)` (entier depuis EPOCH 2026-01-01 UTC, **déjà** utilisé par l'anneau
  `confusions` — même bucket, cohérent).
- La **série courante n'est PAS stockée** : elle se dérive de `byDay` + `goalByDay` à
  l'affichage (une source de vérité, pas deux). Seul `best` est mémorisé (il exige de connaître
  le pic historique, non reconstructible si l'utilisateur casse puis rebâtit une série).
- **Synchro : dernier écrit gagne** — une restauration Gist remplace `jlptN3_cadence`, comme
  l'anneau `confusions` et le reste du blob aujourd'hui. Accepté pour le MVP : étudier le même
  jour sur deux appareils peut écraser un `byDay[j]`. (Fusion par-max/jour = extension future,
  cf. §8.)

## 4. Couche pure — `src/lib/cadence.ts`

Module **pur** (aucun effet, `now`/`today` injectés), sur le modèle de `traps.ts`/`scoring.ts`.
C'est là que vivent les règles **et** les tests.

    export const CIBLE_PCT = 0.70;
    export const TOTAL_QUESTIONS = 10307;   // = Σ questions des shards q-*.jsonld (garde-fou §9)

    /** Objectif du jour = rythme requis, borné ≥ 0. Pur. */
    dailyGoal(masteredNow: number, daysLeft: number, total = TOTAL_QUESTIONS, pct = CIBLE_PCT): number

    /** Journal + objectif du jour après une nouvelle maîtrise. Pur — retourne un nouveau Cadence. */
    recordMastery(c: Cadence, day: number, goalToday: number, k = 1): Cadence

    /** Série courante : jours consécutifs atteints en remontant depuis `today`. Pur. */
    streakOf(c: Cadence, today: number): number

    /** Modèle d'affichage prêt pour le panneau. Pur. */
    cadenceModel(c: Cadence, masteredNow: number, daysLeft: number, today: number): CadenceModel
    // CadenceModel = { goal, done, streak, best, reached: boolean, daysLeft }

`masteredCount(mastered: Uint8Array): number` — popcount du bitset — vit dans **`coverage.ts`**
(avec les autres opérations de bitset : `setBit`/`hasBit`/`countUnseen`), et cadence le réutilise.

`recordMastery` fige `goalByDay[day]` la **première** fois qu'on touche un jour (objectif gelé),
puis incrémente `byDay[day]`, puis rafraîchit `best = max(best, streakOf(next, day))`.

`cadenceModel` affiche pour aujourd'hui l'objectif **gelé** `goalByDay[today]` s'il existe, sinon
le `dailyGoal` live — les deux coïncident (avant toute maîtrise, `masteredNow` = valeur de début
de journée), donc l'objectif affiché ne saute pas en cours de journée.

## 5. Intégration (le seul effet)

`useQuiz` persiste déjà le bit `mastered` via `answerPatch` (posé à `useQuiz.ts:399`). Une
**nouvelle maîtrise** est exactement :

    newlyMastered = correct && !hasBit(decodeBits(prevMastered), q.id)

Au même endroit (juste avant/après le `writeProgress(answerPatch(...))`), si `newlyMastered` :

1. lire `jlptN3_cadence` (ou `{}`), `masteredNow` = `masteredCount(decodeBits(prevMasteredB64))`
   **avant** le nouveau bit, `daysLeft = daysUntilExam(now)`, `goalToday = dailyGoal(masteredNow, daysLeft)` ;
2. `next = recordMastery(cadence, dayNumber(now), goalToday)` ;
3. persister `next` sous `jlptN3_cadence`.

Un helper à effet **`readCadence()` / `writeCadence(patch)`** dans `src/lib/storage.ts` (à côté
de `readProgress`/`writeProgress`), clé centralisée dans `src/lib/keys.ts`
(`CADENCE_KEY = "jlptN3_cadence"`). **Un seul point d'écriture**, au moment exact où le bit est
posé → journal et bitset avancent ensemble (pas de désync interne).

## 6. UI — `CadencePanel` sur l'Accueil

Nouveau composant `src/features/dashboard/CadencePanel.tsx`, monté sur la route `/` (Accueil),
alimenté par un hook `useCadence()` (lecture `jlptN3_cadence` + `useProgress` pour `masteredNow`).
Styles partagés (`PANEL` / `H2`).

Contenu :

- **🔥 Série : N jours** (record : M) — l'accroche.
- **Objectif du jour : X / N appris** + barre de progression (`done / goal`).
- **Le « pourquoi », en clair** : « N = (70 % du banc − déjà appris) ÷ jours avant l'examen » —
  l'objectif adaptatif ne doit jamais paraître opaque (c'était la réserve explicite au choix
  « adaptatif »).
- **Cible atteinte** (`reached`) → message de félicitation, objectif 0, la barre reste pleine.
- **Examen passé** (`daysLeft = 0`) → panneau en veille (« l'examen est passé — bravo »).

Repli : au premier chargement hors ligne, `masteredNow` vient du bitset local (toujours
dispo) ; `total` est une constante → **pas** besoin du corpus. Le panneau s'affiche donc même
sans réseau (contrairement aux anneaux de couverture qui, eux, attendent `corpus.jsonld`).

## 7. Cas limites

| Cas | Comportement |
|---|---|
| Cible déjà atteinte | objectif 0, félicitations, barre pleine |
| Examen passé (`daysLeft=0`) | objectif 0, panneau en veille |
| Jour non ouvert | pas d'entrée `byDay` → 0 → casse la série |
| Progression remise à zéro | le journal `jlptN3_cadence` **reste** (historique) ; la série repart quand on réapprend |
| Restauration Gist | dernier écrit gagne (cf. §3) |
| Premier jour, aucune maîtrise encore | série 0, objectif N, done 0 — panneau incitatif |

## 8. Hors périmètre v1 (extensions notées)

- **Heatmap / calendrier d'activité** — le journal `byDay` en est le socle ; l'écran viendra
  après (c'est l'idée « statistiques dans le temps » mise de côté).
- **CIBLE_PCT configurable** dans Paramétrage — codée en dur à 0,70 pour le MVP.
- **Fusion par-max/jour** à la synchro — dernier-écrit-gagne pour le MVP.
- **Objectif par compétence** — un seul objectif global v1 (le rythme, pas la répartition, que
  `prescriptiveWeights` gère déjà côté sélection).

## 9. Tests

- `src/lib/cadence.test.ts` (pur) : `dailyGoal` (rythme, bornes ≥ 0, cible atteinte,
  `daysLeft=0`), `streakOf` (jours consécutifs, trou qui casse, aujourd'hui live),
  `recordMastery` (gel de `goalByDay`, incrément `byDay`, `best`), `cadenceModel`.
- `coverage.test.ts` : `masteredCount` (popcount, bitset vide, plein).
- **Garde-fou de mesure** : `TOTAL_QUESTIONS === Σ` questions réelles du corpus (comme les
  autres tests de mesure du projet) — échoue si le corpus grandit, forçant à remonter la
  constante. Sans lui, `TOTAL_QUESTIONS` codé en dur dériverait en silence (choix assumé :
  constante = panneau dispo hors ligne, vs dériver du corpus qui exigerait le réseau).
- Test happy-dom : une **bonne réponse à une question non encore maîtrisée** incrémente
  `byDay[today]` de 1 ; une **révision** (déjà maîtrisée) ne l'incrémente pas.
- SSR smoke : `CadencePanel` rend série + objectif + le « pourquoi » (asserter des sous-chaînes
  sans apostrophe — `renderToStaticMarkup` échappe `'`).

## 10. Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/lib/keys.ts` | **modifié** — `CADENCE_KEY = "jlptN3_cadence"` |
| `src/lib/cadence.ts` | **créé** — couche pure (modèle + règles) |
| `src/lib/cadence.test.ts` | **créé** |
| `src/lib/coverage.ts` | **modifié** — `masteredCount` (popcount) |
| `src/lib/storage.ts` | **modifié** — `readCadence` / `writeCadence` |
| `src/features/quiz/useQuiz.ts` | **modifié** — enregistrer la maîtrise au point d'écriture du bit |
| `src/features/dashboard/useCadence.ts` | **créé** — hook de lecture |
| `src/features/dashboard/CadencePanel.tsx` | **créé** — panneau Accueil |
| `src/features/dashboard/CadencePanel.test.tsx` | **créé** — SSR smoke |
| montage Accueil (`App.tsx`/dashboard) | **modifié** — insérer `CadencePanel` |

## Contraintes (rappel projet)

- Worktree `.worktrees/cadence`, branche `feat/cadence-quotidienne`. Jamais dans la racine.
- `bun` exclusivement. Tests : `bun test <fichier>`. Typecheck : `bun run typecheck`.
- Commentaires et commits en **français**, conventional commits, **PAS de Co-Authored-By**.
- **Commit : message COURT à UNE ligne** (un hook de revue bloque les messages multi-lignes).
- Zéro dépendance nouvelle. Aucun asset livré modifié → **pas** de bump `sw.js`.
- `CADENCE_KEY` = seul ajout à `keys.ts`, préfixe `jlptN3` (sinon jamais synchronisée).
