# Confiance + Couverture — design

**Date** : 2026-07-12
**Statut** : approuvé (design), spec en relecture

## Objectif

Ajouter une mesure de **couverture** (% du référentiel N3 réellement parcouru) **à côté** de
l'estimation de niveau existante (Elo), et **amortir** cette estimation quand les données sont
rares. Motivation utilisateur :

> « la progression a été calculée sur un sous-ensemble de vocab, grammaire… comment la
> rebaser sur le périmètre complet » → « il faut de la confiance **et** un % de couverture ;
> la confiance seule est trompeuse et volatile au début. »

## Contexte (état actuel — à lire avant d'éditer)

La progression enregistrée (`localStorage["jlptN3adapt_v2"]`) est une **estimation d'aptitude**,
pas un relevé de couverture :

```ts
// src/types/progress.ts
interface Progress { total: number; skill: Partial<Record<Skill, {R,t}>>; }
```

- 5 compétences (`grammaire | vocabulaire | kanji | lecture | ecoute`), chacune un rating Elo
  `R` (1200–2000, départ 1450) + un compteur `t` (réponses) + `r` (bonnes) — cf. `elo.ts`.
- `masteryOf(p,c) = logistique((R − 1600)/400)` (`scoring.ts`). Les barres du tableau de bord
  (`dashboardModel.barMastery`) affichent `masteryOf` **brut**.
- **Aucune trace par item** n'existe : rien n'enregistre *quels* items ont été vus.
- `bank-index.json` associe chaque **id global** (dense `0..10309`) à sa compétence. Les ids des
  `bank-<skill>.json` **sont** ces ids globaux (vérifié : 0 divergence). Totaux : grammaire 1174,
  vocabulaire 5904, kanji 3148, lecture 52, écoute 32 (10 310 items).
- Une seule prise pour enregistrer une réponse : `useQuiz.choose()` (a `q.id`, `q.cat`, `correct`).
- Sync multi-appareils (`gist.ts#applyData`) = **remplacement par clé** (`setItem(k,v)`) →
  dernier-écrivain-gagne sur tout le blob, déjà le cas pour `R`/`t` aujourd'hui.

**Conséquence clé** : l'Elo est indépendant de la taille de la banque. `R` **se rebase seul** sur
le périmètre complet ; rien à migrer côté confiance. Seule la **couverture** est neuve et doit
être enregistrée par item, à partir de maintenant (choix utilisateur : garder `R`, couverture à 0).

## Décisions (validées)

1. **Deux anneaux** : `vu` (extérieur) = répondu ≥ 1× ; `maîtrisé` (intérieur) = répondu
   **correctement** ≥ 1× (⊆ vu). Sémantique *correct-once*, monotone.
2. **Confiance amortie** : la barre affichée est rapprochée du prior selon `t` (shrinkage
   bayésien), pour tuer la volatilité de début. `masteryOf` **brut reste inchangé** pour
   `allocate()` et le modèle de réussite (`successModel`).
3. **Données existantes** : `R`/`t` conservés (indépendants du périmètre) ; les anneaux
   démarrent à 0 et se remplissent désormais. Aucune couverture historique fabriquée.
4. **Rendu** : double-anneau SVG par compétence, avec les % en texte (jamais couleur seule).

## Architecture cible

### 1. Modèle de données — `src/types/progress.ts`

```ts
interface Progress {
  total: number;
  skill: Partial<Record<Skill, { R: number; t: number }>>;
  seen?: string;      // bitset base64 sur les ids globaux — répondu ≥ 1×
  mastered?: string;  // bitset base64 — répondu correctement ≥ 1× (⊆ seen)
}
```

- Bitset = `ceil((maxId+1)/8)` octets ≈ 1,3 Ko ; base64 ≈ 1,8 Ko. Deux champs ≈ 3,4 Ko, **taille
  fixe** quelle que soit la progression.
- Champs **optionnels** → blobs existants (sans `seen`/`mastered`) → couverture lue à 0.
- **Auto-rebase** : si la banque dépasse un jour `maxId`, `setBit` agrandit le tableau ; le
  dénominateur est recompté depuis `bank-index.json` au runtime → aucune migration.
- `isProgress` (storage.ts) inchangé : il n'exige que `total` + `skill`, et **renvoie l'objet
  parsé tel quel** → `seen`/`mastered` transitent déjà via `useProgress` une fois typés.

### 2. Nouvelle lib pure — `src/lib/coverage.ts` (TDD)

Aucune dépendance DOM ; testable en unitaire.

```ts
export function emptyBits(): Uint8Array;                       // Uint8Array(0), croît à la demande
export function setBit(bits: Uint8Array, id: number): Uint8Array;  // agrandit si id ≥ capacité
export function hasBit(bits: Uint8Array, id: number): boolean;     // false hors capacité
export function encodeBits(bits: Uint8Array): string;         // → base64 (btoa, conversion chunkée)
export function decodeBits(b64: string): Uint8Array;          // best-effort : "" ou base64 invalide → emptyBits()

export interface SkillCoverage { seen: number; mastered: number; seenN: number; masteredN: number; total: number }
// une passe O(N) sur bank-index : bucket total/seenN/masteredN par compétence ; seen/mastered = %
export function coverageBySkill(
  seen: Uint8Array, mastered: Uint8Array, bankIndex: Record<number, Skill>,
): Record<Skill, SkillCoverage>;
```

- `encode/decodeBits` : conversion `Uint8Array ↔ chaîne binaire ↔ base64` via `btoa`/`atob`
  (globaux en Bun & happy-dom), **chunkée** (éviter le dépassement de pile de `String.fromCharCode(...)`).
- `decodeBits` ne **jette jamais** (best-effort, cohérent avec `storage.ts`).

### 3. Chargement de l'index — `src/lib/bank.ts`

Ajouter un loader **caché** (module-level, comme le `cache` par catégorie déjà présent) :

```ts
export function loadBankIndex(fetchImpl?: FetchLike): Promise<Record<number, Skill>>;
```

Réutilisable par le hook de couverture. *Consolidation possible* : `useQuiz.ensureBankIndex`
duplique ce fetch — on peut le faire pointer sur `loadBankIndex` (hors-scope strict, à noter).

### 4. Enregistrement — `src/features/quiz/useQuiz.ts` (`choose`, ~l.218-230)

À côté du `writeProgress` existant, lire-modifier-écrire les bitsets depuis le **même** `raw` :

```ts
const seen = setBit(decodeBits(typeof raw?.seen === "string" ? raw.seen : ""), q.id);
const patch = { skill:{[q.cat]:nextSkill}, total:…, right:…, wrong:…, seen: encodeBits(seen) };
if (correct) {
  const mastered = setBit(decodeBits(typeof raw?.mastered === "string" ? raw.mastered : ""), q.id);
  patch.mastered = encodeBits(mastered);
}
writeProgress(patch);
```

- `seen`/`mastered` sont de simples chaînes → le deep-merge de `writeProgress` (qui ne traite
  spécialement que `skill`) les **écrase**, ce qui est correct car le nouveau contenu inclut
  déjà tous les bits antérieurs (lecture faite du blob courant). Monotone intra-appareil.
- « Vu » = **répondu** (chaque question affichée est répondue avant d'avancer) → prise unique,
  définition honnête. Pas de marquage à l'affichage/`start()`.

### 5. Confiance amortie — `src/lib/scoring.ts`

```ts
const PRIOR_R = 1450;   // rating neutre (= blankSkills)
const SHRINK_M = 10;    // pseudo-comptage — aligné sur la rupture de K de l'Elo (t < 10)

/** Maîtrise affichée : rating rapproché du prior selon l'évidence t, puis logistique. */
export function displayMastery(p: Progress, c: Skill): number {
  const R = skR(p, c), t = skT(p, c);
  const Reff = (t * R + SHRINK_M * PRIOR_R) / (t + SHRINK_M);
  return 1 / (1 + Math.pow(10, (PASS_RATING - Reff) / 400));
}
```

- `t = 0` → `Reff = 1450` → **identique** à `masteryOf` d'une compétence vierge (aucune
  discontinuité). L'amortissement n'agit que lorsque `R` a bougé mais `t` est petit.
- `dashboardModel.barMastery` bascule sur `displayMastery`. **`masteryOf` brut conservé** pour
  `allocate()` et `successModel` (rayon d'impact minimal ; le modèle de réussite a déjà son
  propre facteur `conf`).
- Effet visible : pour les données existantes, les barres lisent **plus bas** tant que `t` est
  faible — c'est l'objectif (moins trompeur).

### 6. Modèle d'affichage — hook `useCoverage`

`useProgress()` ne charge pas l'index. Nouveau `src/features/dashboard/useCoverage.ts` :

```ts
export function useCoverage(p: Progress | null): Record<Skill, SkillCoverage> | null;
// fetch loadBankIndex() (caché) ; decode seen/mastered ; coverageBySkill(...) ; mémoïsé sur
// (p.seen, p.mastered) ; null tant que l'index n'est pas chargé (offline 1re visite → pas d'anneaux)
```

`App.tsx` et `EntrainementApp.tsx` (les deux montent `<Dashboard>`) calculent
`const coverage = useCoverage(progress)` à côté de `model` et le passent en prop.

### 7. Rendu — double-anneau — `src/features/dashboard/SkillChart.tsx`

- Nouveau `<Dashboard coverage={…}>` → transmis à `SkillChart`.
- Sous le radar (qui montre le profil de maîtrise **amortie**), une rangée de **double-anneaux**
  SVG inline (sans dépendance), un par `BAR_SKILLS` (4 ; écoute exclue comme aujourd'hui, mais
  dispo dans le modèle) :
  - anneau **extérieur** = `vu %` (piste claire `--color-line`), rempli en `--color-skill-<c>` ;
  - anneau **intérieur** = `maîtrisé %`, rempli en `--color-accent` ;
  - **libellés texte** : `vu 12 % · appris 8 %` (dataviz : jamais couleur seule ; sert de repli
    accessible/offline, comme la liste de valeurs existante).
- L'implémentation du visuel suivra la skill **dataviz** (formule de couleur, contraste,
  encodage secondaire) — à invoquer au moment du code, pas dans le design.

### 8. Réinitialisation — `src/lib/datajson.ts` (`resetProgress`, l.39)

Ajouter `seen: "", mastered: ""` au blob vierge → « réinitialiser » efface aussi les anneaux.

## Flux de données

```
choose(q, correct)  ──►  decode seen/mastered  ──►  setBit(q.id)  ──►  writeProgress({…, seen, mastered})
                                                                              │
localStorage["jlptN3adapt_v2"]  ◄──────────────────────────────────────────┘
        │
useProgress() ──► Progress{…, seen, mastered}
        │                    │
        │             useCoverage(p) ──► loadBankIndex() ──► coverageBySkill() ──► Record<Skill,SkillCoverage>
        │                    │
dashboardModel(p) ──► barMastery via displayMastery       │
        │                    │                             │
        └──────────► <Dashboard model coverage> ──► <SkillChart> ──► radar (maîtrise amortie) + double-anneaux (vu/appris)
```

## Gestion des erreurs / cas limites

- `seen`/`mastered` absents, `""`, ou base64 corrompu → `decodeBits` → bits vides → 0 % (jamais de throw).
- `id` hors capacité → `hasBit` → `false` ; `setBit` agrandit le tableau.
- `loadBankIndex` échoue (offline, 1re visite) → `useCoverage` → `null` → anneaux masqués (repli
  gracieux, comme le fallback ECharts existant).
- Sync `cloudPull` : couverture en **dernier-écrivain-gagne** (peut régresser inter-appareils) —
  **comportement identique** à `R`/`t` aujourd'hui, accepté. Fusion par union (OR de bitsets) →
  **backlog**.

## Tests

- `coverage.test.ts` : `setBit`/`hasBit` (dont croissance au-delà de la capacité) ;
  `encode∘decode` round-trip ; `decodeBits("")` et base64 invalide → vide ;
  `coverageBySkill` (dénominateurs par compétence, `mastered ⊆ seen`).
- `scoring.test.ts` : `displayMastery` — `t=0` ≡ `masteryOf(1450)` ; croît vers `masteryOf(R)`
  quand `t→∞` ; monotone en `t` ; borne 0–1.
- `useQuiz` (runtime) : `choose` correct → un bit dans `seen` **et** `mastered` ; `choose` faux →
  bit dans `seen` seul ; deux fois le même id → toujours 1 bit.
- `Dashboard`/`SkillChart` (SSR smoke) : `coverage` fourni → « vu … % » / « appris … % » présents ;
  `coverage=null` → pas d'anneaux, pas de crash.
- `datajson.test.ts` : `resetProgress` écrit `seen:"" , mastered:""`.

## Hors-scope (backlog)

- Fusion inter-appareils par union (OR) des bitsets de couverture dans `gist.ts`.
- « Maîtrisé = récent/espacé » (SRS) — on a retenu *correct-once*.
- Amorcer la couverture depuis `t` (rejeté : fabriquerait des ids).
- Unifier `useQuiz.ensureBankIndex` sur `loadBankIndex` (consolidation).
- Anneau de couverture pour l'écoute dans le tableau de bord (dispo dans le modèle, non affiché).

## Portée des modifications

`src/types/progress.ts`, **`src/lib/coverage.ts` (neuf)**, `src/lib/bank.ts`, `src/lib/scoring.ts`,
`src/features/quiz/useQuiz.ts`, **`src/features/dashboard/useCoverage.ts` (neuf)**,
`src/features/dashboard/Dashboard.tsx`, `src/features/dashboard/SkillChart.tsx`,
`src/App.tsx`, `src/EntrainementApp.tsx`, `src/lib/datajson.ts` + tests côte à côte.

**Aucun** changement de `gist.ts`, de format de banque, ni d'asset livré → **pas de bump `sw.js`**
(les `data/*.json` sont inchangés ; le blob de progression vit dans `localStorage`).
