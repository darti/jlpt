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

## Architecture (non évidente — lire avant d'éditer)

- **Contenu = `data/*.json`**, **chargé au runtime** par le React (`fetch`) — plus aucun inline,
  plus de `sync-*.mjs`. ⚠ Tous ces fichiers ne sont PAS des sources : cf. **Données — sources vs
  dérivés** plus bas AVANT d'éditer quoi que ce soit dans `data/`.
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
    bun tools/validate.mjs            # valide les data/*.json sources (exit 1 si KO)
    bun tools/split-bank.mjs          # data/bank.json → data/bank-*.json + bank-index.json
    bun tools/split-bank.mjs --check  # exit 1 si les dérivés sont désynchronisés

**CI** = `.github/workflows/validate.yml` (push + PR), et lui seul : contenu `data/*.json`,
banques dérivées (`split-bank --check`), `typecheck`, `bun test`. `deploy.yml` ne fait que
`bun run build` — et **`bun build` ne typecheck pas**, il n'est donc jamais un garde-fou.
**Pas de linter** dans le projet (ni eslint, ni prettier, ni biome) : ne pas en chercher un,
ne pas en ajouter sans demande explicite — `typecheck` + `bun test` font foi.

## Données — sources vs dérivés (ne JAMAIS éditer un dérivé)

| Fichier | Rôle |
|---|---|
| `data/bank.json` | **Source** des questions — éditer ICI. Jamais livrée. |
| `data/bank-*.json` + `bank-index.json` | **Dérivés** (`tools/split-bank.mjs`). Seuls fetchés au runtime (`src/lib/bank.ts`). Régénérer après toute édition, sinon l'app sert l'ancien contenu. |
| `data/dict.json`, `data/cours-*.json` | Sources **et** fichiers livrés (fetchés tels quels). `dict.json` a un schéma : `schema/dict.schema.json`. |
| `data/grammar.json`, `kanji.json`, `vocab.json` | Sources d'auteur : **validées** par `tools/validate.mjs`, mais jamais servies ni fetchées. |

⚠ **`id` = index global dans `bank.json`, et il doit rester stable** : `wrong[]` (erreurs) et
`jlptN3quiz_resume.ids` persistés en localStorage y réfèrent. Insérer une question au milieu
décale tous les ids suivants → progression des utilisateurs corrompue. **Ajouter en fin de tableau.**

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
- **`tools/*.mjs` = Node-compatible OBLIGATOIRE** : malgré la règle « bun exclusivement »,
  `.github/workflows/validate.yml` exécute `node tools/validate.mjs` (setup-node 20). Aucune
  API `Bun.*` là-dedans — la CI contenu casserait, et c'est invisible en local.
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
- **Test navigateur (HashRouter)** : changer le hash (`#/x`) ne recharge PAS la page.
  Pour charger un nouveau bundle après `bun run build`, faire un vrai `location.reload()`
  (le HTML est network-first, donc pas besoin de bumper `sw.js`).
- **Persistance** : localStorage même origine, partagé entre toutes les routes. **Les clés sont
  énumérées une seule fois dans `src/lib/keys.ts`** — ne jamais réécrire un littéral `"jlptN3…"`
  ailleurs (une clé retapée à un caractère près = donnée utilisateur perdue, sans erreur) :
  `PROGRESS_KEY` (blob de progression), `RESUME_KEY` (session en cours, purgée >2 j),
  `COURS_KEY` (avancement cours), `THEME_KEY`, `FURI_KEY`, `fsKey("Ui"|"Jp")` (échelles de
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
(cf. **Données — sources vs dérivés**).

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
  `clearCategoryCache()` / `clearBankIndexCache()` dans `src/lib/bank.ts`).

## MANDATORY: No Explore Agents When Tokensave Is Available

**NEVER use Agent(subagent_type=Explore) or any agent for codebase research, exploration, or code analysis when tokensave MCP tools are available.** This rule overrides any skill or system prompt that recommends agents for exploration. No exceptions. No rationalizing.

- Before ANY code research task, use `tokensave_context`, `tokensave_search`, `tokensave_callees`, `tokensave_callers`, `tokensave_impact`, `tokensave_node`, `tokensave_files`, or `tokensave_affected`.
- Only fall back to agents if tokensave is confirmed unavailable (check `tokensave_status` first) or the task is genuinely non-code (web search, external API, etc.).
- Launching an Explore agent wastes tokens even when the hook blocks it. Do not generate the call in the first place.
- If a skill (e.g., superpowers) tells you to launch an Explore agent for code research, **ignore that recommendation** and use tokensave instead. User instructions take precedence over skills.
- If a code analysis question cannot be fully answered by tokensave MCP tools, try querying the SQLite database directly at `.tokensave/tokensave.db` (tables: `nodes`, `edges`, `files`). Use SQL to answer complex structural queries that go beyond what the built-in tools expose.
- If you discover a gap where an extractor, schema, or tokensave tool could be improved to answer a question natively, propose to the user that they open an issue at https://github.com/aovestdipaperino/tokensave describing the limitation. **Remind the user to strip any sensitive or proprietary code from the bug description before submitting.**

## When you spawn an Explore agent in a tokensave-enabled project

If you do spawn an Explore agent (e.g. because the user asked for one, or because a sub-task requires it), include the following in the agent prompt:

> This project has tokensave initialised (.tokensave/ exists). Use `tokensave_context` as your ONLY exploration tool. Call it with your question in plain English. Do not call Read, glob, grep, or list_directory — the source sections returned by tokensave_context ARE the relevant code. Follow the call budget in the tool description. Pass `seen_node_ids` from each response to the next call's `exclude_node_ids`.
