# Design — Migration React + Bun (incrémentale, tableau de bord d'abord)

- **Date** : 2026-07-10
- **Statut** : validé (brainstorming) — prêt pour plan d'implémentation
- **Périmètre de CE design** : la fondation partagée + la 1re tranche (`index.html`,
  le tableau de bord). Les pages suivantes (app-n3, cours-n3, planning) auront
  chacune leur propre cycle spec → plan → implémentation.

## 1. Contexte & objectif

L'app JLPT N3 est aujourd'hui une **PWA statique multi-pages, sans build**
(HTML/JS vanilla), déployée sur GitHub Pages. Les données (`data/*.json`) sont
la source de vérité et sont **inlinées** dans les fichiers livrés par
`tools/sync-*.mjs` (d'où `app-n3.html` à ~3,2 Mo).

Objectif : re-plateformer vers **React + TypeScript, bundlé par Bun**, motivé par
(1) douleur des monolithes inlinés, (2) volonté de fonctionnalités plus riches,
(3) DX moderne (HMR, types, imports). Runtime & outils : **bun exclusivement,
jamais `node`**.

## 2. Contraintes dures (rien ne doit régresser)

- **Continuité des données** : clés et formats `localStorage` **inchangés au bit
  près** — `jlptN3adapt_v2` (progression), `jlptN3_theme`, `jlptN3_updatedAt`,
  clés de checklist. La progression réelle d'étude doit survivre.
- **PWA / hors-ligne** (`sw.js`), **sync Gist** (PAT scope `gist`), **déploiement
  GitHub Pages**, **UI en français**, **look identique** — tous préservés.
- **App livrable après chaque étape** (strangler).

## 3. Décisions (issues du brainstorming)

| Sujet | Décision |
|---|---|
| Stratégie | Incrémentale (strangler-fig), une page à la fois |
| Structure | Hybride : multi-entrées HTML maintenant, SPA possible plus tard |
| Langage | TypeScript |
| 1re page | `index.html` (tableau de bord) |
| Styles | Système de tokens CSS / Tailwind v4 de **oku-ui**, **vendorisé** dans jlpt (extraction en package partagé plus tard) |
| Données | `data/*.json` chargées au runtime + code-split (retire l'inline-sync) |
| Build | Bun bundle le TSX ; **`@tailwindcss/cli`** compile le CSS (séparé) |

## 4. Architecture cible (hybride multi-entrées)

```
jlpt/
  data/*.json                ← inchangé : toujours la source de vérité
  dict.js                    ← gardé tel quel (global) pour l'instant ; porté plus tard
  src/
    entries/index.tsx        ← point d'entrée React du tableau de bord
    ui/                       ← layout partagé : Header, TopNav, Footer, UpdateBanner
    features/dashboard/       ← carte Dashboard + InstallPrompt
    lib/
      storage.ts             ← accès typé aux clés localStorage existantes
      scoring.ts             ← maths du moteur adaptatif (pures, extraites, testées)
      theme.ts               ← useTheme() — lit/écrit jlptN3_theme, pose data-theme
      pwa.ts                 ← enregistrement SW + bandeau MAJ + version
    styles/
      tailwind.css           ← @import "tailwindcss" + tokens oku-ui vendorisés
      themes.css             ← blocs [data-theme] (nord-frost-dark, nord-light)
    types/                    ← Question, Lesson, Progress, Skill…
  index.html                 ← coquille fine : <div id=root> + <script src=./src/entries/index.tsx>
  app-n3.html                ← encore vanilla (intact cette tranche)
  cours-n3.html              ← encore vanilla
  planning-n3.html           ← encore vanilla
  bunfig.toml, tsconfig.json, package.json
```

« Hybride » = chaque page est sa propre entrée aujourd'hui ; une fois les 4 en
React, collapser en SPA + routeur est un suivi optionnel, pas un prérequis.

**Gain structurel clé** : `scoring.ts` (Elo→sigmoïde, proba de réussite, score
/180, niveau) est actuellement **dupliqué inline dans `index.html` ET
`app-n3.html`**. L'extraire une fois, typé et testé, est le premier bénéfice.

## 5. Système de styles (tokens oku-ui vendorisés)

Reprise du système de oku-ui (`~/Projects/darticorp/oku-theory/oku-ui`,
`packages/ui/src/styles.css` + `theming/`). **Vendorisé** dans `src/styles/`
maintenant ; si les deux systèmes restent alignés, extraction en package publié
plus tard.

- **Tokens sémantiques uniquement.** On style avec `bg-bg/panel/panel-2/surface`,
  `text-fg{,-dim,-soft,-muted}`, `border-line{,-soft,-hi}`, `text-accent`,
  `text-card/meta/pill`, `shadow-card/hover`, `z-*`. Copier le bloc `@theme` +
  les `@utility` shims (z-scale, `shadow-*` lisant `--elevation-*`, `surface-blur`,
  `scrollbar-none`) + le reset `@layer base` (avec le multiplicateur typo `--ts`).
- **Thèmes = données.** Le look Nord actuel de jlpt est ré-exprimé en blocs
  `[data-theme]` : **sombre → `nord-frost-dark`**, **clair → `nord-light`**
  (les deux existent déjà, bundlés, dans oku-ui). On vendorise ces blocs CSS.
- **Pont avec l'existant** : le toggle `jlptN3_theme` (localStorage) est câblé pour
  écrire `data-theme` sur `<html>` — la préférence sauvegardée continue de marcher.
- **Règle stricte (comme oku-ui)** : **pas** de classes palette natives
  (`bg-gray-*`), **pas** de couleurs arbitraires (`bg-[#…]`), **pas** de tailles
  typo en dur (`text-[13px]` — casse l'échelle `--ts`). Besoin d'une couleur/taille ?
  Ajouter un token d'abord.

## 6. Build & dev

Deux processus **découplés** (le bundler Bun et le CLI Tailwind), car oku-ui a
documenté que `bun-plugin-tailwind` est **incompatible avec le bundler runtime de
`Bun.serve()`** — le CLI est le chemin fiable.

- **dev** : lancer ensemble
  `bunx @tailwindcss/cli -i src/styles/tailwind.css -o src/styles/styles.gen.css --watch=always`
  **+** `bun --hot ./index.html` (HMR React). Le CSS généré est un artefact
  git-ignoré.
- **build** :
  `bunx @tailwindcss/cli -i src/styles/tailwind.css -o src/styles/styles.gen.css --minify`
  **puis** `bun build ./index.html --minify --outdir=_site`.

## 7. Couche données (direction, pas exercée cette tranche)

Le tableau de bord ne lit **aucune** donnée de contenu (seulement `localStorage`).
Direction pour les pages suivantes : `data/*.json` reste la source de vérité,
chargée **au runtime et code-split** (la bank de 5,6 Mo ne se charge que sur la
page quiz), ce qui **retire l'étape d'inline de `tools/sync-content.mjs`**. Le SW
met en cache le JSON pour le hors-ligne.

## 8. Première tranche — le tableau de bord

`index.html` devient une coquille fine (on garde uniquement le petit `<script>`
inline pré-peinture qui pose `data-theme`, pour éviter un flash clair/sombre).
React rend dans `#root` :

- **`useProgress()`** → parse `jlptN3adapt_v2` en un `Progress` typé.
- **`scoring.ts`** (pur) → maîtrise par compétence, proba de réussite estimée,
  score /180, niveau (N4-…N3+), jours avant l'examen. Testé en TDD sur fixtures.
- **`<Dashboard>`** → grille de stats + jauge + barres par compétence
  (visuellement identique à aujourd'hui, via tokens oku-ui).
- **`<Header/TopNav/Footer>`**, **`useTheme()`**, **`usePWA()`** (bouton
  d'installation + guide iOS + bandeau MAJ + version + forcer la MAJ).
- Les liens de nav pointent encore vers `app-n3.html` etc. (vanilla).

**Frontières des unités** (chacune testable/compréhensible isolément) : `storage.ts`
(I/O localStorage typé), `scoring.ts` (maths pures), `theme.ts` (préférence + DOM),
`pwa.ts` (cycle SW), `ui/*` (présentation sans logique métier),
`features/dashboard/*` (composition).

## 9. PWA & déploiement

- Bun émet des chunks JS/CSS **hashés**. `sw.js` passe donc à : **précacher
  seulement les fichiers stables** (`index.html`, icônes, manifest, CSS généré si
  nom stable) et **cache-first au runtime** pour les chunks hashés au 1er chargement.
  HTML reste network-first (déjà correct). Comportement/UX identiques.
- **Workflow de déploiement** : ajouter `bun install` + build Tailwind + `bun build
  ./index.html --minify --outdir=_site` ; continuer de `cp` les pages encore
  vanilla + assets dans `_site`. À chaque page migrée, elle passe de la liste `cp`
  aux entrées de build — **cette liste EST le registre de migration**.

## 10. Tests (TDD, conforme aux guidelines)

`bun test`, tests `*.test.ts` côte à côte. RED→GREEN d'abord sur `scoring.ts`
(fixture de progression connue → proba/niveau/score attendus), puis `storage.ts`
(parse/roundtrip, compat format existant), puis les hooks theme + pwa. Smoke test
de composant optionnel via happy-dom. Couverture cible 80 %.

## 11. Séquence de migration

tableau de bord ✅ → **app-n3 (moteur quiz — la grosse pièce)** → cours-n3 →
planning-n3 → *(optionnel)* collapse en SPA. Chaque étape = son propre cycle
spec → plan → implémentation.

## 12. Risques / questions ouvertes

- **SW + assets hashés** — traité par le split précache/runtime (§9) ; vérifier le
  hors-ligne avant de livrer la tranche.
- **`dict.js`** reste un global non porté cette tranche (dette acceptable,
  à ticketer pour la tranche cours-n3 où la furigana compte le plus).
- **Dérive visuelle des tokens** — le mapping look Nord actuel → `nord-frost-dark`
  / `nord-light` doit être validé visuellement contre le tableau de bord actuel.
- **Vendor vs package partagé** — on vendorise maintenant ; réévaluer l'extraction
  en package publié quand app-n3/cours-n3 seront portées.
