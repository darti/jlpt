# JLPT N3 — contexte projet

App web pour préparer le JLPT N3 : **SPA React + TypeScript, bundlée par Bun** (portage
vanilla → React terminé). PWA installable, 100 % locale, déployée sur GitHub Pages.
UI en **français**, contenu en **japonais**. **Runtime & outils : `bun` exclusivement — jamais `node`.**

## Workflow — worktrees OBLIGATOIRES

**Tout travail (feature, fix, refactor) DOIT se faire dans un `git worktree` sous `.worktrees/`,
jamais directement dans le répertoire principal.** Plusieurs agents partagent ce dépôt : travailler
dans la racine mêle HEAD / staging / commits entre agents (collisions déjà constatées). Un worktree
par tâche = branche + répertoire isolés.

    git worktree add .worktrees/<branche> -b <branche>   # crée branche + répertoire isolés
    cd .worktrees/<branche>
    ln -s ../../node_modules node_modules                # réutilise les deps (sinon `bun install`)
    # … éditer, `bun test`, commiter, pousser depuis le worktree …
    git worktree remove .worktrees/<branche>             # nettoyer après merge

`.worktrees/` est ignoré par git. Ne jamais faire deux agents sur la même branche/le même répertoire.

⚠ **Avant tout merge, vérifier `git status` dans le répertoire principal** : un autre agent peut
y avoir laissé des modifications non commitées (déjà rencontré : un document régénéré). Git refuse
alors le merge — ne jamais stasher ni écraser le travail d'un autre sans demander.

⚠ **Le hook pre-commit (`common:review`) bloque TOUJOURS un commit de sous-agent** : il exige la
revue multi-agents, or un sous-agent n'a pas d'outil de dispatch et refuse — correctement — de
fabriquer des verdicts. Le patron qui marche : le sous-agent laisse son travail **stagé**
(`git add`) et rapporte le texte du blocage ; l'orchestrateur fait relire, puis commite lui-même.
**Ne JAMAIS rejouer un `git commit` bloqué à l'identique** — ça passe parfois, et c'est exactement
comme ça qu'un garde-fou cesse de garder. Le dire dans le prompt du sous-agent.

## Architecture (non évidente — lire avant d'éditer)

**Vue d'ensemble et format du graphe : [`ARCHITECTURE.md`](ARCHITECTURE.md)** — les neuf types,
les alias du `@context`, les deux étages de validation, les couches de projection. Ce qui suit
n'en garde que ce qui se mord les doigts quand on l'ignore.

- **Contenu = `data/graph/*.jsonld` UNIQUEMENT**, **chargé au runtime** par le React
  (`fetch`) — plus aucun inline, plus de `sync-*.mjs`. ⚠ Les autres fichiers de `data/` ne sont
  plus servis du tout : cf. **Données — le graphe est la source** plus bas AVANT d'éditer quoi
  que ce soit dans `data/`.
- **Une seule SPA** : `index.html` monte un `HashRouter` (react-router-dom, `src/AppShell.tsx`).
  Routes : `/` (Accueil : dashboard + graphe de progression), `/entrainement` (**onglet unique
  fusionné** — hub reprise/démarrage **et** moteur quiz adaptatif type Elo inline, piloté par
  `useQuiz` ; phase `home` = hub, sinon flux question/corrigé/résultats), `/parametrage`
  (police/thème/données/synchro), `/cours`. `/quiz` **redirige** vers `/entrainement`
  (compat, query préservée) ; `/planning` **redirige** vers `/` (compat, méthode rapatriée sur l'Accueil) ; `quiz.html`/`app-n3.html` = **stubs de redirection** (anciennes
  URL/bookmarks → routes hash). Le shell (thème/SW/police/dict) est dans `AppShell` (montage unique).
- Qui charge quoi : `src/lib/dict.ts` (furigana + tap-pour-définir), `src/features/cours`
  (route `/cours`), `src/lib/bank.ts` (pools du quiz). ⚠ `furi`/`visualBreak` s'**importent**
  depuis `dict.ts` (module unique, donc même DICT chargé au runtime) — il n'y a plus de
  `window.furi` ni de garde `typeof furi === "function"` : vestiges du `dict.js` vanilla
  supprimé. `setupDict` n'expose plus que `hideDef`/`jlptSay`, appelés par nom depuis les
  `onclick=` du popup de définition, construit en HTML brut.
- **Date de l'examen = une seule constante** : `EXAM_DATE` (`src/lib/scoring.ts`, 2026-12-06).
  Compte à rebours, phases de la méthode et score projeté en dérivent tous.
- Styles : tokens oku (Tailwind v4) compilés dans `src/styles/styles.gen.css` ; look Nord via
  `[data-theme]` (`themes.css`). Furigana masqués par défaut (tap pour révéler / bascule `ふ`).
  ⚠ Les **chaînes d'utilitaires récurrentes** (carte, titre, bouton) vivent dans
  `src/ui/styles.ts` — `PANEL` / `PANEL_BARE` / `TILE`, `H2` / `H2_TIGHT` / `H2_ACCENT`,
  `BTN_PRIMARY` / `BTN_GHOST`. Ne pas retaper le squelette en dur dans un composant : c'est
  exactement comme ça que quinze cartes ont fini avec cinq paddings différents.
- **Moteur quiz = 3 couches pures + 1 hook à effets.** `src/lib/elo.ts` (Elo par compétence,
  R borné 1200–2000 ; d=1/2/3 ↔ 1400/1600/1800 ; K=40 puis 24 après 10 réponses),
  `src/lib/bank.ts` (chargement/mémoïsation des pools + `pickAdaptive` / `selectDiagnostic` /
  `composeSession` / `allocate`, toutes pures et injectables via `rng`), `src/lib/scoring.ts`
  (score estimé /180 + probabilité de réussite), puis `src/features/quiz/useQuiz.ts` — **seule**
  couche à effets (phases, orchestration). Toute règle nouvelle va dans les couches
  pures : c'est là que sont les tests.
  Autour du hook, trois modules purs extraits de lui — y ajouter une règle plutôt que de le
  regonfler : `answerPatch.ts` (ce qu'une réponse écrit + `pickSlice`), `resume.ts`
  (`ResumeState`, lecture/écriture/péremption à 2 j), `sessionParams.ts` (`?min=` / `?resume=`).
  ⚠ Un refactor d'une couche numérique (`elo`/`bank`/`scoring`) se prouve **bit-identique** :
  capture golden des sorties sur des vecteurs variés AVANT, diff exact APRÈS. « Les tests
  passent » ne détecte pas une réassociation flottante qui mésestime un score sans rien casser.

## Commandes (bun uniquement)

    bun install
    bun test                          # toute la suite (*.test.ts/tsx, côte à côte)
    bun test src/lib/elo.test.ts      # UN seul fichier
    bun test -t "diagnostic"          # UN seul cas (filtre sur le nom du test)
    bun run typecheck                 # tsc --noEmit
    bun run dev                       # Tailwind CLI (watch) + SPA Bun (HMR) sur :3030
                                      #   PORT=xxxx bun run dev  → autre port
    bun run css                       # recompile src/styles/styles.gen.css seul
    bun run build                     # CSS minifié + bun build ./index.html (--splitting) → _site/
    bunx serve _site                  # servir le build (http, requis pour SW + fetch)
    bun tools/validate-graph.mjs      # valide data/graph/ — SHACL + contrôles impératifs
    bun tools/graph/readings.mjs      # applique les lectures arbitrées (mots + kanji)
    bun tools/graph/link-answers.mjs  # arête tests depuis la réponse (idempotent)
    bun tools/graph/purge-words.mjs   # --proposer, puis applique data/mots-parasites.json

**CI** = `.github/workflows/validate.yml` (push + PR), et lui seul : graphe `data/graph/`,
`typecheck`, `bun test`. `deploy.yml` ne fait que
`bun run build` — et **`bun build` ne typecheck pas**, il n'est donc jamais un garde-fou.
**Pas de linter** dans le projet (ni eslint, ni prettier, ni biome) : ne pas en chercher un,
ne pas en ajouter sans demande explicite — `typecheck` + `bun test` font foi.

## Données — le graphe EST la source (plus aucun dérivé, plus aucun générateur)

**`data/graph/` est à la fois la source et ce qui est livré** : rien ne le régénère, donc rien
ne peut s'en désynchroniser. C'était l'objet de la migration — les trois pannes du modèle
précédent avaient toutes la même cause, un dérivé que rien ne resynchronisait.

À côté vivent les fichiers de **DÉCISIONS** des chaînes d'arbitrage (`lectures-arbitrees.json`,
`lectures-kanji-arbitrees.json`, `mots-parasites.json`, `enonces-arbitres.json`) : ce sont des
entrées d'outils, **jamais servies** — `isServedData` ne matche que `.jsonld`.

Un seul validateur (`tools/validate-graph.mjs`), et neuf types :

| Type | Document | Rôle |
|---|---|---|
| `jlpt:Question` | `q-<compétence>.jsonld` | les 10 351 questions ; `jlpt:ord` groupé par compétence |
| `jlpt:SkillRange` | `corpus.jsonld` | les intervalles d'ordinaux — **plusieurs par compétence possibles** |
| `jlpt:Passage` | `passage.jsonld` | 28 textes de 読解 ; une question y renvoie par `readsPassage` |
| `jlpt:Word` | `word.jsonld` | mots **et** dictionnaire (furigana, tap-pour-définir) |
| `jlpt:Kanji` | `kanji.jsonld` | 810 kanji, avec `onReading`/`kunReading`/`compound` |
| `jlpt:GrammarPoint` | `gram.jsonld` | points de grammaire |
| `jlpt:Example` | `example.jsonld` | 227 phrases d'exemple → `illustrates` un GrammarPoint |
| `jlpt:Lesson` | `lesson.jsonld` | les 92 leçons : elles **ordonnent** des entités, `covers` |
| `jlpt:MethodNote` | `method.jsonld` | conseils d'examen (prose, nœuds isolés) |

⚠ **Un exemple est rattaché à l'ENTITÉ, pas à la leçon.** Les questions portent déjà des arêtes
`tests` vers ces mêmes `GrammarPoint` : un exemple est donc une ressource du référentiel,
consultable depuis le corrigé du quiz, pas un ornement de leçon.

`bank.json`, `bank-*.json`, `dict.json`, `grammar/kanji/vocab.json`, `cours-*.json`,
`split-bank.mjs`, `migrate-to-graph.mjs`, `migrate-cours.mjs`, `transform-cours.mjs` et
`validate.mjs` ont été **supprimés**. Il n'existe plus aucun script qui réécrive `data/graph/` :
**les corrections de contenu se font dans le graphe**, à la main ou par un outil idempotent.

⚠ **Ne JAMAIS supprimer les fichiers de décisions** (`data/*-arbitrees.json`,
`mots-parasites.json`), même une fois appliqués. Ils sont la **preuve que l'arbitrage a eu
lieu** — le fondement de la posture CC BY-SA — et ils permettent de rejouer une correction
perdue en une commande. 364 Ko au total, jamais servis. Les six chaînes ci-dessous sont
idempotentes : les rejouer sur un graphe à jour ne change rien.

**Lectures manquantes — première chaîne d'écriture outillée**, et elle n'écrase jamais rien :

    bun tools/jmdict/fetch.mjs        # → .jmdict/ (hors dépôt, JAMAIS commité)
    bun tools/jmdict/propose.mjs      # → docs/…/lectures-a-arbitrer.md (propositions)
    #   … l'auteur relit et consigne SES décisions dans data/lectures-arbitrees.json …
    bun tools/graph/readings.mjs      # → pose les lectures manquantes sur word.jsonld

⚠ Aucune donnée JMdict n'entre dans le graphe : **on ne redistribue pas JMdict, on s'en sert
pour décider.** C'est ce qui évite l'attribution CC BY-SA sur chaque écran et le ShareAlike sur
le jeu dérivé. `readings.mjs` est idempotent et n'écrase **jamais** une lecture existante (le
graphe fait autorité ; un désaccord est signalé, pas résolu en silence).

**Lectures de KANJI — deuxième chaîne, via KANJIDIC2**, même invariant licenciel que JMdict :

    bun tools/kanjidic/fetch.mjs      # → .kanjidic/ (gitignoré, JAMAIS commité)
    bun tools/kanjidic/propose.mjs    # → docs/…/kanji-a-arbitrer.md, avec bloc prêt à coller
    #   … l'auteur relit et consigne dans data/lectures-kanji-arbitrees.json …
    bun tools/graph/readings.mjs      # → pose on/kun sur kanji.jsonld

⚠ **JMdict est un dictionnaire de MOTS : il ne porte PAS les lectures on/kun d'un kanji isolé.**
La source pour les kanji est KANJIDIC2 — autre fichier, même éditeur (EDRDG), même CC BY-SA.
`tools/kanjidic/parse.mjs` ne retient que `ja_on`/`ja_kun` : KANJIDIC met le pinyin et le coréen
dans les MÊMES balises `<reading>`, distingués par le seul `r_type`. Il convertit aussi
l'okurigana `やさ.しい` vers la notation du projet `やさ(しい)`.

**Énoncés ambigus — troisième chaîne d'écriture outillée**, même invariant : elle n'écrase rien.

    bun tools/graph/audit-stems.mjs   # → docs/…/enonces-a-arbitrer.md + squelette de décisions
    #   … l'auteur rédige SES phrases dans data/enonces-arbitres.json …
    bun tools/graph/stems.mjs         # → pose stem + gloss sur les shards q-*.jsonld

⚠ **Un énoncé ne doit admettre QU'UNE réponse défendable.** 「あける」を漢字で書くと？ en
admettait trois (開ける・空ける・明ける). La forme correcte est une phrase à trou dont le
contexte tranche : `長い夜がやっと___。（あける）`. Le trou s'écrit `___` (trois soulignés
**ASCII**) — le corpus contient 256 vieux énoncés en `＿` pleine chasse, qu'on LIT mais
qu'on n'écrit plus. La lecture attendue va en fin d'énoncé entre `（）` : sans elle, la
question ne teste plus l'écriture mais la compréhension.

`checkCorpus` (`tools/graph/integrity.mjs`) refuse désormais deux classes, **toutes deux
prouvées, aucune heuristique** :
- **énoncé partagé à réponses divergentes** — la clé de groupement est l'**énoncé seul**.
  Elle incluait le jeu d'options, ce qui la rendait aveugle à 135 groupes (#2569 et #4609
  demandaient tous deux d'écrire 「あける」, l'un attendant 開ける, l'autre 明ける) ;
- **distracteur portant la même `jlpt:reading` que la réponse** — 漢字/感じ, 以外/意外.

⚠ `readingIndex` n'indexe que les mots **glosés** et **à lecture en kana**. Ce n'est pas de
la prudence gratuite : `word.jsonld` a longtemps contenu des distracteurs de quiz importés
comme mots (`約速`、`役束`、`約則`, lecture de 約束 recopiée, aucune glose), et les indexer
faisait condamner des questions parfaitement saines. Ils ont été purgés (voir ci-dessous),
mais **le filtre reste la protection** contre une nouvelle pollution du même genre.

**Entrées parasites du dictionnaire — quatrième chaîne outillée**, en deux temps délibérés,
parce qu'une suppression ne se rejoue pas :

    bun tools/graph/purge-words.mjs --proposer   # → docs/…/mots-fabriques.md (heuristique)
    #   … l'auteur relit et consigne SES décisions dans data/mots-parasites.json …
    bun tools/graph/purge-words.mjs              # → retire / glose word.jsonld

⚠ **La proposition est une heuristique, jamais un ordre de suppression** : elle a désigné
trois VRAIS mots (`始め`、`始めて`、`謝り`) dont le seul tort était de n'avoir pas de glose.
C'est pour ça que la liste passe par un fichier relu. `applyPurge` **refuse** de retirer une
entrée que quoi que ce soit référence, et n'écrase **jamais** une glose existante.

Le fichier de décisions porte trois clés : `supprimer` (entrées fabriquées), `gloser` (sens
manquant) et `lectures` (`jlpt:reading` qui n'est pas du kana). Cette dernière ne remplace
**que** ce qui n'est manifestement pas une lecture — l'outil ne peut donc pas servir à
réécrire une lecture correcte. Sept entrées en relevaient : quatre portaient `—`, 今年 une
note d'auteur (`ことし（特別な読み）`), et 差 / 最大 **deux** lectures dont la seconde
appartenait à un autre mot (`さいしょう` est celle de 最小, l'antonyme de 最大).

**Arêtes `tests` manquantes — cinquième chaîne**, la seule déterministe, sans arbitrage :

    bun tools/graph/link-answers.mjs   # → pose l'arête depuis la RÉPONSE de la question

⚠ **Chaque piste cherche dans SON référentiel.** La réponse d'une question de grammaire est un
point de `gram.jsonld` ; la chercher dans `word.jsonld` donne `食べられた`, `お座り`, `撮って` —
des formes fléchies déposées par le minage des options, qui s'afficheraient comme des mots du
référentiel. Lecture et écoute sont exclues : leur réponse est un fragment de texte, pas une
entité. Couverture des arêtes : 59 % → 95,7 %.

**Types de pièges — outil dérivé, pas une chaîne d'arbitrage** (aucun fichier de décisions) :

    bun tools/graph/traps.mjs   # pose jlpt:trapKind sur chaque option, depuis sa jlpt:optionNote

⚠ **Périmètre : kanji et vocabulaire, et EUX SEULS** — 9 049 options typées. La grammaire n'atteint
que 20 % de typage (un distracteur de grammaire est presque toujours « un autre point, de valeur
différente » : le type y est constant, donc muet), et lecture comme écoute testent la
compréhension, pas la forme. **La PRÉSENCE du champ définit le périmètre** : c'est ce qui permet
au runtime de distinguer « hors périmètre » (`trap` absent) de « dans le périmètre mais non
classé » (`"autre"`). Alimente `TrapPanel` et la tranche confusion de la session.

**Textes de lecture (読解) — sixième chaîne**, même invariant : elle n'écrase jamais rien.

    bun tools/graph/audit-passages.mjs   # garde de périmètre — erreurs bloquantes / avertissements
    #   … l'auteur rédige ses textes dans data/passages-arbitres.json …
    bun tools/graph/passages.mjs         # pose passage.jsonld + q-lecture.jsonld + corpus.jsonld

⚠ Une correction de texte **déjà posé** se fait aux DEUX endroits (décisions **et** graphe) :
l'applicateur n'écrase jamais un `@id` existant, il ne rejouera donc pas la correction.

⚠ **La POSITION de la bonne réponse est une propriété exploitable des données** : l'app ne
mélange **jamais** les options (délibéré — `onChoose(i)` rend l'index d'origine, comparé à
`question.a`), et `checkQuestion` contrôle les **bornes** de `jlpt:answer`, jamais sa
**distribution**. Mesuré : `q-ecoute` **[32, 0, 0, 0]** — toute la section écoute se répond en
cliquant la première option ; `q-grammaire` [508, 315, 213, 138]. **Tout contenu neuf doit
répartir ses réponses sur les quatre positions.** Correctif de fond validé et spécifié :
`docs/superpowers/specs/2026-07-26-lecture-passages-design.md` §9.

⚠ Trois règles de rédaction que trois lots successifs ont dû réapprendre : **(1)** le meilleur
distracteur est une donnée **vraie du texte** qui répond à une AUTRE question que celle posée —
un distracteur littéralement satisfaisable est un défaut ; **(2)** tout mot difficile **dont
dépend la réponse** doit être dans `jlpt:gloss`, sinon la question teste le vocabulaire au lieu
de la compréhension ; **(3)** le corrigé (`schema:description`, `jlpt:optionNote`) s'écrit **en
français** — c'est ce que l'apprenant lit après s'être trompé, quand il a le moins de ressources.

⚠ **`kanji.jsonld` est une liste d'ÉTUDE (810 kanji à apprendre), pas la liste de ce qu'un lecteur
N3 sait lire** : 不, 用, 工, 便, 場, 方, 室 en sont absents. Un contrôle de périmètre qui BLOQUE
là-dessus condamne des textes sains — il doit signaler, pas interdire. De même, `word.jsonld` ne
porte **aucun** mot `N2`/`N1` : un filtre « hors N3 » fondé sur `jlpt:level` est inerte (état figé
par un test de mesure dans `audit-passages.test.ts`).

⚠ **`jlpt:ord` = index global dans le corpus, groupé par compétence, et il doit rester
stable** : c'est lui qu'indexent le bitset `seen`/`mastered`, `wrong[]` (erreurs) et
`jlptN3quiz_resume.ids` persistés en localStorage. Renuméroter corrompt la progression des
utilisateurs. **Ajouter en fin de CORPUS** (pas en fin de shard : seule la dernière compétence
peut grandir sur place) — une compétence gagne alors un **second `SkillRange`**, ce que
`checkCorpus` valide (union des intervalles, chevauchement refusé) et que `coverageBySkill`
accumule. La lecture en a deux depuis le lot passages : `[10223, 10274]` et `[10307, 10350]`.

**Ajouter des questions casse QUATRE tests de mesure, et c'est voulu** — les remonter fait partie
de la tâche, ne jamais les assouplir : `src/lib/cadence.ts` (`TOTAL_QUESTIONS`),
`src/lib/cadence.test.ts` (l'objectif quotidien en dérive), `src/features/quiz/rappel.reel.test.ts`
(`expect(qs.length)`), et `tools/graph/shapes.test.ts` si un type s'ajoute. D'où : **toujours
`bun test` complet avant de commiter**, jamais `bun test <fichier>` — ces cliquets vivent loin du
code touché.

## Gotchas

- **SW / cache** : après modif d'un asset livré (icônes, `sw.js`, `data/*.json`),
  incrémenter la valeur courante de `CACHE` dans `sw.js` (`jlpt-n3-vN` → `vN+1`) pour
  forcer la MAJ clients.
- **bun bundle HTML** : `bun build ./x.html` **bundle** un `<script src="y.js">` classique
  dans le chunk JS de l'entrée (retire la balise du HTML mais **exécute** le code — ne le
  supprime PAS). Pour voir ce qu'une page embarque, greper `_site/*.js`, PAS le HTML
  (`Bun.build` sur un `.tsx` ne voit pas les scripts référencés par le HTML). `bun build`
  ne nettoie pas `--outdir` → chunks périmés possibles dans `_site`.
- **Fichiers livrés** : `bun run build` bundle `index.html` **puis** copie les fichiers
  livrés (`sw.js`, manifest, icônes, stubs `quiz`/`app-n3.html`, `data/*.json`) dans `_site`
  via **`tools/copy-static.mjs`** — inventaire commun à `bun run build` et `deploy.yml`.
  Sans cette copie, `bunx serve _site` sert un `_site` périmé (vieux `sw.js` → « Forcer la mise
  à jour » sans effet). Push sur `main` → Pages (https://darti.github.io/jlpt/).
- **TROIS inventaires de fichiers livrés à garder synchro** — ajouter un asset impose de toucher
  les trois, sinon la panne est silencieuse et locale à un seul contexte :
  `tools/copy-static.mjs` (`ROOT` / `isServedData` → build + prod ; gardé par `copy-static.test.ts`),
  `scripts/dev.ts` `STATIC_FILES` (allowlist du serveur de dev → sinon 404 en `bun run dev` seulement),
  et `sw.js` `SHELL` (précache PWA → sinon absent hors ligne seulement).
- **Lire / écrire un document du graphe passe par `tools/graph/jsonld.mjs`** : `GRAPH_DIR`,
  `graphPath(nom)`, `readJson(p)`, `readGraph(p)` → `{ doc, subjects }`, `writeGraph(p, doc, sujets)`.
  ⚠ Le format d'écriture (**indentation 1, saut de ligne final**, japonais en clair) était retapé
  dans huit outils. Ce n'est pas du style : c'est la forme sous laquelle 10 351 questions sont
  versionnées, et une indentation qui dérive d'un cran dans UN outil réécrit le fichier entier.
  `graphio.test.ts` le fige. (`readDoc` reste à part : il rend le contexte **analysé**, pour
  valider — il ne permet pas de réécrire, faute de garder le document d'origine.)
  ⚠ Preuve de non-régression pour tout refactor de ces outils : ils sont **idempotents**, donc
  les rejouer tous doit laisser `git diff -- data/` **vide**. C'est un oracle exact, là où
  « les tests passent » ne dirait rien d'un format qui a dérivé.
- **`tools/*.mjs` s'exécutent sous `bun`, comme tout le reste** : `bun tools/validate-graph.mjs`,
  `bun tools/graph/readings.mjs`… Il n'y a **plus aucune exception** à la règle « bun
  exclusivement » — l'étape `setup-node` de la CI a été supprimée, et avec elle l'ancienne
  contrainte « rester exécutable sous node ». Ces fichiers n'utilisent que des builtins `node:`
  (que bun implémente), donc rien à changer : c'est simplement l'invocation qui est unifiée.
- **ECharts DOIT rester en `import()` dynamique** : l'invariant vit dans **un seul** endroit,
  le hook `useEChart` (`src/features/dashboard/useEChart.ts`), que `ProgressChart`, `PassGauge`
  et `SkillChart` partagent — il fait le `await import("echarts/core")`, le `init` (renderer SVG),
  le resize et le dispose. Chaque graphe ne fournit que ses modules (`load`) et ses options.
  Un `import` statique en tête de fichier bascule toute la lib dans le chunk d'entrée — aucun
  test ni CI ne le détecte, seule la taille de `_site/*.js` bouge. Les imports **de type**
  (`import type { EChartsCoreOption } from "echarts/core"`) sont sûrs : effacés au build.
  ⚠ `bun build` ne nettoie pas `_site` : pour mesurer, comparer la sortie du build (elle liste
  les chunks émis), pas `du` sur le dossier — il accumule les chunks des builds précédents.
- **Tailwind vendorisé = sous-ensemble** : toutes les utilités ne sont PAS compilées
  (ex. `animate-spin` absent). Définir les manquantes (keyframes + règle/`@utility`)
  dans `src/styles/tailwind.css` `@layer base` — cf. `.jlpt-spin`, `.vbreak`/`.tok-*`.
  ⚠ `src/styles/styles.gen.css` est **gitignoré** (généré) : son absence d'un diff est normale.
  Pour prouver qu'une utilité est compilée, greper le fichier APRÈS `bun run css`, pas le diff.
- **Furigana : `<span class="furi">`, JAMAIS `<ruby>`/`<rt>`.** L'annotation est un
  `<span class="furi-rt">` émis par `annote()` (`src/lib/dict.ts`), stylé en overlay absolu par
  `.furi > .furi-rt` (`src/styles/tailwind.css`). Trois invariants, tous **mesurés dans les deux
  moteurs** — pas de raisonnement à partir de la spec :
  1. **Pas de ruby natif.** WebKit calcule `position: static` sur un `<rt>` malgré
     `position:absolute` → l'annotation retombe dans le flux, superposée au kanji (les furigana
     « disparus » d'iOS/Safari). Et en ruby natif, c'est **Blink** qui élargit la base
     (16 → 72 px, le « 優　　　勝 »). Aucune des huit valeurs de `display` testées n'est verte
     des deux côtés — trois correctifs successifs s'y sont cassé les dents avant qu'on mesure.
  2. **`display:none` pour masquer**, jamais `visibility:hidden` : une annotation seulement
     invisible compte encore dans la largeur de la base.
  3. **`furi()` n'annote qu'avec des lectures mono-kana propres** (`CLEAN_FURI_RE`). Les entrées
     **mono-kanji** du dico portent un *vidage* on/kun (« ユウ・やさ(しい)・すぐ(れる) ») : en
     furigana c'est absurde ET si large que ça déforme la base. Un mot absent du dico (`優勝`,
     `競い合う`) ne doit PAS emprunter ces vidages → kanji rendu en clair. Ne jamais retirer ce filtre.
- **Grep de références** : inclure `.tsx` ET `.ts` (`--include="*.ts"` seul rate les
  composants React → liens/imports morts non détectés, ex. un `href` vers une page supprimée).
- **Greper un prédicat du graphe, c'est greper sa forme PRÉFIXÉE** : `grep '"passage"'` ne matche
  pas `"jlpt:passage"` et rend « zéro occurrence » sur 16 réelles — une spec entière s'est bâtie
  sur cette mesure fausse. Compter en parsant le JSON (`bun -e`), pas au grep.
- **Rédiger du contenu en lot : imposer la variété de FORME aussi explicitement que celle des
  sujets.** Trois lots successifs de textes ont convergé vers le même moule rhétorique parce que
  la consigne ne spécifiait que les compétences à tester — l'apprenant répond alors par réflexe,
  et c'est la question la plus chère à écrire (l'intention) qui perd le plus.
- **Vérification navigateur — le chemin qui MARCHE.** L'extension Chrome n'est pas connectée et
  le MCP Playwright cherche un canal `chrome` absent. Piloter en CDP le Chromium que Playwright
  a déjà installé :
      B=~/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/"Google Chrome for Testing.app"/Contents/MacOS/"Google Chrome for Testing"
      "$B" --headless=new --disable-gpu --remote-debugging-port=9333 --user-data-dir=/tmp/cdp about:blank
  puis `PUT /json/new?<url>` → WebSocket → `Runtime.evaluate`. ⚠ Le chargement à froid des cinq
  shards prend ~8 s : attendre moins fait conclure à tort « la session ne démarre pas ».
  ⚠ Deux états masquent le démarrage d'une séance et font conclure à tort que rien ne marche :
  une **session reprenable** laissée par un essai précédent remplace « Commencer » par
  « Continuer / Nouvelle session », et un **diagnostic dû** détourne vers le diagnostic. Avant de
  piloter : `localStorage.removeItem("jlptN3quiz_resume")` et poser `diagAt: Date.now()` dans le
  blob pour prendre le chemin composé.
- **Vérifier dans WebKit aussi** (tout ce qui touche au rendu du japonais : furigana, ruby,
  césure, largeur de base). Playwright a déjà installé le build : `bun add playwright-core` dans
  le scratchpad, puis `webkit.launch({ executablePath: "~/Library/Caches/ms-playwright/webkit-2311/pw_run.sh" })`
  (idem chromium avec `chromium-1200/…/Google Chrome for Testing`). Passer `executablePath`
  contourne le contrôle de révision de playwright-core.
  ⚠ **Valider le HARNAIS avant de croire un résultat rouge** — quatre faux négatifs déjà payés,
  tous dans le harnais, aucun dans l'app : page de test sans `<meta charset>` (WebKit lit le
  fichier en latin-1 → mojibake → toutes les largeurs fausses) ; `<script type="module">` sur
  `file://` (WebKit refuse, origine opaque → aucun JS ne s'exécute) ; texte en `y=0` (l'overlay
  du furigana tombe hors viewport, le clic n'atteint rien) ; deux clics d'affilée (le second
  REFERME le popup — recharger la page entre deux mesures). Comparer aussi des éléments de même
  `font-size` : un 20 px vs 16 px avait déjà invalidé une mesure entière.
- **Ne pas scripter les éditions en `bun -e '…'`** : le contenu du dépôt est en français, et une
  apostrophe ou un backtick dans la chaîne casse le quoting zsh (`unmatched "`,
  `command not found: +`). Utiliser l'outil Edit pour toute retouche de texte ; réserver
  `bun -e` aux mesures en LECTURE seule.
- **Un test de MESURE a un cycle de vie.** Tant qu'un trou existe, il le fige (« 551 kanji sur
  810 ont une lecture ») ; une fois comblé, il devient un invariant (« aucun kanji sans
  lecture »). Et un cliquet (`couverture > 93 %`) doit être **remonté** dès qu'on dépasse le
  seuil, sinon il cesse de garder quoi que ce soit. Un test de mesure laissé tel quel échoue en
  annonçant une régression alors qu'il constate un progrès.
- **Le FIXTURE d'un test borne ce qu'il peut détecter.** Un test d'intégration monté sur un
  `localStorage` vide ne voit pas un dépassement de budget de séance : sans erreurs ni entités
  dues, la tranche adaptative laisse treize questions de marge et le débordement ne peut pas se
  manifester. Un test vert dit « correct dans l'état que je construis » — relire cet état d'abord.
  Corollaire : **prouver un test par MUTATION** (retirer le correctif, vérifier le rouge, remettre)
  est le seul moyen de savoir qu'il garde quelque chose.
- **Test navigateur (HashRouter)** : changer le hash (`#/x`) ne recharge PAS la page.
  Pour charger un nouveau bundle après `bun run build`, faire un vrai `location.reload()`
  (le HTML est network-first, donc pas besoin de bumper `sw.js`).
- **Persistance** : localStorage même origine, partagé entre toutes les routes. **Les clés sont
  énumérées une seule fois dans `src/lib/keys.ts`** — ne jamais réécrire un littéral `"jlptN3…"`
  ailleurs (une clé retapée à un caractère près = donnée utilisateur perdue, sans erreur) :
  `PROGRESS_KEY` (blob de progression), `RESUME_KEY` (session en cours, purgée >2 j),
  `COURS_KEY` (avancement cours, v2 : indexé par IRI du graphe), `THEME_KEY`, `FURI_KEY`, `fsKey("Ui"|"Jp")` (échelles de
  police), `UPDATED_KEY` (horodatage de la sync — écrire via `stampUpdated(store)`),
  `GH_CFG_KEY` (PAT Gist), `PENDING_KEY`. ⚠ Toute clé applicative nouvelle doit porter le
  préfixe `KEY_PREFIX` (`jlptN3`) : `gist.ts#collectData` balaie le store dessus pour bâtir la
  sauvegarde, donc une clé sans préfixe n'est **jamais** synchronisée.
  Sync multi-appareils optionnelle via Gist (PAT scope `gist`).
  ⚠ Écrire la progression **uniquement** via `writeProgress()` (`src/lib/storage.ts`) : c'est un
  **patch fusionné** sur le blob existant (deep-merge de `skill`). Réécrire le blob entier efface
  les champs des autres features.
  ⚠ **Lire le blob uniquement via `src/lib/blob.ts`** (`asProgress`, `asSkillState`, `asWrong`,
  `asHistory`, `asBits`/`asBitsB64`, `asNum`) : `storage.ts` possède l'accès au store, `blob.ts`
  l'INTERPRÉTATION. Les gardes étaient retapées dans six fichiers — celle des bitsets cinq fois.
  Tolérance obligatoire : le blob est de la donnée utilisateur ancienne, éventuellement
  rapatriée d'un Gist ; un champ absent ou corrompu dégrade vers un défaut, il ne jette jamais.
  ⚠ **Une préférence se déclare via `src/lib/pref.ts`** (`pref` / `boolPref` / `enumPref` /
  `numberPref`), jamais en retapant un couple read/write. Les cinq préférences (thème, furigana,
  police, débit, rappel) partageaient ce corps et **trois avaient perdu `stampUpdated`** : comme
  `collectData` prend `UPDATED_KEY` pour `updatedAt` et que `cloudPull` n'applique le distant que
  si `remoteT > localT`, changer seulement l'une des trois laissait l'horodatage périmé et la
  synchro suivante restaurait l'ancienne valeur, sans erreur. La fabrique horodate toujours.

## Migration React (terminée)

Portage strangler vanilla → **React + TS, bundlé par Bun** : **terminé**. Toutes les pages sont
des routes de la SPA ; les fichiers vanilla (`dict.js`, `theme.css`, `progress.js`, `cours-n3.html`…)
et les `sync-*.mjs` ont été supprimés. Le contenu vit dans `data/` et est chargé au runtime
(cf. **Données — le graphe est la source**).

- **Styles** : tokens Tailwind v4 vendorisés dans `src/styles/` (`tailwind.css` = `@theme`
  + shims + règles de base ; `themes.css` = Nord `[data-theme]`). Compilé par
  **`@tailwindcss/cli`** (PAS `bun-plugin-tailwind` — incompatible avec le bundler Bun).
- **Docs** : specs/plans sous `docs/superpowers/`.
- **Tests** : logique pure → unitaires ; composants → `renderToStaticMarkup` (SSR smoke) ;
  effets/DOM/montage réel → **happy-dom** (`bunfig.toml [test] preload = happydom.ts`,
  `createRoot` + `act`). Router : envelopper dans `<MemoryRouter>`. ⚠ `renderToStaticMarkup`
  échappe les apostrophes (`'` → `&#x27;`) — asserter sur des sous-chaînes sans apostrophe.
  ⚠ Un test SSR ne doit JAMAIS asserter un kanji rendu par `furi()` en sous-chaîne brute
  (`toContain("映像")`) : `furi` scinde un mot en spans (映像 → `映</span><span>像`) et le `DICT`
  est un état de module qui fuit entre fichiers de test → flake selon l'ordre d'exécution.
  Asserter le texte de base via `baseText()` (cf. `quiz.test.tsx`) ou une structure invariante.
  ⚠ `happydom.ts` est préchargé pour **toute** la suite (`bunfig.toml`) : `document`/`localStorage`
  existent même dans un test « pur ». Isoler explicitement l'état partagé (cf.
  `clearCategoryCache()` dans `src/lib/bank.ts`, `clearGraphCache()` dans `src/lib/graph.ts`,
  `clearCoursCache()` dans `src/features/cours/useCours.ts`, `clearAnchorCache()` dans
  `src/features/quiz/anchor.ts`). ⚠ Les neuf `EntrainementApp.*.test.tsx` ne purgent PAS le cache
  du cours : ils ne polluent rien uniquement parce que `src/testing/graphFixture.ts` sert `{}`
  pour les six documents. Enrichir ce fixture casse trois fichiers d'un coup — purger d'abord.
