# Écoute audio-first — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'audio des questions d'écoute central : lecture au chargement (auto-play), bouton Réécouter, et vitesse variable persistée.

**Architecture:** Une couche de préférence pure (`audioRate.ts` + clé `RATE_KEY`), `tts.ts` gagne un débit paramétrable + `stopSpeaking()`, et la branche `ecoute` de `QuestionCard` orchestre l'auto-play/réécoute/vitesse via la prop `onSpeak(rate?)`. Le flux du quiz et `speechTextFor` restent intacts.

**Tech Stack:** bun (runtime, tests), React + TypeScript, happy-dom, Web Speech API.

**Spec:** `docs/superpowers/specs/2026-07-23-ecoute-audio-first-design.md`

## Global Constraints

- **Worktree `.worktrees/ecoute`, branche `feat/ecoute-audio`.** Jamais dans le répertoire principal.
- **`bun` EXCLUSIVEMENT, jamais `node`.** Tests : `bun test <fichier>`. Typecheck : `bun run typecheck`.
- **Pas de linter** : `bun run typecheck` + `bun test` font foi. Ne pas en ajouter.
- **Zéro dépendance nouvelle.**
- Commentaires et messages de commit en **français**, conventional commits. **PAS de ligne Co-Authored-By.**
- **Commit : message COURT à UNE ligne** via `git commit -m "..."`. PAS de heredoc (un hook du dépôt déclenche une revue d'équipe et fait parfois échouer le commit — si bloqué, laisser STAGÉ proprement et le signaler).
- **Aucune touche à `data/graph/`, aucun contenu nouveau. Pas d'asset livré modifié → PAS de bump `sw.js`.**
- ⚠ **`RATE_KEY` = `"jlptN3_ecouteRate"`, SEUL ajout à `keys.ts`** — préfixe `jlptN3` obligatoire (sinon jamais synchronisée par Gist).
- Trois débits : **0.7 / 0.9 / 1.0** (0.9 = défaut, le débit actuel). Persistés.
- ⚠ `renderToStaticMarkup` échappe les apostrophes → asserter sur des sous-chaînes SANS apostrophe.
- Tests happy-dom : `import { act } from "react"` + `import { createRoot } from "react-dom/client"` (patron existant, ex. `src/ui/Footer.handlers.test.tsx`).

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/keys.ts` | **modifié** — ajoute `RATE_KEY` |
| `src/lib/audioRate.ts` | **créé** — `RATES`, `readRate`, `writeRate` (purs) |
| `src/lib/audioRate.test.ts` | **créé** — défaut / persistance / rabat |
| `src/lib/tts.ts` | **modifié** — `speak(text, rate?)`, `speakQuestion(q, rate?)`, `stopSpeaking()` |
| `src/lib/tts.test.ts` | **modifié** — `speak(rate)` ne jette pas ; `stopSpeaking` no-op sûr |
| `src/features/quiz/QuestionCard.tsx` | **modifié** — branche `ecoute` : auto-play, Réécouter, vitesse |
| `src/features/quiz/QuestionCard.audio.test.tsx` | **créé** — SSR + happy-dom (auto-play) |
| `src/EntrainementApp.tsx` | **modifié** — `onSpeak = (rate) => speakQuestion(question, rate)` |

---

## Task 1 : la préférence de débit (pure)

**Files:**
- Modify: `src/lib/keys.ts` (ajout après `fsKey`/`GH_CFG_KEY`)
- Create: `src/lib/audioRate.ts`
- Test: `src/lib/audioRate.test.ts`

**Interfaces:**
- Consumes: `RATE_KEY` de `./keys.ts` (ajouté ici).
- Produces: `RATES: readonly [0.7, 0.9, 1.0]`, `type Rate`, `readRate(store?): Rate`, `writeRate(rate, store?): Rate`.

- [ ] **Step 1 : écrire le test qui échoue**

`src/lib/audioRate.test.ts` :

```ts
import { test, expect } from "bun:test";
import { RATES, readRate, writeRate } from "./audioRate.ts";
import { RATE_KEY } from "./keys.ts";

// Store en mémoire injectable — pas de dépendance au localStorage global.
function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

test("les trois débits sont 0.7 / 0.9 / 1.0", () => {
  expect([...RATES]).toEqual([0.7, 0.9, 1.0]);
});

test("readRate : défaut 0.9 quand rien n'est stocké", () => {
  expect(readRate(memStore())).toBe(0.9);
});

test("writeRate puis readRate : la valeur persiste", () => {
  const s = memStore();
  writeRate(0.7, s);
  expect(readRate(s)).toBe(0.7);
  writeRate(1.0, s);
  expect(readRate(s)).toBe(1.0);
});

test("readRate : rabat une valeur hors des trois crans sur 0.9", () => {
  expect(readRate(memStore({ [RATE_KEY]: "0.85" }))).toBe(0.9);
  expect(readRate(memStore({ [RATE_KEY]: "abc" }))).toBe(0.9);
  expect(readRate(memStore({ [RATE_KEY]: "2" }))).toBe(0.9);
});

test("readRate : un getItem qui jette → défaut, aucune exception", () => {
  const bad = { getItem: () => { throw new Error("boom"); } };
  expect(readRate(bad)).toBe(0.9);
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run: `bun test src/lib/audioRate.test.ts`
Expected: FAIL — `Cannot find module './audioRate.ts'`.

- [ ] **Step 3 : ajouter la clé, puis le module**

Dans `src/lib/keys.ts`, après `GH_CFG_KEY` (ou `PENDING_KEY`) :

```ts
/** Débit de lecture TTS des questions d'écoute (préférence, comme le thème/furi). */
export const RATE_KEY = "jlptN3_ecouteRate";
```

`src/lib/audioRate.ts` :

```ts
import { RATE_KEY } from "./keys.ts";

/** Les trois débits de lecture de l'écoute : lent, normal (défaut), rapide. */
export const RATES = [0.7, 0.9, 1.0] as const;
export type Rate = (typeof RATES)[number];

const DEFAULT_RATE: Rate = 0.9;

/** Le débit d'écoute persisté (défaut 0.9). Toute valeur hors des trois crans est rabattue
 *  sur 0.9. Pur — le store est injectable. */
export function readRate(store: Pick<Storage, "getItem"> = globalThis.localStorage): Rate {
  try {
    const v = Number(store.getItem(RATE_KEY));
    return (RATES as readonly number[]).includes(v) ? (v as Rate) : DEFAULT_RATE;
  } catch { return DEFAULT_RATE; }
}

/** Persiste le débit d'écoute ; best-effort. Rend la valeur écrite. */
export function writeRate(
  rate: Rate, store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage,
): Rate {
  try { store.setItem(RATE_KEY, String(rate)); } catch { /* best-effort */ }
  return rate;
}
```

- [ ] **Step 4 : lancer + typecheck**

Run: `bun test src/lib/audioRate.test.ts && bun run typecheck`
Expected: PASS — 5 tests, `tsc` propre.

- [ ] **Step 5 : commit**

```bash
git add src/lib/keys.ts src/lib/audioRate.ts src/lib/audioRate.test.ts
git commit -m "feat(ecoute): preference de debit TTS persistee (RATE_KEY, audioRate)"
```

---

## Task 2 : débit paramétrable + arrêt (`tts.ts`)

**Files:**
- Modify: `src/lib/tts.ts` (`speak`, `speakQuestion`, ajout `stopSpeaking`)
- Test: `src/lib/tts.test.ts` (ajouts ; créer le fichier s'il n'existe pas)

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: `speak(text: string, rate?: number)`, `speakQuestion(question: Question, rate?: number)`, `stopSpeaking(): void`.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `src/lib/tts.test.ts` (créer le fichier avec l'import s'il n'existe pas) :

```ts
import { test, expect } from "bun:test";
import { speak, stopSpeaking, speechTextFor } from "./tts.ts";
import type { Question } from "../types/quiz.ts";

test("speak avec un débit ne jette pas quand speechSynthesis est absent", () => {
  expect(() => speak("こんにちは", 0.7)).not.toThrow();
  expect(() => speak("こんにちは")).not.toThrow(); // défaut
});

test("stopSpeaking ne jette pas quand speechSynthesis est absent", () => {
  expect(() => stopSpeaking()).not.toThrow();
});

test("speechTextFor (écoute) rend le script, inchangé", () => {
  const q = { id: 1, cat: "ecoute", d: 1, q: "?", o: ["a"], a: 0, script: "駅はどこ" } as Question;
  expect(speechTextFor(q)).toBe("駅はどこ");
});
```

⚠ happy-dom ne fournit PAS `speechSynthesis` → `speak`/`stopSpeaking` empruntent le chemin no-op
(le `typeof speechSynthesis === "undefined"` en garde). Ces tests vérifient l'absence d'exception,
pas une prononciation réelle.

- [ ] **Step 2 : lancer, vérifier l'échec**

Run: `bun test src/lib/tts.test.ts`
Expected: FAIL — `stopSpeaking` n'existe pas / `speak` n'accepte pas de 2ᵉ argument (selon l'état).

- [ ] **Step 3 : modifier `tts.ts`**

Remplacer `speak`, `speakQuestion`, et ajouter `stopSpeaking` :

```ts
export function speak(text: string, rate = 0.9): void {
  if (typeof speechSynthesis === "undefined") return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP"; u.rate = rate; if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

/** Interrompt toute lecture en cours (garde le composant à distance de speechSynthesis brut). */
export function stopSpeaking(): void {
  if (typeof speechSynthesis === "undefined") return;
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
}
```

et, plus bas, `speakQuestion` prend le débit :

```ts
/** Speak a question's Japanese aloud (no-op when speech synthesis is unavailable). */
export function speakQuestion(question: Question, rate = 0.9): void {
  speak(speechTextFor(question), rate);
}
```

⚠ `speechTextFor` **ne change pas** (déjà pur/testé).

- [ ] **Step 4 : lancer + suite complète + typecheck**

Run: `bun test src/lib/tts.test.ts && bun run typecheck && bun test`
Expected: PASS ; suite complète à 0 échec (le débit par défaut 0.9 = comportement inchangé pour les appelants existants).

- [ ] **Step 5 : commit**

```bash
git add src/lib/tts.ts src/lib/tts.test.ts
git commit -m "feat(ecoute): debit TTS parametrable et stopSpeaking"
```

---

## Task 3 : contrôles audio dans `QuestionCard`

**Files:**
- Modify: `src/features/quiz/QuestionCard.tsx`, `src/EntrainementApp.tsx`
- Test: `src/features/quiz/QuestionCard.audio.test.tsx`

**Interfaces:**
- Consumes: `RATES`, `readRate`, `writeRate`, `type Rate` de `../../lib/audioRate.ts` ; `stopSpeaking` de `../../lib/tts.ts` ; `speakQuestion` de `../../lib/tts.ts` (dans EntrainementApp).
- Produces: `QuestionCard`'s `onSpeak` prop devient `(rate?: number) => void`.

- [ ] **Step 1 : écrire les tests qui échouent**

`src/features/quiz/QuestionCard.audio.test.tsx` :

```tsx
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QuestionCard } from "./QuestionCard.tsx";
import type { Question } from "../../types/quiz.ts";

const ecoute: Question = { id: 1, cat: "ecoute", d: 1, q: "何を頼みましたか。", o: ["A", "B"], a: 0, script: "…" };
const gram: Question = { id: 2, cat: "grammaire", d: 1, q: "家に___", o: ["A", "B"], a: 0 };

test("SSR : une question d'écoute rend Réécouter + le sélecteur de vitesse", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={ecoute} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(html).toContain("Réécouter");
  expect(html).toContain("Lent");
  expect(html).toContain("Rapide");
});

test("SSR : une question de grammaire n'a AUCUN contrôle audio", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={gram} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(html).not.toContain("Réécouter");
});

test("auto-play : monter une question d'écoute appelle onSpeak une fois", () => {
  const calls: unknown[] = [];
  const div = document.createElement("div"); document.body.appendChild(div);
  const root = createRoot(div);
  act(() => {
    root.render(<QuestionCard question={ecoute} chosen={null} answered={false} onChoose={() => {}} onSpeak={(r) => calls.push(r)} />);
  });
  expect(calls.length).toBe(1);
  act(() => root.unmount());
  div.remove();
});

test("pas d'auto-play sur une question non-écoute", () => {
  const calls: unknown[] = [];
  const div = document.createElement("div"); document.body.appendChild(div);
  const root = createRoot(div);
  act(() => {
    root.render(<QuestionCard question={gram} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => calls.push(1)} />);
  });
  expect(calls.length).toBe(0);
  act(() => root.unmount());
  div.remove();
});
```

- [ ] **Step 2 : lancer, vérifier l'échec**

Run: `bun test src/features/quiz/QuestionCard.audio.test.tsx`
Expected: FAIL — pas de « Réécouter »/« Lent », auto-play non câblé.

- [ ] **Step 3 : modifier `QuestionCard.tsx`**

En tête, remplacer/compléter les imports :

```tsx
import { useEffect, useState } from "react";
import type { Question } from "../../types/quiz.ts";
import { PANEL } from "../../ui/styles.ts";
import { furi } from "../../lib/dict.ts";
import { RATES, readRate, writeRate, type Rate } from "../../lib/audioRate.ts";
import { stopSpeaking } from "../../lib/tts.ts";

const RATE_LABEL: Record<number, string> = { 0.7: "Lent", 0.9: "Normal", 1.0: "Rapide" };
```

Changer le type de la prop `onSpeak` :

```tsx
  onSpeak: (rate?: number) => void;
```

Au début du corps de `QuestionCard`, ajouter l'état de débit + l'auto-play :

```tsx
  const [rate, setRate] = useState<Rate>(() => readRate());

  // Auto-play : à l'arrivée d'une NOUVELLE question d'écoute non encore répondue, lire le
  // dialogue. Deps volontairement [question.id] uniquement (pas `rate`/`onSpeak`/`answered`) :
  // sinon un changement de vitesse ou un re-render rejouerait l'audio. Nettoyage = stopSpeaking
  // (via tts.ts, pas speechSynthesis brut) → aucune lecture ne survit au changement de question.
  useEffect(() => {
    if (question.cat === "ecoute" && !answered) onSpeak(rate);
    return () => stopSpeaking();
  }, [question.id]);
```

Remplacer le bloc du bouton « ▶ Écouter » (la branche `question.cat === "ecoute"`) par le cluster de contrôles :

```tsx
      {question.cat === "ecoute" && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onSpeak(rate)}
            className="inline-flex items-center gap-2 bg-accent text-fg-on-accent border-none rounded-lg px-4 py-2 text-sm font-bold cursor-pointer"
          >
            ↻ Réécouter
          </button>
          <span className="text-fg-dim text-meta ml-1">Vitesse</span>
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setRate(r); writeRate(r); }}
              className={`rounded-lg px-3 py-1.5 text-sm cursor-pointer border ${
                r === rate ? "bg-surface-2 border-accent text-accent" : "bg-surface-2 border-line text-fg-dim"
              }`}
            >
              {RATE_LABEL[r]}
            </button>
          ))}
        </div>
      )}
```

⚠ Ne PAS toucher au reste de `QuestionCard` (passage lecture, énoncé, options, `#id`).

- [ ] **Step 4 : câbler le débit dans `EntrainementApp.tsx`**

Remplacer la définition de `onSpeak` :

```tsx
  const onSpeak = (rate?: number) => { if (question) speakQuestion(question, rate); };
```

⚠ `DiagnosticResults.tsx` passe `onSpeak={() => speakQuestion(a.question)}` — reste valide (la prop `(rate?) => void` accepte une fonction sans argument). Ne pas le modifier.

- [ ] **Step 5 : lancer les tests audio + suite + typecheck**

Run: `bun test src/features/quiz/QuestionCard.audio.test.tsx && bun run typecheck && bun test`
Expected: PASS (4 tests audio) ; `tsc` propre ; suite complète 0 échec. ⚠ `quiz.test.tsx` (QuestionCard SSR sur une question `grammaire` + `onSpeak={() => {}}`) doit rester vert : la prop `() => {}` est assignable à `(rate?) => void`, et une question `grammaire` n'a pas de contrôle audio.

- [ ] **Step 6 : build (confirme aucun asset livré touché)**

Run: `bun run build`
Expected: build propre. Aucun `sw.js`/`data/` modifié.

- [ ] **Step 7 : commit**

```bash
git add src/features/quiz/QuestionCard.tsx src/EntrainementApp.tsx src/features/quiz/QuestionCard.audio.test.tsx
git commit -m "feat(ecoute): auto-play, reecoute et vitesse dans QuestionCard"
```

---

## Vérification finale

- [ ] `bun run typecheck` — sans erreur
- [ ] `bun test` — 0 échec
- [ ] `bun run build` — build propre
- [ ] **PAS de bump `sw.js`** (aucun asset livré modifié)
- [ ] `speechTextFor`, `useQuiz`, `composeSession`, `pickAdaptive` **hors diff** (non touchés)
- [ ] `RATE_KEY` porte le préfixe `jlptN3` (sinon jamais synchronisée)
