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

test("#4 contract: BUILT_CAPS enables learn (40% cap) alongside errors", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 5, daysSinceDiagnostic: 3 },
    10,
    BUILT_CAPS,
  );
  // errors = min(50,3)=3; learn = min(5, floor(0.4*10)=4, 10-3=7)=4; adaptive = 10-3-4=3
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, learn: 4, adaptive: 3 } });
});

test("#2 contract: no errors emitted when wrong[] is empty", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 0, daysSinceDiagnostic: 3 }, 10, BUILT_CAPS);
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 0, learn: 0, adaptive: 10 } });
});

test("#3 contract: BUILT_CAPS emits diagnostic when never assessed or >=7d", () => {
  expect(pickSessionPlan({ ...base, daysSinceDiagnostic: null }, 10, BUILT_CAPS)).toEqual({ kind: "diagnostic" });
  expect(pickSessionPlan({ ...base, daysSinceDiagnostic: 7 }, 10, BUILT_CAPS)).toEqual({ kind: "diagnostic" });
});

test("#3 contract: a recent diagnostic (<7d) yields a composed session", () => {
  const plan = pickSessionPlan({ ...base, daysSinceDiagnostic: 3, wrongCount: 50 }, 10, BUILT_CAPS);
  expect(plan.kind).toBe("composed");
});

test("learn is capped at LEARN_CAP (40%) of the budget", () => {
  const plan = pickSessionPlan(
    { ...base, newCoursePoints: 100 },
    10,
    { diagnostic: false, errors: false, learn: true },
  );
  // errors off → 0; learn = min(100, floor(0.4*10)=4, 10-0=10) = 4; adaptive = 6
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 0, learn: 4, adaptive: 6 } });
});
