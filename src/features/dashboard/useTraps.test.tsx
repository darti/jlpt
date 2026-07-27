import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useTraps } from "./useTraps.ts";
import { clearGraphCache } from "../../lib/graph.ts";
import { PROGRESS_KEY } from "../../lib/keys.ts";
import type { TrapModel } from "../quiz/traps.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root; let captured: TrapModel | null = null;
function Probe() { captured = useTraps(); return null; }

const vraiFetch = globalThis.fetch;
let fetchs: string[] = [];

beforeEach(() => {
  localStorage.clear();
  clearGraphCache();          // les pools sont mémoïsés au module — isoler ce fichier
  captured = null; fetchs = [];
  globalThis.fetch = ((url: string) => {
    fetchs.push(String(url));
    return Promise.resolve({ json: () => Promise.resolve({ "@graph": [] }) });
  }) as unknown as typeof fetch;
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => { root.unmount(); }); container.remove(); globalThis.fetch = vraiFetch; });

/**
 * ⚠ Invariant de COÛT, pas de correction — et c'est pour ça qu'il mérite un test : rien ne
 * casse si on le perd, l'Accueil devient simplement plusieurs secondes plus lent au démarrage,
 * pour n'afficher aucun panneau. Les deux shards typés (kanji, vocabulaire) sont les plus gros
 * du corpus.
 */
test("aucune confusion → AUCUN fetch des shards (le nouvel arrivant ne paie rien)", async () => {
  await act(async () => { root.render(<Probe />); });
  expect(fetchs).toEqual([]);
  expect(captured).toBeNull();
});

test("des confusions présentes → les deux shards typés sont demandés", async () => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ total: 1, skill: {}, confusions: [[1, 2, 0]] }));
  await act(async () => { root.render(<Probe />); });
  expect(fetchs.some((u) => u.includes("q-kanji"))).toBe(true);
  expect(fetchs.some((u) => u.includes("q-vocabulaire"))).toBe(true);
});

test("un fetch qui échoue laisse le panneau à null au lieu de propager (hors ligne)", async () => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ total: 1, skill: {}, confusions: [[1, 2, 0]] }));
  globalThis.fetch = (() => Promise.reject(new Error("hors ligne"))) as unknown as typeof fetch;
  await act(async () => { root.render(<Probe />); });
  expect(captured).toBeNull();
});
