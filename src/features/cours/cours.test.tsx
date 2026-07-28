import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
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

// ⚠ Régression : les ids de groupe sont RÉUTILISÉS entre pistes (« g1 » existe dans gram ET
// kanji, 25 collisions mesurées dans lesson.jsonld). Sans `key` sur `<Deck>`, passer de
// gram/g1 (3 items, position 2) à kanji/g1 (1 item) sans démontage laissait l'index de carte à
// 2 → `items[2]` undefined → repli « Thème vide. » permanent, sans contrôle pour en sortir.
const CATS_COLLISION: Record<string, unknown> = {
  "data/graph/lesson.jsonld": { "@graph": [
    { "@id": "jlpt:lesson/gram-g1", "@type": "jlpt:Lesson", "schema:name": "Conditionnels",
      "jlpt:order": 0, "jlpt:track": "gram",
      covers: ["jlpt:gram/ば", "jlpt:gram/たら", "jlpt:gram/なら"] },
    { "@id": "jlpt:lesson/kanji-g1", "@type": "jlpt:Lesson", "schema:name": "Eau",
      "jlpt:order": 0, "jlpt:track": "kanji", covers: ["jlpt:kanji/水"] },
  ] },
  "data/graph/gram.jsonld": { "@graph": [
    { "@id": "jlpt:gram/ば", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜ば", "schema:description": "si" },
    { "@id": "jlpt:gram/たら", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜たら", "schema:description": "quand" },
    { "@id": "jlpt:gram/なら", "@type": "jlpt:GrammarPoint", "jlpt:form": "〜なら", "schema:description": "si (topique)" },
  ] },
  "data/graph/kanji.jsonld": { "@graph": [
    { "@id": "jlpt:kanji/水", "@type": "jlpt:Kanji", "schema:name": "水",
      "schema:description": "eau", "jlpt:kunReading": ["みず"] },
  ] },
  "data/graph/word.jsonld": { "@graph": [] },
  "data/graph/example.jsonld": { "@graph": [] },
  "data/graph/method.jsonld": { "@graph": [] },
};

test("naviguer de gram/g1 (position avancee) vers kanji/g1 ne laisse pas Theme vide", async () => {
  globalThis.fetch = ((url: string) =>
    Promise.resolve({ json: () => Promise.resolve(CATS_COLLISION[url] ?? { "@graph": [] }) })) as unknown as typeof fetch;
  let navigateRef: ((to: string) => void) | null = null;
  function NavCapture() {
    navigateRef = useNavigate();
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/cours/gram/g1"]}>
        <NavCapture />
        <Routes><Route path="cours/*" element={<Cours />} /></Routes>
      </MemoryRouter>,
    );
  });
  await act(async () => { await Promise.resolve(); });
  expect(host.innerHTML).toContain("〜ば");
  // Avance à la 3e carte (index 2) via les flèches — PAS via `?focus=`, pour que `group.id` et
  // `focus` restent identiques aux deux ends de la navigation (c'est cette identité qui, sans
  // `key`, empêchait l'effet de repositionnement de se redéclencher).
  await act(async () => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  });
  await act(async () => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  });
  expect(host.innerHTML).toContain("〜なら");
  await act(async () => { navigateRef!("/cours/kanji/g1"); });
  expect(host.innerHTML).not.toContain("Thème vide.");
  expect(host.innerHTML).toContain("水");
  expect(host.innerHTML).toContain("eau");
  await act(async () => { root.unmount(); });
});
