import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { SKILLS, type Skill } from "./types/progress.ts";
import { clearCategoryCache } from "./lib/bank.ts";
import { graphFetch, RANGES } from "./testing/graphFixture.ts";
import { readRawProgress } from "./lib/storage.ts";
import { coverageBySkill, decodeBits } from "./lib/coverage.ts";

// Drives the real quiz flow (start → answer) and asserts choose() records coverage bitsets.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let origFetch: typeof fetch;


beforeEach(() => {
  localStorage.clear();
  clearCategoryCache();
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
  clearCategoryCache();
});

test("answering a question records it as seen and mastered (correct)", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ diagAt: Date.now() })); // recent diagnostic → composed path
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });

  const start = [...container.querySelectorAll("button")].find((b) => b.textContent === "Commencer");
  await act(async () => { start!.click(); await new Promise((r) => setTimeout(r, 0)); });

  // Click the first option ("a" → index 0 → correct, since every mocked question has a:0).
  const optA = [...container.querySelectorAll("button")].find((b) => b.textContent === "a");
  expect(optA).toBeTruthy();
  await act(async () => { optA!.click(); await new Promise((r) => setTimeout(r, 0)); });

  const raw = readRawProgress()!;
  const cov = coverageBySkill(
    decodeBits(typeof raw.seen === "string" ? raw.seen : ""),
    decodeBits(typeof raw.mastered === "string" ? raw.mastered : ""),
    RANGES,
  );
  const seenN = SKILLS.reduce((n, c) => n + (cov[c]?.seenN ?? 0), 0);
  const masteredN = SKILLS.reduce((n, c) => n + (cov[c]?.masteredN ?? 0), 0);
  expect(seenN).toBe(1);      // exactly the one answered question is marked seen
  expect(masteredN).toBe(1);  // correct → also mastered
});
