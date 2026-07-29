import { test, expect } from "bun:test";
import { pickSessionPlan, BUILT_CAPS, REVISION_CAP, CONFUSION_CAP, LEARN_FLOOR, type Caps } from "./sessionPlan.ts";

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

test("learn : le plancher ne fabrique jamais plus de cartes que newCoursePoints n'en offre", () => {
  // plancher visé = max(1, round(0.25*10))=3, mais newCoursePoints=2 < 3 : le Math.min borne le
  // plancher à ce qui existe réellement — c'est ce qui protège l'invariant #3 (programme épuisé).
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

test("la révision remplit jusqu'à REVISION_CAP, après les erreurs (pas de plancher : newCoursePoints=0)", () => {
  // newCoursePoints=0 ⇒ le plancher d'apprentissage prélève 0 : la révision atteint donc encore
  // son plein cap après les erreurs, exactement comme avant l'introduction du plancher.
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
  // plancher=min(10,100,max(1,round(0.25*10)=3))=3 ; reste=7 ;
  // errors=min(100,floor(0.3*10)=3,7)=3 ; revision=min(100,floor(0.4*10)=4,7-3=4)=4 ;
  // sup=min(100-3,floor(0.4*10)-3=1,7-3-4=0)=0 → learn=3+0=3 (ici le plancher seul
  // couvre déjà tout ce que le reste du budget laisse à l'apprentissage) ;
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

test("confusion : la révision garde son plein cap dans une session normale (pas de plancher : newCoursePoints=0)", () => {
  // total=20 ; newCoursePoints=0 ⇒ plancher=0 ⇒ reste=20, comme avant son introduction.
  // errors=6, confusion=5, revision=min(100, floor(0.4*20)=8, 20-6-5=9)=8 (cap plein)
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

test("toutes tranches saturantes → adaptatif 0, budget entièrement alloué avec confusion (plancher effectif)", () => {
  // Le cas où le plancher change RÉELLEMENT le résultat : sans lui, l'apprentissage ne recevait
  // que les miettes du reste (learn=1, revision=8) ; avec lui, il est garanti à 25 % du budget
  // AVANT que les autres tranches ne se servent.
  // plancher=min(20,100,max(1,round(0.25*20)=5))=5 ; reste=15 ;
  // errors=min(100,floor(0.3*20)=6,15)=6 ; confusion=min(100,floor(0.25*20)=5,15-6=9)=5 ;
  // revision=min(100,floor(0.4*20)=8,15-6-5=4)=4 ;
  // sup=min(100-5,floor(0.4*20)-5=3,15-6-5-4=0)=0 → learn=5+0=5 ; adaptive=20-6-5-4-5=0.
  const p = pickSessionPlan(
    { ...base, wrongCount: 100, confusionCount: 100, revisionDue: 100, newCoursePoints: 100 }, 20, CONF_CAPS,
  );
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc).toEqual({ errors: 6, confusion: 5, revision: 4, learn: 5, adaptive: 0 });
  const { errors, confusion, revision, learn, adaptive } = p.alloc;
  expect(errors + confusion + revision + learn + adaptive).toBe(20);
});

// ─── Plancher d'apprentissage (LEARN_FLOOR = 25 %) ─────────────────────────────────────────
// Motif : les plafonds errors/confusion/revision somment à 0,95 — sans plancher, un apprenant
// chargé ne recevait que les miettes de l'apprentissage (mesuré : 1 sur 10 questions). Le
// plancher prélève 25 % du budget pour l'apprentissage AVANT que les autres tranches ne se
// servent dans ce qui reste.

test("le cas qui a motivé le changement : apprenant chargé, budget 15 → learn >= 4 (contre 2 avant)", () => {
  const p = pickSessionPlan(
    { ...base, daysSinceDiagnostic: 3, wrongCount: 20, confusionCount: 5, revisionDue: 40, newCoursePoints: 9999 },
    15,
    BUILT_CAPS,
  );
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.learn).toBeGreaterThanOrEqual(4);
});

test("le plancher tient sur les quatre durées réelles, profil saturé", () => {
  const state = {
    ...base, daysSinceDiagnostic: 3, wrongCount: 99, confusionCount: 99, revisionDue: 99, newCoursePoints: 9999,
  };
  // Arbitré : 2, 4, 8, 11 questions d'apprentissage pour 5, 10, 20, 30 min (8/15/30/45 questions).
  // Alloc complète figée (pas seulement learn) : c'est CE QUE le plancher déplace qu'on veut voir —
  // à 45 questions la révision cède 8 points (18 → 10) et se fait dépasser par l'apprentissage (11).
  const attendu: Record<number, { errors: number; confusion: number; revision: number; learn: number; adaptive: number }> = {
    8: { errors: 2, confusion: 2, revision: 2, learn: 2, adaptive: 0 },
    15: { errors: 4, confusion: 3, revision: 4, learn: 4, adaptive: 0 },
    30: { errors: 9, confusion: 7, revision: 6, learn: 8, adaptive: 0 },
    45: { errors: 13, confusion: 11, revision: 10, learn: 11, adaptive: 0 },
  };
  for (const [total, allocAttendu] of Object.entries(attendu)) {
    expect(allocAttendu.learn).toBe(Math.max(1, Math.round(LEARN_FLOOR * Number(total))));
    const p = pickSessionPlan(state, Number(total), BUILT_CAPS);
    if (p.kind !== "composed") throw new Error("composed attendu");
    expect(p.alloc).toEqual(allocAttendu);
  }
});

test("newCoursePoints=0 (programme épuisé) → learn=0 malgré le plancher", () => {
  const p = pickSessionPlan(
    { ...base, daysSinceDiagnostic: 3, wrongCount: 99, confusionCount: 99, revisionDue: 99, newCoursePoints: 0 },
    30,
    BUILT_CAPS,
  );
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.learn).toBe(0);
});

test("total=0 : le plancher ne peut pas fabriquer une carte hors budget, aucune tranche négative", () => {
  // Math.max(1, …) visait 1 carte même à budget nul ; c'est le Math.min(total, …) qui l'écrête.
  // Sans lui, `reste` devient négatif et `errors` (borné par `reste`) sortirait à -1.
  const p = pickSessionPlan(
    { ...base, daysSinceDiagnostic: 3, wrongCount: 99, confusionCount: 99, revisionDue: 99, newCoursePoints: 9999 },
    0,
    BUILT_CAPS,
  );
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc).toEqual({ errors: 0, confusion: 0, revision: 0, learn: 0, adaptive: 0 });
});

test("plancher : gel de capacité — caps.learn=false → learn=0", () => {
  const p = pickSessionPlan(
    { ...base, daysSinceDiagnostic: 3, newCoursePoints: 9999 },
    30,
    { ...BUILT_CAPS, learn: false },
  );
  if (p.kind !== "composed") throw new Error("composed attendu");
  expect(p.alloc.learn).toBe(0);
});

test("invariant de somme : balayage de budgets et de profils, avec et sans plancher effectif", () => {
  const caps: Caps = { diagnostic: false, errors: true, learn: true, revision: true, confusion: true };
  const profils = [
    { wrongCount: 0, confusionCount: 0, revisionDue: 0, newCoursePoints: 0 },
    { wrongCount: 5, confusionCount: 2, revisionDue: 10, newCoursePoints: 20 },
    { wrongCount: 99, confusionCount: 99, revisionDue: 99, newCoursePoints: 9999 },
    { wrongCount: 0, confusionCount: 0, revisionDue: 0, newCoursePoints: 9999 },
  ];
  for (let total = 0; total <= 45; total++) {
    for (const profil of profils) {
      const p = pickSessionPlan({ ...base, daysSinceDiagnostic: 3, ...profil }, total, caps);
      if (p.kind !== "composed") throw new Error("composed attendu");
      const { errors, confusion, revision, learn, adaptive } = p.alloc;
      expect(errors + confusion + revision + learn + adaptive).toBe(total);
      expect(errors).toBeGreaterThanOrEqual(0);
      expect(confusion).toBeGreaterThanOrEqual(0);
      expect(revision).toBeGreaterThanOrEqual(0);
      expect(learn).toBeGreaterThanOrEqual(0);
      expect(adaptive).toBeGreaterThanOrEqual(0);
    }
  }
});
