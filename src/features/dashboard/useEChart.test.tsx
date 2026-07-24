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

// Attente CONDITIONNELLE. Deux étages asynchrones échappent à un tick fixe : l'import()
// dynamique d'ECharts (résolu au fil des microtâches) ET la livraison des MutationRecords par
// happy-dom (asynchrone, délai variable local vs CI). Un `setTimeout(0)` unique courait cette
// livraison → le test passait en local mais échouait en CI (setOption vu 1× au lieu de 2×).
// On sonde jusqu'à ce que la condition tienne, avec un plafond de sécurité.
async function waitFor(pred: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor : condition non atteinte à temps");
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
}

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
  await waitFor(() => setOption.mock.calls.length >= 1); // rendu initial (import async résolu)
  expect(setOption).toHaveBeenCalledTimes(1);

  document.documentElement.setAttribute("data-theme", "light");
  await waitFor(() => setOption.mock.calls.length >= 2); // bascule de thème → option relue et reposée
  expect(setOption).toHaveBeenCalledTimes(2);
});

test("cesse de réappliquer après démontage (observateur déconnecté)", async () => {
  await act(async () => { root.render(<Harness />); });
  await waitFor(() => setOption.mock.calls.length >= 1);
  act(() => { root.unmount(); });
  setOption.mockClear();

  document.documentElement.setAttribute("data-theme", "light");
  // Assertion d'ABSENCE : on laisse une fenêtre généreuse — bien au-delà du délai de livraison
  // observé — puis on vérifie qu'aucun setOption n'est venu (l'observateur est déconnecté).
  await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
  expect(setOption).not.toHaveBeenCalled();
});
