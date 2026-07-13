# Refonte de l'onglet Cours (navigation + regroupement sémantique) — design

**Date** : 2026-07-13
**Statut** : approuvé (design), spec en relecture
**Portée** : refonte complète de la route `/cours` — navigation master-detail, regroupement
sémantique du contenu (vocab, kanji, grammaire), suivi de progression léger.

## Objectif

L'onglet Cours actuel est **une seule longue page d'accordéons `<details>` imbriqués** : on scrolle
une énorme liste, la navigation se résume à des pastilles qui font un scroll-to-section. On veut :

1. **Apprendre des listes de vocabulaire groupées par champ lexical** (sens), pas par nature grammaticale.
2. **Voir ensemble les kanji qui se ressemblent** — familles par composant/radical partagé.
3. **Grammaire regroupée par similarité** — familles fonctionnelles, pas 26 leçons numérotées.
4. **Navigation simple** — plus de scroll d'une énorme liste ; on choisit un thème, on voit juste ce thème.

Le contenu existant est *déjà partiellement groupé* mais selon de mauvais axes (nature grammaticale
pour le vocab, lots thématiques pour les kanji, leçons séquentielles pour la grammaire). Le chantier =
**re-classer le contenu sur des axes sémantiques** + **remplacer la page unique par une nav master-detail**
+ **ajouter un suivi de progression léger**.

## Contexte (existant)

- **Route** : `/cours` (HashRouter, `src/features/cours/`). `useCours()` charge 5 fichiers en parallèle :
  `cours-{gram,kanji,vocab,dokkai,choukai}.json`. Vue = `CoursView` (`Cours.tsx`) → sections plates avec
  accordéons `<details>` (`Lesson`/`Point`/`Example`/`Table`). Nav = pastilles `scrollIntoView`.
- **Schéma actuel** (`useCours.ts`) : `CoursSection { id, title, intro?, lessons?, tips? }` ;
  `CoursLesson { title, tag?, intro?, lessons?, table?, points?, tip? }` — récursif, hétérogène.
- **Données** :
  - `cours-vocab.json` : 9 leçons — 1 gros dump « ordre gojūon » (10 lots de 60 = 559 mots, table
    `Mot/Niv./Lecture/Sens`) + 8 « thèmes » qui sont en fait des **natures** (Verbes composés, Adverbes,
    Adjectifs, Katakana, Onomatopées, Noms…), table `Mot/Lecture/Sens`.
  - `cours-kanji.json` : 8 lots **thématiques** (Temps & calendrier, Émotions, Travail…) + 1 dump gojūon
    (9 sous-lots, 524 caractères), table `Kanji/Lecture/Sens/Mot exemple`. **Aucune donnée de radical/composant.**
  - `cours-gram.json` : 2 leçons « base » (formes, conjugaison) + 26 leçons numérotées thématiques
    (148 points au total, `Point { form, struct, mean, examples }`) + aide-mémoire. Familles éclatées
    (conditionnels en L1 *et* L19, restriction en L9 *et* L21, cause en L8/L24/L25…).
  - `cours-dokkai.json` / `cours-choukai.json` : **6 conseils chacun**, aucune liste (`tips` seulement).
- `data/kanji.json` (631 entrées `{ k, lvl, sens, struct, ex… }`) : `struct` = lectures 音/訓 seulement,
  **jamais** le radical. Aucune source du projet ne porte l'info composant/radical.
- **Intégration existante à préserver** : `coursGramIndex.ts` construit un index des points de grammaire
  depuis `cours-gram.json` (rappel de cours dans le corrigé quiz). La refonte du schéma grammaire **doit
  garder** une table/structure d'où extraire `{ forme, niv, sens }` → adapter `buildCoursGramIndex`.

## Décisions (validées)

- **Navigation master-detail à sous-routes** (option ① retenue), 3 niveaux :
  - `/cours` → **hub** : cartes de catégories (Grammaire · Vocab · Kanji · Méthode).
  - `/cours/:cat` → **index** : cartes-thèmes de la catégorie + pastille de progression.
  - `/cours/:cat/:group` → **détail** : le contenu d'un seul thème.
  Sous-routes (pas un état interne) → bouton retour natif, liens profonds (`#/cours/vocab/nourriture`),
  scroll par vue. Fil d'Ariane cliquable.
- **4 catégories** : Grammaire, Vocab, Kanji (`kind: 'learn'`, index + progression) ; **Méthode**
  (`kind: 'method'`, page de conseils, **pas** d'index ni de progression) = fusion lecture + écoute.
  Lecture/Écoute **conservés** (vrais conseils d'examen) mais rétrogradés en une seule catégorie compacte.
- **Vocab groupé par champ lexical** (sens), pas par nature. Le dump gojūon disparaît comme axe de nav.
  Les items sans champ lexical naturel (connecteurs/adverbes, onomatopées) → **2 groupes fonctionnels**
  dédiés, pas forcés dans un champ.
- **Kanji groupé par famille graphique** — composant/radical partagé, ce qui met ensemble familles
  phonétiques (青→晴・清・情・精) *et* sosies confondables (未/末, 士/土, 待/持). Composant partagé affiché
  en tête du groupe. Nécessite de **générer** l'assignation composant→kanji (aucune donnée existante).
- **Grammaire consolidée en ~12 familles fonctionnelles** — les 148 points ré-répartis par fonction
  (tous les conditionnels ensemble, toute la restriction/emphase ensemble…), plus une famille
  « Formes de base & conjugaison » de référence.
- **Un item = un seul groupe** (un mot dans un champ, un kanji dans une famille, un point dans une famille)
  → progression non ambiguë. Pas de renvois croisés (backlog si besoin).
- **Suivi de progression (option B)** : par item, état `known` / `review` / (neuf). Roll-up par thème
  (anneau/ratio sur la carte) et par catégorie (total au hub). Persistance localStorage.

## Ce qu'on construit

### 1. Schéma de données unifié (`src/features/cours/`)

Nouveau schéma « groupe » commun aux 3 catégories `learn` (remplace `CoursSection`/`CoursLesson`) :

```ts
type CoursCategoryId = 'gram' | 'vocab' | 'kanji' | 'method';
interface CoursCategory { id: CoursCategoryId; title: string; kind: 'learn' | 'method'; }
interface LearnCategory extends CoursCategory { kind: 'learn'; intro?: string[]; groups: CoursGroup[]; }
interface CoursGroup { id: string; title: string; subtitle?: string; note?: string; items: CoursItem[]; }
// item = union discriminée par catégorie (id stable, unique dans la catégorie, sert de clé progression)
type CoursItem = VocabItem | KanjiItem | GramItem;
interface VocabItem { id: string; mot: string; lecture: string; sens: string; niv?: string; }
interface KanjiItem { id: string; kanji: string; lecture: string; sens: string; exemple?: string; }
interface GramItem  { id: string; form: string; struct?: string; mean?: string; examples?: CoursExample[]; }
// method : page de conseils, pas de groupes/items
interface MethodCategory extends CoursCategory { kind: 'method'; sections: { title: string; tips: string[] }[]; }
```

- `id` d'item : préfixe catégorie + clé stable — `vocab:食べる`, `kanji:政`, `gram:<slug-de-forme>`.
  Doit rester stable si le contenu bouge (sinon la progression se perd) → dérivé du mot/kanji/forme, pas de l'index.
- `CoursExample` : réutiliser le type existant (`{ jp, ro, fr, an }`).

### 2. Fichiers de données restructurés (`data/`)

- `cours-vocab.json`, `cours-kanji.json`, `cours-gram.json` : **réécrits** au nouveau schéma
  (`{ id, title, kind:'learn', intro?, groups:[...] }`). Le dump gojūon (vocab & kanji) et les 26 leçons
  numérotées (grammaire) disparaissent.
- `cours-method.json` (**nouveau**) : fusion des `tips` de `cours-dokkai` + `cours-choukai`
  (`kind:'method'`, `sections:[{title:'読解 …', tips:[…]}, {title:'聴解 …', tips:[…]}]`).
- `cours-dokkai.json` / `cours-choukai.json` : **supprimés** (contenu migré dans `cours-method.json`).
- `useCours()` charge désormais `cours-{gram,vocab,kanji,method}.json`.

**Taxonomies de départ** (raffinées pendant les phases contenu, mais fixées ici comme cible) :

- **Vocab — champs lexicaux** (~14) : Nourriture & cuisine · Corps, santé & médecine · Famille & relations ·
  Travail & entreprise · École & études · Ville, transports & voyage · Maison & quotidien ·
  Nature, météo & environnement · Temps & calendrier · Argent, achats & économie ·
  Émotions & caractère · Communication, langue & médias · Société & administration · Loisirs, sport & culture.
  \+ 2 groupes fonctionnels : **Connecteurs & adverbes** · **Onomatopées**.
- **Kanji — familles graphiques** : chaque kanji assigné à **un** composant saillant. Familles sémantiques
  (氵eau, 木, 心/忄, 言, 糸, 女, 手/扌, 日, 亻, 金, 艹, 辶, 貝…) + séries phonétiques (青系→せい, 寺系, 反系,
  工系, 生系…) + un bac **« Sosies »** pour les confondables sans composant productif (未/末, 士/土, 干/千).
- **Grammaire — familles fonctionnelles** (~12–14) : Formes de base & conjugaison (référence) ·
  Conditionnels & hypothèses · Cause, but & moyen · Restriction, emphase, addition & énumération ·
  Apparence, ouï-dire, conjecture & déduction · Voix (passif/causatif) · Politesse (敬語) & registres ·
  Donner/recevoir, demandes, ordres & permissions · Temps, étapes & circonstances ·
  Aspect (て-forme) & verbes composés · Nominalisation & citation · Tendance, facilité & excès ·
  Décisions, changements & devenir · Connecteurs formels, jugement & nécessité.

### 3. Navigation master-detail (`Cours.tsx` + sous-composants)

- `Cours` (conteneur) : charge les 4 fichiers (`useCours`), rend un `<Routes>` imbriqué :
  - `index` → `<CoursHub categories={…} progress={…} />` : cartes catégories + total progression.
  - `:cat` → `<CategoryIndex category govgroup progress />` : cartes-thèmes (titre, sous-titre, ratio
    progression) ; `method` → rend directement `<MethodPage />` (pas de cartes).
  - `:cat/:group` → `<GroupDetail group category progress onToggle />` : le détail du thème.
- Fil d'Ariane pur (`<Breadcrumb />`), liens `#/cours/...`. Vue « détail » réutilise/adapte
  `Example`/`Point` existants.
- Vues détail par catégorie :
  - **Vocab** : table Mot/Lecture/Sens, furigana tap-pour-révéler (`furi`/`dict`), colonne toggle progression.
  - **Kanji** : bandeau composant partagé, kanji côte à côte (comparer les sosies), lecture/sens/exemple, toggle.
  - **Grammaire** : points de la famille (`form`/`struct`/`mean`/`examples`), toggle par point.
  - **Méthode** : conseils rendus directement, aucun toggle.

### 4. Suivi de progression (`coursProgress.ts`, pur + hook)

- `type ItemState = 'known' | 'review';` `type CoursProgress = Record<string, ItemState>;`
  (absent = neuf). Clé = `item.id`.
- Pur : `groupProgress(group, progress) → { known, review, total }` ; `categoryProgress(cat, progress)`
  (roll-up). `cycleState(current) → next` pour le toggle : **neuf → known → review → neuf** (1 tap =
  appris ●, 2 = à revoir ◐, 3 = reset ○).
- Persistance : `loadCoursProgress()` / `saveCoursProgress()` sur `localStorage['jlptN3_cours_v1']`
  (même patron que la progression quiz `jlptN3adapt_v2`). Hook `useCoursProgress()` → `[progress, setState]`.
- **Robustesse** : IDs inconnus (contenu supprimé) ignorés au roll-up ; JSON invalide → `{}`.

### 5. Intégration & livraison

- **`coursGramIndex.ts`** : adapter `buildCoursGramIndex` au nouveau schéma grammaire (parcourir
  `groups[].items` `GramItem` au lieu des tables `Forme/Niv./Sens`). Le rappel de cours du corrigé quiz
  doit continuer à matcher. **Régression test à garder vert.**
- **`tools/validate.mjs`** : valider le nouveau schéma (`groups`, `items`, unicité des `id` d'item par
  catégorie, `kind`).
- **`tools/copy-static.mjs`** : ajouter `cours-method.json` à l'inventaire des données servies ;
  retirer `cours-dokkai.json`/`cours-choukai.json`.
- **`sw.js`** : bumper `CACHE` (asset data modifié).

## Séquencement (phases)

Une seule spec, plan en phases (2–4 indépendantes entre elles) :

1. **Schéma + squelette UI** : types unifiés, nav master-detail, progression, en re-mappant le contenu
   *actuel* grossièrement (dérisque l'UI avant le gros travail de contenu).
2. **Contenu vocab** : ré-assigner les 559 mots en champs lexicaux (passe outillée + validation manuelle).
3. **Contenu kanji** : générer les familles graphiques pour les 524 kanji (assignation composant, aucune
   donnée existante) + validation.
4. **Contenu grammaire** : consolider les 148 points en ~12–14 familles + adapter `coursGramIndex`.
5. **Finitions** : `validate.mjs`, `copy-static.mjs`, `sw.js`, tests, nettoyage `cours-dokkai/choukai.json`.

## Tests (TDD)

- **Pur** : `coursProgress.ts` (roll-up known/review/total, cycle d'état, IDs inconnus ignorés,
  load/save + JSON invalide → `{}`). Parsing/normalisation du nouveau schéma si logique dédiée.
- **`coursGramIndex.test.ts`** : garder vert après adaptation au nouveau schéma (mêmes formes matchées).
- **SSR smoke** (`renderToStaticMarkup`) : `CoursHub` (cartes catégories), `CategoryIndex` (cartes-thèmes +
  ratio), `GroupDetail` par catégorie (vocab/kanji/gram/method). ⚠ apostrophes échappées.
- **happy-dom** : toggle progression (clic → état persiste, ratio de carte se met à jour) ; navigation
  master-detail (`MemoryRouter` sur `#/cours` → clic catégorie → clic thème → retour). fetch mocké.
- **`validate.mjs`** : exécuter sur les nouveaux `data/cours-*.json` (exit 0).

## Hors périmètre

- **Mode étude actif** (flashcards, auto-quiz depuis un thème) — c'était l'option C, écartée (backlog).
- **Renvois croisés** (un kanji/mot dans plusieurs groupes) — un seul groupe par item.
- Ancre profonde depuis le corrigé quiz vers un point de cours précis (reste un lien de section).
- Amélioration du taux de match du rappel de cours (inchangé ; le repli couvre les non-matchés).
- Refonte des autres routes (accueil, entraînement, planning, paramétrage).

## Notes

- **Stabilité des IDs de progression** : dériver l'`id` du contenu (mot/kanji/forme normalisée), jamais
  de l'index de position — sinon un re-classement casse la progression enregistrée. C'est le point le
  plus délicat des phases contenu.
- **Génération du contenu** (phases 2–4) : les taxonomies ci-dessus sont des cibles ; l'assignation
  précise de chaque item se fait par passe outillée (agent) **puis validation manuelle**, et est
  soumise à `validate.mjs`. Tout item non classé doit atterrir dans un groupe « Divers » explicite,
  jamais être perdu.
