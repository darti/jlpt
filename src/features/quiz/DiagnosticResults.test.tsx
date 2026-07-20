import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticResults } from "./DiagnosticResults.tsx";
import type { DashboardModel } from "../../lib/scoring.ts";
import type { Question } from "../../types/quiz.ts";

// Real `dashboardModel` shape: barMastery covers BAR_SKILLS (4 skills, NO ecoute). The component
// must NOT depend on barMastery for the per-skill breakdown — it derives that from `answers`.
const model: DashboardModel = {
  answers: 2, passPct: 42, sectionTotal: 90, level: "N3-", days: 100, confidence: 0.5,
  barMastery: { grammaire: 55, vocabulaire: 60, kanji: 40, lecture: 50 } as Record<string, number> as never,
  hasEnough: true,
};
const g: Question = { id: 1, cat: "grammaire", d: 1, q: "test", o: ["a", "b"], a: 0 };
const e: Question = { id: 2, cat: "ecoute", d: 1, q: "kiku", o: ["a", "b"], a: 0 };

test("DiagnosticResults shows the estimated level and a per-skill breakdown from answers (incl. ecoute)", () => {
  const html = renderToStaticMarkup(
    <DiagnosticResults model={model} answers={[{ question: g, chosen: 1 }, { question: e, chosen: 0 }]} onDone={() => {}} />,
  );
  expect(html).toContain("niveau estim"); // "niveau estimé"
  expect(html).toContain("N3-");
  expect(html).toContain("Grammaire"); // per-skill breakdown from answers
  expect(html).toContain("Écoute");    // ecoute IS shown (derived from answers, not barMastery)
  expect(html).toContain("Correction");
  expect(html).toContain("Termin");    // "Terminé" button
  expect(html).toContain("Faux");      // Corrige renders for the grammaire miss (chosen 1 != a 0)
});

test("DiagnosticResults renders a matched Rappel de cours when a coursIndex is provided", () => {
  const g: Question = { id: 3, cat: "grammaire", d: 1, q: "", o: ["a", "b"], a: 0,
    e: "<b>〜たら</b> = x", tests: ["jlpt:gram/たら"] };
  const idx = new Map([["jlpt:gram/たら", { kind: "gram" as const, iri: "jlpt:gram/たら",
    titre: "〜たら", lecture: "", niv: "N3", sens: "« quand ».", group: "g4", coursCat: "gram" }]]);
  const html = renderToStaticMarkup(
    <DiagnosticResults model={model} answers={[{ question: g, chosen: 1 }]} onDone={() => {}} coursIndex={idx} />,
  );
  expect(html).toContain("Rappel");
  expect(html).toContain("〜たら");
});
