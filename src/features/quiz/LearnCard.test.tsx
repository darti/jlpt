import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LearnCard } from "./LearnCard.tsx";
import type { CoursItem } from "../cours/coursSchema.ts";

const item: CoursItem = { id: "jlpt:gram/ば", form: "〜ば", mean: "condition generale" };
const base = {
  item, state: "neuf" as const, index: 0, count: 4,
  onNext: () => {}, onSelfGrade: () => {},
};

test("LearnCard affiche la position dans le bloc", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("1 / 4");
});

test("LearnCard rend le contenu de l entite", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("condition generale");
});

// Avec une ancre : un seul geste, on enchaîne sur la question.
test("avec une ancre, LearnCard propose de passer a la question", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("Question");
  expect(html).not.toContain("Je connais");
});

// Sans ancre : rien ne peut la tester, donc le seul signal disponible est l'auto-évaluation.
// C'est la contrepartie assumée du refus d'inventer une question.
test("sans ancre, LearnCard propose l auto-evaluation a deux branches", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor={false} />);
  expect(html).toContain("Je connais");
  expect(html).toContain("revoir");
});
