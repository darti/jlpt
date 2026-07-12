import { test, expect } from "bun:test";
import { resolveMinutes } from "./useQuiz.ts";

test("resolveMinutes uses a numeric arg (URL handoff ?min=N)", () => {
  expect(resolveMinutes(15, 10)).toBe(15);
});

test("resolveMinutes falls back to the minutes state when arg is undefined", () => {
  expect(resolveMinutes(undefined, 10)).toBe(10);
});

test("resolveMinutes ignores a non-number arg (click event wired straight to onClick)", () => {
  // `start` is wired as `onStart={quiz.start}` → React passes the click event as the
  // first arg; without this guard `min` became the event → NaN session → silent no-op.
  const clickEvent = { type: "click", nativeEvent: {} };
  expect(resolveMinutes(clickEvent, 10)).toBe(10);
});
