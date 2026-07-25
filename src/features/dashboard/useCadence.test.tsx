import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCadence } from "./useCadence.ts";
import type { CadenceModel } from "../../lib/cadence.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement; let root: Root; let captured: CadenceModel | null = null;
function Probe() { captured = useCadence(); return null; }

beforeEach(() => { localStorage.clear(); captured = null; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => { root.unmount(); }); container.remove(); });

test("useCadence expose un modèle même sans progression (nouvel arrivant)", async () => {
  await act(async () => { root.render(<Probe />); });
  expect(captured).not.toBeNull();
  expect(captured!.done).toBe(0);
  expect(captured!.goal).toBeGreaterThan(0);   // rythme requis positif avant l'examen
  expect(captured!.streak).toBe(0);
});
