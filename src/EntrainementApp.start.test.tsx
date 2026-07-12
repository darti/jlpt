import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { SKILLS } from "./types/progress.ts";
import { clearCategoryCache } from "./lib/bank.ts";

// Reproduces the hub "Commencer" click: onStart={quiz.start} makes React pass the click
// event as start's first arg. Guards against the NaN-session regression (resolveMinutes).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let origFetch: typeof fetch;

function pool(cat: string, base: number) {
  return Array.from({ length: 8 }, (_, i) => ({
    id: base + i, cat, d: ((i % 3) + 1), q: `Q-${cat}-${i}`, o: ["a", "b", "c", "d"], a: 0,
  }));
}

const BANK: Record<string, ReturnType<typeof pool>> = {};
SKILLS.forEach((c, idx) => { BANK[c] = pool(c, (idx + 1) * 100); });
const INDEX: Record<number, string> = {};
Object.values(BANK).flat().forEach((q) => { INDEX[q.id] = q.cat; });

beforeEach(() => {
  localStorage.clear();
  clearCategoryCache(); // isolate the shared loadCategory memo from other test files
  origFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const u = String(url);
    if (u.includes("bank-index")) return { json: async () => INDEX };
    const m = u.match(/bank-([a-z]+)\.json/);
    if (m && BANK[m[1]]) return { json: async () => BANK[m[1]] };
    return { json: async () => ({}) };
  }) as unknown as typeof fetch;
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
