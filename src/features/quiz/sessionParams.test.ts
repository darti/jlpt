import { test, expect } from "bun:test";
import { parseSessionParams, resolveMinutes } from "./sessionParams.ts";

test("parses ?min=15", () => { expect(parseSessionParams("?min=15")).toEqual({ min: 15, resume: false }); });
test("parses ?resume=1", () => { expect(parseSessionParams("?resume=1")).toEqual({ resume: true }); });
test("ignores junk / clamps absurd min to 45 (allocate caps a session at 45 questions)", () => {
  expect(parseSessionParams("")).toEqual({ resume: false });
  expect(parseSessionParams("?min=abc")).toEqual({ resume: false });
  expect(parseSessionParams("?min=999").min).toBe(45); // M4: allocate() caps total at 45 (round(min*1.5)); ≥30 min already yields 45
});

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
