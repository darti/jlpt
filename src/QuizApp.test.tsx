import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QuizAppView } from "./QuizApp.tsx";
import { SKILLS } from "./types/progress.ts";
import type { ResumeState } from "./features/quiz/useQuiz.ts";
import type { Question } from "./types/quiz.ts";

const baseProps = {
  theme: "dark" as const, onToggleTheme: () => {},
  onStart: () => {}, onChoose: () => {}, onNext: () => {}, onRestart: () => {},
  onToggleCat: () => {}, onSetMinutes: () => {}, onResumeNow: () => {}, onDismissResume: () => {},
};

const q: Question = {
  id: 0, cat: "grammaire", d: 1, q: "家に帰っ___、電話します。",
  o: ["たら", "なら", "ば", "と"], a: 0, e: "<b>〜たら</b> = quand/dès que.", g: "帰る→帰ったら", od: ["ok", "b", "c", "d"],
};

test("QuizAppView home phase renders the category picker and the start button", () => {
  const html = renderToStaticMarkup(
    <QuizAppView
      {...baseProps}
      phase="home" question={null} count={0} right={0}
      selected={new Set(SKILLS)} minutes={10} resume={null}
      answered={false} chosen={null}
    />,
  );
  expect(html).toContain("Grammaire");
  expect(html).toContain("Commencer");
});

test("QuizAppView shows the resume banner on the home phase when a session is resumable", () => {
  const resume: ResumeState = { kind: "quiz", ids: [1, 2, 3], qi: 1, right: 1, t: Date.now() };
  const html = renderToStaticMarkup(
    <QuizAppView
      {...baseProps}
      phase="home" question={null} count={0} right={0}
      selected={new Set(SKILLS)} minutes={10} resume={resume}
      answered={false} chosen={null}
    />,
  );
  expect(html).toContain("Reprendre ma session");
  expect(html).toContain("Commencer");
});

test("QuizAppView question phase renders the question card", () => {
  const html = renderToStaticMarkup(
    <QuizAppView
      {...baseProps}
      phase="question" question={q} count={1} right={0}
      selected={new Set(SKILLS)} minutes={10} resume={null}
      answered={false} chosen={null}
    />,
  );
  expect(html).toContain("電話します");
});

test("QuizAppView corrige phase renders the corrigé and a next button", () => {
  const html = renderToStaticMarkup(
    <QuizAppView
      {...baseProps}
      phase="corrige" question={q} count={1} right={1}
      selected={new Set(SKILLS)} minutes={10} resume={null}
      answered={true} chosen={0}
    />,
  );
  expect(html).toContain("Correct !");
  expect(html).toContain("Suivant");
});

test("QuizAppView results phase renders the session score", () => {
  const html = renderToStaticMarkup(
    <QuizAppView
      {...baseProps}
      phase="results" question={null} count={10} right={7}
      selected={new Set(SKILLS)} minutes={10} resume={null}
      answered={false} chosen={null}
    />,
  );
  expect(html).toContain("7");
  expect(html).toContain("10");
});
