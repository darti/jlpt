import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useClientOnce } from "./useClientOnce.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => { root.unmount(); }); container.remove(); });

test("le calcul est différé au montage — le PREMIER rendu vaut null (sûreté SSR)", async () => {
  const rendus: (number | null)[] = [];
  function Probe() { rendus.push(useClientOnce(() => 42)); return null; }
  await act(async () => { root.render(<Probe />); });
  expect(rendus[0]).toBeNull();          // rendu initial : rien lu du store
  expect(rendus.at(-1)).toBe(42);        // après montage : le modèle
});

test("un compute rendant null laisse le hook à null", async () => {
  let vu: number | null = 0;
  function Probe() { vu = useClientOnce<number>(() => null); return null; }
  await act(async () => { root.render(<Probe />); });
  expect(vu).toBeNull();
});

test("le calcul ne tourne QU'UNE fois, même si le parent re-rend", async () => {
  let appels = 0;
  function Probe() { useClientOnce(() => { appels++; return 1; }); return null; }
  await act(async () => { root.render(<Probe />); });
  await act(async () => { root.render(<Probe />); });
  await act(async () => { root.render(<Probe />); });
  expect(appels).toBe(1);
});
