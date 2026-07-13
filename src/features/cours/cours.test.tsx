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

const CATS: Record<string, unknown> = {
  "data/cours-gram.json": {
    id: "gram", title: "文法 — Grammaire", kind: "learn",
    groups: [{
      id: "g1", title: "Conditionnels",
      items: [{ id: "gram:ば", form: "〜ば", mean: "si" }],
    }],
  },
  "data/cours-vocab.json": { id: "vocab", title: "語彙", kind: "learn", groups: [] },
  "data/cours-kanji.json": {
    id: "kanji", title: "漢字", kind: "learn",
    groups: [{
      id: "k1", title: "Eau",
      items: [{ id: "kanji:水", kanji: "水", lecture: "みず", sens: "eau" }],
    }],
  },
  "data/cours-method.json": { id: "method", title: "Méthode", kind: "method", sections: [] },
};

async function mountAt(path: string): Promise<{ host: HTMLElement; root: Root }> {
  globalThis.fetch = ((url: string) =>
    Promise.resolve({ json: () => Promise.resolve(CATS[url]) })) as unknown as typeof fetch;
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
  const btn = host.querySelector('[data-item-id="gram:ば"]') as HTMLButtonElement;
  expect(btn).not.toBeNull();
  await act(async () => { btn.click(); }); // neuf → known
  const raw = globalThis.localStorage.getItem("jlptN3_cours_v1");
  expect(JSON.parse(raw!)).toEqual({ "gram:ば": "known" });
  await act(async () => { root.unmount(); });
});

test("Cours /cours/kanji/k1 → détail kanji (dispatch GroupDetail)", async () => {
  const { host, root } = await mountAt("/cours/kanji/k1");
  expect(host.innerHTML).toContain("水");
  expect(host.innerHTML).toContain("eau");
  await act(async () => { root.unmount(); });
});
