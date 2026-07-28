# Lot 1 — État dérivé & paquet de cartes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer le cochage manuel du cours (l'état devient dérivé du modèle de mémoire FSRS)
et remplacer les écrans de revue défilants par un paquet de cartes plein écran.

**Architecture :** Un module pur `entityState.ts` projette la `FsrsMap` (déjà indexée par IRI
d'entité, exactement comme l'était `COURS_KEY`) vers quatre états d'affichage. Un composant
unique `EntityCard` rend une entité ; `Deck` en montre une par écran sur `/cours/:cat/:group`,
en lieu et place de `GroupDetail` (supprimé). Aucune couche numérique (`elo`, `scoring`,
`fsrs`, `bank`, `sessionPlan`) n'est modifiée — on n'ajoute qu'une **lecture** dérivée.

**Tech Stack :** React 19 + TypeScript, bundlé par **Bun** (jamais `node`), react-router-dom
(`HashRouter`), Tailwind v4 vendorisé, tests `bun test` (happy-dom préchargé via `bunfig.toml`).

**Spec :** `docs/superpowers/specs/2026-07-28-apprendre-avant-quiz-design.md` §3, §3.1, §3.2, §4.

## Global Constraints

- **Worktree obligatoire** : tout le travail se fait dans `.worktrees/feat-apprendre-avant-quiz`
  (branche `feat/apprendre-avant-quiz`). Jamais dans le répertoire principal.
- **`bun` exclusivement** — `bun test`, `bun run typecheck`. Jamais `node`, jamais `npm`.
- **Toujours `bun test` COMPLET avant de commiter**, jamais `bun test <fichier>` seul : quatre
  tests de mesure (`cadence.test.ts`, `rappel.reel.test.ts`, `shapes.test.ts`) vivent loin du
  code touché et servent de cliquets.
- **Pas de linter** dans le projet (ni eslint, ni prettier, ni biome). Ne pas en ajouter.
- **Ne JAMAIS modifier** `src/lib/elo.ts`, `src/lib/scoring.ts`, `src/lib/fsrs.ts`,
  `src/lib/bank.ts`, `src/features/entrainement/sessionPlan.ts`, `src/features/quiz/answerPatch.ts`.
  Un refactor de ces modules exigerait une preuve bit-identique (capture golden avant / diff
  exact après) qui n'est pas dans le périmètre de ce lot.
- **`STABILITE_ACQUISE = 21`** (jours) — une seule déclaration, dans `entityState.ts`.
- **Clés localStorage** : toute clé nouvelle est déclarée dans `src/lib/keys.ts` et porte le
  préfixe `KEY_PREFIX` (`jlptN3`), sinon `gist.ts#collectData` ne la synchronise jamais.
- **Écriture de la progression** : uniquement via `writeProgress()` (patch fusionné). ⚠ Le
  deep-merge ne concerne que `skill` ; le champ `fsrs` est **remplacé en entier**, il faut donc
  toujours écrire la carte complète (c'est déjà ce que fait `fsrsPatch`).
- **Tests SSR** : `renderToStaticMarkup` échappe les apostrophes (`'` → `&#x27;`) — asserter sur
  des sous-chaînes sans apostrophe. **Ne jamais** asserter un kanji rendu par `furi()` en
  sous-chaîne brute : `furi` scinde les mots en `<span>` et le `DICT` est un état de module qui
  fuit entre fichiers de test.
- **Router** : tout composant utilisant `useSearchParams` doit être enveloppé dans
  `<MemoryRouter>` en test.
- **Commits** : jamais de ligne `Co-Authored-By`. Message d'une ligne, en français.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `src/features/cours/entityState.ts` | **créé** — dérivation pure `Fsrs → EntityState`, agrégats par groupe/catégorie |
| `src/features/cours/entityState.test.ts` | **créé** — frontières des 4 états + test de mesure du seuil |
| `src/features/cours/coursProgress.ts` | **réduit** — ne garde que la lecture legacy + la migration |
| `src/features/cours/coursProgress.test.ts` | **réécrit** — idempotence, non-écrasement |
| `src/features/cours/useEntityStates.ts` | **créé** — hook : migration au montage, lecture `FsrsMap`, `markKnown` |
| `src/features/cours/useEntityStates.test.tsx` | **créé** — happy-dom |
| `src/features/cours/EntityCard.tsx` | **créé** — rendu unique d'entité (`itemKind`, `splitStruct`, marqueurs d'état) |
| `src/features/cours/EntityCard.test.tsx` | **créé** — SSR smoke par nature d'item |
| `src/features/cours/Deck.tsx` | **créé** — paquet plein écran, `initialIndex` pur exporté |
| `src/features/cours/Deck.test.tsx` | **créé** — `initialIndex` pur + happy-dom (clavier, focus) |
| `src/features/cours/GroupDetail.tsx` | **supprimé** (284 l.) |
| `src/features/cours/GroupDetail.test.tsx` | **supprimé** |
| `src/features/cours/useCoursProgress.ts` | **supprimé** |
| `src/features/cours/useCoursProgress.test.tsx` | **supprimé** |
| `src/features/cours/Cours.tsx` | **modifié** — route `:cat/:group` → `Deck` |
| `src/features/cours/CategoryIndex.tsx` | **modifié** — compteurs dérivés |
| `src/features/cours/CoursHub.tsx` | **modifié** — compteurs dérivés |
| `src/features/quiz/Corrige.tsx` | **modifié** — `RappelCard` rend `EntityCard variant="compacte"` |
| `src/lib/keys.ts` | **modifié** — `COURS_MIGRE_KEY` |

---

## Task 1 : le module pur `entityState.ts`

**Files:**
- Create: `src/features/cours/entityState.ts`
- Test: `src/features/cours/entityState.test.ts`

**Interfaces:**
- Consumes: `Fsrs`, `isDue` (`src/lib/fsrs.ts`) ; `FsrsMap` (type, `src/features/quiz/revision.ts`) ;
  `CoursGroup`, `LearnCategory` (`src/features/cours/coursSchema.ts`).
- Produces:
  - `type EntityState = "neuf" | "en-cours" | "a-revoir" | "acquis"`
  - `const STABILITE_ACQUISE: number` (= 21)
  - `function entityState(f: Fsrs | undefined, today: number): EntityState`
  - `interface GroupStats { acquis: number; enCours: number; aRevoir: number; neufs: number; total: number }`
  - `function groupStates(group: CoursGroup, m: FsrsMap, today: number): GroupStats`
  - `function categoryStates(cat: LearnCategory, m: FsrsMap, today: number): GroupStats`

> ⚠ `FsrsMap` est importé **en type seul** (`import type`) depuis `features/quiz/revision.ts` :
> effacé au build, donc aucune dépendance d'exécution du cours vers le quiz.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/cours/entityState.test.ts` :

```ts
import { test, expect } from "bun:test";
import { fsrsInit, fsrsReview, isDue, type Fsrs } from "../../lib/fsrs.ts";
import {
  entityState, groupStates, categoryStates, STABILITE_ACQUISE,
} from "./entityState.ts";
import type { CoursGroup, LearnCategory } from "./coursSchema.ts";

test("entityState sans carte rend neuf", () => {
  expect(entityState(undefined, 10)).toBe("neuf");
});

// RÉGRESSION (spec §3) : `isDue` seul ne suffit PAS. fsrsInit(1) rend S = 0,49 j avec R = 1
// le jour même — l'item serait « acquis » quelques heures après avoir été raté.
test("entityState juste apres une reponse fausse n est pas acquis", () => {
  expect(entityState(fsrsInit(1, 0), 0)).toBe("en-cours");
});

test("entityState le lendemain d une reponse fausse rend a-revoir", () => {
  expect(entityState(fsrsInit(1, 0), 1)).toBe("a-revoir");
});

test("entityState avec stabilite haute et carte fraiche rend acquis", () => {
  const st: Fsrs = [30, 5, 0];
  expect(entityState(st, 0)).toBe("acquis");
});

// L'échéance l'emporte sur la stabilité : une carte stable mais oubliée est à revoir.
test("entityState avec stabilite haute mais carte due rend a-revoir", () => {
  const st: Fsrs = [30, 5, 0];
  expect(isDue(st, 100)).toBe(true);
  expect(entityState(st, 100)).toBe("a-revoir");
});

// TEST DE MESURE (spec §3) : fige la PROPRIÉTÉ du seuil — « acquis » se gagne en deux succès
// espacés — sans dépendre de la valeur des 17 poids FSRS.
test("le seuil d acquisition tombe entre la premiere et la deuxieme revision reussie", () => {
  let st = fsrsInit(3, 0);
  let jour = 0;
  const stabilites: number[] = [];
  for (let i = 0; i < 2; i++) {
    while (!isDue(st, jour)) jour++;
    st = fsrsReview(st, 3, jour);
    stabilites.push(st[0]);
  }
  expect(stabilites[0]).toBeLessThan(STABILITE_ACQUISE);
  expect(stabilites[1]).toBeGreaterThanOrEqual(STABILITE_ACQUISE);
});

const groupe: CoursGroup = {
  id: "g1",
  title: "Conditionnels",
  items: [
    { id: "jlpt:gram/ば", form: "〜ば" },
    { id: "jlpt:gram/たら", form: "〜たら" },
    { id: "jlpt:gram/なら", form: "〜なら" },
  ],
};

test("groupStates compte les quatre etats", () => {
  const m = { "jlpt:gram/ば": [30, 5, 0] as Fsrs, "jlpt:gram/たら": fsrsInit(1, 0) };
  expect(groupStates(groupe, m, 0)).toEqual({
    acquis: 1, enCours: 1, aRevoir: 0, neufs: 1, total: 3,
  });
});

test("categoryStates additionne les groupes", () => {
  const cat: LearnCategory = {
    id: "gram", title: "文法", kind: "learn", groups: [groupe, groupe],
  };
  expect(categoryStates(cat, {}, 0)).toEqual({
    acquis: 0, enCours: 0, aRevoir: 0, neufs: 6, total: 6,
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/entityState.test.ts
```

Attendu : ÉCHEC — `Cannot find module './entityState.ts'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `src/features/cours/entityState.ts` :

```ts
/**
 * État d'affichage d'une entité de cours, DÉRIVÉ du modèle de mémoire.
 *
 * `COURS_KEY` (`Record<IRI, "known"|"review">`) et la carte FSRS (`Record<IRI, Fsrs>`)
 * partageaient le même espace de clés sans jamais se parler : on pouvait avoir R = 0,98 sur
 * 〜ばかり depuis trois semaines et voir toujours « ○ » dans le cours. L'état n'est donc plus
 * stocké — il se calcule. Module PUR : `today` est injecté, jamais lu d'une horloge.
 */
import { isDue, type Fsrs } from "../../lib/fsrs.ts";
import type { FsrsMap } from "../quiz/revision.ts";
import type { CoursGroup, LearnCategory } from "./coursSchema.ts";

export type EntityState = "neuf" | "en-cours" | "a-revoir" | "acquis";

/**
 * Stabilité (jours) au-delà de laquelle une entité est « acquise ».
 *
 * ⚠ Seuil dérivé d'une mesure, pas choisi : la trajectoire `fsrsReview(·, Good, échéance)`
 * depuis `fsrsInit(3)` donne S = 3,7 → 14,8 → 49,5 → 147,4 j. 21 tombe entre la 1re et la 2e
 * révision réussie — « acquis » se gagne donc en DEUX succès espacés. Figé par un test de
 * mesure dans `entityState.test.ts`.
 */
export const STABILITE_ACQUISE = 21;

/**
 * L'état d'une entité au jour `today`.
 *
 * ⚠ L'ordre des tests compte. `isDue` ne peut pas trancher seul : `fsrsInit(1, j)` (réponse
 * fausse sur un item neuf) rend S = 0,49 j avec R = 1 le jour même — l'entité serait affichée
 * « acquise » quelques heures après avoir été ratée. C'est la STABILITÉ qui porte
 * l'acquisition, la rétrievabilité ne porte que l'urgence.
 */
export function entityState(f: Fsrs | undefined, today: number): EntityState {
  if (!f) return "neuf";
  if (isDue(f, today)) return "a-revoir";
  return f[0] >= STABILITE_ACQUISE ? "acquis" : "en-cours";
}

export interface GroupStats {
  acquis: number;
  enCours: number;
  aRevoir: number;
  neufs: number;
  total: number;
}

const VIDE: GroupStats = { acquis: 0, enCours: 0, aRevoir: 0, neufs: 0, total: 0 };

const CHAMP: Record<EntityState, keyof Omit<GroupStats, "total">> = {
  acquis: "acquis",
  "en-cours": "enCours",
  "a-revoir": "aRevoir",
  neuf: "neufs",
};

export function groupStates(group: CoursGroup, m: FsrsMap, today: number): GroupStats {
  const out: GroupStats = { ...VIDE };
  for (const it of group.items) {
    out[CHAMP[entityState(m[it.id], today)]]++;
    out.total++;
  }
  return out;
}

export function categoryStates(cat: LearnCategory, m: FsrsMap, today: number): GroupStats {
  return cat.groups.reduce<GroupStats>((acc, g) => {
    const s = groupStates(g, m, today);
    return {
      acquis: acc.acquis + s.acquis,
      enCours: acc.enCours + s.enCours,
      aRevoir: acc.aRevoir + s.aRevoir,
      neufs: acc.neufs + s.neufs,
      total: acc.total + s.total,
    };
  }, { ...VIDE });
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/entityState.test.ts
```

Attendu : 8 tests PASS.

- [ ] **Step 5: Suite complète + typecheck**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test && bun run typecheck
```

Attendu : tout vert (rien d'autre n'est encore touché).

- [ ] **Step 6: Commit**

```bash
cd .worktrees/feat-apprendre-avant-quiz
git add src/features/cours/entityState.ts src/features/cours/entityState.test.ts
git commit -m "feat(cours): l etat d une entite se derive du modele de memoire"
```

---

## Task 2 : migration de `COURS_KEY` vers la carte FSRS

**Files:**
- Modify: `src/lib/keys.ts` (ajout d'une constante)
- Modify: `src/features/cours/coursProgress.ts` (réduction + migration)
- Test: `src/features/cours/coursProgress.test.ts` (réécriture complète)

**Interfaces:**
- Consumes: `fsrsInit` (`src/lib/fsrs.ts`) ; `FsrsMap` (`src/features/quiz/revision.ts`).
- Produces:
  - `const COURS_MIGRE_KEY = "jlptN3_coursMigre"` (`src/lib/keys.ts`)
  - `function migrateCoursProgress(legacy: CoursProgress, m: FsrsMap, today: number): FsrsMap | null`
    — rend la carte complète à écrire, ou `null` s'il n'y a rien à faire.
  - `loadCoursProgress` (inchangée, lecture seule) et `type CoursProgress` / `type ItemState` restent exportés.

> ⚠ **Cette task est purement ADDITIVE.** `cycleState`, `setItemState`, `saveCoursProgress`,
> `groupProgress`, `categoryProgress` et `GroupStats` restent en place ici : ils sont encore
> consommés par `CoursHub`, `CategoryIndex`, `GroupDetail` et `useCoursProgress`. Ils sont
> supprimés à la Task 6, dans le même commit que le rebranchement de leurs appelants — c'est
> ce qui garde le typecheck VERT à chaque commit de la branche.

- [ ] **Step 1: Écrire le test qui échoue**

**Ajouter** à `src/features/cours/coursProgress.test.ts` (ne rien retirer : les tests de
`groupProgress` / `cycleState` restent valides jusqu'à la Task 6, où ils partent avec leur
sujet). Compléter les imports en tête du fichier, puis ajouter les cas :

```ts
import { fsrsInit, type Fsrs } from "../../lib/fsrs.ts";
import { migrateCoursProgress } from "./coursProgress.ts";

test("migrateCoursProgress amorce known en Good et review en Again", () => {
  const out = migrateCoursProgress(
    { "jlpt:gram/ば": "known", "jlpt:gram/たら": "review" }, {}, 7,
  );
  expect(out).toEqual({
    "jlpt:gram/ば": fsrsInit(3, 7),
    "jlpt:gram/たら": fsrsInit(1, 7),
  });
});

// Le modèle de mémoire fait autorité — même invariant que toutes les chaînes d'outils du
// projet : un applicateur n'écrase jamais une donnée déjà posée.
test("migrateCoursProgress n ecrase jamais une carte existante", () => {
  const deja: Fsrs = [99, 5, 3];
  const out = migrateCoursProgress(
    { "jlpt:gram/ば": "known" }, { "jlpt:gram/ば": deja }, 7,
  );
  expect(out).toBeNull();
});

test("migrateCoursProgress rend null quand il n y a rien a migrer", () => {
  expect(migrateCoursProgress({}, {}, 7)).toBeNull();
});

test("migrateCoursProgress conserve les cartes non concernees", () => {
  const autre: Fsrs = [12, 4, 1];
  const out = migrateCoursProgress(
    { "jlpt:gram/ば": "known" }, { "jlpt:word/影響": autre }, 7,
  );
  expect(out).toEqual({
    "jlpt:word/影響": autre,
    "jlpt:gram/ば": fsrsInit(3, 7),
  });
});

```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/coursProgress.test.ts
```

Attendu : ÉCHEC — `migrateCoursProgress is not a function` (export absent).

- [ ] **Step 3: Ajouter la clé de migration**

Dans `src/lib/keys.ts`, juste après le bloc `COURS_KEY` :

```ts
/** Marqueur « la progression de cours manuelle a été versée dans la carte FSRS ».
 *  Rend la migration idempotente. `COURS_KEY` est conservée (preuve du travail manuel,
 *  rejouable) mais n'est plus jamais écrite. */
export const COURS_MIGRE_KEY = "jlptN3_coursMigre";
```

- [ ] **Step 4: Ajouter la migration à `coursProgress.ts` (sans rien retirer)**

En tête de `src/features/cours/coursProgress.ts`, ajouter l'import :

```ts
import { fsrsInit } from "../../lib/fsrs.ts";
import type { FsrsMap } from "../quiz/revision.ts";
```

puis **ajouter à la fin du fichier**, sans toucher au reste :

```ts
/**
 * La carte FSRS après versement de l'ancien cochage — `null` s'il n'y a rien à écrire.
 *
 * `known` → `fsrsInit(3)` (Good), `review` → `fsrsInit(1)` (Again). **N'écrase jamais** une
 * carte existante : la mémoire mesurée fait autorité sur une déclaration manuelle. Pure.
 */
export function migrateCoursProgress(
  legacy: CoursProgress, m: FsrsMap, today: number,
): FsrsMap | null {
  const next: FsrsMap = { ...m };
  let touche = false;
  for (const [iri, etat] of Object.entries(legacy)) {
    if (next[iri]) continue; // la carte existante gagne
    next[iri] = fsrsInit(etat === "known" ? 3 : 1, today);
    touche = true;
  }
  return touche ? next : null;
}
```

- [ ] **Step 5: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/coursProgress.test.ts
```

Attendu : 5 tests PASS.

- [ ] **Step 6: Suite complète + typecheck**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test && bun run typecheck
```

Attendu : **tout vert.** Cette task n'ajoute que du code ; les anciens exports vivent encore et
leurs appelants compilent. Si le typecheck échoue, c'est qu'une fonction a été retirée par
erreur — la restaurer, la suppression appartient à la Task 6.

- [ ] **Step 7: Commit**

```bash
cd .worktrees/feat-apprendre-avant-quiz
git add src/lib/keys.ts src/features/cours/coursProgress.ts src/features/cours/coursProgress.test.ts
git commit -m "feat(cours): verser le cochage manuel dans la carte FSRS (migration idempotente)"
```

---

## Task 3 : le hook `useEntityStates`

**Files:**
- Create: `src/features/cours/useEntityStates.ts`
- Test: `src/features/cours/useEntityStates.test.tsx`

**Interfaces:**
- Consumes: `entityState`, `EntityState` (Task 1) ; `migrateCoursProgress`, `loadCoursProgress`
  (Task 2) ; `COURS_MIGRE_KEY` (Task 2) ; `asFsrs`, `FsrsMap` (`src/features/quiz/revision.ts`) ;
  `readRawProgress`, `writeProgress` (`src/lib/storage.ts`) ; `dayNumber`
  (`src/features/quiz/traps.ts`) ; `fsrsInit` (`src/lib/fsrs.ts`).
- Produces:
  ```ts
  interface EntityStates {
    fsrs: FsrsMap;
    today: number;
    stateOf: (iri: string) => EntityState;
    markKnown: (iri: string, grade?: 1 | 3) => void;
  }
  function useEntityStates(): EntityStates;
  ```

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/cours/useEntityStates.test.tsx` :

```tsx
import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEntityStates } from "./useEntityStates.ts";
import { COURS_KEY, COURS_MIGRE_KEY, PROGRESS_KEY } from "../../lib/keys.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  try { globalThis.localStorage.clear(); } catch { /* noop */ }
});

async function monter(): Promise<{ api: () => ReturnType<typeof useEntityStates> }> {
  let courant: ReturnType<typeof useEntityStates> | null = null;
  function Probe() { courant = useEntityStates(); return null; }
  const host = document.createElement("div");
  const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  return { api: () => courant! };
}

test("markKnown amorce la carte FSRS et rend l entite non-neuve", async () => {
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).toBe("neuf");
  await act(async () => { api().markKnown("jlpt:gram/ば"); });
  expect(api().stateOf("jlpt:gram/ば")).not.toBe("neuf");
  const blob = JSON.parse(globalThis.localStorage.getItem(PROGRESS_KEY)!);
  expect(blob.fsrs["jlpt:gram/ば"]).toBeArrayOfSize(3);
});

test("markKnown preserve les cartes des autres entites", async () => {
  const { api } = await monter();
  await act(async () => { api().markKnown("jlpt:gram/ば"); });
  await act(async () => { api().markKnown("jlpt:gram/たら"); });
  const blob = JSON.parse(globalThis.localStorage.getItem(PROGRESS_KEY)!);
  expect(Object.keys(blob.fsrs).sort()).toEqual(["jlpt:gram/たら", "jlpt:gram/ば"].sort());
});

test("le montage migre COURS_KEY une seule fois", async () => {
  globalThis.localStorage.setItem(
    COURS_KEY, JSON.stringify({ "jlpt:gram/ば": "known" }),
  );
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).not.toBe("neuf");
  expect(globalThis.localStorage.getItem(COURS_MIGRE_KEY)).toBe("1");
  // COURS_KEY survit : preuve du travail manuel, rejouable.
  expect(globalThis.localStorage.getItem(COURS_KEY)).not.toBeNull();
});

test("un second montage ne rejoue pas la migration", async () => {
  globalThis.localStorage.setItem(COURS_KEY, JSON.stringify({ "jlpt:gram/ば": "known" }));
  globalThis.localStorage.setItem(COURS_MIGRE_KEY, "1");
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).toBe("neuf");
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/useEntityStates.test.tsx
```

Attendu : ÉCHEC — `Cannot find module './useEntityStates.ts'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/features/cours/useEntityStates.ts` :

```ts
/**
 * Lecture de l'état dérivé des entités du cours, et unique geste d'écriture (« je connais »).
 *
 * Remplace `useCoursProgress` : plus de cochage cyclique persisté, l'état se calcule depuis la
 * carte FSRS (`entityState.ts`). Le seul geste offert AMORCE la mémoire au lieu de poser un
 * drapeau — l'entité entre dans le planificateur et reviendra en révision. Une affirmation
 * devient une hypothèse testable au lieu d'un angle mort.
 */
import { useCallback, useEffect, useState } from "react";
import { fsrsInit } from "../../lib/fsrs.ts";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { asFsrs, type FsrsMap } from "../quiz/revision.ts";
import { dayNumber } from "../quiz/traps.ts";
import { COURS_MIGRE_KEY } from "../../lib/keys.ts";
import { entityState, type EntityState } from "./entityState.ts";
import { loadCoursProgress, migrateCoursProgress } from "./coursProgress.ts";

export interface EntityStates {
  fsrs: FsrsMap;
  today: number;
  stateOf: (iri: string) => EntityState;
  markKnown: (iri: string, grade?: 1 | 3) => void;
}

export function useEntityStates(): EntityStates {
  const [today] = useState(() => dayNumber(new Date()));
  const [fsrs, setFsrs] = useState<FsrsMap>(() => asFsrs(readRawProgress()));

  // Migration unique du cochage manuel (COURS_KEY) vers la carte FSRS. Le marqueur la rend
  // idempotente ; `migrateCoursProgress` n'écrase jamais une carte existante.
  useEffect(() => {
    let deja: string | null = null;
    try { deja = globalThis.localStorage.getItem(COURS_MIGRE_KEY); } catch { return; }
    if (deja === "1") return;
    const suivant = migrateCoursProgress(loadCoursProgress(), asFsrs(readRawProgress()), today);
    if (suivant) {
      writeProgress({ fsrs: suivant });
      setFsrs(suivant);
    }
    try { globalThis.localStorage.setItem(COURS_MIGRE_KEY, "1"); } catch { /* best-effort */ }
  }, [today]);

  const stateOf = useCallback(
    (iri: string) => entityState(fsrs[iri], today),
    [fsrs, today],
  );

  // ⚠ `writeProgress` ne deep-merge QUE `skill` : le champ `fsrs` est remplacé en entier, il
  // faut donc toujours réécrire la carte complète (même contrainte que `fsrsPatch`).
  const markKnown = useCallback((iri: string, grade: 1 | 3 = 3) => {
    setFsrs((cur) => {
      const suivant: FsrsMap = { ...cur, [iri]: fsrsInit(grade, today) };
      writeProgress({ fsrs: suivant });
      return suivant;
    });
  }, [today]);

  return { fsrs, today, stateOf, markKnown };
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/useEntityStates.test.tsx
```

Attendu : 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-apprendre-avant-quiz
git add src/features/cours/useEntityStates.ts src/features/cours/useEntityStates.test.tsx
git commit -m "feat(cours): hook d etat derive, je-connais amorce la memoire"
```

---

## Task 4 : `EntityCard`, le rendu unique d'une entité

**Files:**
- Create: `src/features/cours/EntityCard.tsx`
- Test: `src/features/cours/EntityCard.test.tsx`

**Interfaces:**
- Consumes: `EntityState` (Task 1) ; `CoursItem`, `GramItem`, `KanjiItem`, `VocabItem`,
  `CoursExample` (`coursSchema.ts`) ; `SpeakButton`, `kanjiExempleJa` (`./`) ;
  `SentenceAnalysis` (`../../ui/SentenceAnalysis.tsx`) ; `furi` (`../../lib/dict.ts`).
- Produces:
  - `function itemKind(it: CoursItem): "gram" | "kanji" | "vocab"`
  - `function splitStruct(struct: string): string[]` (déplacé depuis `GroupDetail.tsx`, inchangé)
  - `const STATE_MARK: Record<EntityState, string>`
  - `const STATE_TITRE: Record<EntityState, string>`
  - `function EntityCard(props: { item: CoursItem; state: EntityState; variant?: "carte" | "compacte"; legende?: boolean }): JSX.Element`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/cours/EntityCard.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityCard, itemKind, splitStruct } from "./EntityCard.tsx";
import type { CoursItem } from "./coursSchema.ts";

test("splitStruct coupe sur les barres de premier niveau", () => {
  expect(splitStruct("V(ば形) ／ い-adj：〜ければ")).toEqual([
    "V(ば形)", "い-adj：〜ければ",
  ]);
});

test("splitStruct laisse intactes les barres entre parentheses", () => {
  expect(splitStruct("〜て（口語：〜ちゃう／〜じゃう）")).toEqual([
    "〜て（口語：〜ちゃう／〜じゃう）",
  ]);
});

// ⚠ La nature se lit sur les CHAMPS, pas sur la piste : un motif grammatical rangé dans le
// cours de vocabulaire porte `form` ET `mot` (cf. coursFromGraph.ts) — `form` doit gagner.
test("itemKind se fie aux champs et non a la piste", () => {
  expect(itemKind({ id: "a", form: "〜ば" } as CoursItem)).toBe("gram");
  expect(itemKind({ id: "b", kanji: "位", lecture: "イ", sens: "rang" } as CoursItem)).toBe("kanji");
  expect(itemKind({ id: "c", mot: "影響", lecture: "えいきょう", sens: "influence" } as CoursItem)).toBe("vocab");
  const mixte = { id: "d", form: "なかなか〜ない", mot: "なかなか〜ない", lecture: "", sens: "" };
  expect(itemKind(mixte as CoursItem)).toBe("gram");
});

test("EntityCard rend la structure et le sens d un point de grammaire", () => {
  const html = renderToStaticMarkup(
    <EntityCard
      item={{ id: "jlpt:gram/ば", form: "〜ば", struct: "V(ば形)", mean: "condition generale" }}
      state="neuf"
    />,
  );
  expect(html).toContain("V(ば形)");
  expect(html).toContain("condition generale");
});

test("EntityCard rend la lecture et le sens d un kanji", () => {
  const html = renderToStaticMarkup(
    <EntityCard
      item={{ id: "jlpt:kanji/位", kanji: "位", lecture: "イ・くらい", sens: "rang" }}
      state="acquis"
    />,
  );
  expect(html).toContain("イ・くらい");
  expect(html).toContain("rang");
});

// ⚠ Ne JAMAIS asserter un kanji rendu par furi() en sous-chaîne brute (furi scinde les mots en
// spans et le DICT fuit entre fichiers de test) — on asserte la LECTURE et le SENS, jamais 影響.
test("EntityCard rend la lecture et le sens d un mot", () => {
  const html = renderToStaticMarkup(
    <EntityCard
      item={{ id: "jlpt:word/影響", mot: "影響", lecture: "えいきょう", sens: "influence" }}
      state="en-cours"
    />,
  );
  expect(html).toContain("えいきょう");
  expect(html).toContain("influence");
});

test("la variante compacte n affiche pas les exemples", () => {
  const item: CoursItem = {
    id: "jlpt:gram/ば", form: "〜ば",
    examples: [{ jp: "安ければ買います。", ro: "yasukereba", fr: "Si c est bon marche" }],
  };
  const carte = renderToStaticMarkup(<EntityCard item={item} state="neuf" />);
  const compacte = renderToStaticMarkup(<EntityCard item={item} state="neuf" variant="compacte" />);
  expect(carte).toContain("yasukereba");
  expect(compacte).not.toContain("yasukereba");
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/EntityCard.test.tsx
```

Attendu : ÉCHEC — `Cannot find module './EntityCard.tsx'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/features/cours/EntityCard.tsx` :

```tsx
/**
 * Rendu UNIQUE d'une entité du référentiel — point de grammaire, mot ou kanji.
 *
 * Quatre sites rendaient une entité chacun à sa façon : `GramPoint` / `VocabRow` / `KanjiRow`
 * (l'ancien `GroupDetail`) et `RappelCard` (le corrigé du quiz). Un seul composant désormais,
 * deux variantes : `carte` (le paquet, l'apprentissage) et `compacte` (le corrigé, sans
 * exemples dépliés).
 *
 * ⚠ `legende` par défaut à `false` : la clé des couleurs de `SentenceAnalysis` était réémise à
 * CHAQUE exemple, ce qui est la répétition la plus coûteuse en hauteur du rendu d'origine. Le
 * paquet l'affiche une fois, en pied.
 */
import type {
  CoursExample, CoursItem, GramItem, KanjiItem, VocabItem,
} from "./coursSchema.ts";
import type { EntityState } from "./entityState.ts";
import { SpeakButton } from "./SpeakButton.tsx";
import { SentenceAnalysis } from "../../ui/SentenceAnalysis.tsx";
import { kanjiExempleJa } from "./coursSpeech.ts";
import { furi } from "../../lib/dict.ts";

export type ItemKind = "gram" | "kanji" | "vocab";

/** Découpe une structure grammaticale sur les « ／ » de premier niveau (hors parenthèses)
 *  pour afficher chaque construction alternative sur sa propre ligne. Les « ／ » à
 *  l'intérieur de （…） restent intacts (ex. « （口語：〜ちゃう／〜じゃう） »). */
export function splitStruct(struct: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of struct) {
    if (ch === "（" || ch === "(") depth++;
    else if (ch === "）" || ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "／" && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts.filter((p) => p.length > 0);
}

/**
 * La nature d'un item, lue sur ses CHAMPS et non sur la piste qui le range.
 *
 * ⚠ Un motif grammatical rangé dans le cours de vocabulaire (« なかなか〜ない ») porte à la fois
 * `form` et `mot` — `coursFromGraph.ts` lui ajoute les champs de la vue vocabulaire. `form`
 * doit donc gagner, sinon la carte affiche une lecture vide.
 */
export function itemKind(it: CoursItem): ItemKind {
  if ("form" in it && typeof it.form === "string" && it.form.length > 0) return "gram";
  if ("kanji" in it) return "kanji";
  return "vocab";
}

export const STATE_MARK: Record<EntityState, string> = {
  neuf: "○", "en-cours": "◐", "a-revoir": "◑", acquis: "●",
};

export const STATE_TITRE: Record<EntityState, string> = {
  neuf: "jamais rencontré",
  "en-cours": "vu, pas encore consolidé",
  "a-revoir": "à revoir",
  acquis: "acquis",
};

const STATE_COULEUR: Record<EntityState, string> = {
  neuf: "text-fg-muted",
  "en-cours": "text-accent",
  "a-revoir": "text-status-failed",
  acquis: "text-status-completed",
};

function Badge({ state }: { state: EntityState }) {
  return (
    <span
      className={`shrink-0 text-lg ${STATE_COULEUR[state]}`}
      title={STATE_TITRE[state]}
      aria-label={`état : ${STATE_TITRE[state]}`}
    >
      {STATE_MARK[state]}
    </span>
  );
}

function Exemple({ ex, legende }: { ex: CoursExample; legende: boolean }) {
  return (
    <div className="bg-surface-2 border border-line rounded-lg p-3 text-sm flex flex-col gap-0.5">
      <div className="flex items-start gap-2">
        <div
          className="text-fg text-xl flex-1 min-w-0"
          dangerouslySetInnerHTML={{ __html: furi(ex.jp) }}
        />
        <SpeakButton text={ex.jp} />
      </div>
      <div className="text-fg-muted text-meta">{ex.ro}</div>
      <div className="text-fg-dim">{ex.fr}</div>
      {ex.an && ex.an.length > 0 && (
        <SentenceAnalysis source={ex.an.join(" · ")} legend={legende} />
      )}
    </div>
  );
}

export function EntityCard({
  item, state, variant = "carte", legende = false,
}: {
  item: CoursItem;
  state: EntityState;
  variant?: "carte" | "compacte";
  legende?: boolean;
}) {
  const kind = itemKind(item);
  const complet = variant === "carte";

  if (kind === "gram") {
    const it = item as GramItem;
    return (
      <div data-cours-item={it.id} data-kind="gram" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge state={state} />
          <span className="text-fg text-2xl font-bold">{it.form}</span>
          {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
        </div>
        {it.struct && (
          <div className="text-fg-muted text-base font-mono flex flex-col">
            {splitStruct(it.struct).map((line, i) => <span key={i}>{line}</span>)}
          </div>
        )}
        {it.mean && <div className="text-fg-dim text-sm">{it.mean}</div>}
        {complet && it.examples?.map((ex, i) => (
          <Exemple key={i} ex={ex} legende={legende && i === 0} />
        ))}
      </div>
    );
  }

  if (kind === "kanji") {
    const it = item as KanjiItem;
    return (
      <div data-cours-item={it.id} data-kind="kanji" className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Badge state={state} />
          <span className="text-fg text-5xl font-light">{it.kanji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-fg-muted text-base">{it.lecture}</div>
            <div className="text-fg-dim text-sm">{it.sens}</div>
          </div>
        </div>
        {complet && it.exemple && (
          <div className="flex items-center gap-2">
            <div
              className="text-fg text-xl flex-1 min-w-0"
              dangerouslySetInnerHTML={{ __html: furi(it.exemple) }}
            />
            <SpeakButton text={kanjiExempleJa(it.exemple)} />
          </div>
        )}
      </div>
    );
  }

  const it = item as VocabItem;
  return (
    <div data-cours-item={it.id} data-kind="vocab" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Badge state={state} />
        <div className="flex-1 min-w-0">
          <span
            className="text-fg text-2xl"
            dangerouslySetInnerHTML={{ __html: furi(it.mot) }}
          />
          <span className="text-fg-muted text-base ml-2">{it.lecture}</span>
          <div className="text-fg-dim text-sm">{it.sens}</div>
        </div>
        {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
        {complet && <SpeakButton text={it.mot} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/EntityCard.test.tsx
```

Attendu : 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-apprendre-avant-quiz
git add src/features/cours/EntityCard.tsx src/features/cours/EntityCard.test.tsx
git commit -m "feat(cours): EntityCard, rendu unique d une entite du referentiel"
```

---

## Task 5 : `Deck`, le paquet plein écran

**Files:**
- Create: `src/features/cours/Deck.tsx`
- Test: `src/features/cours/Deck.test.tsx`

**Interfaces:**
- Consumes: `EntityCard` (Task 4) ; `EntityState` (Task 1) ; `Breadcrumb`, `quizResumeHref`
  (`./`) ; `H2_TIGHT`, `BTN_GHOST` (`../../ui/styles.ts`) ; `useSearchParams` (react-router-dom).
- Produces:
  - `function initialIndex(items: CoursItem[], focus: string | null, estAcquis: (iri: string) => boolean): number`
  - `function Deck(props: { category: LearnCategory; group: CoursGroup; stateOf: (iri: string) => EntityState; onKnown: (iri: string) => void }): JSX.Element`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/cours/Deck.test.tsx` :

```tsx
import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Deck, initialIndex } from "./Deck.tsx";
import type { CoursGroup, CoursItem, LearnCategory } from "./coursSchema.ts";
import type { EntityState } from "./entityState.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const items: CoursItem[] = [
  { id: "jlpt:gram/ば", form: "〜ば" },
  { id: "jlpt:gram/たら", form: "〜たら" },
  { id: "jlpt:gram/なら", form: "〜なら" },
];
const group: CoursGroup = { id: "g2", title: "Conditionnels", items };
const category: LearnCategory = {
  id: "gram", title: "文法 — Grammaire", kind: "learn", groups: [group],
};

test("initialIndex ouvre sur la premiere carte non acquise", () => {
  const acquis = (iri: string) => iri === "jlpt:gram/ば";
  expect(initialIndex(items, null, acquis)).toBe(1);
});

test("initialIndex ouvre sur zero quand tout est acquis", () => {
  expect(initialIndex(items, null, () => true)).toBe(0);
});

test("initialIndex positionne sur le focus, meme acquis", () => {
  expect(initialIndex(items, "jlpt:gram/なら", () => true)).toBe(2);
});

test("initialIndex ignore un focus inconnu", () => {
  expect(initialIndex(items, "jlpt:gram/inexistant", () => false)).toBe(0);
});

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  root = null; host = null;
});

async function monter(search: string, stateOf: (iri: string) => EntityState) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[`/cours/gram/g2${search}`]}>
        <Deck category={category} group={group} stateOf={stateOf} onKnown={() => {}} />
      </MemoryRouter>,
    );
  });
  return host!;
}

test("le paquet montre UNE carte a la fois", async () => {
  const el = await monter("", () => "neuf");
  expect(el.querySelectorAll("[data-cours-item]").length).toBe(1);
  expect(el.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/ば");
});

test("focus positionne le paquet sur la carte visee", async () => {
  const el = await monter("?focus=jlpt%3Agram%2F%E3%81%AA%E3%82%89", () => "neuf");
  expect(el.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/なら");
});

test("la fleche droite avance d une carte", async () => {
  const el = await monter("", () => "neuf");
  await act(async () => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  });
  expect(el.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/たら");
});

test("la fleche gauche ne depasse pas la premiere carte", async () => {
  const el = await monter("", () => "neuf");
  await act(async () => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  });
  expect(el.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/ば");
});

test("from=quiz affiche le lien de retour au corrige", async () => {
  const el = await monter("?from=quiz", () => "neuf");
  expect(el.textContent).toContain("Revenir à la question");
});

test("sans from=quiz il n y a pas de lien de retour", async () => {
  const el = await monter("", () => "neuf");
  expect(el.textContent).not.toContain("Revenir à la question");
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/Deck.test.tsx
```

Attendu : ÉCHEC — `Cannot find module './Deck.tsx'`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `src/features/cours/Deck.tsx` :

```tsx
/**
 * Niveau 2 du cours : un PAQUET de cartes, une entité par écran, zéro défilement de liste.
 *
 * L'écran précédent (`GroupDetail`) dépliait tout : jusqu'à 26 points de grammaire et 47 mots,
 * soit plusieurs milliers de pixels sans pliage, sans ancre et sans filtre. Le paquet supprime
 * le problème au lieu de le replier.
 *
 * ⚠ Sans `?focus=`, le paquet s'ouvre sur la PREMIÈRE carte non acquise. C'est ce qui rend un
 * thème de 47 mots praticable sans introduire de filtre : la traversée démarre là où le travail
 * reste, et raccourcit d'elle-même à mesure que l'état dérivé progresse.
 *
 * `?focus=<iri>` POSITIONNE le paquet (là où l'ancien écran faisait défiler) : les voisins
 * — 〜たら / 〜ば / 〜なら — sont alors à une touche, contre 800 px auparavant.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { CoursGroup, CoursItem, LearnCategory } from "./coursSchema.ts";
import type { EntityState } from "./entityState.ts";
import { EntityCard } from "./EntityCard.tsx";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { quizResumeHref } from "./coursDeepLink.ts";
import { H2_TIGHT, BTN_GHOST, PANEL } from "../../ui/styles.ts";

/** Carte d'ouverture : le `focus` demandé s'il existe, sinon la première non acquise, sinon 0. */
export function initialIndex(
  items: CoursItem[], focus: string | null, estAcquis: (iri: string) => boolean,
): number {
  if (focus) {
    const k = items.findIndex((it) => it.id === focus);
    if (k >= 0) return k;
  }
  const k = items.findIndex((it) => !estAcquis(it.id));
  return k >= 0 ? k : 0;
}

const POINT: Record<EntityState, string> = {
  neuf: "bg-line",
  "en-cours": "bg-accent/50",
  "a-revoir": "bg-status-failed",
  acquis: "bg-status-completed",
};

export function Deck({ category, group, stateOf, onKnown }: {
  category: LearnCategory;
  group: CoursGroup;
  stateOf: (iri: string) => EntityState;
  onKnown: (iri: string) => void;
}) {
  const [params] = useSearchParams();
  const focus = params.get("focus");
  const fromQuiz = params.get("from") === "quiz";
  const items = group.items;

  const [i, setI] = useState(() =>
    initialIndex(items, focus, (iri) => stateOf(iri) === "acquis"));

  // Le groupe change (navigation interne) → on rouvre le paquet à sa carte d'entrée.
  // ⚠ `stateOf` est DÉLIBÉRÉMENT absent des dépendances : il change à chaque `markKnown`, et
  // l'inclure repositionnerait le paquet à chaque clic sur « Je connais déjà » — on veut ne
  // rouvrir la carte d'entrée qu'au changement de groupe ou de focus. (Le projet n'a pas de
  // linter : cette omission se documente ici, elle ne se désactive nulle part.)
  useEffect(() => {
    setI(initialIndex(items, focus, (iri) => stateOf(iri) === "acquis"));
  }, [group.id, focus]);

  const bouge = useCallback((d: number) => {
    setI((cur) => Math.min(items.length - 1, Math.max(0, cur + d)));
  }, [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") bouge(1);
      else if (e.key === "ArrowLeft") bouge(-1);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [bouge]);

  const item = items[i];
  if (!item) return <p className="text-fg-dim text-sm">Thème vide.</p>;
  const etat = stateOf(item.id);

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        crumbs={[
          { label: "Cours", to: "/cours" },
          { label: category.title.split(" ")[0], to: `/cours/${category.id}` },
          { label: group.title },
        ]}
      />
      {fromQuiz && (
        <a
          href={quizResumeHref}
          className="self-start inline-flex items-center gap-1 text-accent text-sm font-bold no-underline"
        >
          <span aria-hidden="true">←</span> Revenir à la question
        </a>
      )}
      <h2 className={H2_TIGHT}>{group.title}</h2>

      <div className="flex gap-1" aria-hidden="true">
        {items.map((it, k) => (
          <span
            key={it.id}
            className={`h-1 flex-1 rounded-full ${POINT[stateOf(it.id)]} ${k === i ? "ring-1 ring-accent" : ""}`}
          />
        ))}
      </div>

      <div className={PANEL}>
        <EntityCard item={item} state={etat} legende />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button" onClick={() => bouge(-1)} disabled={i === 0}
          className={`${BTN_GHOST} disabled:opacity-40`} aria-label="carte précédente"
        >
          ‹
        </button>
        <span className="text-fg-muted text-meta flex-1 text-center">
          {i + 1} / {items.length}
        </span>
        <button
          type="button" onClick={() => bouge(1)} disabled={i === items.length - 1}
          className={`${BTN_GHOST} disabled:opacity-40`} aria-label="carte suivante"
        >
          ›
        </button>
      </div>

      {etat === "neuf" && (
        <button
          type="button"
          onClick={() => { onKnown(item.id); bouge(1); }}
          className={`w-full ${BTN_GHOST}`}
        >
          Je connais déjà — le mettre en révision
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/Deck.test.tsx
```

Attendu : 10 tests PASS.

- [ ] **Step 5: Vérifier que les utilités Tailwind neuves sont bien COMPILÉES**

⚠ Le Tailwind du projet est **vendorisé, donc un sous-ensemble** : une utilité absente ne
produit aucune erreur — ni au test, ni au typecheck, ni au build. Seul le CSS généré fait foi.

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun run css
for c in "bg-status-failed" "bg-status-completed" "bg-line" "bg-accent\\\\/50" "ring-1" "opacity-40"; do
  printf "%-22s %s\n" "$c" "$(grep -c -- "$c" src/styles/styles.gen.css)"
done
```

Attendu : **chaque ligne ≥ 1**. Une ligne à `0` = la classe n'existe pas dans le sous-ensemble
vendorisé → la définir dans `src/styles/tailwind.css` `@layer base` (cf. `.jlpt-spin`,
`.vbreak`), **ne pas** se contenter du token `@theme` (`--color-status-failed` existe déjà et ne
suffit pas à créer l'utilité).

- [ ] **Step 6: Commit**

```bash
cd .worktrees/feat-apprendre-avant-quiz
git add src/features/cours/Deck.tsx src/features/cours/Deck.test.tsx
git commit -m "feat(cours): paquet de cartes plein ecran, ouverture sur la premiere non acquise"
```

---

## Task 6 : la bascule — router le paquet, dériver les compteurs, supprimer l'ancien

**Files:**
- Modify: `src/features/cours/Cours.tsx`
- Modify: `src/features/cours/CategoryIndex.tsx`
- Modify: `src/features/cours/CoursHub.tsx`
- Delete: `src/features/cours/GroupDetail.tsx`, `src/features/cours/GroupDetail.test.tsx`
- Delete: `src/features/cours/useCoursProgress.ts`, `src/features/cours/useCoursProgress.test.tsx`
- Test: `src/features/cours/cours.test.tsx` (mise à jour), `src/features/cours/CoursNav.test.tsx` (vérifier)

**Interfaces:**
- Consumes: `useEntityStates` (Task 3), `Deck` (Task 5), `groupStates` / `categoryStates` (Task 1).
- Produces: aucune API nouvelle. C'est la task de **bascule** : elle rebranche les appelants
  ET retire l'ancien code dans le même commit, pour que le typecheck reste vert à chaque commit.

- [ ] **Step 1: Supprimer l'ancien écran et l'ancien hook**

```bash
cd .worktrees/feat-apprendre-avant-quiz
git rm src/features/cours/GroupDetail.tsx src/features/cours/GroupDetail.test.tsx \
       src/features/cours/useCoursProgress.ts src/features/cours/useCoursProgress.test.tsx
```

- [ ] **Step 2: Retirer les fonctions de cochage devenues mortes**

Dans `src/features/cours/coursProgress.ts`, supprimer `cycleState`, `setItemState`,
`saveCoursProgress`, `groupProgress`, `categoryProgress` et `interface GroupStats` — remplacées
par `entityState.ts`. Ne garder que `type ItemState`, `type CoursProgress`,
`loadCoursProgress` et `migrateCoursProgress`, et mettre à jour la doc de tête du module :

```ts
/**
 * Vestige de la progression de cours manuelle : lecture seule + migration vers la mémoire.
 *
 * L'état d'un item n'est plus stocké, il se dérive (`entityState.ts`). Ce module ne sert plus
 * qu'à verser une fois l'ancien cochage dans la carte FSRS. ⚠ `COURS_KEY` n'est PAS supprimée :
 * elle reste la preuve du travail manuel déjà fait et permet de rejouer la migration si elle
 * est perdue. Elle n'est simplement plus jamais écrite.
 */
```

Retirer de `src/features/cours/coursProgress.test.ts` les cas qui portaient sur ces fonctions
(`groupProgress`, `categoryProgress`, `cycleState`, `setItemState`, `saveCoursProgress`) — leur
sujet n'existe plus. Les cas de `migrateCoursProgress` et `loadCoursProgress` restent.

- [ ] **Step 3: Rebrancher `Cours.tsx` sur `useEntityStates` + `Deck`**

Remplacer **tout** le contenu de `src/features/cours/Cours.tsx` par :

```tsx
/** Route /cours/* : master-detail à 3 niveaux. Charge le contenu une fois, dérive l'état des
 *  entités depuis le modèle de mémoire, rend un <Routes> interne (hub → index de catégorie →
 *  paquet de cartes). */
import { Routes, Route, useParams } from "react-router-dom";
import { useCours } from "./useCours.ts";
import { useEntityStates, type EntityStates } from "./useEntityStates.ts";
import { CoursHub } from "./CoursHub.tsx";
import { CategoryIndex } from "./CategoryIndex.tsx";
import { Deck } from "./Deck.tsx";
import { MethodPage } from "./MethodPage.tsx";
import type { CoursCategory } from "./coursSchema.ts";

function NotFound() { return <p className="text-fg-dim text-sm">Thème introuvable.</p>; }

function CategoryRoute(
  { categories, etats }: { categories: CoursCategory[]; etats: EntityStates },
) {
  const { cat } = useParams();
  const category = categories.find((c) => c.id === cat);
  if (!category) return <NotFound />;
  if (category.kind === "method") return <MethodPage category={category} />;
  return <CategoryIndex category={category} etats={etats} />;
}

function GroupRoute(
  { categories, etats }: { categories: CoursCategory[]; etats: EntityStates },
) {
  const { cat, group } = useParams();
  const category = categories.find((c) => c.id === cat);
  if (!category || category.kind !== "learn") return <NotFound />;
  const g = category.groups.find((x) => x.id === group);
  if (!g) return <NotFound />;
  return (
    <Deck
      category={category} group={g}
      stateOf={etats.stateOf} onKnown={etats.markKnown}
    />
  );
}

export function Cours() {
  const categories = useCours();
  const etats = useEntityStates();
  if (!categories) return <p className="text-fg-dim text-sm">Chargement du cours…</p>;
  if (!categories.length) {
    return <p className="text-fg-dim text-sm">Cours indisponible (hors ligne ?).</p>;
  }
  return (
    <Routes>
      <Route index element={<CoursHub categories={categories} etats={etats} />} />
      <Route path=":cat" element={<CategoryRoute categories={categories} etats={etats} />} />
      <Route path=":cat/:group" element={<GroupRoute categories={categories} etats={etats} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Dériver les compteurs de `CategoryIndex`**

Remplacer **tout** le contenu de `src/features/cours/CategoryIndex.tsx` par :

```tsx
import type { LearnCategory } from "./coursSchema.ts";
import { groupStates } from "./entityState.ts";
import type { EntityStates } from "./useEntityStates.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { TILE } from "../../ui/styles.ts";

/** Niveau 1 : les thèmes d'une catégorie, en cartes, avec un ratio DÉRIVÉ du modèle de mémoire
 *  (plus aucun cochage manuel — cf. entityState.ts). */
export function CategoryIndex({
  category, etats,
}: {
  category: LearnCategory;
  etats: EntityStates;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        crumbs={[{ label: "Cours", to: "/cours" }, { label: category.title.split(" ")[0] }]}
      />
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {category.groups.map((g) => {
          const s = groupStates(g, etats.fsrs, etats.today);
          return (
            <a
              key={g.id}
              href={`#/cours/${category.id}/${g.id}`}
              className={`${TILE} flex flex-col gap-1 no-underline`}
            >
              <span className="text-fg font-semibold text-sm">{g.title}</span>
              {g.subtitle && <span className="text-fg-dim text-meta">{g.subtitle}</span>}
              <span className="text-fg-muted text-meta mt-1">
                {s.acquis}/{s.total} acquis
                {s.aRevoir > 0 ? ` · ${s.aRevoir} à revoir` : ""}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Dériver les compteurs de `CoursHub`**

Dans `src/features/cours/CoursHub.tsx`, remplacer l'import et la signature :

```tsx
import type { CoursCategory } from "./coursSchema.ts";
import { categoryStates } from "./entityState.ts";
import type { EntityStates } from "./useEntityStates.ts";
import { TILE, H2_ACCENT } from "../../ui/styles.ts";

/** Niveau 0 : cartes de catégories (learn = ratio dérivé ; method = page conseils). */
export function CoursHub({
  categories, etats,
}: {
  categories: CoursCategory[];
  etats: EntityStates;
}) {
```

puis, dans le `map`, remplacer le calcul et l'affichage :

```tsx
          const s = c.kind === "learn" ? categoryStates(c, etats.fsrs, etats.today) : null;
```

```tsx
              <span className="text-fg-muted text-meta">
                {s
                  ? `${s.acquis}/${s.total} acquis${s.aRevoir > 0 ? ` · ${s.aRevoir} à revoir` : ""}`
                  : "Conseils d'examen"}
              </span>
```

- [ ] **Step 6: Mettre à jour les tests de navigation existants**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/cours/
```

`cours.test.tsx` et `CoursNav.test.tsx` passent `progress={...}` / `onToggle` à `CoursHub` /
`CategoryIndex`. Remplacer par un `etats` factice :

```tsx
const etats = {
  fsrs: {}, today: 0,
  stateOf: () => "neuf" as const,
  markKnown: () => {},
};
```

et adapter les assertions de compteur (`0/3 appris` → `0/3 acquis`).

- [ ] **Step 7: Typecheck + suite complète**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun run typecheck && bun test
```

Attendu : typecheck **vert** et toute la suite au vert, y compris `cadence.test.ts`,
`rappel.reel.test.ts` et `shapes.test.ts` (aucune question ajoutée).

- [ ] **Step 8: Commit**

```bash
cd .worktrees/feat-apprendre-avant-quiz
git add -A src/features/cours
git commit -m "feat(cours): le paquet remplace l ecran deroulant, compteurs derives"
```

---

## Task 7 : le rappel du corrigé rend `EntityCard`

**Files:**
- Modify: `src/features/quiz/Corrige.tsx` (fonction `RappelCard`, lignes ~95-125)
- Create: `src/features/quiz/rappelItem.ts`
- Test: `src/features/quiz/rappelItem.test.ts`
- Test: `src/features/quiz/Corrige.test.tsx` (vérifier que les assertions existantes tiennent)

**Interfaces:**
- Consumes: `Rappel` (`./rappel.ts`) ; `CoursItem` (`../cours/coursSchema.ts`) ; `EntityCard`
  (Task 4) ; `EntityState` (Task 1).
- Produces: `function itemFromRappel(r: Rappel): CoursItem`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/features/quiz/rappelItem.test.ts` :

```ts
import { test, expect } from "bun:test";
import { itemFromRappel } from "./rappelItem.ts";
import { itemKind } from "../cours/EntityCard.tsx";
import type { Rappel } from "./rappel.ts";

const base: Omit<Rappel, "kind"> = {
  iri: "x", titre: "t", lecture: "l", sens: "s", niv: "N3", group: "g1", coursCat: "gram",
};

test("itemFromRappel rend un item de grammaire pour kind gram", () => {
  const it = itemFromRappel({ ...base, kind: "gram", titre: "〜ば" });
  expect(itemKind(it)).toBe("gram");
  expect(it.id).toBe("x");
});

test("itemFromRappel rend un item de kanji pour kind kanji", () => {
  const it = itemFromRappel({ ...base, kind: "kanji", titre: "位" });
  expect(itemKind(it)).toBe("kanji");
});

test("itemFromRappel rend un item de vocabulaire pour kind word", () => {
  const it = itemFromRappel({ ...base, kind: "word", titre: "影響" });
  expect(itemKind(it)).toBe("vocab");
});

test("itemFromRappel reporte l exemple d un point de grammaire", () => {
  const it = itemFromRappel({
    ...base, kind: "gram", titre: "〜ば",
    exemple: { jp: "安ければ買います。", fr: "Si c est bon marche" },
  });
  expect((it as { examples?: unknown[] }).examples).toHaveLength(1);
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/quiz/rappelItem.test.ts
```

Attendu : ÉCHEC — `Cannot find module './rappelItem.ts'`.

- [ ] **Step 3: Écrire l'adaptateur**

Créer `src/features/quiz/rappelItem.ts` :

```ts
/**
 * Adapte un `Rappel` (résolu par l'arête `tests` d'une question) vers le `CoursItem` qu'attend
 * `EntityCard`. Pur.
 *
 * Les deux types décrivent la même entité vue de deux côtés : `rappel.ts` la projette pour le
 * corrigé, `coursFromGraph.ts` pour le cours. Cet adaptateur est ce qui permet au corrigé de
 * rendre EXACTEMENT la carte que l'apprenant reverra dans le paquet — une seule apparence pour
 * une même notion.
 */
import type { Rappel } from "./rappel.ts";
import type { CoursItem } from "../cours/coursSchema.ts";

export function itemFromRappel(r: Rappel): CoursItem {
  if (r.kind === "gram") {
    return {
      id: r.iri,
      form: r.titre,
      ...(r.sens ? { mean: r.sens } : {}),
      ...(r.niv ? { niv: r.niv } : {}),
      ...(r.exemple ? { examples: [{ jp: r.exemple.jp, ro: "", fr: r.exemple.fr }] } : {}),
    };
  }
  if (r.kind === "kanji") {
    return { id: r.iri, kanji: r.titre, lecture: r.lecture, sens: r.sens };
  }
  return {
    id: r.iri, mot: r.titre, lecture: r.lecture, sens: r.sens,
    ...(r.niv ? { niv: r.niv } : {}),
  };
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/quiz/rappelItem.test.ts
```

Attendu : 4 tests PASS.

- [ ] **Step 5: Brancher `RappelCard` sur `EntityCard`**

Dans `src/features/quiz/Corrige.tsx`, ajouter les imports :

```tsx
import { EntityCard } from "../cours/EntityCard.tsx";
import { itemFromRappel } from "./rappelItem.ts";
```

puis remplacer **tout le corps** de `RappelCard` (le `return (…)`, en gardant la doc et le
calcul de `href` / `LIBELLE`) par :

```tsx
  return (
    <div className="mt-3 pt-3 border-t border-line">
      <p className="text-accent text-sm font-bold mb-1">Rappel</p>
      <EntityCard item={itemFromRappel(rappel)} state="a-revoir" variant="compacte" />
      {href && (
        <a href={href} className="text-accent text-sm whitespace-nowrap">
          {LIBELLE[rappel.kind]} →
        </a>
      )}
    </div>
  );
```

> ⚠ `state="a-revoir"` est délibéré et non dérivé : on est dans le corrigé d'une question qui
> vient d'être posée sur cette entité — elle est, par construction, en cours de révision. Faire
> remonter l'état réel jusqu'ici exigerait de passer la `FsrsMap` à travers `EntrainementApp`,
> ce qui n'apporte rien au corrigé.

- [ ] **Step 6: Vérifier les tests du corrigé**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test src/features/quiz/Corrige.test.tsx
```

Si une assertion portait sur la mise en forme inline de l'ancien `RappelCard` (lecture accolée
au titre), l'adapter à la structure d'`EntityCard` — **sans** asserter un kanji rendu par
`furi()` en sous-chaîne brute.

- [ ] **Step 7: Suite complète + typecheck**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun test && bun run typecheck
```

Attendu : tout vert.

- [ ] **Step 8: Vérification navigateur (obligatoire — aucun test ne couvre le rendu réel)**

```bash
cd .worktrees/feat-apprendre-avant-quiz && bun run build && bunx serve _site
```

Vérifier à la main, sur `#/cours/gram/g2` :
1. une seule carte à l'écran, pas de défilement de liste ;
2. ←/→ changent de carte, la barre de progression suit ;
3. « Je connais déjà » fait passer la pastille de ○ à ◐ **et** avance d'une carte ;
4. après rechargement, l'état ◐ persiste (il vient bien du blob, pas d'un état React) ;
5. depuis un corrigé de quiz, « voir le point de grammaire → » ouvre le paquet **sur la bonne
   carte**, et « ← Revenir à la question » ramène au corrigé quitté.

⚠ Le chargement à froid des shards prend ~8 s : attendre avant de conclure « ça ne marche pas ».

- [ ] **Step 9: Commit**

```bash
cd .worktrees/feat-apprendre-avant-quiz
git add src/features/quiz/rappelItem.ts src/features/quiz/rappelItem.test.ts \
        src/features/quiz/Corrige.tsx src/features/quiz/Corrige.test.tsx
git commit -m "feat(quiz): le rappel du corrige rend la meme carte que le cours"
```

---

## Self-Review

**Couverture de la spec (lot 1) :**

| Exigence | Task |
|---|---|
| §3 — quatre états dérivés, seuil `STABILITE_ACQUISE` mesuré | 1 |
| §3 — `groupStates` / `categoryStates`, `GroupStats` change de forme | 1, 6 |
| §3 — régression « `isDue` seul ne suffit pas » | 1 (test dédié) |
| §3.1 — « Je connais déjà » → `fsrsInit(3)` | 3 (hook), 5 (bouton) |
| §3.1 — variante `Je connais` / `À revoir` (`grade` 1 ou 3) | 3 (`markKnown(iri, grade)`) — **le bouton « À revoir » n'est pas exposé au lot 1** : il n'a de sens que sur une carte sans ancre (§5.3, lot 2). L'API du hook l'accepte déjà. |
| §3.2 — migration idempotente, `COURS_MIGRE_KEY`, `COURS_KEY` conservée | 2, 3 |
| §3.2 — suppression de `cycleState` / `setItemState` / `saveCoursProgress` | 2 |
| §4.1 — `EntityCard`, 4 usages, `splitStruct` migré, légende une seule fois | 4, 5, 7 |
| §4.2 — `Deck`, ←/→, `?focus=` positionne, `?from=quiz`, ouverture sur première non acquise | 5 |
| §4.2 — `GroupDetail` supprimé, cas de test portés | 6 |
| §4.2 — `CategoryIndex` reste la carte du territoire, compteurs dérivés | 6 |

**Cohérence des types** — vérifiée : `EntityState` (Task 1) est consommé tel quel par
`EntityCard` (4), `Deck` (5), `useEntityStates` (3) et `Corrige` (7). `EntityStates` (Task 3)
est l'unique forme passée à `CoursHub` / `CategoryIndex` / `GroupRoute` (Task 6). `FsrsMap` est
partout importé depuis `features/quiz/revision.ts`.

**Écarts assumés, signalés ici plutôt que découverts en cours de route :**

1. **Le typecheck reste vert à chaque commit.** La Task 2 est purement additive ; la suppression
   des fonctions de cochage se fait à la Task 6, dans le même commit que le rebranchement de
   leurs appelants. (Une première rédaction de ce plan faisait volontairement rougir le
   typecheck entre les Tasks 2 et 6 — corrigé avant exécution : un commit qui ne compile pas
   n'est pas bissectable, et le CI du projet lance `typecheck` sur chaque push.)
2. **Le 4e usage d'`EntityCard`** annoncé en §4.1 de la spec (« carte d'entité en révision »)
   n'existe pas encore — il naît avec la phase d'apprentissage du lot 2. Trois usages sur quatre
   au terme de ce lot.
3. **`Deck` ne gère pas le balayage tactile** (swipe). Boutons + clavier seulement. Un `swipe`
   est un ajout indépendant, testable à part, et son absence ne bloque aucun usage.
