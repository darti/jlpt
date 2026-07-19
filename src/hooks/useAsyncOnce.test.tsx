import { test, expect } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAsyncOnce } from "./useAsyncOnce.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: React.ReactNode): Promise<Root> {
  const root = createRoot(document.createElement("div"));
  await act(async () => { root.render(node); });
  await act(async () => { await Promise.resolve(); }); // laisse résoudre la promesse
  return root;
}

test("useAsyncOnce vaut null avant résolution puis expose la valeur", async () => {
  const seen: (string | null)[] = [];
  function Probe() { seen.push(useAsyncOnce(() => Promise.resolve("ok"))); return null; }
  const root = await mount(<Probe />);
  expect(seen[0]).toBeNull();          // premier rendu : rien n'a encore résolu
  expect(seen.at(-1)).toBe("ok");
  await act(async () => { root.unmount(); });
});

test("useAsyncOnce reste null si le chargement échoue (1re visite hors ligne)", async () => {
  let captured: string | null = "pas-null";
  function Probe() { captured = useAsyncOnce(() => Promise.reject(new Error("offline"))); return null; }
  const root = await mount(<Probe />);
  expect(captured).toBeNull(); // le rejet est avalé : l'appelant dégrade, il ne plante pas
  await act(async () => { root.unmount(); });
});

test("useAsyncOnce ne charge qu'une fois, même si le rendu recrée la lambda", async () => {
  let calls = 0;
  function Probe({ tick }: { tick: number }) {
    useAsyncOnce(() => { calls++; return Promise.resolve(tick); }); // lambda neuve à chaque rendu
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => { root.render(<Probe tick={1} />); });
  await act(async () => { root.render(<Probe tick={2} />); });
  await act(async () => { root.render(<Probe tick={3} />); });
  expect(calls).toBe(1); // c'est tout l'intérêt du hook : sinon rechargement en boucle
  await act(async () => { root.unmount(); });
});
