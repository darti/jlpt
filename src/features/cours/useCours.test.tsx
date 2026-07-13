import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCours } from "./useCours.ts";
import type { CoursCategory } from "./coursSchema.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = origFetch; });

test("useCours charge gram/vocab/kanji/method dans l'ordre", async () => {
  const fake: Record<string, unknown> = {
    "data/cours-gram.json":   { id: "gram", title: "G", kind: "learn", groups: [] },
    "data/cours-vocab.json":  { id: "vocab", title: "V", kind: "learn", groups: [] },
    "data/cours-kanji.json":  { id: "kanji", title: "K", kind: "learn", groups: [] },
    "data/cours-method.json": { id: "method", title: "M", kind: "method", sections: [] },
  };
  globalThis.fetch = ((url: string) =>
    Promise.resolve({ json: () => Promise.resolve(fake[url]) })) as unknown as typeof fetch;

  // Tenu dans un objet (pas un `let` nu) : `let` capturé + réassigné dans une closure
  // fait sur-restreindre tsc à `never` sur la lecture externe (narrowing across closures).
  const state: { cats: CoursCategory[] | null } = { cats: null };
  function Probe() { state.cats = useCours(); return null; }
  const host = document.createElement("div"); const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  await act(async () => { await Promise.resolve(); });

  expect(state.cats?.map((c) => c.id)).toEqual(["gram", "vocab", "kanji", "method"]);
  await act(async () => { root.unmount(); });
});
