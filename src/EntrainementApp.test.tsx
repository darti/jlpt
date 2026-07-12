import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import { SKILLS } from "./types/progress.ts";
import type { Phase } from "./features/quiz/useQuiz.ts";
import type { Question } from "./types/quiz.ts";

const q: Question = {
  id: 0, cat: "grammaire", d: 1, q: "家に帰っ___、電話します。",
  o: ["たら", "なら", "ば", "と"], a: 0, e: "<b>〜たら</b>", g: "帰る→帰ったら", od: ["ok", "b", "c", "d"],
};

const handlers = {
  onStart: () => {}, onChoose: () => {}, onNext: () => {}, onRestart: () => {},
  onToggleCat: () => {}, onSetMinutes: () => {}, onResumeNow: () => {}, onDismissResume: () => {},
};

function view(phase: Phase, question: Question | null) {
  return renderToStaticMarkup(
    <EntrainementAppView
      phase={phase} question={question} count={1} right={0}
      selected={new Set(SKILLS)} minutes={10} resume={null}
      answered={false} chosen={null}
      {...handlers}
    />,
  );
}

test("home phase renders the hub: start card + categories + stubs (no stats/chart)", () => {
  const html = view("home", null);
  expect(html).toContain("Lancer une session");  // QuizHome start card title
  expect(html).toContain("Grammaire");           // category chip
  expect(html).toContain("Commencer");           // start button
  expect(html).toContain("bientôt");             // deferred stubs
  expect(html).not.toContain("réussite estimée"); // Dashboard stats moved to Accueil
  expect(html).not.toContain("Progression");      // chart section moved to Accueil
});

test("home phase no longer renders settings or sync (moved to Paramétrage)", () => {
  const html = view("home", null);
  expect(html).not.toContain("Réglages");
  expect(html).not.toContain("Synchronisation multi-appareils");
});

test("question phase renders the question card, not the hub", () => {
  const html = view("question", q);
  expect(html).toContain("電話します");
  expect(html).not.toContain("Lancer une session");
});
