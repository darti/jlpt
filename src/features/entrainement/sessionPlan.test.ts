import { test, expect } from "bun:test";
import { pickSessionPlan, BUILT_CAPS, REVISION_CAP, CONFUSION_CAP, type Caps } from "./sessionPlan.ts";

const OFF: Caps = { diagnostic: false, errors: false, learn: false, revision: false, confusion: false };
const base = {
  resume: false, daysSinceDiagnostic: null, wrongCount: 0, newCoursePoints: 0, revisionDue: 0, confusionCount: 0,
};

test("resume state always wins, even when diagnostic is due", () => {
  const plan = pickSessionPlan(
    { ...base, resume: true, daysSinceDiagnostic: 30 },
    10,
    { diagnostic: true, errors: true, learn: true, revision: true, confusion: true },
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
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, confusion: 0, revision: 0, learn: 0, adaptive: 7 } });
});

test("errors limited by wrongCount when below the cap", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 2 }, 10, { ...OFF, errors: true });
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 2, confusion: 0, revision: 0, learn: 0, adaptive: 8 } });
});

test("learn fills after errors, bounded by newCoursePoints", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 2 },
    10,
    { diagnostic: false, errors: true, learn: true, revision: false, confusion: false },
  );
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, confusion: 0, revision: 0, learn: 2, adaptive: 5 } });
});

test("#4 contract: BUILT_CAPS enables learn (40% cap) alongside errors", () => {
  const plan = pickSessionPlan(
    { ...base, wrongCount: 50, newCoursePoints: 5, daysSinceDiagnostic: 3 },
    10,
    BUILT_CAPS,
  );
  // errors = min(50,3)=3; revision = min(0,4,7)=0; learn = min(5, floor(0.4*10)=4, 10-3-0=7)=4; adaptive = 10-3-0-4=3
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 3, confusion: 0, revision: 0, learn: 4, adaptive: 3 } });
});

test("#2 contract: no errors emitted when wrong[] is empty", () => {
  const plan = pickSessionPlan({ ...base, wrongCount: 0, daysSinceDiagnostic: 3 }, 10, BUILT_CAPS);
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 0, confusion: 0, revision: 0, learn: 0, adaptive: 10 } });
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
    { diagnostic: false, errors: false, learn: true, revision: false, confusion: false },
  );
  // errors off → 0; revision off → 0; learn = min(100, floor(0.4*10)=4, 10-0-0=10) = 4; adaptive = 6
  expect(plan).toEqual({ kind: "composed", alloc: { errors: 0, confusion: 0, revision: 0, learn: 4, adaptive: 6 } });
});

const REVISION_CAPS: Caps = { diagnostic: false, errors: true, learn: true, revision: true, confusion: false };

test("la révision remplit jusqu'à REVISION_CAP, après les erreurs", () => {
  const p = pickSessionPlan({ ...base, wrongCount: 100, revisionDue: 100 }, 20, REVISION_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.errors).toBe(Math.floor(0.3 * 20));   // 6
  expect(p.alloc.revision).toBe(Math.floor(REVISION_CAP * 20)); // 8
});

test("la révision est bornée par le nombre d'entités dues", () => {
  const p = pickSessionPlan({ ...base, revisionDue: 2 }, 20, REVISION_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.revision).toBe(2);
});

test("erreurs + révision + apprentissage saturantes → adaptatif à 0, budget entièrement alloué", () => {
  const p = pickSessionPlan(
    { ...base, wrongCount: 100, revisionDue: 100, newCoursePoints: 100 },
    10,
    REVISION_CAPS,
  );
  if (p.kind !== "composed") throw new Error("composed attendu");
  // errors=floor(0.3*10)=3 ; revision=min(100,floor(0.4*10)=4,10-3=7)=4 ;
  // learn=min(100,floor(0.4*10)=4,10-3-4=3)=3 (borné par le reste, pas par son propre cap) ;
  // adaptive=max(0,10-3-4-3)=0 — la tranche d'ajustement, jamais les tranches prioritaires.
  expect(p.alloc.errors + p.alloc.revision + p.alloc.learn + p.alloc.adaptive).toBe(10);
  expect(p.alloc.adaptive).toBe(0);
});

test("capacité révision absente → aucune tranche révision", () => {
  const p = pickSessionPlan({ ...base, revisionDue: 100 }, 20, { ...REVISION_CAPS, revision: false });
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.revision).toBe(0);
});

test("fsrs vide (revisionDue 0) → session inchangée : tout en adaptatif", () => {
  const p = pickSessionPlan(base, 20, REVISION_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc).toEqual({ errors: 0, confusion: 0, revision: 0, learn: 0, adaptive: 20 });
});

const CONF_CAPS: Caps = { diagnostic: false, errors: true, learn: true, revision: true, confusion: true };

test("confusion : errors et confusion atteignent tous deux leur cap (0,3 + 0,25 < 1)", () => {
  // total=20 ; errors=min(100, floor(0.3*20)=6)=6 ; confusion=min(100, floor(0.25*20)=5, 20-6=14)=5
  const p = pickSessionPlan({ ...base, wrongCount: 100, confusionCount: 100 }, 20, CONF_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.errors).toBe(6);
  expect(p.alloc.confusion).toBe(Math.floor(CONFUSION_CAP * 20)); // 5
});

test("confusion : bornée par confusionCount sous le cap", () => {
  const p = pickSessionPlan({ ...base, confusionCount: 2 }, 20, CONF_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.confusion).toBe(2);
});

test("confusion : la révision garde son plein cap dans une session normale", () => {
  // total=20 ; errors=6, confusion=5, revision=min(100, floor(0.4*20)=8, 20-6-5=9)=8 (cap plein)
  const p = pickSessionPlan({ ...base, wrongCount: 100, confusionCount: 100, revisionDue: 100 }, 20, CONF_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.revision).toBe(Math.floor(REVISION_CAP * 20)); // 8 — non comprimé par la confusion
});

test("confusion : graceful zero (aucune confusion → alloc.confusion=0, reste inchangé)", () => {
  const p = pickSessionPlan({ ...base, wrongCount: 50, revisionDue: 50, confusionCount: 0 }, 20, CONF_CAPS);
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.confusion).toBe(0);
});

test("confusion : capacité absente → 0 (gel de capacité)", () => {
  const p = pickSessionPlan({ ...base, confusionCount: 100 }, 20, { ...CONF_CAPS, confusion: false });
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.confusion).toBe(0);
});

test("toutes tranches saturantes → adaptatif 0, budget entièrement alloué avec confusion", () => {
  const p = pickSessionPlan(
    { ...base, wrongCount: 100, confusionCount: 100, revisionDue: 100, newCoursePoints: 100 }, 20, CONF_CAPS,
  );
  if (p.kind !== "composed") throw new Error("composed attendu");
  const { errors, confusion, revision, learn, adaptive } = p.alloc;
  expect(errors + confusion + revision + learn + adaptive).toBe(20);
});
