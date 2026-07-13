import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";
import { SKILLS } from "./types/progress.ts";
import { clearCategoryCache } from "./lib/bank.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root; let origFetch: typeof fetch;

function pool(cat: string, base: number) {
  return Array.from({ length: 12 }, (_, i) => ({
    id: base + i, cat, d: ((i % 3) + 1), q: `Q-${cat}-${i}`, o: ["a", "b", "c", "d"], a: 0,
  }));
}
const BANK: Record<string, ReturnType<typeof pool>> = {};
SKILLS.forEach((c, idx) => { BANK[c] = pool(c, (idx + 1) * 100); });
const INDEX: Record<number, string> = {};
Object.values(BANK).flat().forEach((q) => { INDEX[q.id] = q.cat; });

beforeEach(() => {
  localStorage.clear(); clearCategoryCache();
  origFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    const u = String(url);
    if (u.includes("bank-index")) return { json: async () => INDEX };
    const m = u.match(/bank-([a-z]+)\.json/);
    if (m && BANK[m[1]]) return { json: async () => BANK[m[1]] };
    return { json: async () => ({}) };
  }) as unknown as typeof fetch;
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => { root.unmount(); }); container.remove(); globalThis.fetch = origFetch; clearCategoryCache(); });

async function commencer() {
  act(() => { root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>); });
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Commencer");
  await act(async () => { btn!.click(); await new Promise((r) => setTimeout(r, 0)); });
}

test("with everything unseen, a session includes a learn slice — full budget, no duplicates", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 0, skill: {}, diagAt: Date.now() })); // recent diag, no seen
  await commencer();
  const resume = JSON.parse(localStorage.getItem("jlptN3quiz_resume") ?? "null");
  expect(resume).toBeTruthy();
  expect(resume.ids).toHaveLength(15);                 // budget kept (learn + adaptive)
  expect(new Set(resume.ids).size).toBe(15);            // no duplicates across errors/learn/adaptive
  expect(resume.ids.every((id: number) => id in INDEX)).toBe(true); // real bank items
});

test("with all items already seen, learn is empty and the session is still built", async () => {
  // Mark every bank id as seen so newCoursePoints = 0 → learn = 0.
  const { encodeBits, setBit, emptyBits } = await import("./lib/coverage.ts");
  let seen = emptyBits();
  for (const id of Object.keys(INDEX)) seen = setBit(seen, Number(id));
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 0, skill: {}, diagAt: Date.now(), seen: encodeBits(seen) }));
  await commencer();
  const resume = JSON.parse(localStorage.getItem("jlptN3quiz_resume") ?? "null");
  expect(resume).toBeTruthy();
  expect(resume.ids).toHaveLength(15);       // adaptive fills the whole budget (learn = 0)
  expect(new Set(resume.ids).size).toBe(15);  // no duplicates
});
