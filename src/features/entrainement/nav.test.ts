import { test, expect } from "bun:test";
import { sessionHref, resumeHref } from "./nav.ts";

test("sessionHref builds /quiz?min=N", () => {
  expect(sessionHref(15)).toBe("/quiz?min=15");
});
test("sessionHref clamps absurd minutes to 45", () => {
  expect(sessionHref(999)).toBe("/quiz?min=45");
});
test("sessionHref falls back to 10 for NaN or 0", () => {
  expect(sessionHref(NaN)).toBe("/quiz?min=10");
  expect(sessionHref(0)).toBe("/quiz?min=10");
});
test("resumeHref is /quiz?resume=1", () => {
  expect(resumeHref()).toBe("/quiz?resume=1");
});
