import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { clearCategoryCache } from "./lib/bank.ts";
import { clearRappelCache } from "./features/quiz/rappel.ts";
import { clearCoursCache } from "./features/cours/useCours.ts";
import { graphFetch } from "./testing/graphFixture.ts";
import { readCadence, readRawProgress } from "./lib/storage.ts";
import { asBits } from "./lib/blob.ts";
import { masteredCount } from "./lib/coverage.ts";
import { dayNumber } from "./features/quiz/traps.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root; let origFetch: typeof fetch;

beforeEach(() => {
  localStorage.clear(); clearCategoryCache(); clearRappelCache(); clearCoursCache();
  origFetch = globalThis.fetch;
  globalThis.fetch = graphFetch();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => { root.unmount(); }); container.remove(); globalThis.fetch = origFetch; clearCategoryCache(); clearRappelCache(); clearCoursCache(); });

async function click(text: string) {
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  expect(btn, `button "${text}"`).toBeTruthy();
  await act(async () => { btn!.click(); await new Promise((r) => setTimeout(r, 0)); });
}

// Le fixture met la bonne réponse à l'index 0 (`jlpt:answer: 0`, opts ["a","b","c","d"]) : cliquer
// « a » répond juste à chaque fois → chaque question devient « apprise ». On vérifie que le journal
// de cadence enregistre exactement la croissance du bitset appris (progrès du jour = maîtrises gagnées).
test("le journal de cadence reste en phase avec le bitset appris (progrès du jour = maîtrises gagnées)", async () => {
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  await click("Commencer");           // pas de diagAt → diagnostic
  await click("Commencer le test");
  for (let i = 0; i < 60 && !(container.textContent ?? "").includes("Ton niveau estimé"); i++) {
    const opt = [...container.querySelectorAll("button")].find((b) => b.textContent === "a"); // index 0 = correct
    if (!opt) break;
    await act(async () => { opt.click(); await new Promise((r) => setTimeout(r, 0)); });
  }

  const mastered = masteredCount(asBits(readRawProgress(), "mastered"));
  const cad = readCadence();
  const today = dayNumber(new Date());
  expect(mastered).toBeGreaterThan(0);          // on a réellement appris des questions
  expect(cad.byDay[today] ?? 0).toBe(mastered); // le journal = croissance du bitset appris
});
