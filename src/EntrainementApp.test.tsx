import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import { SKILLS } from "./types/progress.ts";
import type { Progress } from "./types/progress.ts";
import type { Phase } from "./features/quiz/useQuiz.ts";
import type { Question } from "./types/quiz.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R, t: 60 }, vocabulaire: { R, t: 60 }, kanji: { R, t: 60 }, lecture: { R, t: 60 } },
});

const q: Question = {
  id: 0, cat: "grammaire", d: 1, q: "家に帰っ___、電話します。",
  o: ["たら", "なら", "ば", "と"], a: 0, e: "<b>〜たら</b>", g: "帰る→帰ったら", od: ["ok", "b", "c", "d"],
};

const handlers = {
  onStart: () => {}, onChoose: () => {}, onNext: () => {}, onRestart: () => {},
  onToggleCat: () => {}, onSetMinutes: () => {}, onResumeNow: () => {}, onDismissResume: () => {},
};

function view(phase: Phase, question: Question | null, scores: number[]) {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  return renderToStaticMarkup(
    <EntrainementAppView
      model={model} days={model.days} scores={scores}
      phase={phase} question={question} count={1} right={0}
      selected={new Set(SKILLS)} minutes={10} resume={null}
      answered={false} chosen={null}
      {...handlers}
    />,
  );
}

test("home phase renders the hub: dashboard stat + start card + categories + stubs", () => {
  const html = view("home", null, []);
  expect(html).toContain("17%");                 // Dashboard stat (réussite estimée)
  expect(html).toContain("Lancer une session");  // QuizHome start card title
  expect(html).toContain("Grammaire");           // category chip
  expect(html).toContain("Commencer");           // start button
  expect(html).toContain("bientôt");             // deferred stubs
});

test("home phase no longer renders settings or sync (moved to Paramétrage)", () => {
  const html = view("home", null, []);
  expect(html).not.toContain("Réglages");
  expect(html).not.toContain("Synchronisation multi-appareils");
});

test("home phase shows the empty chart state with <2 session scores", () => {
  expect(view("home", null, [])).toContain("Au moins 2 diagnostics");
});

test("question phase renders the question card, not the hub", () => {
  const html = view("question", q, []);
  expect(html).toContain("電話します");
  expect(html).not.toContain("Lancer une session");
});
