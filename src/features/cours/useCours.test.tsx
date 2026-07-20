import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCours } from "./useCours.ts";
import type { CoursCategory, LearnCategory } from "./coursSchema.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = origFetch; });

const DOCS: Record<string, unknown> = {
  "data/graph/lesson.jsonld": { "@graph": [
    { "@id": "jlpt:lesson/gram-g1", "@type": "jlpt:Lesson", "schema:name": "G1",
      "jlpt:order": 0, "jlpt:track": "gram", covers: ["jlpt:gram/ば"] },
  ] },
  "data/graph/gram.jsonld": { "@graph": [
    { "@id": "jlpt:gram/ば", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜ば" },
  ] },
  "data/graph/kanji.jsonld": { "@graph": [] },
  "data/graph/word.jsonld": { "@graph": [] },
  "data/graph/example.jsonld": { "@graph": [] },
  "data/graph/method.jsonld": { "@graph": [] },
};

const serve = (table: Record<string, unknown>) =>
  ((url: string) =>
    Promise.resolve({ json: () => Promise.resolve(table[url] ?? {}) })) as unknown as typeof fetch;

test("useCours charge gram/vocab/kanji/method dans l'ordre", async () => {
  globalThis.fetch = serve(DOCS);

  // Tenu dans un objet (pas un `let` nu) : `let` capturé + réassigné dans une closure
  // fait sur-restreindre tsc à `never` sur la lecture externe (narrowing across closures).
  const state: { cats: CoursCategory[] | null } = { cats: null };
  function Probe() { state.cats = useCours(); return null; }
  const host = document.createElement("div"); const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  await act(async () => { await Promise.resolve(); });

  expect(state.cats?.map((c) => c.id)).toEqual(["gram", "vocab", "kanji", "method"]);
  const gram = state.cats?.find((c) => c.id === "gram") as LearnCategory;
  expect(gram.groups[0].items).toHaveLength(1); // la leçon a résolu son entité
  await act(async () => { root.unmount(); });
});

test("un document sans @graph ne fait pas planter le chargement", async () => {
  // Régression : un cache SW servant un document vide ou d'une forme inattendue ne doit
  // pas laisser CategoryIndex faire `category.groups.map` sur undefined. La projection
  // rend des catégories vides, pas une exception.
  globalThis.fetch = serve({ ...DOCS, "data/graph/lesson.jsonld": { périmé: true } });

  const state: { cats: CoursCategory[] | null } = { cats: null };
  function Probe() { state.cats = useCours(); return null; }
  const host = document.createElement("div"); const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  await act(async () => { await Promise.resolve(); });

  expect(state.cats?.map((c) => c.id)).toEqual(["gram", "vocab", "kanji", "method"]);
  const gram = state.cats?.find((c) => c.id === "gram") as LearnCategory;
  expect(gram.groups).toEqual([]);
  await act(async () => { root.unmount(); });
});

test("un échec réseau dégrade en [] au lieu de planter", async () => {
  globalThis.fetch = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;

  const state: { cats: CoursCategory[] | null } = { cats: null };
  function Probe() { state.cats = useCours(); return null; }
  const host = document.createElement("div"); const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  await act(async () => { await Promise.resolve(); });

  expect(state.cats).toEqual([]);
  await act(async () => { root.unmount(); });
});
