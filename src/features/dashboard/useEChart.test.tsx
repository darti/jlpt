import { test, expect, mock, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEChart } from "./useEChart.ts";

// happy-dom est préchargé (bunfig) : `document` existe. On simule ECharts pour compter les
// `setOption` sans embarquer la vraie lib — le graphe n'a pas besoin d'être réellement tracé,
// seul le CYCLE de réapplication de l'option nous intéresse.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setOption = mock(() => {});
const dispose = mock(() => {});
mock.module("echarts/core", () => ({
  use: () => {},
  init: () => ({ resize: () => {}, dispose, setOption }),
}));

// Un graphe minimal : aucune dépendance de données, donc SEUL un changement de thème doit
// provoquer une réapplication de l'option (le cas de régression : les axes ne se recoloraient
// qu'après un rechargement de page).
function Harness() {
  const ref = useEChart(
    async () => [] as never,
    () => ({ id: "opt" }),
    [],
  );
  return <div ref={ref} style={{ width: 100, height: 100 }} />;
}

let container: HTMLDivElement;
let root: Root;
// Laisse se résoudre l'import() dynamique + l'init + la livraison du MutationObserver (macrotâche).
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  document.documentElement.setAttribute("data-theme", "dark");
  setOption.mockClear();
  dispose.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

test("réapplique l'option quand data-theme change (les axes se recolorent sans rechargement)", async () => {
  await act(async () => { root.render(<Harness />); });
  await flush();
  expect(setOption).toHaveBeenCalledTimes(1); // rendu initial

  await act(async () => {
    document.documentElement.setAttribute("data-theme", "light");
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(setOption).toHaveBeenCalledTimes(2); // le thème a rebasculé → option relue et reposée
});

test("cesse de réappliquer après démontage (observateur déconnecté)", async () => {
  await act(async () => { root.render(<Harness />); });
  await flush();
  act(() => { root.unmount(); });
  setOption.mockClear();

  await act(async () => {
    document.documentElement.setAttribute("data-theme", "light");
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(setOption).not.toHaveBeenCalled();
});
