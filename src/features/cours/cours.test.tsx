import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Cours } from "./Cours.tsx";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = origFetch;
  try { globalThis.localStorage.clear(); } catch { /* noop */ }
});

// Documents du graphe : c est ce que useCours fetche depuis la migration des cours.
const CATS: Record<string, unknown> = {
  "data/graph/lesson.jsonld": { "@graph": [
    { "@id": "jlpt:lesson/gram-g1", "@type": "jlpt:Lesson", "schema:name": "Conditionnels",
      "jlpt:order": 0, "jlpt:track": "gram", covers: ["jlpt:gram/ば"] },
    { "@id": "jlpt:lesson/kanji-k1", "@type": "jlpt:Lesson", "schema:name": "Eau",
      "jlpt:order": 0, "jlpt:track": "kanji", covers: ["jlpt:kanji/水"] },
  ] },
  "data/graph/gram.jsonld": { "@graph": [
    { "@id": "jlpt:gram/ば", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜ば",
      "schema:description": "si" },
  ] },
  "data/graph/kanji.jsonld": { "@graph": [
    { "@id": "jlpt:kanji/水", "@type": "jlpt:Kanji", "schema:name": "水",
      "schema:description": "eau", "jlpt:kunReading": ["みず"] },
  ] },
  "data/graph/word.jsonld": { "@graph": [] },
  "data/graph/example.jsonld": { "@graph": [] },
  "data/graph/method.jsonld": { "@graph": [] },
};

async function mountAt(path: string): Promise<{ host: HTMLElement; root: Root }> {
  globalThis.fetch = ((url: string) =>
    Promise.resolve({ json: () => Promise.resolve(CATS[url] ?? { "@graph": [] }) })) as unknown as typeof fetch;
  const host = document.createElement("div"); const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="cours/*" element={<Cours />} /></Routes>
      </MemoryRouter>,
    );
  });
  await act(async () => { await Promise.resolve(); });
  return { host, root };
}

test("Cours /cours → hub des catégories", async () => {
  const { host, root } = await mountAt("/cours");
  expect(host.innerHTML).toContain("Grammaire");
  expect(host.innerHTML).toContain("Méthode");
  await act(async () => { root.unmount(); });
});

test("Cours /cours/gram/g1 → détail + toggle qui persiste", async () => {
  const { host, root } = await mountAt("/cours/gram/g1");
  expect(host.innerHTML).toContain("〜ば");
  const btn = host.querySelector('[data-item-id="jlpt:gram/ば"]') as HTMLButtonElement;
  expect(btn).not.toBeNull();
  await act(async () => { btn.click(); }); // neuf → known
  const raw = globalThis.localStorage.getItem("jlptN3_cours_v2");
  expect(JSON.parse(raw!)).toEqual({ "jlpt:gram/ば": "known" });
  await act(async () => { root.unmount(); });
});

test("Cours /cours/kanji/k1 → détail kanji (dispatch GroupDetail)", async () => {
  const { host, root } = await mountAt("/cours/kanji/k1");
  expect(host.innerHTML).toContain("水");
  expect(host.innerHTML).toContain("eau");
  await act(async () => { root.unmount(); });
});
