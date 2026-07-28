import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Cours } from "./Cours.tsx";
import { PROGRESS_KEY } from "../../lib/keys.ts";

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

test("Cours /cours/gram/g1 → paquet + « je connais déjà » qui amorce la carte FSRS", async () => {
  const { host, root } = await mountAt("/cours/gram/g1");
  expect(host.innerHTML).toContain("〜ば");
  const btn = Array.from(host.querySelectorAll("button"))
    .find((b) => b.textContent?.includes("Je connais déjà")) as HTMLButtonElement;
  expect(btn).not.toBeUndefined();
  await act(async () => { btn.click(); }); // neuf → amorce la mémoire (grade Good)
  const blob = JSON.parse(globalThis.localStorage.getItem(PROGRESS_KEY)!);
  expect(Object.keys(blob.fsrs)).toEqual(["jlpt:gram/ば"]);
  await act(async () => { root.unmount(); });
});

test("Cours /cours/kanji/k1 → paquet kanji (rend EntityCard)", async () => {
  const { host, root } = await mountAt("/cours/kanji/k1");
  expect(host.innerHTML).toContain("水");
  expect(host.innerHTML).toContain("eau");
  await act(async () => { root.unmount(); });
});
