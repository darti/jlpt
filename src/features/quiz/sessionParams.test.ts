import { test, expect } from "bun:test";
import { parseSessionParams } from "./useQuiz.ts";

test("parses ?min=15", () => { expect(parseSessionParams("?min=15")).toEqual({ min: 15, resume: false }); });
test("parses ?resume=1", () => { expect(parseSessionParams("?resume=1")).toEqual({ resume: true }); });
test("ignores junk / clamps absurd min to 45 (allocate caps a session at 45 questions)", () => {
  expect(parseSessionParams("")).toEqual({ resume: false });
  expect(parseSessionParams("?min=abc")).toEqual({ resume: false });
  expect(parseSessionParams("?min=999").min).toBe(45); // M4: allocate() caps total at 45 (round(min*1.5)); ≥30 min already yields 45
});
