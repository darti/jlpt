# Apprendre avant de quizzer — état dérivé, paquet de cartes, ancrage immédiat

**Date** : 2026-07-28
**Statut** : conçu, prêt à planifier

## 1. Problème

Trois symptômes, une cause commune.

**(a) Les écrans de revue sont des murs.** `/cours/gram/g2` (« Conditionnels & hypothèses »)
déplie 12 points, chacun avec forme + structure multi-lignes + sens + carte d'exemple
(japonais furiganisé, romaji, français, `SentenceAnalysis` **légende comprise**) — les 227
exemples du graphe portent une analyse. Mesuré sur le contenu réel :

| Piste | Groupes | Items | min / médiane / max par groupe |
|---|---|---|---|
| grammaire | 16 | 222 | 4 / 14 / **26** |
| vocabulaire | 25 | 618 | 3 / 27 / **47** |
| kanji | 51 | 551 | 1 / 9 / 30 |

Aucun pliage, aucune ancre, aucun filtre. Le seul geste offert est le défilement.

**(b) Le cochage est une saisie redondante.** `coursProgress` est un
`Record<IRI, "known"|"review">` (clé `COURS_KEY`, v2 indexée par IRI du graphe). Le modèle de
mémoire `FsrsMap` est un `Record<IRI, Fsrs>`. **Même espace de clés, deux vues de la même
entité, jamais réconciliées** : on peut avoir `R = 0,98` sur 〜ばかり depuis trois semaines et
voir toujours `○` dans le cours. L'app possède l'information que l'apprenant ressaisit à la main.

**(c) La tranche « apprendre » enseigne à l'envers.** `sessionPlan.ts` alloue déjà `learn`
(cap 40 %), mais la tranche sélectionne des **questions jamais vues** (`useQuiz.ts:203`,
`pools[cat].filter(q => !hasBit(seen, q.id))`). « Apprendre » signifie donc aujourd'hui *être
interrogé sur une notion qu'on ne vous a jamais présentée*. L'étage d'enseignement n'existe pas.

La cause commune : **le cours et le moteur de quiz ne se parlent que dans un sens**
(`rappel.ts`, corrigé → cours). Le cours ne sait rien de ce que le quiz a mesuré.

## 2. Décisions

Cinq décisions prises en conception, dans cet ordre :

1. **L'état d'un item est entièrement dérivé du modèle de mémoire.** Plus de stockage, plus de
   cochage manuel. Le geste « je connais déjà » **amorce** la mémoire (`fsrsInit`) au lieu de
   poser un drapeau qui masque l'item.
2. **La phase d'apprentissage suit le programme** : la leçon en cours de chaque piste, pas une
   sélection algorithmique d'entités sans lien entre elles.
3. **L'écran de revue devient un paquet de cartes plein écran**, sans défilement — le même
   composant que la phase d'apprentissage.
4. **Le flux est « carte → question immédiate »**, puis les mêmes entités reviennent mêlées
   dans le quiz. Pas 90 s de lecture passive avant le premier effort.
5. **Les trois pistes sont touchées à chaque séance**, en mini-blocs contigus (2 kanji, puis
   2 mots, puis 1 point de grammaire), l'allocation venant des `prescriptiveWeights` existants.

**Contrainte de conception transverse : aucune couche numérique n'est modifiée.** `elo.ts`,
`scoring.ts`, `fsrs.ts` et `sessionPlan.ts` restent intacts. Le CLAUDE.md exige une preuve
bit-identique (capture golden avant / diff exact après) pour tout refactor de ces modules ; en
n'ajoutant qu'une **lecture** dérivée par-dessus, ce coût de preuve tombe à zéro. Toute
tentation d'« ajuster un poids » au fil de l'implémentation est une déviation (G9).

## 3. L'état dérivé

Nouveau module pur `src/features/cours/entityState.ts`.

```ts
export type EntityState = "neuf" | "en-cours" | "a-revoir" | "acquis";
export function entityState(fsrs: Fsrs | undefined, today: number): EntityState;
```

| État | Règle | Signification |
|---|---|---|
| ○ `neuf` | aucune carte FSRS | jamais rencontré |
| ◐ `en-cours` | non due et `S < STABILITE_ACQUISE` | vu, pas encore consolidé |
| ◑ `a-revoir` | `isDue(carte, today)` | l'oubli a commencé |
| ● `acquis` | non due et `S ≥ STABILITE_ACQUISE` | tenable trois semaines |

`STABILITE_ACQUISE = 21` (jours). **Le seuil est dérivé d'une mesure, pas choisi au doigt
mouillé.** Trajectoire simulée de `fsrsReview(·, Good, échéance)` depuis
`fsrsInit(3)` :

    S = 3,7 j → 14,8 j → 49,5 j → 147,4 j → 397,4 j

`21` tombe entre la 1re et la 2e révision réussie : **« acquis » se gagne en deux succès
espacés**. Une seule bonne réponse ne suffit pas, et le seuil ne dépend d'aucune constante
FSRS interne (il resterait juste si les intervalles changeaient d'échelle).

> ⚠ Le critère **ne peut pas** être `isDue` seul. `fsrsInit(1, today)` (réponse fausse sur un
> item neuf) rend `S = 0,49 j` avec `R = 1` le jour même : l'item serait affiché « acquis »
> quelques heures après avoir été raté. C'est la stabilité, pas la rétrievabilité instantanée,
> qui porte l'acquisition.

Fonctions dérivées, mêmes signatures que l'actuel `coursProgress.ts` pour que les vues ne
changent pas de contrat :

```ts
export function groupStates(group: CoursGroup, m: FsrsMap, today: number): GroupStats;
export function categoryStates(cat: LearnCategory, m: FsrsMap, today: number): GroupStats;
```

`GroupStats` change de forme : `{ known, review, total }` devient
`{ acquis, enCours, aRevoir, neufs, total }`. Les deux seuls consommateurs sont `CategoryIndex`
et `CoursHub` — pas de shim, on met à jour les appelants (MVP : pas de compatibilité ascendante).

`STABILITE_ACQUISE` est exportée par `entityState.ts` — un seul endroit, comme `EXAM_DATE`
l'est pour la date d'examen.

### 3.1 Le geste « Je connais déjà »

Remplace `StateToggle`. Un clic écrit `fsrsInit(3, today)` pour l'IRI, via `writeProgress`
(patch `fsrs`, jamais un blob complet). Conséquence voulue : **l'entité entre dans le
planificateur** et reviendra en révision. Une affirmation devient une hypothèse testable au lieu
d'un angle mort — c'est ce qui rachète la perte du « masquer définitivement ».

Sur une carte sans question d'ancrage possible (§5.3), le geste se dédouble en
`Je connais` / `À revoir` → `fsrsInit(3 | 1, today)`.

### 3.2 Migration de `COURS_KEY`

Au premier montage après déploiement, `migrateCoursProgress(raw, today)` (pur) lit `COURS_KEY`
et produit le patch `fsrs` correspondant, **sans écraser une carte existante** (le modèle de
mémoire fait autorité ; c'est l'invariant de toutes les chaînes d'outils du projet) :

| `COURS_KEY` | Patch |
|---|---|
| `"known"` | `fsrsInit(3, today)` si aucune carte |
| `"review"` | `fsrsInit(1, today)` si aucune carte |

La clé est ensuite **laissée en place mais plus jamais écrite** : elle reste la preuve du travail
manuel déjà fait, rejouable si la migration est perdue. Un drapeau
`jlptN3_coursMigre` (préfixe `KEY_PREFIX`, donc synchronisé par `gist.ts#collectData`) rend
l'opération idempotente. `saveCoursProgress` et `cycleState` sont **supprimés**.

## 4. `EntityCard` et le paquet

### 4.1 Le composant

`src/features/cours/EntityCard.tsx` — un rendu d'entité, **quatre points d'usage** :

| Usage | Aujourd'hui |
|---|---|
| paquet du cours | `GramPoint` / `VocabRow` / `KanjiRow` (`GroupDetail.tsx`) |
| phase d'apprentissage | n'existe pas |
| rappel du corrigé | `Rappel` (`Corrige.tsx`) |
| carte d'entité en révision | n'existe pas |

Props : `{ item: CoursItem; state: EntityState; variant: "carte" | "compacte" }`. La variante
compacte sert le corrigé (pas d'exemple déplié) ; la variante carte sert le paquet et
l'apprentissage. `splitStruct` migre de `GroupDetail.tsx` vers ce module.

La légende de `SentenceAnalysis` passe **une fois par paquet** (dans le pied), plus une fois par
exemple : c'est la répétition la plus coûteuse en hauteur du rendu actuel.

### 4.2 Le paquet

`src/features/cours/Deck.tsx` remplace `GroupDetail.tsx` sur `/cours/:cat/:group`.

- une `EntityCard` par écran, **aucun défilement de liste** ;
- navigation ←/→ (clavier) et boutons précédent/suivant ; `Échap` remonte à `CategoryIndex` ;
- barre de progression `n / total`, colorée par état dérivé ;
- le paquet contient **tous** les items du groupe, dans l'ordre de `covers` — mais sans
  `?focus=`, il s'ouvre **sur la première carte non `acquis`**. C'est ce qui rend un thème de
  47 mots praticable sans introduire de filtre : la traversée démarre là où le travail reste
  à faire, et raccourcit d'elle-même à mesure que l'état dérivé progresse ;
- `?focus=<iri>` **positionne le paquet sur la carte** au lieu de faire défiler vers elle. Le
  lien profond du corrigé (`coursDeepLink.ts#rappelHref`) est inchangé — c'est sa destination
  qui change de nature. Les voisins (〜たら / 〜ば / 〜なら) sont alors à une touche, contre
  800 px de défilement aujourd'hui ;
- `?from=quiz` conserve le lien « Revenir à la question » (`quizResumeHref`).

`GroupDetail.tsx` (284 lignes) et `GroupDetail.test.tsx` sont supprimés ; les cas de test
utiles (deep link, focus, rendu par catégorie) sont portés sur `Deck.test.tsx`.

`CategoryIndex` reste la carte du territoire — c'est ce qui rachète la faiblesse connue d'un
paquet (mauvais dictionnaire). Ses compteurs deviennent dérivés :
`{acquis}/{total} acquis · {aRevoir} à revoir`.

## 5. La séance : apprendre & ancrer

### 5.1 Réinterprétation, pas modification

`sessionPlan.ts` n'est **pas modifié**. Seule l'interprétation de `alloc.learn` change :

| | Avant | Après |
|---|---|---|
| `alloc.learn` | N questions jamais vues | **N entités à enseigner**, chacune consommant son créneau via sa question d'ancrage |

L'arithmétique du budget est donc inchangée : `errors + confusion + revision + learn + adaptive
= total`. La reprise en phase 2 (« les mêmes points rebrassés ») est prélevée sur `adaptive`,
en tête de sa file — pas de créneau supplémentaire.

⚠ **Une entité sans ancre (§5.3) ne consomme pas son créneau** : elle est enseignée, mais aucune
question ne lui correspond. Le créneau libéré retourne à `adaptive`, exactement comme le fait
déjà `composeSession` quand une tranche garantie rend moins que son allocation. Le budget total
reste donc `total` quel que soit le taux d'ancrage — invariant à couvrir par un test.

⚠ `allocateCount` distribue sur les **cinq** compétences du quiz ; seules **trois** sont
enseignables (lecture et écoute n'ont pas d'entité). L'allocation de la tranche `learn` est donc
restreinte à `{kanji, vocabulaire, grammaire}` et renormalisée.

### 5.2 Le curseur de programme

Nouveau module pur `src/features/entrainement/curriculum.ts` :

```ts
export function nextLessonBlock(
  track: "gram" | "vocab" | "kanji",
  categories: CoursCategory[], m: FsrsMap, today: number, n: number,
): CoursItem[];
```

La leçon en cours = la **première leçon dans l'ordre `jlpt:order`** contenant au moins un item
non `acquis`. On y prend les `n` premiers items non `acquis`, dans l'ordre de `covers` ; si la
leçon en fournit moins de `n`, on complète avec la suivante (un bloc peut donc chevaucher deux
leçons en fin de leçon — accepté, c'est la frontière, pas le régime courant).

Les mini-blocs restent **contigus par piste** dans la file de la phase 1.

### 5.3 L'ancrage — et la découverte qui le contraint

Chaque carte enseignée est suivie immédiatement d'une question qui la teste. Il faut donc, pour
chaque entité, résoudre entité → question. Mesuré sur le graphe :

| Piste | Enseignés | Testables par arête `tests` |
|---|---|---|
| grammaire | 222 | 188 — **85 %** |
| vocabulaire | 618 | 540 — **87 %** |
| kanji | 551 | **0** — **0 %** |

**Les 551 kanji enseignés et les 124 kanji testés directement sont deux ensembles disjoints.**
L'intersection est vide, vérifiée. Cause : `link-answers.mjs` pose l'arête depuis la **réponse**,
et la réponse d'une question de kanji est presque toujours un **mot** — `q-kanji.jsonld` porte
2 690 arêtes `jlpt:word` contre 436 `jlpt:kanji`. Ces 436 visent des kanji élémentaires
(八 午 毎 古 子 友), pas les kanji N3 du cours (位 億 化 供 偶 係).

Le pont existe et se **dérive**, sans écrire une ligne de contenu :
**kanji → mots testés qui le contiennent → questions**. Mesuré : **513 / 551 = 93 %**, médiane
3 mots testés par kanji, max 32.

Nouveau module pur `src/features/quiz/anchor.ts`, même patron que `revision.ts#fsrsIndex`
(index inverse mémoïsé sur l'identité du tableau de questions) :

```ts
export function anchorIndex(questions: Question[]): AnchorIndex;
export function selectAnchor(
  iri: string, index: AnchorIndex, exclude: Set<number>,
): Question | null;
```

Résolution en deux temps : arête `tests` directe d'abord ; à défaut, pour un IRI
`jlpt:kanji/X`, les questions testant un `jlpt:word/…` contenant `X`.

**Les 38 kanji restants** (仁 湯 司 詩 諸 紀 署 操 批 忠 宮 脳 肺 芽 票 型 序 鉱 銅 鈍 …) et les
~14 % de grammaire / vocabulaire sans arête n'ont **aucune ancre**. Décision : **on n'invente
pas de question.** La carte propose l'auto-évaluation `Je connais` / `À revoir` (§3.1) et passe.
C'est cohérent avec le reste : le seul signal disponible entre dans le planificateur.

### 5.4 Le flux

Nouvelle phase dans `useQuiz` : `Phase` gagne `"apprendre"`.

```
plan.kind === "composed" && alloc.learn > 0
  └─ phase "apprendre"  : file [carte e₁, ancre(e₁), carte e₂, ancre(e₂), …]
                          mini-blocs contigus par piste
  └─ phase "question"   : le quiz — reprises des eᵢ en tête de la file adaptive,
                          puis erreurs / confusion / révision / adaptatif
```

Les cartes ne sont **pas** persistées dans `ResumeState.ids` (ce sont des IRIs, pas des ords).
`ResumeState` gagne un champ optionnel `learn?: string[]` (IRIs restant à enseigner) — champ
absent sur un blob ancien, donc dégradation silencieuse vers une reprise directe en phase quiz,
conformément à la tolérance imposée aux lectures de blob (`blob.ts`).

Une réponse d'ancrage passe par `commitAnswer` **inchangé** : mêmes écritures Elo, `seen`,
`mastered`, cadence et `fsrsPatch`. Une bonne réponse à lag ~0 vaut `Good(3)` → `S = 3,7 j`,
soit `en-cours` et non `acquis` : le §3 garantit qu'apprendre une carte puis répondre juste ne
suffit pas à la déclarer acquise.

## 6. Modules touchés

| Fichier | Action |
|---|---|
| `src/features/cours/entityState.ts` | **créé** — dérivation pure + `groupStates` / `categoryStates` |
| `src/features/cours/EntityCard.tsx` | **créé** — rendu unique d'entité, 4 usages |
| `src/features/cours/Deck.tsx` | **créé** — paquet plein écran |
| `src/features/entrainement/curriculum.ts` | **créé** — curseur de programme |
| `src/features/quiz/anchor.ts` | **créé** — index inverse entité → question |
| `src/features/cours/GroupDetail.tsx` | **supprimé** (284 l.) |
| `src/features/cours/coursProgress.ts` | réduit à la migration ; `cycleState` / `setItemState` / `saveCoursProgress` supprimés |
| `src/features/cours/useCoursProgress.ts` | remplacé par une lecture de `FsrsMap` |
| `src/features/cours/CategoryIndex.tsx` | compteurs dérivés |
| `src/features/quiz/Corrige.tsx` | le rappel rend `EntityCard variant="compacte"` |
| `src/features/quiz/useQuiz.ts` | phase `apprendre`, file d'ancrage, reprises |
| `src/features/quiz/resume.ts` | `learn?: string[]` |
| `src/EntrainementApp.tsx` | branche de rendu de la phase `apprendre` |
| `src/lib/keys.ts` | `COURS_MIGRE_KEY` |

`elo.ts`, `scoring.ts`, `fsrs.ts`, `bank.ts`, `sessionPlan.ts`, `answerPatch.ts` : **intacts**.

## 7. Tests

- `entityState.test.ts` — les quatre états aux frontières ; **cas de régression explicite** :
  `fsrsInit(1, j)` le jour même n'est pas `acquis` (§3, le piège de `isDue`).
- `entityState.test.ts` — test de **mesure** : le seuil 21 j tombe entre la 1re et la 2e
  révision réussie (fige la propriété, pas la constante FSRS).
- `coursProgress.migration.test.ts` — idempotence ; une carte existante n'est jamais écrasée.
- `anchor.test.ts` — résolution directe ; résolution kanji → mot ; `null` sans ancre.
- `anchor.reel.test.ts` — test de **mesure** sur le graphe réel : `≥ 93 %` des kanji enseignés
  résolvent une ancre, `≥ 85 %` en grammaire, `≥ 87 %` en vocabulaire. **Cliquets à remonter**
  dès que les arêtes s'améliorent (cf. cycle de vie d'un test de mesure, CLAUDE.md).
- `curriculum.test.ts` — leçon en cours ; chevauchement de fin de leçon ; piste épuisée.
- `Deck.test.tsx` — happy-dom : navigation clavier, `?focus=` positionne, `?from=quiz` rend le
  lien retour. ⚠ ne jamais asserter un kanji rendu par `furi()` en sous-chaîne brute
  (`baseText()`, cf. `quiz.test.tsx`).
- `useQuiz` — la phase `apprendre` précède `question` ; `alloc.learn === 0` la saute ; un
  `ResumeState` sans `learn` reprend en phase quiz.
- `useQuiz` — **invariant de budget** : une session dont *aucune* entité enseignée n'a d'ancre
  compte toujours `total` questions (§5.1).

Les quatre tests de mesure existants (`cadence.ts` `TOTAL_QUESTIONS`, `cadence.test.ts`,
`rappel.reel.test.ts`, `shapes.test.ts`) **ne bougent pas** : aucune question n'est ajoutée.

## 8. Hors périmètre — signalé, pas traité

- **La position de la bonne réponse n'est pas répartie.** L'app ne mélange jamais les options
  (délibéré, `onChoose(i)` rend l'index d'origine) et `q-ecoute` mesure **[32, 0, 0, 0]**.
  L'ancrage rapproche des questions portant sur la même notion : le biais deviendra plus
  visible. Ce lot ne le corrige pas.
- **`link-answers.mjs` pourrait poser les arêtes kanji manquantes** (depuis `jlpt:gloss`, qui
  décompose déjà 未（み）·来（らい）). Ce serait une écriture dans le graphe, donc une chaîne
  outillée à part entière — et `anchor.ts` la rendrait ensuite superflue pour 93 % des cas.
  À arbitrer plus tard, pas ici.
- Les 38 kanji sans ancre restent sans ancre.

## 9. Ordre de livraison

Le lot est cohérent mais se scinde proprement en deux étapes livrables séparément, la première
étant un prérequis strict de la seconde (`EntityCard` et `entityState` sont consommés par la
phase d'apprentissage) :

**Lot 1 — l'état dérivé et le paquet.** §3, §3.1, §3.2, §4. Livre à lui seul les demandes (a) et
(b) : le mur disparaît, le cochage disparaît. Aucune modification de `useQuiz`. Vérifiable de
bout en bout dans le navigateur.

**Lot 2 — l'apprentissage ancré.** §5. Livre la demande (c). Dépend de `EntityCard` (lot 1) et
n'y touche pas.

Un plan par lot. Le lot 1 doit être fusionné et vérifié avant que le lot 2 commence — c'est
aussi ce qui garde chaque plan sous la taille où un pas reste vérifiable.
