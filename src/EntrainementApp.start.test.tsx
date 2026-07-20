import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { SKILLS } from "./types/progress.ts";
import { clearCategoryCache } from "./lib/bank.ts";
import { graphFetch, ALL_ORDS, PER_SKILL } from "./testing/graphFixture.ts";

// Reproduces the hub "Commencer" click: onStart={quiz.start} makes React pass the click
// event as start's first arg. Guards against the NaN-session regression (resolveMinutes).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let origFetch: typeof fetch;


beforeEach(() => {
  localStorage.clear();
  clearCategoryCache(); // isolate the shared loadCategory memo from other test files
  origFetch = globalThis.fetch;
  globalThis.fetch = graphFetch();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  globalThis.fetch = origFetch;
  clearCategoryCache(); // don't leak our mocked pools into other test files
});

test("clicking Commencer starts a session (event arg does not NaN the session length)", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ diagAt: Date.now() })); // recent diagnostic → composed path
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });

  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Commencer");
  expect(btn).toBeTruthy();

  await act(async () => {
    btn!.click();
    await new Promise((r) => setTimeout(r, 0));
  });

  const text = container.textContent ?? "";
  expect(text).not.toContain("Lancer une session"); // left the hub → in the quiz flow
  expect(text).toContain("Q-");                      // a mocked question is showing
});

test("a session with stored errors injects the recent wrong ids without duplicates and keeps the budget", async () => {
  // 4 real ids across 2 categories (les deux premiers de grammaire et de vocabulaire ; les
  // ordinaux sont GROUPÉS par compétence, donc grammaire occupe [0, 7] et vocabulaire [8, 15])
  // — tous dans le plafond de 30 % (floor(0.3*15) = 4), donc chacun doit survivre dans la
  // tranche « erreurs récentes ».
  const wrongIds = [0, 1, PER_SKILL, PER_SKILL + 1];
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ wrong: wrongIds, diagAt: Date.now() }));

  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });

  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Commencer");
  expect(btn).toBeTruthy();

  await act(async () => {
    btn!.click();
    await new Promise((r) => setTimeout(r, 0));
  });

  const raw = localStorage.getItem("jlptN3quiz_resume");
  expect(raw).toBeTruthy();
  const resume = JSON.parse(raw!) as { kind: string; ids: number[] };

  for (const id of wrongIds) expect(resume.ids).toContain(id);
  expect(resume.ids.length).toBe(15); // budget for the default 10 min: round(10*1.5)
  expect(new Set(resume.ids).size).toBe(resume.ids.length); // no duplicates errors↔adaptive
});

test("corpus-fetch failure degrades to an adaptive-only session (no crash, budget kept)", async () => {
  // Seed errors that would be injected IF the corpus resolved.
  const someIds = ALL_ORDS.slice(0, 4);
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ wrong: someIds, diagAt: Date.now() }));
  // Override the harness fetch: fail only corpus.jsonld, still serve the skill shards.
  const served = graphFetch();
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes("corpus.jsonld")) throw new Error("network down");
    return served(url as unknown as RequestInfo);
  }) as unknown as typeof fetch;

  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Commencer");
  await act(async () => { btn!.click(); await new Promise((r) => setTimeout(r, 0)); });

  const resume = JSON.parse(localStorage.getItem("jlptN3quiz_resume") ?? "null");
  expect(resume).toBeTruthy();               // a session was built
  expect(resume.ids).toHaveLength(15);        // full budget, adaptive-only
  expect(new Set(resume.ids).size).toBe(15);  // no duplicates
});
