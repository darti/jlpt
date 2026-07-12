# JLPT N3 — contexte projet

App web pour préparer le JLPT N3 : **SPA React + TypeScript, bundlée par Bun** (portage
vanilla → React terminé). PWA installable, 100 % locale, déployée sur GitHub Pages.
UI en **français**, contenu en **japonais**. **Runtime & outils : `bun` exclusivement — jamais `node`.**

## Architecture (non évidente — lire avant d'éditer)

- **Source de vérité = `data/*.json`** (bank, dict, cours, kanji, grammar, vocab).
  Tout est **chargé au runtime** par le React (`fetch`) — plus aucun inline, plus de `sync-*.mjs`.
- **Une seule SPA** : `index.html` monte un `HashRouter` (react-router-dom, `src/AppShell.tsx`).
  Routes : `/` (dashboard), `/quiz` (moteur adaptatif type Elo), `/entrainement` (hub),
  `/cours`, `/planning`. `quiz.html`/`app-n3.html` = **stubs de redirection** (anciennes
  URL/bookmarks → routes hash). Le shell (thème/SW/police/dict) est dans `AppShell` (montage unique).
- Contenu chargé au runtime : `data/dict.json` (furigana + tap-pour-définir, `src/lib/dict.ts`),
  `data/cours-*.json` (route `/cours`, `src/features/cours`), `data/bank-*.json` (quiz).
- Styles : tokens oku (Tailwind v4) compilés dans `src/styles/styles.gen.css` ; look Nord via
  `[data-theme]` (`themes.css`). Furigana masqués par défaut (tap pour révéler / bascule `ふ`).

## Commandes (bun uniquement)

    bun tools/validate.mjs            # valide les data/*.json sources (exit 1 si KO)
    bunx serve _site                  # servir le build (http, requis pour SW + fetch)

## Gotchas

- **SW / cache** : après modif d'un asset livré (icônes, `sw.js`, `data/*.json`),
  bumper `CACHE` dans `sw.js` (ex. `jlpt-n3-v87` → v88) pour forcer la MAJ clients.
- **bun bundle HTML** : `bun build ./x.html` **bundle** un `<script src="y.js">` classique
  dans le chunk JS de l'entrée (retire la balise du HTML mais **exécute** le code — ne le
  supprime PAS). Pour voir ce qu'une page embarque, greper `_site/*.js`, PAS le HTML
  (`Bun.build` sur un `.tsx` ne voit pas les scripts référencés par le HTML). `bun build`
  ne nettoie pas `--outdir` → chunks périmés possibles dans `_site`.
- **Fichiers livrés** : `bun run build` bundle `index.html` **puis** copie les fichiers
  livrés (`sw.js`, manifest, icônes, stubs `quiz`/`app-n3.html`, `data/*.json`) dans `_site`
  via **`tools/copy-static.mjs`** — inventaire **unique** aussi utilisé par `deploy.yml`.
  Tout nouveau fichier livré s'ajoute là (`ROOT` ou `isServedData`), sinon absent en local
  **et** en prod. Sans cette copie, `bunx serve _site` sert un `_site` périmé (vieux `sw.js`
  → « Forcer la mise à jour » sans effet). Push sur `main` → Pages (https://darti.github.io/jlpt/).
- **Tailwind vendorisé = sous-ensemble** : toutes les utilités ne sont PAS compilées
  (ex. `animate-spin` absent). Définir les manquantes (keyframes + règle/`@utility`)
  dans `src/styles/tailwind.css` `@layer base` — cf. `.jlpt-spin`, `.vbreak`/`.tok-*`.
- **Grep de références** : inclure `.tsx` ET `.ts` (`--include="*.ts"` seul rate les
  composants React → liens/imports morts non détectés, ex. un `href` vers une page supprimée).
- **Test navigateur (HashRouter)** : changer le hash (`#/x`) ne recharge PAS la page.
  Pour charger un nouveau bundle après `bun run build`, faire un vrai `location.reload()`
  (le HTML est network-first, donc pas besoin de bumper `sw.js`).
- **Persistance** : localStorage même origine, partagé entre pages —
  `jlptN3adapt_v2` (progression), `jlptN3_theme`, `jlptN3_updatedAt`.
  Sync multi-appareils optionnelle via Gist (PAT scope `gist`).

## Migration React (terminée)

Portage strangler vanilla → **React + TS, bundlé par Bun** : **terminé**. Toutes les pages sont
des routes de la SPA ; les fichiers vanilla (`dict.js`, `theme.css`, `progress.js`, `cours-n3.html`…)
et les `sync-*.mjs` ont été supprimés. `data/*.json` = source de vérité, chargée au runtime.

- **Styles** : tokens Tailwind v4 vendorisés dans `src/styles/` (`tailwind.css` = `@theme`
  + shims + règles de base ; `themes.css` = Nord `[data-theme]`). Compilé par
  **`@tailwindcss/cli`** (PAS `bun-plugin-tailwind` — incompatible avec le bundler Bun).
- **Docs** : specs/plans sous `docs/superpowers/`.
- **Tests** : logique pure → unitaires ; composants → `renderToStaticMarkup` (SSR smoke) ;
  effets/DOM/montage réel → **happy-dom** (`bunfig.toml [test] preload = happydom.ts`,
  `createRoot` + `act`). Router : envelopper dans `<MemoryRouter>`. ⚠ `renderToStaticMarkup`
  échappe les apostrophes (`'` → `&#x27;`) — asserter sur des sous-chaînes sans apostrophe.

    bun install
    bun run dev        # Tailwind CLI (watch) + serveur SPA Bun (HMR)
    bun run build      # CSS minifié + bun build ./index.html (--splitting) → _site/
    bun test           # tests TDD (*.test.ts, côte à côte)
    bun run typecheck  # tsc --noEmit
