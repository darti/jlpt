# Rappel actif (production kana) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pour les questions de lecture éligibles (vocabulaire/kanji dont la réponse est une lecture kana), remplacer le QCM par un champ où l'apprenant **tape** la lecture, qui alimente la même mesure Elo/FSRS que le QCM.

**Architecture:** Une couche pure `kana.ts` (normalisation + éligibilité + comparaison), un toggle pur `production.ts`, un refactor DRY de `useQuiz` qui extrait un **patch de progression pur** `answerPatch` (partagé par le QCM et la production, la production sautant le graphe de confusion), puis un embranchement d'affichage dans `QuestionCard` et le câblage dans `EntrainementApp`. Aucune modification de `data/graph/`, aucun asset livré nouveau.

**Tech Stack:** React + TypeScript, bundlé par Bun ; tests `bun test` (unitaires purs + `renderToStaticMarkup` SSR + happy-dom `createRoot`/`act`).

## Global Constraints

- **Runtime & outils : `bun` exclusivement**, jamais `node`. Tests : `bun test <fichier>`.
- **Tests côte à côte** : `foo.test.ts(x)` à côté de `foo.ts(x)`.
- Toute clé localStorage applicative nouvelle porte le préfixe `jlptN3` (balayé par la synchro Gist) et est déclarée dans `src/lib/keys.ts` — **une seule source**.
- `renderToStaticMarkup` échappe les apostrophes (`'`→`&#x27;`) : asserter sur des sous-chaînes **sans apostrophe**.
- happy-dom est préchargé pour toute la suite ; les tests DOM posent `IS_REACT_ACT_ENVIRONMENT = true` et montent via `createRoot` + `act` (cf. `QuestionCard.audio.test.tsx`).
- **Kana purs** = `/^[ぁ-んァ-ンー]+$/` (même plage que `CLEAN_FURI_RE` de `dict.ts`, pour cohérence).
- Aucune écriture `data/graph/`, **pas de bump `sw.js`** (aucun asset livré ne change).
- Pas de linter dans le projet ; `bun run typecheck` + `bun test` font foi.
- La production **n'écrit jamais** le graphe de confusion (frontière rappel / reconnaissance).
- Éligibilité v1 : **vocabulaire + kanji uniquement** (grammaire hors périmètre).

---

### Task 1: Couche kana pure (`src/lib/kana.ts`)

**Files:**
- Create: `src/lib/kana.ts`
- Test: `src/lib/kana.test.ts`

**Interfaces:**
- Consumes: `Question` depuis `src/types/quiz.ts` (`{ id, cat, d, q, o: string[], a: number, ... }`).
- Produces:
  - `isPureKana(s: string): boolean`
  - `normalizeKana(s: string): string`
  - `checkReading(input: string, answer: string): boolean`
  - `isProductionEligible(q: Question): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/kana.test.ts` :

```ts
import { test, expect } from "bun:test";
import { isPureKana, normalizeKana, checkReading, isProductionEligible } from "./kana.ts";
import type { Question } from "../types/quiz.ts";

test("isPureKana : hiragana/katakana/ー oui, kanji/espace/latin non", () => {
  expect(isPureKana("やくそく")).toBe(true);
  expect(isPureKana("ヤクソク")).toBe(true);
  expect(isPureKana("コーヒー")).toBe(true);
  expect(isPureKana("約束")).toBe(false);
  expect(isPureKana("やく そく")).toBe(false);
  expect(isPureKana("abc")).toBe(false);
  expect(isPureKana("")).toBe(false);
});

test("normalizeKana : trim, katakana→hiragana, retrait espaces/・, ー conservé", () => {
  expect(normalizeKana("  やくそく ")).toBe("やくそく");
  expect(normalizeKana("ヤクソク")).toBe("やくそく");
  expect(normalizeKana("や く そ く")).toBe("やくそく");
  expect(normalizeKana("コーヒー")).toBe("こーひー");
  expect(normalizeKana("サ・シ")).toBe("さし");
});

test("checkReading : exact après normalisation", () => {
  expect(checkReading("やくそく", "やくそく")).toBe(true);
  expect(checkReading("ヤクソク", "やくそく")).toBe(true);
  expect(checkReading(" やくそく ", "やくそく")).toBe(true);
  expect(checkReading("やくそぐ", "やくそく")).toBe(false);
  expect(checkReading("", "やくそく")).toBe(false);
  expect(checkReading("なにか", "")).toBe(false);
});

const q = (over: Partial<Question>): Question => ({ id: 1, cat: "vocabulaire", d: 1, q: "…", o: ["やくそく", "X", "Y", "Z"], a: 0, ...over });

test("isProductionEligible : vocab/kanji à réponse kana oui, sinon non", () => {
  expect(isProductionEligible(q({}))).toBe(true);
  expect(isProductionEligible(q({ cat: "kanji" }))).toBe(true);
  expect(isProductionEligible(q({ o: ["約束", "X", "Y", "Z"], a: 0 }))).toBe(false);
  expect(isProductionEligible(q({ cat: "grammaire" }))).toBe(false);
  expect(isProductionEligible(q({ cat: "ecoute" }))).toBe(false);
  expect(isProductionEligible(q({ cat: "lecture" }))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/kana.test.ts`
Expected: FAIL — `Cannot find module './kana.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/kana.ts` :

```ts
/**
 * Kana : test de pureté, normalisation de lecture, comparaison, éligibilité à la production.
 *
 * Le rappel actif compare une saisie libre à la lecture attendue (la bonne réponse de la
 * question). La normalisation neutralise katakana↔hiragana, espaces et point médian pour
 * qu'une saisie légitime ne soit pas refusée sur un détail de casse kana.
 */
import type { Question } from "../types/quiz.ts";

/** Kana purs : hiragana, katakana, prolongation ー (même plage que le furigana propre). */
const PURE_KANA_RE = /^[ぁ-んァ-ンー]+$/;

/** true ssi `s` n'est fait que de kana (hiragana/katakana/ー). Chaîne vide → false. */
export function isPureKana(s: string): boolean {
  return PURE_KANA_RE.test(s);
}

/** Normalise une lecture pour comparaison : trim → NFC → katakana→hiragana → retrait des
 *  espaces (` `, U+3000) et du point médian `・`. `ー` (prolongation) est conservé. */
export function normalizeKana(s: string): string {
  const t = s.trim().normalize("NFC");
  let out = "";
  for (const ch of t) {
    const code = ch.codePointAt(0) ?? 0;
    // Bloc katakana ァ(U+30A1)..ヶ(U+30F6) → hiragana (décalage 0x60). ー(U+30FC) hors plage.
    if (code >= 0x30a1 && code <= 0x30f6) out += String.fromCodePoint(code - 0x60);
    else if (ch === " " || ch === "　" || ch === "・") continue;
    else out += ch;
  }
  return out;
}

/** true ssi la saisie, normalisée, égale la réponse normalisée (non vide). */
export function checkReading(input: string, answer: string): boolean {
  const a = normalizeKana(answer);
  return a.length > 0 && normalizeKana(input) === a;
}

/** Éligible à la production : vocabulaire ou kanji dont la bonne réponse est une lecture kana. */
export function isProductionEligible(q: Question): boolean {
  if (q.cat !== "vocabulaire" && q.cat !== "kanji") return false;
  const answer = q.o[q.a];
  return typeof answer === "string" && isPureKana(answer);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/kana.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kana.ts src/lib/kana.test.ts
git commit -m "feat(rappel-actif): couche kana pure (normalisation, éligibilité, comparaison)"
```

---

### Task 2: Toggle de préférence (`PROD_KEY` + `src/lib/production.ts`)

**Files:**
- Modify: `src/lib/keys.ts` (ajout d'une constante, après `RATE_KEY` ligne 49)
- Create: `src/lib/production.ts`
- Test: `src/lib/production.test.ts`

**Interfaces:**
- Consumes: `PROD_KEY` depuis `src/lib/keys.ts`.
- Produces:
  - `readProduction(store?: Pick<Storage, "getItem">): boolean`
  - `writeProduction(on: boolean, store?: Pick<Storage, "setItem">): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/production.test.ts` :

```ts
import { test, expect } from "bun:test";
import { readProduction, writeProduction } from "./production.ts";
import { PROD_KEY } from "./keys.ts";

function fakeStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    _map: m,
  };
}

test("readProduction : défaut false", () => {
  expect(readProduction(fakeStore())).toBe(false);
});

test("writeProduction puis readProduction : round-trip", () => {
  const s = fakeStore();
  writeProduction(true, s);
  expect(readProduction(s)).toBe(true);
  expect(s._map.get(PROD_KEY)).toBe("1");
  writeProduction(false, s);
  expect(readProduction(s)).toBe(false);
});

test("readProduction : store en échec → false", () => {
  const bad = { getItem: () => { throw new Error("blocked"); } };
  expect(readProduction(bad)).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/production.test.ts`
Expected: FAIL — `Cannot find module './production.ts'` (et `PROD_KEY` absent).

- [ ] **Step 3a: Add the key**

Dans `src/lib/keys.ts`, après la ligne 49 (`export const RATE_KEY = "jlptN3_ecouteRate";`), ajouter :

```ts

/** Mode rappel actif : taper la lecture au lieu de choisir (préférence, comme furi/thème). */
export const PROD_KEY = "jlptN3_production";
```

- [ ] **Step 3b: Write the module**

Create `src/lib/production.ts` :

```ts
import { PROD_KEY } from "./keys.ts";

/** Mode rappel actif persisté (défaut false : le QCM reste le mode par défaut). Pur — le
 *  store est injectable. Stocké en "1"/"0" pour rester lisible dans l'export Gist. */
export function readProduction(store: Pick<Storage, "getItem"> = globalThis.localStorage): boolean {
  try { return store.getItem(PROD_KEY) === "1"; } catch { return false; }
}

/** Persiste le mode rappel actif ; best-effort. Rend la valeur écrite. */
export function writeProduction(
  on: boolean, store: Pick<Storage, "setItem"> = globalThis.localStorage,
): boolean {
  try { store.setItem(PROD_KEY, on ? "1" : "0"); } catch { /* best-effort */ }
  return on;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/production.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/keys.ts src/lib/production.ts src/lib/production.test.ts
git commit -m "feat(rappel-actif): clé PROD_KEY + toggle de préférence"
```

---

### Task 3: Patch de réponse pur + `submitTyped` dans `useQuiz`

**Files:**
- Modify: `src/features/quiz/useQuiz.ts` (extraction de `answerPatch`, refactor de `choose`, ajout de `submitTyped` + état `typed`)
- Test: `src/features/quiz/answerPatch.test.ts`

**Interfaces:**
- Consumes: `checkReading` depuis `src/lib/kana.ts` (Task 1) ; helpers privés déjà présents dans `useQuiz.ts` (`asWrong`, `skillStateOf`, `numField`), et `updateRating`, `confusionPatch`/`asConfusions`/`dayNumber`, `fsrsPatch`/`asFsrs`, `encodeBits`/`decodeBits`/`setBit`.
- Produces (exportés/retournés) :
  - `export function answerPatch(raw, q: Question, correct: boolean, chosen: number | null, today: number, nowMs: number, isLastDiag: boolean): Record<string, unknown>`
  - Le hook retourne en plus : `submitTyped: (text: string) => void` et `typed: string | null`.

**Contexte du refactor.** `choose` (lignes 326–383) inline aujourd'hui tout le calcul du patch de progression puis l'écrit. On extrait ce calcul dans une fonction **pure** `answerPatch` (temps injecté), partagée par `choose` et le nouveau `submitTyped`. La règle nouvelle vit dans cette couche pure : `chosen === null` ⇒ **pas de patch de confusion**. Le refactor est **iso-comportement** pour `choose` (mêmes valeurs, mêmes clés).

- [ ] **Step 1: Write the failing test**

Create `src/features/quiz/answerPatch.test.ts` :

```ts
import { test, expect } from "bun:test";
import { answerPatch } from "./useQuiz.ts";
import type { Question } from "../../types/quiz.ts";

const q: Question = { id: 5, cat: "vocabulaire", d: 2, q: "…", o: ["やくそく", "X", "Y", "Z"], a: 0, tests: ["jlpt:word/約束"] };
const RAW = null; // progression vierge

test("réponse juste : right +1, bit mastered posé, pas de wrong", () => {
  const p = answerPatch(RAW, q, true, 0, 100, 1_000, false);
  expect(p.right).toBe(1);
  expect(p.total).toBe(1);
  expect(Array.isArray(p.wrong) ? (p.wrong as number[]) : []).not.toContain(5);
  expect(typeof p.mastered).toBe("string");
});

test("réponse fausse en QCM (chosen index) : wrong contient l'id ET confusions présent", () => {
  const p = answerPatch(RAW, q, false, 1, 100, 1_000, false);
  expect((p.wrong as number[])).toContain(5);
  expect(p.right).toBe(0);
  expect(p.mastered).toBeUndefined();
  expect(p).toHaveProperty("confusions"); // un distracteur a été coché → arête de confusion
});

test("réponse fausse en PRODUCTION (chosen null) : wrong présent mais AUCUN confusions", () => {
  const p = answerPatch(RAW, q, false, null, 100, 1_000, false);
  expect((p.wrong as number[])).toContain(5);
  expect(p).not.toHaveProperty("confusions"); // rappel ≠ reconnaissance : pas de graphe de confusion
});

test("réponse juste en production (chosen = index correct) : pas de confusions non plus", () => {
  const p = answerPatch(RAW, q, true, 0, 100, 1_000, false);
  expect(p).not.toHaveProperty("confusions"); // confusionPatch ne pose rien sur une bonne réponse
});

test("dernière du diagnostic : diagAt = nowMs", () => {
  const p = answerPatch(RAW, q, true, 0, 100, 42_000, true);
  expect(p.diagAt).toBe(42_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/quiz/answerPatch.test.ts`
Expected: FAIL — `answerPatch` n'est pas exporté par `useQuiz.ts`.

- [ ] **Step 3a: Add the import**

Dans `src/features/quiz/useQuiz.ts`, ajouter en tête (après la ligne 18) :

```ts
import { checkReading } from "../../lib/kana.ts";
```

- [ ] **Step 3b: Add the pure `answerPatch` function**

Dans `src/features/quiz/useQuiz.ts`, juste **avant** `export function useQuiz()` (ligne 161), ajouter la fonction pure. Elle réutilise les helpers privés du module (`asWrong`, `skillStateOf`, `numField`) déjà définis plus haut :

```ts
/** Patch de progression pour UNE réponse. Pur (temps injecté) → testé unitairement.
 *  `chosen` = index de l'option cochée, ou `null` en production (aucune option cochée) :
 *  dans ce cas on n'écrit PAS le graphe de confusion (erreur de rappel, pas de reconnaissance). */
export function answerPatch(
  raw: Record<string, unknown> | null,
  q: Question,
  correct: boolean,
  chosen: number | null,
  today: number,
  nowMs: number,
  isLastDiag: boolean,
): Record<string, unknown> {
  const curWrong = asWrong(raw);
  const nextSkill = updateRating(skillStateOf(raw, q.cat), q.d, correct);
  const withoutId = curWrong.filter((id) => id !== q.id);
  const nextWrong = (correct ? withoutId : [...withoutId, q.id]).slice(-80);
  const nextConfusions = chosen === null
    ? undefined
    : confusionPatch(asConfusions(raw), q.id, chosen, correct, today);
  const nextFsrs = fsrsPatch(asFsrs(raw), Array.isArray(q.tests) ? q.tests : [], correct, today);
  const seen = encodeBits(setBit(decodeBits(typeof raw?.seen === "string" ? raw.seen : ""), q.id));
  const mastered = correct
    ? encodeBits(setBit(decodeBits(typeof raw?.mastered === "string" ? raw.mastered : ""), q.id))
    : undefined;
  return {
    skill: { [q.cat]: nextSkill },
    total: numField(raw, "total") + 1,
    right: numField(raw, "right") + (correct ? 1 : 0),
    wrong: nextWrong,
    seen,
    ...(mastered !== undefined ? { mastered } : {}),
    ...(isLastDiag ? { diagAt: nowMs } : {}),
    ...(nextConfusions !== undefined ? { confusions: nextConfusions } : {}),
    ...(nextFsrs !== undefined ? { fsrs: nextFsrs } : {}),
  };
}
```

- [ ] **Step 3c: Add the `typed` state**

Dans `useQuiz()`, après la ligne 168 (`const [chosen, setChosen] = useState<number | null>(null);`), ajouter :

```ts
  const [typed, setTyped] = useState<string | null>(null);
```

- [ ] **Step 3d: Extract `commitAnswer` and rewrite `choose`**

Remplacer **tout le corps** de `const choose = useCallback(...)` (lignes 326–383) par un `commitAnswer` interne + un `choose` mince :

```ts
  const commitAnswer = useCallback((q: Question, correct: boolean, chosen: number | null) => {
    const raw = readRawProgress();
    const isLastDiag = mode === "diagnostic" && index + 1 >= questions.length;
    writeProgress(answerPatch(raw, q, correct, chosen, dayNumber(new Date()), Date.now(), isLastDiag));
    schedulePush();
    rightRef.current += correct ? 1 : 0;

    if (mode === "diagnostic") {
      // Le diagnostic reste en QCM : `chosen` y est toujours un index réel.
      setDiagAnswers((prev) => [...prev, { question: q, chosen: chosen ?? -1 }]);
      const ni = index + 1;
      if (ni >= questions.length) setPhase("diag-results");
      else setIndex(ni);
      return;
    }

    setChosen(chosen);
    setAnswered(true);
    setPhase("corrige");
    setResume((prev) => {
      if (!prev) return prev;
      const next: ResumeState = { ...prev, qi: index, right: rightRef.current, phase: "corrige", chosen: chosen ?? undefined };
      persistResumeState(next);
      return next;
    });
  }, [questions, index, mode, schedulePush]);

  const choose = useCallback((i: number) => {
    const q = questions[index];
    if (!q || answered) return;
    commitAnswer(q, i === q.a, i);
  }, [questions, index, answered, commitAnswer]);

  const submitTyped = useCallback((text: string) => {
    const q = questions[index];
    if (!q || answered) return;
    const correct = checkReading(text, q.o[q.a]);
    setTyped(text);
    // Bonne réponse → on « coche » l'option correcte pour le corrigé (surlignage vert, correct===a) ;
    // mauvaise → chosen null (aucun distracteur coché → pas de graphe de confusion).
    commitAnswer(q, correct, correct ? q.a : null);
  }, [questions, index, answered, commitAnswer]);
```

- [ ] **Step 3e: Reset `typed` on advance / restart / resume**

Ajouter `setTyped(null);` à chaque endroit qui réinitialise `chosen`/`answered` pour une nouvelle question :

1. Dans `next()`, branche « avancer » (après `setChosen(null);`, ligne ~401) :

```ts
      setAnswered(false);
      setChosen(null);
      setTyped(null);
```

2. Dans `resumeNow()` (après `setChosen(onCorrige ? (r.chosen as number) : null);`, ligne ~454) :

```ts
    setTyped(null);
```

3. Dans `restart()` (au début, avec les autres remises à zéro d'état de phase) :

```ts
    setTyped(null);
```

- [ ] **Step 3f: Expose `submitTyped` and `typed`**

Dans l'objet retourné par `useQuiz` (lignes 471–489), ajouter deux entrées :

```ts
    choose,
    submitTyped,
    typed,
    next,
```

- [ ] **Step 4: Run tests**

Run: `bun test src/features/quiz/answerPatch.test.ts`
Expected: PASS (5 tests).

Run: `bun test src/features/quiz/ && bun run typecheck`
Expected: toute la suite quiz verte (les tests existants de `useQuiz` restent verts : refactor iso-comportement) ; typecheck sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz/useQuiz.ts src/features/quiz/answerPatch.test.ts
git commit -m "feat(rappel-actif): answerPatch pur + submitTyped (production saute la confusion)"
```

---

### Task 4: Champ de saisie dans `QuestionCard`

**Files:**
- Modify: `src/features/quiz/QuestionCard.tsx`
- Test: `src/features/quiz/QuestionCard.production.test.tsx`

**Interfaces:**
- Consumes: `isProductionEligible`, `checkReading` depuis `src/lib/kana.ts` (Task 1) ; `BTN_PRIMARY` depuis `src/ui/styles.ts`.
- Produces: `QuestionCard` accepte trois props **optionnelles** nouvelles :
  - `production?: boolean` (défaut `false`)
  - `onSubmitTyped?: (text: string) => void`
  - `typed?: string | null`

- [ ] **Step 1: Write the failing test**

Create `src/features/quiz/QuestionCard.production.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QuestionCard } from "./QuestionCard.tsx";
import type { Question } from "../../types/quiz.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const vocab: Question = { id: 1, cat: "vocabulaire", d: 1, q: "約束", o: ["やくそく", "やくそぐ", "やくぞく", "やくそ"], a: 0 };
const kanjiAns: Question = { id: 2, cat: "vocabulaire", d: 1, q: "えいきょう", o: ["影響", "映像", "反響", "影像"], a: 0 };

test("SSR : production + éligible rend un champ, pas les boutons d'option", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={vocab} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={() => {}} />,
  );
  expect(html).toContain("Tapez la lecture");
  expect(html).not.toContain("やくそぐ"); // aucun distracteur affiché
});

test("SSR : production mais réponse en kanji (non éligible) → QCM classique", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={kanjiAns} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={() => {}} />,
  );
  expect(html).not.toContain("Tapez la lecture");
  expect(html).toContain("映像"); // les options sont affichées
});

test("SSR : sans production (QCM) l'éligible affiche quand même les options", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={vocab} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(html).not.toContain("Tapez la lecture");
  expect(html).toContain("やくそぐ");
});

test("SSR corrigé : production + answered montre « Votre réponse » et les options", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={vocab} chosen={0} answered={true} onChoose={() => {}} onSpeak={() => {}} production={true} typed="やくそく" />,
  );
  expect(html).toContain("Votre réponse");
  expect(html).toContain("やくそく");
});

test("saisie + submit appelle onSubmitTyped avec le texte", () => {
  const calls: string[] = [];
  const div = document.createElement("div"); document.body.appendChild(div);
  const root = createRoot(div);
  act(() => {
    root.render(<QuestionCard question={vocab} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={(t) => calls.push(t)} />);
  });
  const input = div.querySelector("input") as HTMLInputElement;
  const form = div.querySelector("form") as HTMLFormElement;
  act(() => {
    input.value = "やくそく";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(calls).toEqual(["やくそく"]);
  act(() => root.unmount());
  div.remove();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/quiz/QuestionCard.production.test.tsx`
Expected: FAIL — le champ « Tapez la lecture » n'existe pas (les tests SSR échouent).

- [ ] **Step 3a: Update imports**

Dans `src/features/quiz/QuestionCard.tsx`, remplacer les lignes d'import 1–6 pour ajouter `isProductionEligible`/`checkReading` et `BTN_PRIMARY` :

```tsx
import { useEffect, useState } from "react";
import type { Question } from "../../types/quiz.ts";
import { PANEL, BTN_PRIMARY } from "../../ui/styles.ts";
import { furi } from "../../lib/dict.ts";
import { RATES, readRate, writeRate, type Rate } from "../../lib/audioRate.ts";
import { stopSpeaking } from "../../lib/tts.ts";
import { isProductionEligible, checkReading } from "../../lib/kana.ts";
```

- [ ] **Step 3b: Add the new props and input state**

Modifier la signature du composant (lignes 14–22) :

```tsx
export function QuestionCard({
  question, chosen, answered, onChoose, onSpeak,
  production = false, onSubmitTyped, typed = null,
}: {
  question: Question;
  chosen: number | null;
  answered: boolean;
  onChoose: (i: number) => void;
  onSpeak: (rate?: number) => void;
  production?: boolean;
  onSubmitTyped?: (text: string) => void;
  typed?: string | null;
}) {
```

Ajouter, après la déclaration `const [rate, setRate] = useState<Rate>(() => readRate());` (ligne 26) :

```tsx
  const [input, setInput] = useState("");
  // Le champ se vide à chaque nouvelle question (le composant peut ne pas remonter).
  useEffect(() => { setInput(""); }, [question.id]);
  const typing = production && isProductionEligible(question) && !answered;
```

- [ ] **Step 3c: Branch the answer area**

Remplacer le bloc des options (lignes 75–97, `<div className="flex flex-col gap-2">…</div>`) par :

```tsx
      {typing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) onSubmitTyped?.(input); }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            lang="ja"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Tapez la lecture en kana"
            className="rounded-lg px-4 py-2.5 text-base bg-surface-2 border border-line text-fg outline-none focus:border-accent"
          />
          <button type="submit" className={`self-start ${BTN_PRIMARY}`}>Valider</button>
        </form>
      ) : (
        <>
          {production && isProductionEligible(question) && answered && typed != null && (
            <div className="text-sm mb-1 text-fg-dim">
              Votre réponse : <span className="font-bold text-fg">{typed}</span>{" "}
              {checkReading(typed, question.o[question.a])
                ? <span className="text-status-completed font-bold">✓</span>
                : <span className="text-status-failed font-bold">✗</span>}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {question.o.map((opt, i) => {
              const isCorrectOpt = answered && i === question.a;
              const isWrongChosen = answered && !isCorrectOpt && i === chosen;
              const cls = isCorrectOpt
                ? "bg-surface-2 border border-status-completed text-status-completed"
                : isWrongChosen
                  ? "bg-surface-2 border border-status-failed text-status-failed"
                  : answered
                    ? "bg-surface-2 border border-line text-fg-dim"
                    : "bg-surface-2 border border-line text-fg hover:border-accent transition-colors";
              return (
                <button
                  key={i}
                  type="button"
                  disabled={answered}
                  onClick={() => onChoose(i)}
                  className={`text-left rounded-lg px-4 py-2.5 text-base cursor-pointer ${cls}`}
                  dangerouslySetInnerHTML={{ __html: furi(opt) }}
                />
              );
            })}
          </div>
        </>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/quiz/QuestionCard.production.test.tsx`
Expected: PASS (5 tests).

Run: `bun test src/features/quiz/QuestionCard.audio.test.tsx && bun run typecheck`
Expected: les tests audio existants restent verts (props nouvelles optionnelles) ; typecheck OK.

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz/QuestionCard.tsx src/features/quiz/QuestionCard.production.test.tsx
git commit -m "feat(rappel-actif): champ de saisie kana pour les questions éligibles"
```

---

### Task 5: Câblage `EntrainementApp` + toggle du hub

**Files:**
- Modify: `src/EntrainementApp.tsx`
- Test: `src/EntrainementApp.production.test.tsx`

**Interfaces:**
- Consumes: `readProduction`/`writeProduction` (Task 2) ; `quiz.submitTyped`/`quiz.typed` (Task 3) ; les props `production`/`onSubmitTyped`/`typed` de `QuestionCard` (Task 4).
- Produces: `EntrainementAppView` accepte `production?: boolean`, `onToggleProduction?: () => void`, `onSubmitTyped?: (t: string) => void`, `typed?: string | null` ; le container les câble.

- [ ] **Step 1: Write the failing test**

Create `src/EntrainementApp.production.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import type { Question } from "./types/quiz.ts";

const vocab: Question = { id: 1, cat: "vocabulaire", d: 1, q: "約束", o: ["やくそく", "X", "Y", "Z"], a: 0 };

test("hub : un toggle « rappel actif » est présent", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView
        phase="home" question={null} count={0} right={0} minutes={10} resume={null} chosen={null}
        onStart={() => {}} onChoose={() => {}} onNext={() => {}} onRestart={() => {}}
        onSetMinutes={() => {}} onResumeNow={() => {}} onDismissResume={() => {}}
        production={false} onToggleProduction={() => {}}
      />
    </MemoryRouter>,
  );
  expect(html).toContain("rappel actif");
});

test("question éligible + production : le champ de saisie remplace les options", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView
        phase="question" question={vocab} count={5} right={0} minutes={10} resume={null} chosen={null} index={0}
        onStart={() => {}} onChoose={() => {}} onNext={() => {}} onRestart={() => {}}
        onSetMinutes={() => {}} onResumeNow={() => {}} onDismissResume={() => {}}
        production={true} onSubmitTyped={() => {}} typed={null}
      />
    </MemoryRouter>,
  );
  expect(html).toContain("Tapez la lecture");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/EntrainementApp.production.test.tsx`
Expected: FAIL — le toggle « rappel actif » et le passage de `production` à `QuestionCard` n'existent pas encore.

- [ ] **Step 3a: Import the preference helpers**

Dans `src/EntrainementApp.tsx`, après la ligne 17 (`import { BTN_PRIMARY } from "./ui/styles.ts";`), ajouter :

```tsx
import { readProduction, writeProduction } from "./lib/production.ts";
```

- [ ] **Step 3b: Extend the view props**

Dans la signature de `EntrainementAppView` (lignes 22–33), ajouter au type des props (après `onBeginDiag?…onDiagDone?…`) :

```tsx
  production?: boolean; onToggleProduction?: () => void;
  onSubmitTyped?: (text: string) => void; typed?: string | null;
```

- [ ] **Step 3c: Add the hub toggle**

Dans la branche `props.phase === "home"` (lignes 40–48), ajouter le toggle sous `<SessionCard/>`, à l'intérieur du `<div className="flex flex-col gap-6">` :

```tsx
        <label className="flex items-center gap-3 text-fg text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={props.production ?? false}
            onChange={props.onToggleProduction}
            className="w-4 h-4 accent-accent"
          />
          <span>Mode rappel actif — taper les lectures (vocabulaire &amp; kanji)</span>
        </label>
```

- [ ] **Step 3d: Pass the props to both QuestionCard renders**

Dans la branche `props.phase === "question"` (ligne 60), remplacer la balise `<QuestionCard .../>` par :

```tsx
          <QuestionCard question={question} chosen={null} answered={false} onChoose={props.onChoose} onSpeak={onSpeak} production={props.production} onSubmitTyped={props.onSubmitTyped} typed={props.typed} />
```

Dans la branche `props.phase === "corrige"` (ligne 66), remplacer la balise `<QuestionCard .../>` par :

```tsx
          <QuestionCard question={question} chosen={props.chosen} answered={true} onChoose={() => {}} onSpeak={onSpeak} production={props.production} typed={props.typed} />
```

- [ ] **Step 3e: Wire the container**

Dans `EntrainementApp()` (lignes 89–113), après `const [resumeDismissed, setResumeDismissed] = useState(false);` (ligne 91), ajouter :

```tsx
  const [production, setProduction] = useState<boolean>(() => readProduction());
  const toggleProduction = () => setProduction((p) => { const n = !p; writeProduction(n); return n; });
```

Puis, dans le JSX `<EntrainementAppView … />` (lignes 99–111), ajouter ces props (par ex. après la ligne `onDiagDone={quiz.restart}`) :

```tsx
      production={production} onToggleProduction={toggleProduction}
      onSubmitTyped={quiz.submitTyped} typed={quiz.typed}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/EntrainementApp.production.test.tsx`
Expected: PASS (2 tests).

Run: `bun run typecheck && bun test`
Expected: typecheck OK ; toute la suite verte.

- [ ] **Step 5: Commit**

```bash
git add src/EntrainementApp.tsx src/EntrainementApp.production.test.tsx
git commit -m "feat(rappel-actif): toggle du hub + câblage submitTyped/typed"
```

---

## Notes d'intégration finale (après Task 5)

- **Vérification navigateur (facultative mais recommandée)** : `bun run build` puis charger `/entrainement`, activer le toggle, démarrer une session ; sur une question vocab/kanji à réponse kana, vérifier le champ, la validation (Entrée), le corrigé (« Votre réponse ✓/✗ » + bonne lecture en vert). Les questions non éligibles restent en QCM.
- **Pas de bump `sw.js`** : aucun asset livré ne change (seulement du JS bundlé).
- **Aucune écriture `data/graph/`**.
```
