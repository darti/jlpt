import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LearnCard } from "./LearnCard.tsx";
import type { CoursItem } from "../cours/coursSchema.ts";

const item: CoursItem = { id: "jlpt:gram/ば", form: "〜ば", mean: "condition generale" };
const base = {
  item, state: "neuf" as const, index: 0, count: 4,
  onNext: () => {}, onDeclareKnown: () => {}, onNeedsReview: () => {},
};

test("LearnCard affiche la position dans le bloc", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("1 / 4");
});

test("LearnCard rend le contenu de l entite", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("condition generale");
});

// Avec une ancre : la question porte le signal, MAIS « je sais déjà » reste offert — sans lui il
// fallait répondre au QCM pour évacuer un point déjà su, sur ~96 % des cartes.
test("avec une ancre, LearnCard propose la question ET la declaration", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).toContain("Question");
  expect(html).toContain("Je sais déjà");
});

// Sans ancre : rien ne peut la tester. « À revoir » remplace la question comme signal d'échec ;
// « je sais déjà » est le MÊME geste que dans l'autre régime et que dans le cours.
test("sans ancre, LearnCard propose la declaration et « a revoir »", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor={false} />);
  expect(html).toContain("Je sais déjà");
  expect(html).toContain("revoir");
});

// ⚠ « À revoir » est le seul geste réservé au régime sans ancre : avec une ancre, c'est la
// question qui porte l'échec (et le hook refuse le geste, cf. `learnNeedsReview`).
test("avec une ancre, LearnCard ne propose pas « a revoir »", () => {
  const html = renderToStaticMarkup(<LearnCard {...base} hasAnchor />);
  expect(html).not.toContain("À revoir");
});
