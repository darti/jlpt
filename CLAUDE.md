# JLPT N3 — contexte projet

App web **statique, sans build** (HTML/JS vanilla) pour préparer le JLPT N3.
PWA installable, 100 % locale, déployée sur GitHub Pages. UI en **français**,
contenu en **japonais**. **Runtime & outils : `bun` exclusivement — jamais `node`.**

## Architecture (non évidente — lire avant d'éditer)

- **Source de vérité = `data/*.json`** (bank, vocab, kanji, grammar, dict, examples).
- Ces données sont **inlinées** dans les fichiers livrés entre marqueurs
  `/*NOM-START*/ … /*NOM-END*/` par les scripts `tools/sync-*.mjs`.
  → **Ne jamais éditer les tableaux inlinés à la main** (`BANK` dans `app-n3.html`,
    `DICT` dans `dict.js`, blocs `.ex` de `cours-n3.html`, `vocab-data.js`).
    Éditer `data/*.json` puis relancer le sync. La CI vérifie avec `--check`.
- Pages autonomes multi-entrées : `index.html` (tableau de bord), `app-n3.html`
  (moteur adaptatif type Elo, ~3,2 Mo car BANK inliné), `cours-n3.html` (cours),
  `planning-n3.html` (planning 20 semaines).
- Runtime partagé : `theme.css` (tokens Nord + thème clair/sombre via `[data-theme]`),
  `dict.js` (furigana + définition au tap). Vocab externalisé dans `vocab-data.js`.

## Commandes (bun uniquement)

    bun tools/validate.mjs            # valide toutes les data/*.json (exit 1 si KO)
    bun tools/sync-content.mjs        # ré-inline bank/grammar/kanji → app-n3.html + vocab-data.js
    bun tools/sync-content.mjs --check
    bun tools/sync-dict.mjs           # ré-inline data/dict.json → dict.js  (--check en CI)
    bun tools/sync-examples.mjs       # ré-inline data/examples.json → cours-n3.html (--extract, --check)
    bunx serve .                      # servir en local (http, requis pour SW + fetch)

## Gotchas

- **SW / cache** : après modif d'un asset statique (theme.css, dict.js, icônes),
  bumper `CACHE` dans `sw.js` (ex. `jlpt-n3-v78` → v79) pour forcer la MAJ clients.
- **Déploiement** : `.github/workflows/deploy.yml` copie une **liste de fichiers
  explicite** dans `_site`. Tout nouveau fichier livré doit y être ajouté, sinon
  il ne sera pas publié. Push sur `main` → Pages (https://darti.github.io/jlpt/).
- **Persistance** : localStorage même origine, partagé entre pages —
  `jlptN3adapt_v2` (progression), `jlptN3_theme`, `jlptN3_updatedAt`.
  Sync multi-appareils optionnelle via Gist (PAT scope `gist`).

## Migration en cours

Portage incrémental (strangler) vers **React + TypeScript, bundlé par Bun**,
page par page en commençant par `index.html`. Système de styles : **tokens CSS /
Tailwind v4 repris de `~/Projects/darticorp/oku-theory/oku-ui`** (tokens
sémantiques `@theme`, thèmes via `[data-theme]`). Voir
`docs/superpowers/specs/` pour le design. Tant qu'une page n'est pas portée,
elle reste en vanilla et doit continuer de fonctionner.

    bun install
    bun --hot ./index.html                        # dev (HMR)
    bun build ./index.html --minify --outdir=_site # build prod
    bun test                                       # tests (TDD, *.test.ts)
