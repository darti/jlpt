import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCoverage } from "./useCoverage.ts";
import { setBit, encodeBits, emptyBits, type SkillCoverage } from "../../lib/coverage.ts";
import { clearGraphCache } from "../../lib/graph.ts";
import type { Progress, Skill } from "../../types/progress.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const origFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = origFetch; clearGraphCache(); });

test("useCoverage returns per-skill % once the corpus loads", async () => {
  clearGraphCache();
  globalThis.fetch = (() =>
    Promise.resolve({ json: () => Promise.resolve({ "@graph": [
      { "jlpt:skill": "grammaire", "jlpt:from": 0, "jlpt:count": 2 },
      { "jlpt:skill": "kanji", "jlpt:from": 2, "jlpt:count": 1 },
    ] }) })
  ) as unknown as typeof fetch;

  let seen = emptyBits(); seen = setBit(seen, 0); // 1 of 2 grammaire ids seen
  const p: Progress = { total: 1, skill: {}, seen: encodeBits(seen), mastered: encodeBits(emptyBits()) };

  let captured: Record<Skill, SkillCoverage> | null = null;
  function Probe() { captured = useCoverage(p); return null; }

  const host = document.createElement("div");
  const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  await act(async () => { await Promise.resolve(); }); // flush the corpus promise → re-render

  expect(captured).not.toBeNull();
  expect(captured!.grammaire.seen).toBe(50);
  expect(captured!.kanji.seen).toBe(0);
  await act(async () => { root.unmount(); });
});

test("useCoverage returns null before the corpus resolves / when progress is null", () => {
  clearGraphCache();
  globalThis.fetch = (() => new Promise(() => {})) as unknown as typeof fetch; // never resolves

  let captured: Record<Skill, SkillCoverage> | null | undefined;
  function Probe() { captured = useCoverage(null); return null; }
  const host = document.createElement("div");
  const root: Root = createRoot(host);
  act(() => { root.render(<Probe />); });
  expect(captured).toBeNull();
  act(() => { root.unmount(); });
});
