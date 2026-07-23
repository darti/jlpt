import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { clearCategoryCache } from "./lib/bank.ts";
import { clearRappelCache } from "./features/quiz/rappel.ts";
import { readRawProgress } from "./lib/storage.ts";
import { PROGRESS_KEY, PROD_KEY } from "./lib/keys.ts";

// Pilote le VRAI hook en mode rappel actif : monte EntrainementApp, tape une lecture, valide, et
// vérifie que `submitTyped` → `commitAnswer` → `answerPatch` → `writeProgress` a bien écrit la
// progression (et jamais le graphe de confusion). Complète les tests purs d'`answerPatch`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Corpus vocab-ONLY à réponses kana → CHAQUE question de session est production-éligible, donc
// le champ de saisie s'affiche toujours (pas de QCM qui masquerait l'input).
const VOCAB_Q = Array.from({ length: 6 }, (_, i) => ({
  "@id": `jlpt:q/${i}`, "@type": "jlpt:Question",
  "jlpt:skill": "vocabulaire", "jlpt:difficulty": (i % 3) + 1, "jlpt:ord": i,
  "jlpt:stem": `語彙${i}`,
  opts: ["やくそく", "やくそぐ", "やくぞく", "やくそ"], "jlpt:answer": 0,
}));

function eligibleFetch(): typeof fetch {
  return (async (url: string) => {
    const u = String(url);
    if (u.includes("corpus.jsonld")) {
      return { json: async () => ({ "@graph": [{
        "@id": "jlpt:corpus/vocabulaire", "@type": "jlpt:SkillRange",
        "jlpt:skill": "vocabulaire", "jlpt:from": 0, "jlpt:count": VOCAB_Q.length,
      }] }) };
    }
    if (/q-vocabulaire\.jsonld/.test(u)) return { json: async () => ({ "@graph": VOCAB_Q }) };
    return { json: async () => ({}) }; // autres shards + docs du rappel : vides
  }) as unknown as typeof fetch;
}

let container: HTMLDivElement;
let root: Root;
let origFetch: typeof fetch;

beforeEach(() => {
  localStorage.clear();
  clearCategoryCache(); clearRappelCache();
  origFetch = globalThis.fetch;
  globalThis.fetch = eligibleFetch();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  globalThis.fetch = origFetch;
  clearCategoryCache(); clearRappelCache();
});

const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

/** Monte, démarre une session, et rend le champ de saisie de la 1re question production. */
async function startAndGetInput(): Promise<HTMLInputElement> {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ diagAt: Date.now() })); // récent → chemin composé (pas de diagnostic)
  localStorage.setItem(PROD_KEY, "1"); // mode rappel actif ON
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  const start = [...container.querySelectorAll("button")].find((b) => b.textContent === "Commencer");
  await act(async () => { start!.click(); await new Promise((r) => setTimeout(r, 0)); });
  const input = container.querySelector("input[type=text]") as HTMLInputElement;
  expect(input).toBeTruthy(); // question éligible → saisie, pas de boutons d'option
  return input;
}

async function typeAndSubmit(input: HTMLInputElement, text: string): Promise<void> {
  await act(async () => {
    nativeSetter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  const valider = [...container.querySelectorAll("button")].find((b) => b.textContent === "Valider");
  expect(valider).toBeTruthy();
  await act(async () => { valider!.click(); await new Promise((r) => setTimeout(r, 0)); });
}

test("production JUSTE : la lecture tapée enregistre right+1, sans graphe de confusion", async () => {
  const input = await startAndGetInput();
  await typeAndSubmit(input, "やくそく"); // == o[0] → correct

  const raw = readRawProgress()!;
  expect(raw.total).toBe(1);
  expect(raw.right).toBe(1);
  expect(typeof raw.seen).toBe("string");     // bit « vu » posé
  expect(raw.confusions).toBeUndefined();     // production → JAMAIS de graphe de confusion (bout-en-bout)
});

test("production FAUSSE : la lecture erronée va dans wrong[], toujours sans confusion", async () => {
  const input = await startAndGetInput();
  await typeAndSubmit(input, "ばつ"); // ne matche aucune option → incorrect

  const raw = readRawProgress()!;
  expect(raw.total).toBe(1);
  expect(raw.right).toBe(0);
  expect(Array.isArray(raw.wrong) && (raw.wrong as number[]).length).toBe(1); // l'id ajouté aux erreurs
  expect(raw.confusions).toBeUndefined(); // chosen=null en production → pas de patch de confusion
});
