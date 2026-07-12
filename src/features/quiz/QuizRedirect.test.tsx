import { test, expect } from "bun:test";
import { quizRedirectTarget } from "./QuizRedirect.tsx";

test("quizRedirectTarget preserves ?resume=1", () => {
  expect(quizRedirectTarget("?resume=1")).toBe("/entrainement?resume=1");
});
test("quizRedirectTarget preserves ?min=15", () => {
  expect(quizRedirectTarget("?min=15")).toBe("/entrainement?min=15");
});
test("quizRedirectTarget with no query points at /entrainement", () => {
  expect(quizRedirectTarget("")).toBe("/entrainement");
  expect(quizRedirectTarget("?")).toBe("/entrainement");
});
