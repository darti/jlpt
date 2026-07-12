import { test, expect } from "bun:test";
import { pickSessionPlan, BUILT_CAPS, type Caps } from "./sessionPlan.ts";

const OFF: Caps = { diagnostic: false, errors: false, learn: false };
const base = { resume: false, daysSinceDiagnostic: null, wrongCount: 0, newCoursePoints: 0 };

test("resume state always wins, even when diagnostic is due", () => {
  const plan = pickSessionPlan(
    { ...base, resume: true, daysSinceDiagnostic: 30 },
    10,
    { diagnostic: true, errors: true, learn: true },
  );
  expect(plan).toEqual({ kind: "resume" });
});

test("diagnostic emitted when capable and never assessed", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: null }, 10, { ...OFF, diagnostic: true });
  expect(plan).toEqual({ kind: "diagnostic" });
});

test("diagnostic emitted when capable and >= 7 days since last", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: 7 }, 10, { ...OFF, diagnostic: true });
  expect(plan).toEqual({ kind: "diagnostic" });
});

test("diagnostic NOT emitted when < 7 days since last", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: 6 }, 10, { ...OFF, diagnostic: true });
  expect(plan.kind).toBe("composed");
});

test("diagnostic NOT emitted when capability off", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: null }, 10, OFF);
  expect(plan.kind).toBe("composed");
});

test("errors capped at 30% of total when capable", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 50 }, 10, { ...OFF, errors: true });
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, learn: 0, adaptive: 7 } });
});

test("errors limited by wrongCount when below the cap", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 2 }, 10, { ...OFF, errors: true });
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 2, learn: 0, adaptive: 8 } });
});

test("learn fills after errors, bounded by newCoursePoints", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 2 },
    10,
    { diagnostic: false, errors: true, learn: true },
  );
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, learn: 2, adaptive: 5 } });
});

test("#2 contract: BUILT_CAPS enables errors (30% cap); learn/diagnostic still off", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 5, daysSinceDiagnostic: null },
    10,
    BUILT_CAPS,
  );
  // errors = min(50, floor(0.30*10)) = 3; learn off = 0; adaptive = 7
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, learn: 0, adaptive: 7 } });
});

test("#2 contract: no errors emitted when wrong[] is empty", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 0 }, 10, BUILT_CAPS);
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 0, learn: 0, adaptive: 10 } });
});
