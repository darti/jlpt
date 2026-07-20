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

## Architecture (non évidente — lire avant d'éditer)

**Vue d'ensemble et format du graphe : [`ARCHITECTURE.md`](ARCHITECTURE.md)** — les huit types,
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
  couche à effets (phases, reprise, persistance). Toute règle nouvelle va dans les couches
  pures : c'est là que sont les tests.

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

Un seul validateur (`tools/validate-graph.mjs`), et huit types :

| Type | Document | Rôle |
|---|---|---|
| `jlpt:Question` | `q-<compétence>.jsonld` | les 10 307 questions ; `jlpt:ord` groupé par compétence |
| `jlpt:SkillRange` | `corpus.jsonld` | les 5 intervalles — remplace l'ancien index de 190 Ko |
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
perdue en une commande. 269 Ko au total, jamais servis. Les cinq chaînes ci-dessous sont
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

⚠ **`jlpt:ord` = index global dans le corpus, groupé par compétence, et il doit rester
stable** : c'est lui qu'indexent le bitset `seen`/`mastered`, `wrong[]` (erreurs) et
`jlptN3quiz_resume.ids` persistés en localStorage. Renuméroter corrompt la progression des
utilisateurs. **Ajouter en fin de shard**, et vérifier que `corpus.jsonld` suit
(`checkCorpus` confronte les intervalles aux questions réelles).

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
- **Furigana ruby — pas de gros espaces intra-mot** (régression déjà vue, ex. Q#1180
  « 優　　　勝 » sur iOS). DEUX invariants à préserver ensemble, sinon la base kanji
  s'étire :
  1. **`furi()` (`src/lib/dict.ts`)** n'émet en `<rt>` que des lectures **mono-kana propres**
     (`CLEAN_FURI_RE`). Les entrées **mono-kanji** du dico portent un *vidage* on/kun
     (« ユウ・やさ(しい)・すぐ(れる) ») ; en furigana c'est absurde ET si large que ça déforme
     la base. Un mot absent du dico (`優勝`, `競い合う`) ne doit PAS emprunter ces vidages →
     kanji rendu en clair. Ne jamais retirer ce filtre.
  2. **CSS `ruby rt` (`src/styles/tailwind.css`)** masque en **`display:none`** (overlay
     `display:block` sous `[data-furi="on"]`), PAS `visibility:hidden` : WebKit/iOS garde une
     `<rt>` en `visibility:hidden` dans le calcul de largeur de la base → étirement même
     invisible (Chromium sort le `rt` absolu du flux, donc le bug ne se voit pas en desktop).
- **Grep de références** : inclure `.tsx` ET `.ts` (`--include="*.ts"` seul rate les
  composants React → liens/imports morts non détectés, ex. un `href` vers une page supprimée).
- **Vérification navigateur — le chemin qui MARCHE.** L'extension Chrome n'est pas connectée et
  le MCP Playwright cherche un canal `chrome` absent. Piloter en CDP le Chromium que Playwright
  a déjà installé :
      B=~/Library/Caches/ms-playwright/chromium-1200/chrome-mac-arm64/"Google Chrome for Testing.app"/Contents/MacOS/"Google Chrome for Testing"
      "$B" --headless=new --disable-gpu --remote-debugging-port=9333 --user-data-dir=/tmp/cdp about:blank
  puis `PUT /json/new?<url>` → WebSocket → `Runtime.evaluate`. ⚠ Le chargement à froid des cinq
  shards prend ~8 s : attendre moins fait conclure à tort « la session ne démarre pas ».
- **Ne pas scripter les éditions en `bun -e '…'`** : le contenu du dépôt est en français, et une
  apostrophe ou un backtick dans la chaîne casse le quoting zsh (`unmatched "`,
  `command not found: +`). Utiliser l'outil Edit pour toute retouche de texte ; réserver
  `bun -e` aux mesures en LECTURE seule.
- **Un test de MESURE a un cycle de vie.** Tant qu'un trou existe, il le fige (« 551 kanji sur
  810 ont une lecture ») ; une fois comblé, il devient un invariant (« aucun kanji sans
  lecture »). Et un cliquet (`couverture > 93 %`) doit être **remonté** dès qu'on dépasse le
  seuil, sinon il cesse de garder quoi que ce soit. Un test de mesure laissé tel quel échoue en
  annonçant une régression alors qu'il constate un progrès.
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
  ⚠ `happydom.ts` est préchargé pour **toute** la suite (`bunfig.toml`) : `document`/`localStorage`
  existent même dans un test « pur ». Isoler explicitement l'état partagé (cf.
  `clearCategoryCache()` dans `src/lib/bank.ts`, `clearGraphCache()` dans `src/lib/graph.ts`).
