import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import type { CoursItem } from "./features/cours/coursSchema.ts";

const item: CoursItem = { id: "jlpt:gram/ば", form: "〜ば", mean: "condition generale" };

const base = {
  phase: "apprendre" as const, question: null, count: 12, right: 0, index: 0,
  minutes: 10, resume: null, chosen: null,
  onStart: () => {}, onChoose: () => {}, onNext: () => {}, onRestart: () => {},
  onSetMinutes: () => {}, onResumeNow: () => {}, onDismissResume: () => {},
};

test("la phase apprendre rend la carte enseignee", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView
        {...base}
        learnStep={{ item, state: "neuf", index: 0, count: 4, hasAnchor: true }}
        onLearnNext={() => {}} onLearnDeclareKnown={() => {}} onLearnNeedsReview={() => {}}
      />
    </MemoryRouter>,
  );
  expect(html).toContain("Apprendre");
  expect(html).toContain("1 / 4");
  expect(html).toContain("condition generale");
});

test("la phase apprendre sans etape ne rend rien de la carte", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView {...base} learnStep={null}
        onLearnNext={() => {}} onLearnDeclareKnown={() => {}} onLearnNeedsReview={() => {}} />
    </MemoryRouter>,
  );
  expect(html).not.toContain("Apprendre ·");
});
