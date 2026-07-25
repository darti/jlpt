import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CadencePanel } from "./CadencePanel.tsx";

test("affiche la série, l'objectif du jour et le pourquoi", () => {
  const html = renderToStaticMarkup(
    <CadencePanel model={{ goal: 54, done: 12, streak: 3, best: 5, reached: false, daysLeft: 134 }} />,
  );
  expect(html).toContain("Cadence");
  expect(html).toContain("Série : 3");    // série (pinné : « 3 » nu matcherait aussi daysLeft=134)
  expect(html).toContain("record 5");     // record affiché quand best > série
  expect(html).toContain("12");           // progrès
  expect(html).toContain("54");           // objectif
  expect(html).toContain("examen");       // le « pourquoi » mentionne les jours avant l examen
});

test("cible atteinte : message de consolidation, pas de barre d'objectif", () => {
  const html = renderToStaticMarkup(
    <CadencePanel model={{ goal: 0, done: 0, streak: 2, best: 2, reached: true, daysLeft: 40 }} />,
  );
  expect(html).toContain("atteint");
});

test("examen passé : panneau en veille", () => {
  const html = renderToStaticMarkup(
    <CadencePanel model={{ goal: 0, done: 0, streak: 0, best: 9, reached: false, daysLeft: 0 }} />,
  );
  expect(html).toContain("passé");
});

test("sans modèle, ne rend rien", () => {
  expect(renderToStaticMarkup(<CadencePanel model={null} />)).toBe("");
});
