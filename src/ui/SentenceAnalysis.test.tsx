import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SentenceAnalysis } from "./SentenceAnalysis.tsx";

// Composant d'analyse unifié (quiz + cours) : mêmes pills colorées via visualBreak, JAMAIS de
// légende, taille text-lg. Voir SentenceAnalysis.tsx pour la fusion des deux anciens chemins.

test("rend les pills d'analyse (vbreak) en text-lg", () => {
  const html = renderToStaticMarkup(<SentenceAnalysis source="朝（あさ） « matin » · を « COD »" />);
  expect(html).toContain("vbreak");
  expect(html).toContain("text-lg");
  expect(html).toContain("tok-part"); // を
});

test("n'affiche jamais la légende, même avec plusieurs rôles", () => {
  const html = renderToStaticMarkup(<SentenceAnalysis source="朝（あさ） « matin » · を « COD »" />);
  expect(html).not.toContain("vbleg");
});

test("source vide → rien", () => {
  expect(renderToStaticMarkup(<SentenceAnalysis source="" />)).toBe("");
});
