# Architecture

App web de préparation au JLPT N3. SPA React + TypeScript bundlée par Bun, PWA installable,
**100 % locale** (aucun serveur : tout l'état vit dans `localStorage`, la synchro multi-appareils
passe par un Gist optionnel). Déployée sur GitHub Pages.

## Le principe qui gouverne tout : pas de fichier dérivé

`data/graph/` est **à la fois la source et ce qui est livré**. Aucun script ne le régénère.

Les trois pannes du modèle précédent avaient la même cause : un dérivé que rien ne
resynchronisait. On ne les a pas corrigées, on a supprimé la classe — un fichier qui n'existe
pas ne peut pas se désynchroniser. C'est aussi pourquoi `tools/migrate-*.mjs` ont été supprimés
après usage : un générateur qui survit finit par écraser le travail fait à la main.

Corollaire : **les corrections de contenu se font dans le graphe**, à la main ou par un outil
idempotent qui n'écrase jamais (cf. les quatre chaînes d'écriture décrites dans `CLAUDE.md`).

## Le graphe

JSON-LD, conventions Oku (sujets RDF, `sh:NodeShape` en JSON-LD). Un `@context` partagé
(`data/graph/context.jsonld`) déclare quatre préfixes et cinq alias — les alias servent à écrire
les arêtes lisiblement (`tests: ["jlpt:gram/たら"]` plutôt qu'un objet `@id`) :

| alias | prédicat | forme |
|---|---|---|
| `tests` | `jlpt:tests` | `@set` d'IRI — l'entité qu'une question teste |
| `covers` | `jlpt:covers` | `@list` d'IRI — les entités qu'une leçon ordonne |
| `usesKanji` | `jlpt:usesKanji` | `@set` d'IRI — les kanji d'un mot |
| `illustrates` | `jlpt:illustrates` | IRI — l'entité qu'un exemple illustre |
| `opts` | `jlpt:option` | `@list` — les options d'une question |

### Les huit types

`!` = obligatoire, `*` = répétable.

| Type | Document | Propriétés |
|---|---|---|
| `Question` | `q-<compétence>.jsonld` | `stem!` `answer!` `ord!` `skill!` `difficulty!` `description` `gloss` `script` `passage` `tests*` |
| `SkillRange` | `corpus.jsonld` | `skill!` `from!` `count!` |
| `Word` | `word.jsonld` | `name!` `reading` `description` `level` `usesKanji*` |
| `Kanji` | `kanji.jsonld` | `name!` `description!` `onReading*` `kunReading*` `compound` `level` |
| `GrammarPoint` | `gram.jsonld` | `form!` `altForm*` `description` `structure` `level` |
| `Example` | `example.jsonld` | `illustrates!` `jp!` `romaji` `description` `analysis*` |
| `Lesson` | `lesson.jsonld` | `name!` `order!` `track!` `covers*` |
| `MethodNote` | `method.jsonld` | `name!` `order!` `tip!*` |

IRIs : `jlpt:<type>/<clé>` — `jlpt:word/影響`, `jlpt:kanji/校`, `jlpt:gram/たら`,
`jlpt:q/<ord>`, `jlpt:lesson/<piste>-<groupe>`.

### Ce que la forme du graphe achète

**Une leçon ORDONNE, elle ne recopie pas.** Corriger la lecture de 影響 sur son nœud atteint le
cours, le dictionnaire et le quiz — il n'y a qu'un nœud.

**Un exemple illustre l'ENTITÉ, pas la leçon.** Les questions portent déjà `tests` vers ces mêmes
`GrammarPoint` : l'exemple devient donc consultable depuis le corrigé du quiz, au lieu de rester
enfermé dans le cours.

**`corpus.jsonld` remplace un index de 190 Ko par 5 intervalles.** Possible parce que `jlpt:ord`
est groupé par compétence : « à quelle compétence appartient l'id N » devient une comparaison de
bornes. Et `checkCorpus` confronte ces intervalles aux questions réelles — la dérive est
impossible, pas seulement improbable.

### Validation — deux étages

`bun tools/validate-graph.mjs`, seul validateur du dépôt :

1. **SHACL** (`tools/graph/shacl.mjs`) — la FORME d'un sujet : cardinalité, type, énumération.
2. **Impératif** (`tools/graph/integrity.mjs`) — ce que SHACL ne sait pas dire : `answer` doit
   indexer `opts`, les `ord` doivent être denses, aucune référence pendante, aucune leçon vide,
   aucune paire de questions contradictoires, aucun distracteur homophone de la réponse.

## L'application

**Une seule SPA.** `index.html` monte un `HashRouter` ; le shell (thème, SW, police, dictionnaire)
vit dans `AppShell`, monté une fois.

**Deux couches de projection, et elles seules connaissent le JSON-LD :**

- `src/lib/graph.ts` — sujets → le type `Question` du moteur de quiz ;
- `src/features/cours/coursFromGraph.ts` — sujets → le type `CoursCategory` de la vue.

C'est ce qui a permis de basculer tout le contenu sur le graphe sans qu'un seul composant ni un
seul test de composant ne change. Toute nouvelle lecture du graphe passe par l'une des deux.

**Le moteur de quiz : 3 couches pures + 1 hook à effets.**

    elo.ts  ·  bank.ts  ·  scoring.ts      pures, injectables via `rng` — c'est là que sont les tests
    useQuiz.ts                             SEULE couche à effets (phases, reprise, persistance)

Toute règle nouvelle va dans les couches pures. Leur immuabilité pendant la migration du graphe
(zéro diff, tests inchangés) est ce qui a prouvé que la bascule n'avait pas touché aux règles.

**Le rappel du corrigé** (`src/features/quiz/rappel.ts`) résout `question.tests` vers un rappel
unifié — grammaire, mot ou kanji — avec sa lecture, son sens, son exemple et son lien profond vers
le cours. Il lit l'arête au lieu de deviner la notion en parsant le HTML du corrigé.

## Dépendances et frontières

- **Runtime** : React, react-router-dom, ECharts (**toujours en `import()` dynamique**, invariant
  tenu par le seul hook `useEChart`).
- **Outils** : aucune dépendance. `tools/*.mjs` n'utilise que des builtins `node:`, exécutés par
  `bun` comme tout le reste.
- **Sources externes** : JMdict et KANJIDIC2 (EDRDG, CC BY-SA 4.0) ne sont **jamais
  redistribués** — ils servent à *proposer* des lectures que l'auteur arbitre. Ce sont ses
  décisions, et elles seules, qui entrent dans le graphe : c'est ce qui évite l'attribution sur
  chaque écran et le ShareAlike sur `data/graph/`.

## Où lire la suite

`CLAUDE.md` — les invariants opérationnels et les pièges (les trois inventaires de fichiers
livrés, les chaînes d'arbitrage, les régressions furigana). `docs/superpowers/specs/` et
`plans/` — les décisions de conception, datées, avec leur raisonnement.
