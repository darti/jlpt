# Allocation prescriptive par valeur marginale — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Répartir les questions entre compétences par la **valeur marginale** ∂P/∂question
(dérivée du `successModel`) au lieu de la simple faiblesse `1 − maîtrise`.

**Architecture:** `scoring.ts#prescriptiveWeights` (pur) calcule le poids par compétence
(`0.2 + 1.3·valeur_normalisée`). `allocateCount` passe de « prend la maîtrise et applique la
formule » à « prend un poids et répartit ». `useQuiz` passe les poids prescriptifs. `pickAdaptive`
et la composition de session restent intacts.

**Tech Stack:** bun (runtime, tests), TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-23-tableau-prescriptif-design.md`

## Global Constraints

- **Worktree `.worktrees/prescriptif`, branche `feat/prescriptif`.** Jamais dans le répertoire principal.
- **`bun` EXCLUSIVEMENT, jamais `node`.** Tests : `bun test <fichier>`. Typecheck : `bun run typecheck`.
- **Pas de linter** : `bun run typecheck` + `bun test` font foi. Ne pas en ajouter.
- **Zéro dépendance nouvelle.**
- Commentaires et messages de commit en **français**, conventional commits. **PAS de ligne Co-Authored-By.**
- **Commit : message COURT à UNE ligne** via `git commit -m "..."`. PAS de heredoc (un hook du dépôt déclenche une revue d'équipe et fait parfois échouer le commit — si bloqué, laisser STAGÉ proprement et le signaler).
- **Aucune UI, aucun asset livré** : pas de touche à `data/graph/`, **pas de bump `sw.js`**, pas de composant.
- Constantes réutilisées **verbatim** : plancher `0.2`, échelle `1.3` (celles d'`allocateCount` aujourd'hui).
- Modules purs (`scoring.ts`, `bank.ts`) : aucune horloge, aucun store. `prescriptiveWeights` est pur.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/scoring.ts` | **modifié** — ajoute `prescriptiveWeights(p)` (le modèle de valeur) |
| `src/lib/scoring.test.ts` | **modifié** — propriétés + ancres + vecteur de référence |
| `src/lib/bank.ts` | **modifié** — `allocateCount`/`allocate` : `masteryOf` → `weightOf` |
| `src/lib/bank.test.ts` | **modifié** — adaptation sémantique (poids au lieu de maîtrise) |
| `src/features/quiz/useQuiz.ts` | **modifié** — passe `prescriptiveWeights(progress)` aux 2 appels |

---

## Task 1 : le modèle de valeur (`prescriptiveWeights`)

**Files:**
- Modify: `src/lib/scoring.ts` (ajout après `dashboardModel`)
- Test: `src/lib/scoring.test.ts`

**Interfaces:**
- Consumes: `masteryOf`, `skT` (privé, déjà dans `scoring.ts`), `SKILLS`, `type Skill`, `type Progress`.
- Produces: `export function prescriptiveWeights(p: Progress): Record<Skill, number>`.

- [ ] **Step 1 : écrire les tests de propriété + ancres (les plus robustes)**

Ajouter à `src/lib/scoring.test.ts` (importer `prescriptiveWeights` en tête, à côté des imports existants) :

```ts
import { prescriptiveWeights } from "./scoring.ts";
import type { Progress } from "../types/progress.ts";

// Construit une progression avec un R par compétence (t=10 par défaut → écoute mesurée).
const prog = (R: Partial<Record<string, number>>, tEcoute = 10): Progress => ({
  total: 100,
  skill: {
    vocabulaire: { R: R.vocabulaire ?? 1600, t: 10 },
    kanji: { R: R.kanji ?? 1600, t: 10 },
    grammaire: { R: R.grammaire ?? 1600, t: 10 },
    lecture: { R: R.lecture ?? 1600, t: 10 },
    ecoute: { R: R.ecoute ?? 1600, t: tEcoute },
  } as Progress["skill"],
});

test("une section sous son minimum pèse PLUS qu'une section saturée (le cœur)", () => {
  // langage (vocab+kanji) très faible → sous le minimum sectionnel ; grammaire+lecture saturés.
  const w = prescriptiveWeights(prog({ vocabulaire: 1350, kanji: 1350, grammaire: 1950, lecture: 1950 }));
  expect(w.vocabulaire).toBeGreaterThan(w.grammaire);
  expect(w.kanji).toBeGreaterThan(w.lecture);
});

test("chaque poids reste dans [0.2, 1.5] et le max vaut exactement 1.5", () => {
  const w = prescriptiveWeights(prog({ vocabulaire: 1350, kanji: 1350, grammaire: 1950, lecture: 1950 }));
  for (const c of Object.keys(w)) {
    expect(w[c as keyof typeof w]).toBeGreaterThanOrEqual(0.2);
    expect(w[c as keyof typeof w]).toBeLessThanOrEqual(1.5 + 1e-9);
  }
  expect(Math.max(...Object.values(w))).toBeCloseTo(1.5, 9);
});

test("une compétence saturée est DÉ-priorisée (poids faible, sous une compétence au seuil)", () => {
  // écoute très forte (2000), les autres au seuil (1600) → écoute a la plus petite valeur.
  // ⚠ Une compétence MESURÉE n'atteint jamais EXACTEMENT 0.2 (sa valeur n'est pas nulle) — on
  // asserte donc la DÉ-priorisation relative, pas un plancher exact (ça, c'est l'écoute non mesurée).
  const w = prescriptiveWeights(prog({ ecoute: 2000 }));
  expect(w.ecoute).toBeLessThan(w.vocabulaire);
  expect(w.ecoute).toBeGreaterThan(0.2); // au-dessus du plancher : mesurée, valeur > 0
});

test("écoute t<3 (estimée) : poids = plancher EXACT (bootstrap), pas piloté par une valeur fausse", () => {
  const w = prescriptiveWeights(prog({}, 2)); // t_ecoute = 2 < 3
  expect(w.ecoute).toBeCloseTo(0.2, 9);
});

test("démarrage à froid (tous R=1450, t_ecoute<3) : 4 compétences à 1.5, écoute au plancher", () => {
  const cold = prescriptiveWeights(prog(
    { vocabulaire: 1450, kanji: 1450, grammaire: 1450, lecture: 1450, ecoute: 1450 }, 0,
  ));
  expect(cold.vocabulaire).toBeCloseTo(1.5, 6);
  expect(cold.kanji).toBeCloseTo(1.5, 6);
  expect(cold.grammaire).toBeCloseTo(1.5, 6);
  expect(cold.lecture).toBeCloseTo(1.5, 6);
  expect(cold.ecoute).toBeCloseTo(0.2, 6);
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run: `bun test src/lib/scoring.test.ts`
Expected: FAIL — `prescriptiveWeights is not a function` / import introuvable.

- [ ] **Step 3 : implémenter `prescriptiveWeights`**

Dans `src/lib/scoring.ts`, après `dashboardModel` :

```ts
/**
 * Poids d'allocation prescriptif par compétence : `0.2 + 1.3·valeur_normalisée`, où la valeur est
 * la valeur marginale ∂P/∂question dérivée du `successModel`. Remplace « poids ∝ faiblesse ».
 *
 * value(c) = marginalSection · sectionFactor · dMasteryDR, avec
 *   marginalSection = (1−pTotal)/12 + (1−pSec)/4   (seuil global commun + minimum sectionnel propre)
 *   sectionFactor   = 0.5 (2 compétences/section) ; écoute = 1.0 si mesurée (t≥3), sinon 0
 *   dMasteryDR      = m·(1−m)·ln10/400              (pente logistique, max à R=1600)
 * Le plancher 0.2 garantit la couverture (et le bootstrap de l'écoute non mesurée).
 * Pur. Cf. docs/superpowers/specs/2026-07-23-tableau-prescriptif-design.md.
 */
export function prescriptiveWeights(p: Progress): Record<Skill, number> {
  const m = {
    vocabulaire: masteryOf(p, "vocabulaire"), kanji: masteryOf(p, "kanji"),
    grammaire: masteryOf(p, "grammaire"), lecture: masteryOf(p, "lecture"),
    ecoute: masteryOf(p, "ecoute"),
  };
  const langage = (m.vocabulaire + m.kanji) / 2;
  const grammLect = (m.grammaire + m.lecture) / 2;
  const ecouteMeasured = skT(p, "ecoute") >= 3;
  const listening = ecouteMeasured ? m.ecoute : 0.85 * ((langage + grammLect) / 2);
  const sec = { langage: langage * 60, grammLect: grammLect * 60, listening: listening * 60 };
  const total = sec.langage + sec.grammLect + sec.listening;
  const sig = (x: number) => 1 / (1 + Math.exp(-x));
  const pSec = (v: number) => sig((v - 22) / 4);
  const globalTerm = (1 - sig((total - 95) / 12)) / 12;
  const marginal = {
    langage: globalTerm + (1 - pSec(sec.langage)) / 4,
    grammLect: globalTerm + (1 - pSec(sec.grammLect)) / 4,
    listening: globalTerm + (1 - pSec(sec.listening)) / 4,
  };
  const dDR = (x: number) => (x * (1 - x) * Math.LN10) / 400;
  const value: Record<Skill, number> = {
    vocabulaire: marginal.langage * 0.5 * dDR(m.vocabulaire),
    kanji: marginal.langage * 0.5 * dDR(m.kanji),
    grammaire: marginal.grammLect * 0.5 * dDR(m.grammaire),
    lecture: marginal.grammLect * 0.5 * dDR(m.lecture),
    ecoute: ecouteMeasured ? marginal.listening * 1.0 * dDR(m.ecoute) : 0,
  };
  const maxVal = Math.max(...SKILLS.map((c) => value[c]));
  const w = {} as Record<Skill, number>;
  for (const c of SKILLS) w[c] = 0.2 + 1.3 * (maxVal > 0 ? value[c] / maxVal : 0);
  return w;
}
```

⚠ Vérifier que `Progress` est déjà importé dans `scoring.ts` (il l'est — `type Progress` en tête).
`masteryOf`, `skT`, `SKILLS`, `Skill` sont tous déjà dans le fichier.

- [ ] **Step 4 : lancer, vérifier le succès**

Run: `bun test src/lib/scoring.test.ts`
Expected: PASS — les 5 tests ajoutés (+ les tests existants de `scoring.test.ts` inchangés).

- [ ] **Step 5 : ajouter le vecteur de référence golden (verrouille la transposition contre les régressions)**

⚠ **Ne PAS hand-computer les poids attendus** : les formules composées (marginalSection × sectionFactor
× dMasteryDR × normalisation) sont trop faciles à mal calculer à la main (l'auteur du plan s'y est
trompé sur l'ordre grammaire/lecture — `dMasteryDR` favorise la maîtrise la plus proche de 0,5, donc
`lecture` R=1700 (m=0,64) pèse PLUS que `grammaire` R=1400 (m=0,24) dans la même section). Procédure :
1. Écris le test ci-dessous avec des `?` en placeholders pour les 5 poids.
2. Lance-le une fois pour lire les valeurs RÉELLES produites par ton implémentation (déjà validée par
   les propriétés du Step 1).
3. Fige ces valeurs comme ancres golden. Elles protègent contre les RÉGRESSIONS futures (tout
   changement de formule les casse). La justesse de l'implémentation, elle, est établie par les tests
   de propriété du Step 1 + la revue ligne à ligne — pas par ce golden.

```ts
// Vecteur golden : un état fixe (R distincts par compétence) → les 5 poids figés. Verrou de
// non-régression. Les valeurs sont celles de l'implémentation validée au Step 1, et sont
// cross-validées en revue par une transcription indépendante des formules du § 2 (méthode FSRS).
test("vecteur golden : R distincts → 5 poids figés (verrou de régression)", () => {
  const w = prescriptiveWeights(prog({
    vocabulaire: 1500, kanji: 1600, grammaire: 1400, lecture: 1700, ecoute: 1550,
  }));
  expect(w.vocabulaire).toBeCloseTo(/* réel */ 0, 4);
  expect(w.kanji).toBeCloseTo(/* réel */ 0, 4);
  expect(w.grammaire).toBeCloseTo(/* réel */ 0, 4);
  expect(w.lecture).toBeCloseTo(/* réel */ 0, 4);
  expect(w.ecoute).toBeCloseTo(/* réel */ 0, 4);
  // Ancres exactes indépendantes de l'arithmétique :
  expect(Math.max(...Object.values(w))).toBeCloseTo(1.5, 9); // normalisation
  expect(Math.min(...Object.values(w))).toBeGreaterThanOrEqual(0.2); // plancher
});
```

Remplace les cinq `/* réel */ 0` par les valeurs lues à l'étape 2 (garde `toBeCloseTo(_, 4)`).

- [ ] **Step 6 : lancer les tests + typecheck + suite complète**

Run: `bun test src/lib/scoring.test.ts && bun run typecheck && bun test`
Expected: PASS (6 nouveaux cas), `tsc` propre, suite complète à 0 échec (rien d'existant ne change —
`prescriptiveWeights` n'est encore appelé nulle part).

- [ ] **Step 7 : commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat(scoring): prescriptiveWeights, valeur marginale d'allocation par competence"
```

---

## Task 2 : brancher les poids dans l'allocation

**Files:**
- Modify: `src/lib/bank.ts` (`allocateCount`, `allocate`), `src/features/quiz/useQuiz.ts` (2 appels), `src/lib/bank.test.ts`

**Interfaces:**
- Consumes: `prescriptiveWeights` de `scoring.ts` (Task 1).
- Produces: `allocateCount(weightOf: (c: Skill) => number, total: number)`, `allocate(weightOf, minutes)`.

- [ ] **Step 1 : adapter les tests de `bank.test.ts` à la sémantique « poids »**

Dans `src/lib/bank.test.ts`, remplacer les deux tests d'allocation (le contenu, pas les autres) :

```ts
test("allocate distribue ~1.5 questions/min, pondéré par le poids par compétence", () => {
  const { total } = allocate(() => 0.5, 10); // poids uniforme 0.5
  expect(total).toBe(15); // clamp(4, round(10*1.5), 45)
});

test("allocateCount distribue exactement `total` entre compétences", () => {
  const alloc = allocateCount(() => 0.5, 11); // poids uniforme
  const sum = Object.values(alloc).reduce((a, b) => a + b, 0);
  expect(sum).toBe(11); // ni sur- ni sous-tirage
});

test("allocateCount : reliquat aux compétences de plus HAUT poids", () => {
  // grammaire a le poids le plus élevé → reçoit le +1 du reliquat (total non divisible également).
  const alloc = allocateCount(
    (c) => (c === "grammaire" ? 1.5 : 0.2), 6,
  );
  const maxSkill = Object.entries(alloc).sort((a, b) => b[1] - a[1])[0][0];
  expect(maxSkill).toBe("grammaire");
});
```

- [ ] **Step 2 : lancer, vérifier l'échec du nouveau cas**

Run: `bun test src/lib/bank.test.ts`
Expected: le 3ᵉ test échoue (`allocateCount` pondère encore par `1 − maîtrise` : `0.2`/`1.5`
interprétés comme maîtrises → poids inversés, grammaire ne reçoit PAS le reliquat).

- [ ] **Step 3 : `allocateCount`/`allocate` prennent un poids**

Dans `src/lib/bank.ts`, remplacer `allocateCount` et `allocate` :

```ts
/** Répartit un budget `total` de questions entre compétences, proportionnellement à un poids
 *  par compétence ; reliquat aux compétences de plus haut poids. */
export function allocateCount(weightOf: (c: Skill) => number, total: number): Record<Skill, number> {
  const w = {} as Record<Skill, number>;
  let sum = 0;
  for (const c of SKILLS) { w[c] = weightOf(c); sum += w[c]; }
  const alloc = {} as Record<Skill, number>;
  let assigned = 0;
  for (const c of SKILLS) { alloc[c] = sum > 0 ? Math.floor((total * w[c]) / sum) : 0; assigned += alloc[c]; }
  const order = [...SKILLS].sort((a, b) => w[b] - w[a]); // reliquat au plus haut poids d'abord
  let i = 0;
  while (assigned < total) { alloc[order[i % order.length]]++; assigned++; i++; }
  return alloc;
}

export function allocate(weightOf: (c: Skill) => number, minutes: number): { total: number; alloc: Record<Skill, number> } {
  const total = questionCount(minutes);
  return { total, alloc: allocateCount(weightOf, total) };
}
```

⚠ Le seul changement de logique : `w[c] = weightOf(c)` (au lieu de `0.2 + (1 − masteryOf(c)) * 1.3`)
et le tri du reliquat par poids **décroissant** (au lieu de maîtrise croissante). La formule
`0.2 + …·1.3` déménage dans `prescriptiveWeights` (Task 1).

- [ ] **Step 4 : brancher `prescriptiveWeights` dans `useQuiz`**

Dans `src/features/quiz/useQuiz.ts` :
- Ligne 13, remplacer l'import `masteryOf` par `prescriptiveWeights` (masteryOf ne sert plus qu'ici) :
  ```ts
  import { dashboardModel, prescriptiveWeights } from "../../lib/scoring.ts";
  ```
- Dans `start()`, juste avant le bloc qui construit les tranches apprentissage/adaptatif (là où
  `progress` est disponible, avant la ligne `allocateCount(... plan.alloc.learn)`), calculer une
  fois :
  ```ts
    const weights = prescriptiveWeights(progress);
  ```
- Remplacer les deux `allocateCount((c) => masteryOf(progress, c), …)` (apprentissage puis adaptatif) par :
  ```ts
          allocateCount((c) => weights[c], plan.alloc.learn),
  ```
  et
  ```ts
      allocateCount((c) => weights[c], adaptiveTarget),
  ```

⚠ `masteryOf` n'est plus utilisé ailleurs dans `useQuiz.ts` (vérifié : uniquement ces 2 lignes) —
son retrait de l'import est donc sûr. Le commentaire ligne ~75 qui mentionne `masteryOf` peut rester
(il décrit `scoring.ts`, pas un usage local).

- [ ] **Step 5 : lancer les tests concernés + typecheck**

Run: `bun test src/lib/bank.test.ts && bun run typecheck`
Expected: PASS — les 3 tests d'allocation, `tsc` propre (aucun `masteryOf` orphelin).

- [ ] **Step 6 : suite complète**

Run: `bun test`
Expected: 0 échec. ⚠ Si un test EXISTANT de `useQuiz`/session casse, c'est qu'il dépendait de
l'ancienne pondération `1 − maîtrise` — l'examiner : soit il asserte une allocation précise (à
mettre à jour vers la nouvelle pondération), soit c'est une vraie régression à corriger. Ne pas
maquiller.

- [ ] **Step 7 : build (confirme qu'aucun asset livré ne bouge — pas de bump `sw.js`)**

Run: `bun run build`
Expected: build propre. Aucun `sw.js`/`data/` touché.

- [ ] **Step 8 : commit**

```bash
git add src/lib/bank.ts src/lib/bank.test.ts src/features/quiz/useQuiz.ts
git commit -m "feat(scoring): l'allocation de session pilote par la valeur marginale prescriptive"
```

---

## Vérification finale

- [ ] `bun run typecheck` — sans erreur
- [ ] `bun test` — 0 échec
- [ ] `bun run build` — build propre
- [ ] **PAS de bump `sw.js`** (aucun asset livré modifié)
- [ ] `pickAdaptive`, `composeSession`, `selectDiagnostic` **hors diff** (non touchés)
- [ ] `prescriptiveWeights` est le SEUL endroit portant la formule `0.2 + …·1.3` (elle a quitté `allocateCount`)
