import { test, expect, afterEach, beforeEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { clearCoursCache, useCours } from "./useCours.ts";
import type { CoursCategory, LearnCategory } from "./coursSchema.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origFetch = globalThis.fetch;
// Le chargement est mémoïsé AU MODULE : sans purge, chaque test rejouerait le bouchon du
// précédent (et le fichier suivant, celui d'ici).
beforeEach(() => { clearCoursCache(); });
afterEach(() => { globalThis.fetch = origFetch; clearCoursCache(); });

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

// ⚠ Le programme a DEUX consommateurs depuis le lot 2 : la route /cours et le moteur de séance
// (`useQuiz` a besoin de savoir quoi enseigner). Sans mémoïsation au module, chaque montage
// refetchait les six documents — dont `word.jsonld`, 978 Ko : ouvrir /entrainement en
// retéléchargeait ~1,44 Mo, et chaque aller-retour /cours ↔ /entrainement recommençait.
test("les six documents ne sont charges qu une fois pour tous les consommateurs", async () => {
  let appels = 0;
  globalThis.fetch = ((url: string) => {
    appels++;
    return Promise.resolve({ json: () => Promise.resolve(DOCS[url] ?? {}) });
  }) as unknown as typeof fetch;

  const state: { cats: CoursCategory[] | null } = { cats: null };
  function Probe() { state.cats = useCours(); return null; }
  const hosts = [document.createElement("div"), document.createElement("div")];
  const roots = hosts.map((h) => createRoot(h));
  for (const root of roots) {
    await act(async () => { root.render(<Probe />); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }

  expect(state.cats?.map((c) => c.id)).toEqual(["gram", "vocab", "kanji", "method"]);
  expect(appels).toBe(6); // six documents, deux consommateurs — pas douze
  for (const root of roots) await act(async () => { root.unmount(); });
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
