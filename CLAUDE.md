# JLPT N3 — contexte projet

App web pour préparer le JLPT N3, **en portage vanilla → React** (voir « Migration »).
Origine : statique sans build (HTML/JS vanilla) ; désormais hybride (React bundlé par Bun + pages vanilla).
PWA installable, 100 % locale, déployée sur GitHub Pages. UI en **français**,
contenu en **japonais**. **Runtime & outils : `bun` exclusivement — jamais `node`.**

## Architecture (non évidente — lire avant d'éditer)

- **Source de vérité = `data/*.json`** (bank, vocab, kanji, grammar, dict, examples).
- Ces données sont **inlinées** dans les fichiers livrés entre marqueurs
  `/*NOM-START*/ … /*NOM-END*/` par les scripts `tools/sync-*.mjs`.
  → **Ne jamais éditer les tableaux inlinés à la main** (`DICT` dans `dict.js`,
    blocs `.ex` de `cours-n3.html`). Éditer `data/*.json` puis relancer le sync.
    La CI vérifie avec `--check`. (Le quiz React charge `data/bank-*.json` et
    `data/dict.json` au runtime — plus d'inline BANK/vocab.)
- Pages multi-entrées : `index.html` (tableau de bord), `app-n3.html` (hub Entraînement,
  lance le quiz), `quiz.html` (moteur adaptatif type Elo), `cours-n3.html` (cours),
  `planning-n3.html` (planning 20 semaines). Voir « Migration » pour l'état React/vanilla.
- Runtime partagé : `theme.css` (tokens Nord + thème clair/sombre via `[data-theme]`),
  `dict.js` (furigana + définition au tap, pages vanilla ; le quiz React porte
  cette logique dans `src/lib/dict.ts` + fetch `data/dict.json`).

## Commandes (bun uniquement)

    bun tools/validate.mjs            # valide toutes les data/*.json (exit 1 si KO)
    bun tools/sync-dict.mjs           # ré-inline data/dict.json → dict.js  (--check en CI)
    bun tools/sync-examples.mjs       # ré-inline data/examples.json → cours-n3.html (--extract, --check)
    bunx serve .                      # servir en local (http, requis pour SW + fetch)

## Gotchas

- **SW / cache** : après modif d'un asset statique (theme.css, dict.js, icônes),
  bumper `CACHE` dans `sw.js` (ex. `jlpt-n3-v78` → v79) pour forcer la MAJ clients.
- **bun bundle HTML** : `bun build ./x.html` **bundle** un `<script src="y.js">` classique
  dans le chunk JS de l'entrée (retire la balise du HTML mais **exécute** le code — ne le
  supprime PAS). Pour voir ce qu'une page embarque, greper `_site/*.js`, PAS le HTML
  (`Bun.build` sur un `.tsx` ne voit pas les scripts référencés par le HTML). `bun build`
  ne nettoie pas `--outdir` → chunks périmés possibles dans `_site`.
- **Déploiement** : `.github/workflows/deploy.yml` copie une **liste de fichiers
  explicite** dans `_site`. Tout nouveau fichier livré doit y être ajouté, sinon
  il ne sera pas publié. Push sur `main` → Pages (https://darti.github.io/jlpt/).
- **Persistance** : localStorage même origine, partagé entre pages —
  `jlptN3adapt_v2` (progression), `jlptN3_theme`, `jlptN3_updatedAt`.
  Sync multi-appareils optionnelle via Gist (PAT scope `gist`).

## Migration en cours

Portage incrémental (strangler) vers **React + TypeScript, bundlé par Bun**. Désormais une
**SPA `HashRouter`** (une seule entrée `index.html`, react-router-dom) : routes `/` (dashboard),
`/quiz`, `/entrainement` (hub), `/planning`. `quiz.html`/`app-n3.html` = stubs de redirection
vers les routes hash. **Encore vanilla** : `cours-n3.html` (dernière page ; ses liens pointent
vers `index.html#/…`). Le quiz porte furigana/tap dans `src/lib/dict.ts` (fetch `data/dict.json`
au runtime) ; furigana masqués par défaut (tap / bascule `ふ`).

- **Styles** : tokens CSS / Tailwind v4 repris de `~/Projects/darticorp/oku-theory/oku-ui`,
  **vendorisés** dans `src/styles/` (`tailwind.css` = tokens `@theme` + shims ;
  `themes.css` = look Nord en `[data-theme]`). CSS compilé par **`@tailwindcss/cli`**
  (PAS `bun-plugin-tailwind` — incompatible avec le bundler runtime de Bun).
- **Docs** : design `docs/superpowers/specs/2026-07-10-react-bun-migration-design.md` ;
  plan `docs/superpowers/plans/2026-07-10-dashboard-react-bun-slice.md`.
- Tant qu'une page n'est pas portée, elle reste en vanilla et doit fonctionner.
- **Tests** : logique pure → tests unitaires ; composants → `renderToStaticMarkup` (SSR smoke,
  sans DOM) ; effets/handlers/montage réel avec DOM → **happy-dom**
  (`bunfig.toml [test] preload = happydom.ts`, `createRoot` + `act`).

    bun install
    bun run dev        # Tailwind CLI (watch) + serveur HTML Bun (HMR)
    bun run build      # CSS minifié + bun build des 3 entrées HTML (--splitting requis) → _site/
    bun test           # tests TDD (*.test.ts, côte à côte)
    bun run typecheck  # tsc --noEmit
