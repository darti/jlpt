# 読解 — passages (chaîne n°6), lot 1

**Date** : 2026-07-26
**Statut** : conçu, prêt à planifier

## 1. Problème

Le corpus compte 10 307 questions. **52** portent sur la compréhension écrite et **32** sur
l'écoute — soit 0,8 % du banc pour **120 des 180 points** de l'examen. Les 52 questions de
lecture sont par ailleurs des phrases isolées : aucun des quatre formats réels de l'épreuve
(短文・中文・長文・情報検索) n'est représenté.

Le modèle de réussite l'avoue déjà dans son code : `sectionMastery` (`src/lib/scoring.ts:52`)
estime l'écoute à `0,85 × moyenne des deux autres sections` tant que `t < 3`, et
`prescriptiveWeights` lui donne un poids **0** — seul le plancher `0,2` la maintient dans
l'allocation. La probabilité affichée est, pour un tiers, une extrapolation.

Ce lot traite la **lecture**. L'écoute suivra par la même chaîne (§9).

Toute la plomberie d'affichage existe déjà : `jlpt:passage` est déclaré en SHACL
(`shapes.jsonld:46`), projeté par `graph.ts:39`, rendu avec furigana par `QuestionCard.tsx:50`
— **pour zéro question**. Ce qui manque est du contenu, un type, et une règle de sélection.

## 2. Le verrou à lever d'abord : la contiguïté des ordinaux

`jlpt:ord` est un index **global, dense, groupé par compétence**. L'état réel :

    grammaire   [0,     1173]      vocabulaire [1174,  7074]     kanji [7075, 10222]
    lecture     [10223, 10274]     écoute      [10275, 10306]

« Ajouter en fin de shard » place donc les nouvelles questions de lecture **après** l'écoute, et
`corpus.jsonld` — un intervalle unique par compétence — se met à mentir. Renuméroter est
interdit : `jlpt:ord` indexe les bitsets `seen`/`mastered`, `wrong[]` et `resume.ids` persistés.

> **Propriété émergente, écrite nulle part** : aujourd'hui **aucune compétence sauf l'écoute** ne
> peut recevoir une seule question nouvelle. Le corpus n'est extensible qu'à sa toute fin. Ce lot
> paie cette dette une fois pour toutes.

**Décision : plusieurs `SkillRange` par compétence.** `corpus.jsonld` reçoit
`jlpt:corpus/lecture-2` (`jlpt:from: 10307`). Ce que ça touche, exhaustivement :

| Emplacement | Aujourd'hui | Après |
|---|---|---|
| `tools/graph/integrity.mjs:144` | compare **tous** les ords d'une compétence à **un** intervalle | agrège l'union des intervalles de la compétence ; refuse deux intervalles qui se chevauchent |
| `src/lib/coverage.ts:75` | `out[r.skill] = {…}` — **écrase** | accumule (`seenN`/`masteredN`/`total` sommés) |
| `src/lib/graph.ts:99` | `skillOfOrd` itère et rend le premier intervalle contenant l'ord | **inchangé** |

Le défaut de `coverageBySkill` est silencieux : avec deux intervalles « lecture », le second
écraserait le premier et les 52 questions historiques disparaîtraient du calcul de couverture
sans la moindre erreur. Test rouge d'abord.

## 3. Le passage devient le neuvième type

Un texte de 中文 porte 3 questions. Le recopier trois fois dans une chaîne `jlpt:passage`
contredit le principe du graphe (« une leçon ORDONNE, elle ne recopie pas ») et prive le
regroupement (§4) de toute clé.

    jlpt:Passage    name! · jp! · format! · description · tests*
    jlpt:Question   + readsPassage → IRI de passage   (jlpt:passage SUPPRIMÉ)

- `format` ∈ `tanbun | chubun | chobun | joho` (短文・中文・長文・情報検索). Slugs ASCII :
  c'est une métadonnée de code (énumération SHACL, gabarits d'audit), pas du contenu affiché ;
  l'UI en donne le libellé français.
- `description` = traduction/résumé français du texte, pour le corrigé.
- `tests*` = les entités que le texte mobilise. Un passage **porte ses propres arêtes** : FSRS,
  confusion et rappel du corrigé fonctionnent alors sur la lecture sans une ligne de plus.
- IRI : `jlpt:passage/<format>-<nn>` — stable, triable, insensible au reslug d'un titre.
- `context.jsonld` gagne un **sixième alias**, `readsPassage` (IRI simple, sur le modèle
  d'`illustrates`).

`jlpt:passage` est **retiré** de `shapes.jsonld`, de `graph.ts` et de `QuestionCard.tsx` : zéro
consommateur réel, donc aucun shim (MVP : pas de repli).

**Nouveau document livré : `data/graph/passage.jsonld`.** Les trois inventaires de fichiers
livrés doivent suivre, sinon la panne est silencieuse et locale à un seul contexte :

| Inventaire | Action | Symptôme si oublié |
|---|---|---|
| `tools/copy-static.mjs` | **rien** — `isServedData` matche `.jsonld` | — |
| `scripts/dev.ts` `STATIC_FILES` | ajouter l'entrée | 404 en `bun run dev` **seulement** |
| `sw.js` `GRAPH` | ajouter l'entrée + bump `CACHE` | absent **hors ligne seulement** |

### Résolution passage → question

Deux champs distincts sur le type `Question` (`src/types/quiz.ts`), parce que la projection est
synchrone et la résolution asynchrone :

- `q.passageId?: string` — l'IRI, posée par `toQuestion` depuis `readsPassage` (même forme que
  `q.tests`). C'est **elle** qui sert de clé de regroupement (§4).
- `q.passage?: { jp, format, fr }` — le passage résolu, attaché par `bank.ts#loadCategory` via un
  `loadPassages()` mémoïsé dans `graph.ts` (sur le modèle de `loadCorpus`).

Le champ `passage: string` disparaît au profit de cet objet. Les deux couches de projection
restent les seules à connaître le JSON-LD.

⚠ **Si la résolution échoue** (document absent, IRI pendante), la question est **exclue du
pool** — une question de lecture sans son texte est inrépondable. Silencieux côté UI, compté
dans un `console.warn` côté chargement.

## 4. Les questions d'un même texte voyagent ensemble

`pickAdaptive` tire à l'unité, et `composeSession` **mélange** la session finale
(`shuffle([...errorQs, ...adaptiveQs], rng)`). Sans règle : un texte de 350 caractères affiché
pour une seule question, le même texte re-servi dans trois sessions différentes, et les questions
d'un même texte dispersées entre la 3ᵉ et la 17ᵉ position.

Couche **pure**, dans `bank.ts` :

    /** Complète les fratries de passage depuis `pool`, écarte un groupe qui ne tient pas dans
     *  `total`, puis rend les membres adjacents et ordonnés par `ord`. Pure. */
    export function withPassageGroups(session: Question[], pool: Question[], total: number): Question[]

Règles, dans l'ordre :

1. **Complétion** — toute question retenue portant un `passageId` fait entrer ses sœurs
   manquantes du même passage.
2. **Tout ou rien** — si le groupe complet ne tient pas dans le budget restant, le groupe entier
   est écarté (jamais de groupe tronqué). Sa place n'est **pas** recomblée : la session est alors
   plus courte d'autant (borné à 3 questions). Refiler exigerait le vivier complet, les poids et
   le jeu d'exclusion — coût sans commune mesure avec l'écart.
3. **Adjacence** — le mélange de `composeSession` est **préservé** pour tout le reste ; chaque
   groupe est simplement ramené d'un bloc à la position de son premier membre, ses questions
   triées par `ord` (l'ordre de lecture du texte).

Appelée **après** `composeSession` et après `selectDiagnostic`, depuis `useQuiz` (couche à
effets) — la règle, elle, reste pure et testée.

Elo : chaque réponse compte normalement. Trois réponses sur un même texte sont corrélées ;
amortir `K` serait une règle de plus sans preuve (YAGNI — observation notée, pas implémentée).

**Alternative écartée** : se limiter aux formats à une question (短文, 情報検索), ce qui
supprimerait tout ce paragraphe. Rejeté : 中文 et 長文 sont le cœur de la difficulté réelle de
l'épreuve, et la fonction coûte ~30 lignes pures et testables.

## 5. La chaîne n°6

    bun tools/graph/audit-passages.mjs   # garde de périmètre — lit data/passages-arbitres.json
    bun tools/graph/passages.mjs         # applicateur idempotent → passage.jsonld, q-lecture.jsonld, corpus.jsonld

`data/passages-arbitres.json` est le **fichier de décisions** : jamais servi, jamais supprimé —
il permet de rejouer une pose perdue en une commande, comme les cinq chaînes existantes.

`passages.mjs` **n'écrase jamais** un `@id` existant et **signale** un désaccord au lieu de le
résoudre (convention de `readings.mjs`). Il pose en fin de corpus (ord ≥ 10307), étend
`corpus.jsonld`, et est idempotent : rejoué sur un graphe à jour, il ne change rien.

`audit-passages.mjs` porte la qualité mécanique — c'est ce qui remplace l'arbitrage humain :

| Contrôle | Règle |
|---|---|
| Périmètre kanji | tout kanji du texte existe dans `kanji.jsonld` (810) |
| Périmètre lexical | tout mot glosé hors N3/N4/N5 est signalé (2 955 mots portent un `level`) |
| Longueur | `tanbun` 100–200 · `chubun` 300–420 · `chobun` 500–650 · `joho` 150–300 caractères |
| Cardinalité | `optionNote` de même longueur que `opts` (déjà imposé par `integrity.mjs:43`) |
| Questions par texte | `tanbun` 1 · `chubun` 3 · `chobun` 4 · `joho` 2 |
| Réponse unique | énoncé partagé à réponses divergentes — contrôle **existant** |
| Homophonie | distracteur portant la `reading` de la réponse — contrôle **existant** |

⚠ **Pas d'effet gratuit côté confusion** : `traps.mjs` déclare `SHARDS = ["q-kanji",
"q-vocabulaire"]`, et son en-tête motive ce périmètre — « l'écoute comme la lecture testent la
compréhension, pas la forme ». Les `optionNote` des passages servent donc au corrigé, pas au
typage des pièges. Aucun rejeu de `traps.mjs` n'est requis par ce lot.

## 6. Contenu du lot 1

| Format | Passages | Questions/texte | Questions |
|---|---|---|---|
| `tanbun` (短文) | 8 | 1 | 8 |
| `chubun` (中文) | 6 | 3 | 18 |
| `chobun` (長文) | 3 | 4 | 12 |
| `joho` (情報検索) | 3 | 2 | 6 |
| **Total** | **20** | | **44** |

La lecture passe de **52 à 96 questions**, et pour la première fois avec les formats réels.
Textes **originaux** — aucun extrait d'annales (droit d'auteur, distinct du ShareAlike qui
gouverne JMdict/KANJIDIC2).

**Lot 1a — la seule relecture humaine demandée** : les 3 premiers passages (un `tanbun`, un
`chubun`, un `joho`) sont soumis avant d'écrire les 17 autres. Le périmètre lexical se prouve
mécaniquement ; le **naturel de la langue** et l'**unicité de la réponse défendable** ne se
mesurent pas — c'est précisément là qu'un énoncé du corpus historique admettait trois réponses
(「あける」 → 開ける・空ける・明ける).

## 7. Effets de bord sur les features livrées

| Feature | Effet |
|---|---|
| `src/lib/cadence.ts` | `TOTAL_QUESTIONS = 10307` → **10351**. Son test de mesure est **conçu pour échouer** quand le corpus grandit (« forçant à remonter la constante ») : rouge attendu, pas une régression. L'objectif quotidien passe de 7 215 à 7 246 questions cibles. |
| Anneaux de couverture | total lecture 52 → 96 : le **pourcentage de couverture de la lecture baisse mécaniquement**. C'est la mesure qui devient honnête, pas la progression qui recule. |
| `scoring.ts` | inchangé. La lecture devient *mesurable* ; le regroupement grammaire+lecture reste tel quel (question ouverte, hors périmètre — cf. §9). |
| Progression utilisateur | **intacte** : aucun `ord` existant ne bouge. |

## 8. Tests

- `src/lib/coverage.test.ts` — `coverageBySkill` avec **deux intervalles pour une même
  compétence** (rouge d'abord : le second écrase aujourd'hui le premier).
- `src/lib/bank.test.ts` — `withPassageGroups` : complétion des fratries, groupe écarté faute de
  place, adjacence après mélange, tri par `ord`, session sans passage inchangée, budget respecté.
- `src/lib/graph.test.ts` — `loadPassages` mémoïsé ; question à `readsPassage` pendant → exclue.
- `tools/graph/passages.test.ts` — idempotence sur le corpus réel, refus d'écrasement, extension
  correcte de `corpus.jsonld`.
- `tools/graph/audit-passages.test.ts` — chaque contrôle du tableau §5, rouge sur un cas fabriqué.
- `tools/graph/integrity.test.ts` — `checkCorpus` accepte deux intervalles disjoints pour une
  compétence, refuse deux intervalles qui se chevauchent.
- `copy-static.test.ts` — `passage.jsonld` livré.
- `bun tools/validate-graph.mjs` vert, et **mesure gzip** du surcoût (règle du dépôt : au-delà de
  5 %, on s'arrête et on signale au lieu d'improviser un encodage court).
- SSR smoke `QuestionCard` — un passage résolu s'affiche ; sans passage, rendu inchangé.

## 9. Hors périmètre (suites identifiées)

- **聴解 par la même chaîne** — 32 questions pour 60 points ; l'outillage de ce lot est réutilisable
  tel quel (`jlpt:script` existe déjà, l'audio-first et le réglage de débit sont livrés).
- **Examen blanc chronométré** — score *mesuré* /180 avec la règle ≥ 19/60, confronté au score
  projeté ; c'est ce qui calibrerait `successModel`, jamais confronté à une mesure à ce jour.
  Devient fidèle une fois la lecture et l'écoute pourvues.
- **Sections officielles** — `sectionMastery` groupe `grammaire + lecture` (structure des
  *épreuves*), alors que le relevé officiel — **et la carte « Structure de l'examen » de
  l'Accueil** — sépare 言語知識 (文字・語彙・**文法**) / 読解 / 聴解. Une grammaire forte
  (1 174 questions pratiquées) masque donc une lecture faible dans la section qui porte le
  minimum de 19/60. À trancher : délibéré (et à documenter) ou correctif (avec capture golden).
- **Amortissement de `K`** sur les réponses corrélées d'un même texte.
- **Lot 2 de passages** — même chaîne, sans relecture humaine si le lot 1a est concluant.

## 10. Fichiers touchés

| Fichier | Nature |
|---|---|
| `data/passages-arbitres.json` | **créé** — décisions (textes + questions), jamais servi |
| `data/graph/passage.jsonld` | **créé** — 20 passages |
| `data/graph/q-lecture.jsonld` | **modifié** — 44 questions ajoutées (ord ≥ 10307) |
| `data/graph/corpus.jsonld` | **modifié** — `jlpt:corpus/lecture-2` |
| `data/graph/context.jsonld` | **modifié** — alias `readsPassage` |
| `data/graph/shapes.jsonld` | **modifié** — shape `Passage`, `readsPassage`, retrait de `jlpt:passage` |
| `tools/graph/audit-passages.mjs` | **créé** — garde de périmètre |
| `tools/graph/passages.mjs` | **créé** — applicateur idempotent |
| `tools/graph/integrity.mjs` | **modifié** — `checkCorpus` multi-intervalles |
| `src/lib/coverage.ts` | **modifié** — `coverageBySkill` accumule |
| `src/types/quiz.ts` | **modifié** — `passageId` (IRI) + `passage` (objet résolu), retrait de `passage: string` |
| `src/lib/graph.ts` | **modifié** — `loadPassages`, `readsPassage`, retrait de `passage` string |
| `src/lib/bank.ts` | **modifié** — résolution du passage + `withPassageGroups` |
| `src/lib/cadence.ts` | **modifié** — `TOTAL_QUESTIONS` 10307 → 10351 |
| `src/features/quiz/useQuiz.ts` | **modifié** — appel de `withPassageGroups` (2 points) |
| `src/features/quiz/QuestionCard.tsx` | **modifié** — passage résolu au lieu de la chaîne |
| `scripts/dev.ts` · `sw.js` | **modifiés** — inventaires + bump `CACHE` |
| tests associés | **créés / modifiés** (§8) |

## Contraintes (rappel projet)

- Worktree `.worktrees/lecture-passages`, branche `feat/lecture-passages`. Jamais dans la racine.
- `bun` exclusivement, y compris pour `tools/*.mjs`. Zéro dépendance nouvelle.
- Commentaires et commits en **français**, conventional commits, **PAS de `Co-Authored-By`**.
- **Commit : message COURT à UNE ligne** (un hook de revue bloque les messages multi-lignes).
- Assets livrés modifiés → **bump `CACHE`** dans `sw.js` (`jlpt-n3-vN` → `vN+1`).
- Ne jamais supprimer un fichier de décisions, même appliqué.
