# Confusion lot 2 — pilotage de la sélection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une tranche « confusion » à la composition de session qui reserre des questions exerçant les types de pièges que l'apprenant confond encore, pilotée par le graphe de confusion déjà collecté.

**Architecture:** Nouvel ingrédient dans le moteur de plan (`sessionPlan.ts`), suivant le patron exact des tranches errors/revision/learn (cap + compteur d'état + sélecteur pur + réconciliation `composeSession`) ; deux fonctions pures dans `traps.ts` (proxy de comptage + sélecteur) ; câblage dans `useQuiz.start()`.

**Tech Stack:** React + TypeScript, bundlé par Bun ; tests `bun test` (couches pures uniquement).

## Global Constraints

- **Runtime & outils : `bun` exclusivement**, jamais `node`. Tests : `bun test <fichier>`.
- Tests côte à côte ; couches pures = là où vivent les tests (toute règle nouvelle y va).
- **Ordre de priorité des tranches : errors → confusion → revision → learn → adaptive.** Chaque tranche bornée par son cap ET le budget restant.
- `CONFUSION_CAP = 0.25`. Caps existants inchangés : `ERRORS_CAP=0.3`, `REVISION_CAP=0.4`, `LEARN_CAP=0.4`.
- **Graceful zero** : aucune confusion active ⇒ tranche = 0 ⇒ session identique à aujourd'hui.
- Une question **exerce** un type K ssi `K ∈ q.trap` (le type de piège de chaque option ; `""` à l'index de la réponse, jamais un type actif).
- Fenêtre de sélection = fenêtre d'affichage : **30 jours** (défaut de `trapModel`).
- La tranche confusion ne dédouble jamais errors/revision/learn (ajout à `exclude`).
- Aucune écriture `data/graph/`, aucun asset livré → **pas de bump `sw.js`**.
- Pas de linter ; `bun run typecheck` + `bun test` font foi.

---

### Task 1: Fonctions pures `activeConfusionCount` + `selectConfusion` (`traps.ts`)

**Files:**
- Modify: `src/features/quiz/traps.ts` (ajout de deux fonctions exportées, après `trapModel`)
- Test: `src/features/quiz/traps.test.ts` (ajout à l'import + nouveaux tests)

**Interfaces:**
- Consumes: types déjà dans `traps.ts` — `Confusion` (`[ord, choix, jour]`), `TrapCount` (`{ kind: string; recent: number }`), `Question` (`{ id, trap?: string[], ... }`).
- Produces:
  - `activeConfusionCount(confusions: Confusion[], today: number, windowDays?: number): number`
  - `selectConfusion(active: TrapCount[], pool: Question[], exclude: Set<number>, n: number, rng?: () => number): Question[]`

- [ ] **Step 1: Write the failing tests**

Dans `src/features/quiz/traps.test.ts`, ajouter à la ligne d'import les deux nouveaux noms :

```ts
import { dayNumber, kindIndex, trapModel, KIND_LABELS, CONF_MAX, asConfusions, appendConfusion, confusionPatch, activeConfusionCount, selectConfusion } from "./traps.ts";
```

Puis ajouter, à la fin du fichier (le helper `q(id, trap)` existe déjà en tête : `({ id, cat: "vocabulaire", d: 1, q: "?", o: ["a","b","c","d"], a: 2, trap })`) :

```ts
test("activeConfusionCount : compte les événements dans la fenêtre, ignore les vieux", () => {
  // [ord, choix, jour] ; today=100, fenêtre 30 → garde jour>70
  const conf: [number, number, number][] = [[1, 0, 90], [2, 1, 80], [3, 0, 50], [4, 2, 100]];
  expect(activeConfusionCount(conf, 100, 30)).toBe(3); // 90,80,100 dedans ; 50 dehors
  expect(activeConfusionCount([], 100, 30)).toBe(0);
});

test("selectConfusion : pioche les questions exerçant un type actif, plus fréquent d'abord", () => {
  const active = [{ kind: "homophone", recent: 5 }, { kind: "kanji-partage", recent: 2 }];
  const pool = [
    q(10, ["", "kanji-partage", "", ""]),          // exerce kanji-partage (poids 2)
    q(11, ["homophone", "", "", ""]),              // exerce homophone (poids 5)
    q(12, ["", "", "", ""]),                       // n'exerce aucun type actif
    q(13, ["sens-different", "", "", ""]),         // type non actif
  ];
  const out = selectConfusion(active, pool, new Set(), 5, () => 0);
  expect(out.map((x) => x.id)).toEqual([11, 10]); // 11 (poids 5) avant 10 (poids 2) ; 12/13 exclus
});

test("selectConfusion : respecte exclude et le budget n", () => {
  const active = [{ kind: "homophone", recent: 3 }];
  const pool = [q(10, ["homophone", "", "", ""]), q(11, ["homophone", "", "", ""]), q(12, ["homophone", "", "", ""])];
  expect(selectConfusion(active, pool, new Set([11]), 1, () => 0).map((x) => x.id)).toEqual([10]); // exclut 11, limite à 1
});

test("selectConfusion : graceful zero (active vide ou n<=0 → [])", () => {
  const pool = [q(10, ["homophone", "", "", ""])];
  expect(selectConfusion([], pool, new Set(), 5, () => 0)).toEqual([]);
  expect(selectConfusion([{ kind: "homophone", recent: 1 }], pool, new Set(), 0, () => 0)).toEqual([]);
});

test("selectConfusion : l'index de la réponse (\"\") ne compte jamais comme un type exercé", () => {
  // a=2 → q.trap[2]="" ; mettre un type actif SEULEMENT à l'index réponse ne doit pas matcher.
  const active = [{ kind: "homophone", recent: 4 }];
  const pool = [{ id: 20, cat: "vocabulaire" as const, d: 1 as const, q: "?", o: ["a", "b", "c", "d"], a: 2, trap: ["", "", "homophone", ""] }];
  //                                                                                    ^ index 2 = réponse
  expect(selectConfusion(active, pool, new Set(), 5, () => 0)).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/features/quiz/traps.test.ts`
Expected: FAIL — `activeConfusionCount`/`selectConfusion` non exportés.

- [ ] **Step 3: Implement the two functions**

Dans `src/features/quiz/traps.ts`, ajouter à la fin du fichier (après `trapModel`) :

```ts
/** Nombre d'événements de confusion dans la fenêtre récente. Proxy de comptage pour le plan de
 *  session : ne nécessite PAS les pools (donc calculable avant leur chargement). Sur-compte
 *  (untyped/hors-périmètre inclus) mais ce n'est qu'un plafond — `selectConfusion` fait le tri
 *  fin par type et `composeSession` réconcilie tout écart. Pur. */
export function activeConfusionCount(confusions: Confusion[], today: number, windowDays = 30): number {
  let n = 0;
  for (const [, , jour] of confusions) if (today - jour < windowDays) n++;
  return n;
}

/** Questions exerçant un TYPE de piège encore actif (`kind ∈ q.trap`), pondérées par la récence
 *  du type (poids max sur les types actifs qu'elles exercent), hors `exclude`, au plus `n`.
 *  `active` = `trapModel().active`. Pur — `rng` départage à poids égal (jitter < 1, il ne peut
 *  pas renverser deux poids entiers distincts). L'index de la réponse porte `""`, jamais dans
 *  `weight` → il ne rapporte jamais de score. */
export function selectConfusion(
  active: TrapCount[],
  pool: Question[],
  exclude: Set<number>,
  n: number,
  rng: () => number = Math.random,
): Question[] {
  if (n <= 0 || active.length === 0) return [];
  const weight = new Map(active.map((t) => [t.kind, t.recent]));
  return pool
    .filter((q) => !exclude.has(q.id) && Array.isArray(q.trap))
    .map((q) => {
      let best = 0;
      for (const k of q.trap as string[]) { const w = weight.get(k); if (w !== undefined && w > best) best = w; }
      return { q, score: best };
    })
    .filter((x) => x.score > 0)
    .map((x) => ({ q: x.q, w: x.score + rng() * 0.5 }))
    .sort((a, b) => b.w - a.w)
    .slice(0, n)
    .map((x) => x.q);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/features/quiz/traps.test.ts`
Expected: PASS (tests existants + 5 nouveaux).

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz/traps.ts src/features/quiz/traps.test.ts
git commit -m "feat(confusion): activeConfusionCount + selectConfusion (couche pure)"
```

---

### Task 2: Ingrédient « confusion » dans le moteur de plan (`sessionPlan.ts`)

**Files:**
- Modify: `src/features/entrainement/sessionPlan.ts`
- Test: `src/features/entrainement/sessionPlan.test.ts` (mise à jour des littéraux + nouveaux tests)

**Interfaces:**
- Produces (types étendus) :
  - `CONFUSION_CAP = 0.25`
  - `SessionState` gagne `confusionCount: number`
  - `Caps` gagne `confusion: boolean`
  - `SessionPlan` composé : `alloc: { errors, confusion, revision, learn, adaptive }`
  - `BUILT_CAPS.confusion = true`

- [ ] **Step 1: Update the existing tests (they encode the old alloc shape) + write the new ones**

Dans `src/features/entrainement/sessionPlan.test.ts` :

1. Import — ajouter `CONFUSION_CAP` :

```ts
import { pickSessionPlan, BUILT_CAPS, REVISION_CAP, CONFUSION_CAP, type Caps } from "./sessionPlan.ts";
```

2. `OFF` (ligne 4) — ajouter `confusion: false` :

```ts
const OFF: Caps = { diagnostic: false, errors: false, learn: false, revision: false, confusion: false };
```

3. `base` (lignes 5-7) — ajouter `confusionCount: 0` :

```ts
const base = {
  resume: false, daysSinceDiagnostic: null, wrongCount: 0, newCoursePoints: 0, revisionDue: 0, confusionCount: 0,
};
```

4. Les littéraux `Caps` en clair — ajouter `confusion` :
   - ligne 13 `{ diagnostic: true, errors: true, learn: true, revision: true }` → ajouter `confusion: true`
   - ligne 52 `{ diagnostic: false, errors: true, learn: true, revision: false }` → ajouter `confusion: false`
   - ligne 86 `{ diagnostic: false, errors: false, learn: true, revision: false }` → ajouter `confusion: false`
   - `REVISION_CAPS` ligne 92 `{ diagnostic: false, errors: true, learn: true, revision: true }` → ajouter `confusion: false`

5. Les 7 assertions `.toEqual({ ..., alloc: {...} })` — insérer `confusion: 0` (base.confusionCount=0 → toujours 0). Lignes 40, 45, 54, 64, 69, 89, 130 :
   - l.40 → `alloc: { errors: 3, confusion: 0, revision: 0, learn: 0, adaptive: 7 }`
   - l.45 → `alloc: { errors: 2, confusion: 0, revision: 0, learn: 0, adaptive: 8 }`
   - l.54 → `alloc: { errors: 3, confusion: 0, revision: 0, learn: 2, adaptive: 5 }`
   - l.64 → `alloc: { errors: 3, confusion: 0, revision: 0, learn: 4, adaptive: 3 }`
   - l.69 → `alloc: { errors: 0, confusion: 0, revision: 0, learn: 0, adaptive: 10 }`
   - l.89 → `alloc: { errors: 0, confusion: 0, revision: 0, learn: 4, adaptive: 6 }`
   - l.130 → `alloc: { errors: 0, confusion: 0, revision: 0, learn: 0, adaptive: 20 }`

6. Ajouter les nouveaux tests à la fin :

```ts
const CONF_CAPS: Caps = { diagnostic: false, errors: true, learn: true, revision: true, confusion: true };

test("confusion : borné par CONFUSION_CAP et placé après les erreurs", () => {
  // total=20 ; errors=min(100, floor(0.3*20)=6)=6 ; confusion=min(100, floor(0.25*20)=5, 20-6=14)=5
  const p = pickSessionPlan({ ...base, wrongCount: 100, confusionCount: 100 }, 20, CONF_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.errors).toBe(6);
  expect(p.alloc.confusion).toBe(Math.floor(CONFUSION_CAP * 20)); // 5
});

test("confusion : bornée par confusionCount sous le cap", () => {
  const p = pickSessionPlan({ ...base, confusionCount: 2 }, 20, CONF_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.confusion).toBe(2);
});

test("confusion : la révision garde son plein cap dans une session normale", () => {
  // total=20 ; errors=6, confusion=5, revision=min(100, floor(0.4*20)=8, 20-6-5=9)=8 (cap plein)
  const p = pickSessionPlan({ ...base, wrongCount: 100, confusionCount: 100, revisionDue: 100 }, 20, CONF_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.revision).toBe(Math.floor(REVISION_CAP * 20)); // 8 — non comprimé par la confusion
});

test("confusion : graceful zero (aucune confusion → alloc.confusion=0, reste inchangé)", () => {
  const p = pickSessionPlan({ ...base, wrongCount: 50, revisionDue: 50, confusionCount: 0 }, 20, CONF_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.confusion).toBe(0);
});

test("confusion : capacité absente → 0 (gel de capacité)", () => {
  const p = pickSessionPlan({ ...base, confusionCount: 100 }, 20, { ...CONF_CAPS, confusion: false });
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.confusion).toBe(0);
});

test("toutes tranches saturantes → adaptatif 0, budget entièrement alloué avec confusion", () => {
  const p = pickSessionPlan(
    { ...base, wrongCount: 100, confusionCount: 100, revisionDue: 100, newCoursePoints: 100 }, 20, CONF_CAPS,
  );
  if (p.kind !== "composed") throw new Error("composed attendu");
  const { errors, confusion, revision, learn, adaptive } = p.alloc;
  expect(errors + confusion + revision + learn + adaptive).toBe(20);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/features/entrainement/sessionPlan.test.ts`
Expected: FAIL — `CONFUSION_CAP` non exporté, `confusion` absent du type/alloc.

- [ ] **Step 3: Implement the ingredient**

Dans `src/features/entrainement/sessionPlan.ts` :

Après `export const REVISION_CAP = 0.4;` (ligne 15), ajouter :

```ts

/** Part maximale du budget consacrée au drill des confusions actives (types de pièges répétés). */
export const CONFUSION_CAP = 0.25;
```

Dans `SessionState`, ajouter le champ (après `revisionDue`) :

```ts
  /** Nombre d'événements de confusion récents (proxy de plafond ; 0 tant qu'aucune confusion). */
  confusionCount: number;
```

Dans `Caps`, ajouter :

```ts
  confusion: boolean;
```

Dans `SessionPlan`, étendre l'alloc composé :

```ts
  | { kind: "composed"; alloc: { errors: number; confusion: number; revision: number; learn: number; adaptive: number } };
```

`BUILT_CAPS` :

```ts
export const BUILT_CAPS: Caps = { diagnostic: true, errors: true, learn: true, revision: true, confusion: true };
```

Dans `pickSessionPlan`, remplacer le bloc de calcul (de `const errors =` jusqu'au `return`) par :

```ts
  const errors = caps.errors ? Math.min(state.wrongCount, Math.floor(ERRORS_CAP * total)) : 0;
  // Confusion : le MOTIF répété, juste après les erreurs (les deux corrigent des fautes). Cap 0,25
  // qui ne comprime pas le cap 0,4 de la révision en session normale (cf. spec §3.2).
  const confusion = caps.confusion
    ? Math.min(state.confusionCount, Math.floor(CONFUSION_CAP * total), Math.max(0, total - errors))
    : 0;
  // La révision suit : à 4,5 mois de l'examen, l'oubli prime (priorité haute).
  const revision = caps.revision
    ? Math.min(state.revisionDue, Math.floor(REVISION_CAP * total), Math.max(0, total - errors - confusion))
    : 0;
  const learn = caps.learn
    ? Math.min(state.newCoursePoints, Math.floor(LEARN_CAP * total), Math.max(0, total - errors - confusion - revision))
    : 0;
  const adaptive = Math.max(0, total - errors - confusion - revision - learn);
  return { kind: "composed", alloc: { errors, confusion, revision, learn, adaptive } };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/features/entrainement/sessionPlan.test.ts && bun run typecheck`
Expected: PASS (tests mis à jour + 6 nouveaux) ; typecheck OK (⚠ `useQuiz.ts` construit un `SessionState` sans `confusionCount` → **Task 3 le corrige**, donc typecheck peut échouer ICI sur ce seul point ; c'est attendu et levé par la Task 3).

Note : si le typecheck bloque sur `useQuiz.ts` à cette étape, c'est le trou que la Task 3 comble ; le `bun test` de CE fichier doit néanmoins passer.

- [ ] **Step 5: Commit**

```bash
git add src/features/entrainement/sessionPlan.ts src/features/entrainement/sessionPlan.test.ts
git commit -m "feat(confusion): ingredient confusion dans le moteur de plan (cap 0.25)"
```

---

### Task 3: Câblage dans `useQuiz.start()`

**Files:**
- Modify: `src/features/quiz/useQuiz.ts`

**Interfaces:**
- Consumes: `activeConfusionCount`, `selectConfusion`, `trapModel`, `kindIndex` (Task 1), `plan.alloc.confusion` (Task 2).
- Produces: rien de nouveau ; la session composée inclut la tranche confusion.

Le câblage n'introduit aucune règle testable hors des couches pures (Tasks 1-2 les couvrent) ; il est garanti par le typecheck et la suite existante de `useQuiz`. Pas de nouveau test unitaire (la règle « la tranche confusion ne dédouble pas » est mécaniquement portée par `exclude`).

- [ ] **Step 1: Extend the traps import**

Dans `src/features/quiz/useQuiz.ts`, remplacer :

```ts
import { asConfusions, confusionPatch, dayNumber } from "./traps.ts";
```

par :

```ts
import { asConfusions, confusionPatch, dayNumber, trapModel, kindIndex, selectConfusion, activeConfusionCount } from "./traps.ts";
```

- [ ] **Step 2: Compute the confusion count before the plan**

Dans `start()`, juste après `const fsrsMap = asFsrs(raw);` et `const jourRevision = dayNumber(new Date());` (autour des lignes 284-285), ajouter (avant `const revisionDue = ...`) :

```ts
    const confusions = asConfusions(raw);
```

Puis, après `const revisionDue = dueBySkill(fsrsMap, jourRevision).total;` (ligne 286), ajouter :

```ts
    // Confusion : proxy de comptage (ne nécessite pas les pools) pour le plan ; le tri fin par
    // type se fait après le chargement des pools, réconcilié par composeSession.
    const confusionCount = activeConfusionCount(confusions, jourRevision);
```

- [ ] **Step 3: Pass `confusionCount` into the plan**

Dans l'appel `pickSessionPlan(...)` (ligne ~290), ajouter le champ à l'objet d'état :

```ts
    const plan = pickSessionPlan(
      { resume: false, daysSinceDiagnostic, wrongCount: wrong.length, newCoursePoints, revisionDue, confusionCount },
      total,
      BUILT_CAPS,
    );
```

- [ ] **Step 4: Build the confusion slice after the pools load**

Dans le chemin composé, juste après la tranche révision et sa boucle `for (const q of revisionQs) exclude.add(q.id);` (ligne ~334), et AVANT la tranche `learnQs`, ajouter :

```ts
    // Tranche confusion : questions exerçant un type de piège encore actif (motif répété), la
    // plus fréquente d'abord. Même fenêtre 30 j que l'affichage → cible ce que voit l'apprenant.
    // Placée après errors/révision dans `exclude` → jamais de doublon.
    const confusionQs = plan.alloc.confusion > 0
      ? selectConfusion(
          trapModel(confusions, kindIndex(allPool), jourRevision).active,
          allPool, exclude, plan.alloc.confusion, Math.random,
        )
      : [];
    for (const q of confusionQs) exclude.add(q.id);
```

- [ ] **Step 5: Fold the slice into the budget + the composed session**

1. `adaptiveTarget` (ligne ~351) — soustraire `confusionQs.length` :

```ts
    const adaptiveTarget = Math.max(0, total - errorQs.length - confusionQs.length - revisionQs.length - learnQs.length);
```

2. `composeSession` (ligne ~359) — ajouter `...confusionQs` aux tranches garanties :

```ts
    const session = composeSession([...errorQs, ...confusionQs, ...revisionQs, ...learnQs], picked, total, Math.random);
```

- [ ] **Step 6: Verify**

Run: `bun run typecheck && bun test`
Expected: typecheck OK (le trou `SessionState` de la Task 2 est comblé) ; toute la suite verte.

- [ ] **Step 7: Commit**

```bash
git add src/features/quiz/useQuiz.ts
git commit -m "feat(confusion): tranche confusion cablee dans la composition de session"
```

---

## Notes d'intégration finale (après Task 3)

- **Graceful zero à vérifier** : sur un blob sans `confusions` récentes, `confusionCount=0` → `alloc.confusion=0` → `confusionQs=[]` → session identique à avant ce lot.
- **Pas de bump `sw.js`** (aucun asset livré ne change). **Aucune écriture `data/graph/`.**
- Vérification navigateur facultative : avec un blob portant des confusions récentes typées, démarrer une session et confirmer que des questions du type actif apparaissent (non déterministe à l'œil ; les tests purs verrouillent la logique).
