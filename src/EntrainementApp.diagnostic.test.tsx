import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { SKILLS } from "./types/progress.ts";
import { clearCategoryCache } from "./lib/bank.ts";
import { graphFetch } from "./testing/graphFixture.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root; let origFetch: typeof fetch;


beforeEach(() => {
  localStorage.clear(); clearCategoryCache();
  origFetch = globalThis.fetch;
  globalThis.fetch = graphFetch();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => { root.unmount(); }); container.remove(); globalThis.fetch = origFetch; clearCategoryCache(); });

async function click(text: string) {
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  expect(btn, `button "${text}"`).toBeTruthy();
  await act(async () => { btn!.click(); await new Promise((r) => setTimeout(r, 0)); });
}

test("first-ever Commencer runs a diagnostic: intro → straight-through → estimated level + diagAt", async () => {
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  await click("Commencer");                       // no diagAt → diagnostic due
  expect(container.textContent ?? "").toContain("Mode test"); // intro notifies

  await click("Commencer le test");               // begin; first question shows
  expect(container.textContent ?? "").toContain("Test · question 1 /");

  // answer straight-through until the report appears (no "Suivant" between questions)
  for (let i = 0; i < 60 && !(container.textContent ?? "").includes("Ton niveau estimé"); i++) {
    const opt = [...container.querySelectorAll("button")].find((b) => /^[abcd]$/.test(b.textContent ?? ""));
    if (!opt) break;
    await act(async () => { opt.click(); await new Promise((r) => setTimeout(r, 0)); });
  }
  const text = container.textContent ?? "";
  expect(text).toContain("Ton niveau estimé");
  expect(text).toContain("Correction");
  const blob = JSON.parse(localStorage.getItem("jlptN3adapt_v2") ?? "{}");
  expect(typeof blob.diagAt).toBe("number"); // completion stamped
});

test("a recent diagnostic (<7d) skips the test — Commencer builds a normal session", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 0, skill: {}, diagAt: Date.now() }));
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  await click("Commencer");
  const text = container.textContent ?? "";
  expect(text).not.toContain("Mode test");   // no diagnostic
  expect(text).toContain("Q-");              // a normal question is showing
});

// MAJOR #5b: entering a diagnostic must clear a pending normal-session resume so it can't
// resurface on a later reload.
test("entering the diagnostic clears a pending resume session", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 0, skill: {} })); // no diagAt → diagnostic due
  localStorage.setItem("jlptN3quiz_resume", JSON.stringify({ kind: "quiz", ids: [1, 2, 3], qi: 1, right: 1, t: Date.now() }));
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  await click("Nouvelle session"); // resume card shown → dismiss to reveal Commencer
  await click("Commencer");         // diagnostic due → diag-intro; start() clears the resume
  expect(container.textContent ?? "").toContain("Mode test");
  expect(localStorage.getItem("jlptN3quiz_resume")).toBeNull(); // stale resume gone
});
