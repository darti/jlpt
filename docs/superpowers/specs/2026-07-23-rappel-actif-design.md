# Rappel actif — production kana (lot 5)

**Date** : 2026-07-23
**Statut** : conçu, prêt à planifier

## 1. Problème

Le quiz est entièrement en QCM (reconnaissance) : pour lire 約束 on **choisit** やくそく
parmi quatre options. La reconnaissance est le test de mémoire le plus faible — un plancher de
25 % de bonne réponse au hasard, et « je la reconnais » ne prouve pas « je sais la produire ».
Le rappel **actif** (production) — taper la lecture de mémoire, sans options — est le test le
plus fort, et c'est exactement ce que l'examen de vocabulaire/kanji finit par exiger.

Le levier est déjà dans les données : pour une question « lecture », **la bonne réponse EST la
lecture cible** (une chaîne kana). On peut donc, sans aucun contenu nouveau et sans toucher au
graphe, **re-rendre** ces questions en exercice de saisie : masquer les options, afficher un
champ, comparer la saisie à la réponse.

## 2. Périmètre

### Éligibilité

Une question est **éligible à la production** ssi :

    (cat === "vocabulaire" || cat === "kanji") && isPureKana(o[a])

où `o[a]` est la bonne réponse (chaîne) et `isPureKana` teste `/^[ぁ-んァ-ンー]+$/`.

Mesure sur le corpus courant (`data/graph/q-*.jsonld`) :

| Piste | Total | Éligibles (réponse kana) | Part |
|---|---|---|---|
| vocabulaire | 5 901 | 2 944 | 49,9 % |
| kanji | 3 148 | 1 714 | 54,4 % |
| **total** | | **4 658** | |

Le filtre kana pur **exclut mécaniquement** le sens inverse (« écrire en kanji » : réponse =
kanji, ex. 影響) — qui exigerait un IME et ne teste pas la lecture. C'est le bon discriminant,
pas une heuristique : la réponse kana ⇔ la question demande une lecture.

### Hors périmètre v1 (notés comme extensions futures)

- **grammaire** : 79 % des réponses sont « kana pures », mais ce sont des particules/formes
  (は, ので) — produire une particule est un autre exercice que produire une lecture. Exclu
  pour garder une identité de feature nette (« taper la lecture »).
- **tolérance floue** : correspondance **exacte** après normalisation. Aucun rapprochement
  approché (il accepterait de fausses lectures).
- **crédit FSRS/Elo renforcé** pour une production correcte (qui, sans plancher de hasard, est
  une preuve de mémoire plus forte qu'un QCM correct) : v1 garde la mise à jour **binaire et
  identique** au QCM. Amélioration future, pas un manque.

## 3. Architecture

Une couche pure nouvelle, un toggle pur nouveau, un refactor DRY de `choose`, un embranchement
d'affichage. Aucune modification du graphe, aucun asset livré nouveau (donc **pas de bump
`sw.js`**).

### 3.1 `src/lib/kana.ts` (nouveau, pur)

Cœur mesurable de la feature, testé en table « golden » :

    /** hiragana + katakana + ー ; rien d'autre. */
    export function isPureKana(s: string): boolean

    /** trim → NFC → katakana→hiragana → retire espaces & ・. Comparaison de lectures. */
    export function normalizeKana(s: string): string

    /** true ssi la saisie normalisée égale la réponse normalisée. */
    export function checkReading(input: string, answer: string): boolean

    /** (vocabulaire|kanji) ET réponse kana pure. Opère sur la Question runtime (o[a]). */
    export function isProductionEligible(q: Question): boolean

Règle de normalisation, dans l'ordre :
1. `trim()`
2. `.normalize("NFC")`
3. katakana → hiragana (décalage `ァ..ヶ` = U+30A1..U+30F6 → −0x60 ; `ー` inchangé)
4. retrait des espaces (` 　`) et du point médian `・`

`checkReading` normalise **les deux** côtés puis compare `===`. La réponse du graphe étant déjà
en hiragana, la normalisation de la réponse est surtout idempotente ; elle protège d'un `・`
ou d'un espace résiduel côté données.

### 3.2 `src/lib/production.ts` (nouveau, pur)

Même patron qu'`audioRate.ts` :

    import { PROD_KEY } from "./keys.ts";
    export function readProduction(store = globalThis.localStorage): boolean
    export function writeProduction(on: boolean, store = globalThis.localStorage): boolean

Défaut : `false` (le mode QCM reste le mode par défaut). Best-effort try/catch comme les autres.

### 3.3 `src/lib/keys.ts`

    /** Mode rappel actif : taper la lecture au lieu de choisir (préférence, comme furi/thème). */
    export const PROD_KEY = "jlptN3_production";

Préfixe `jlptN3` obligatoire → balayé par `gist.ts#collectData`, donc synchronisé.

### 3.4 `src/features/quiz/useQuiz.ts` — refactor + extension

**Refactor DRY, préservant le comportement.** Le gros bloc d'écriture de `choose` (Elo, FSRS,
confusion, seen/mastered, wrong, history, transitions de phase, resume) est extrait :

    // chosen: index choisi, ou null en production (aucune option cochée).
    function commitAnswer(q: Question, correct: boolean, chosen: number | null): void

`choose(i)` devient `commitAnswer(q, i === q.a, i)`. Comportement identique — les tests existants
de `useQuiz` le garantissent.

**Extension production :**

    const submitTyped = useCallback((text: string) => {
      const q = questions[index];
      if (!q || answered) return;
      commitAnswer(q, checkReading(text, q.o[q.a]), null);
    }, [questions, index, answered, ...]);

**`chosen === null` (production) saute `confusionPatch`.** Le graphe de confusion modélise la
sélection d'un distracteur *sosie* en QCM ; une erreur de production est une erreur de **rappel**,
pas de reconnaissance. Les mélanger polluerait le graphe. Tout le reste (Elo, FSRS, seen,
mastered, wrong[], history) est **identique** — la production alimente la mesure exactement
comme un QCM.

`submitTyped` est exposé par le hook à côté de `choose`.

### 3.5 `src/features/quiz/QuestionCard.tsx`

Deux props nouvelles :

    production: boolean;
    onSubmitTyped: (text: string) => void;

Embranchement d'affichage de la zone de réponse :

- **production && isProductionEligible(question) && !answered** → un `<input>` kana + bouton
  « Valider » (Entrée valide aussi). La saisie locale (`useState`) est **remise à zéro quand
  `question.id` change** (même effet que l'auto-play écoute).
- **sinon (non éligible, ou QCM, ou déjà répondu)** → la liste d'options actuelle.

Après réponse en production (`answered`), on **révèle la liste d'options** comme corrigé (bonne
réponse en vert, exactement le corrigé QCM), précédée d'une ligne « Votre réponse : `<saisie>`
✓/✗ ». Cohérent avec le QCM : les distracteurs sont d'autres lectures, informatifs à voir.

Le champ accepte du texte libre ; on ne peut pas forcer l'IME. Une saisie romaji ne matchera pas
(il faut un clavier kana) — attendu pour une app d'étude du japonais.

### 3.6 `src/EntrainementApp.tsx`

- État `production` (init `readProduction()`), un **toggle sur le hub** (phase `home`) :
  « Mode rappel actif — taper les lectures », qui `writeProduction` au basculement.
- Passe `production` et `onSubmitTyped={submitTyped}` à `QuestionCard`.
- Le mode est **fixe pour une session** (on bascule sur le hub, avant de démarrer) ; c'est une
  prop de l'état React, pas une lecture localStorage par rendu → aucune obsolescence.
- **Écran de résultats diagnostic** (`DiagnosticResults`) : ces cartes restent en QCM (revue).
  La production ne s'applique qu'au flux de session normal ; le diagnostic mesure sans friction.

## 4. Flux de données

    hub: toggle production ──writeProduction──▶ localStorage(PROD_KEY)
                           └─état React───────────────┐
                                                      ▼
    question éligible + production ──▶ QuestionCard: <input>
        saisie + Entrée ──onSubmitTyped──▶ useQuiz.submitTyped(text)
            checkReading(text, o[a]) ──▶ correct: bool
                commitAnswer(q, correct, null)
                    ├─ Elo (updateRating)         ┐
                    ├─ FSRS (fsrsPatch)            │ identique au QCM
                    ├─ seen / mastered / wrong[]   ┘
                    └─ confusionPatch  ✗ SAUTÉ (chosen===null)
            phase → corrigé : options révélées + « Votre réponse ✓/✗ »

## 5. Tests

- **kana.ts** (table golden, cœur du lot) :
  - `normalizeKana` : katakana→hiragana (ヤクソク→やくそく), espaces/・ retirés, ー conservé
    (コーヒー), NFC.
  - `checkReading` : exact après normalisation ; ヤクソク vs やくそく → true ; « やくそく » (espaces)
    → true ; mauvaise lecture → false ; casse kana katakana/hiragana neutralisée.
  - `isPureKana` : やくそく→true ; 約束→false ; やく そく (espace)→false ; ABC→false.
  - `isProductionEligible` : vocab+réponse kana→true ; vocab+réponse kanji→false ;
    kanji+kana→true ; grammaire+kana→false ; ecoute/lecture→false.
- **production.ts** : lecture défaut false ; round-trip write→read ; store en échec → défaut.
- **useQuiz** : les tests existants restent verts (refactor préservant le comportement) ;
  nouveaux : `submitTyped(bonne)` incrémente `right` et pose le bit mastered ;
  `submitTyped(mauvaise)` ajoute à `wrong[]` ; **la production n'écrit jamais `confusions`**
  (assert absence de patch) ; Elo/FSRS mis à jour comme un QCM.
- **QuestionCard** : SSR — production+éligible affiche l'input, pas les boutons d'option ;
  non éligible affiche les options même en production. happy-dom — Entrée/Valider appelle
  `onSubmitTyped` avec la saisie ; le champ se vide au changement de `question.id`.

## 6. Invariants

- Aucune écriture dans `data/graph/` ; aucun asset livré nouveau → **pas de bump `sw.js`**.
- `PROD_KEY` porte le préfixe `jlptN3` (synchro Gist).
- `jlpt:ord` intact (aucune renumérotation) — la progression reste compatible.
- Le refactor de `choose` est **iso-comportement** ; garanti par la suite existante.
- La production **n'alimente pas** le graphe de confusion (frontière recall/reconnaissance).
