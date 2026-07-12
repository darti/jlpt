import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionCard } from "./SessionCard.tsx";
import type { ResumeState } from "../quiz/useQuiz.ts";

const noop = () => {};

test("SessionCard without resume shows the time picker and start button", () => {
  const html = renderToStaticMarkup(
    <SessionCard resume={null} minutes={10} onSetMinutes={noop} onStart={noop} onResumeNow={noop} onDismissResume={noop} />,
  );
  expect(html).toContain("Ta session du moment");
  expect(html).toContain("Commencer");
  expect(html).not.toContain("Reprendre");
});

test("SessionCard with resume shows the resume headline and continue button", () => {
  const resume: ResumeState = { kind: "quiz", ids: [1, 2, 3], qi: 1, right: 1, t: 0 };
  const html = renderToStaticMarkup(
    <SessionCard resume={resume} minutes={10} onSetMinutes={noop} onStart={noop} onResumeNow={noop} onDismissResume={noop} />,
  );
  expect(html).toContain("Reprendre ta session");
  expect(html).toContain("Continuer");
  expect(html).toContain("Nouvelle session");
  expect(html).toContain("2/3");
});
