import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverageRings } from "./CoverageRings.tsx";
import type { SkillCoverage } from "../../lib/coverage.ts";
import type { Skill } from "../../types/progress.ts";

const cov = {
  grammaire: { seen: 12, mastered: 8, seenN: 141, masteredN: 94, total: 1174 },
  vocabulaire: { seen: 3, mastered: 1, seenN: 177, masteredN: 59, total: 5904 },
  kanji: { seen: 5, mastered: 2, seenN: 157, masteredN: 63, total: 3148 },
  lecture: { seen: 40, mastered: 25, seenN: 21, masteredN: 13, total: 52 },
} as Record<Skill, SkillCoverage>;

test("CoverageRings renders vu/appris labels and percentages", () => {
  const html = renderToStaticMarkup(<CoverageRings coverage={cov} />);
  expect(html).toContain("Grammaire");
  expect(html).toContain("vu");
  expect(html).toContain("appris");
  expect(html).toContain("12%");
  expect(html).toContain("8%");
});

test("CoverageRings tolerates a missing skill entry (defaults to 0)", () => {
  const html = renderToStaticMarkup(<CoverageRings coverage={{} as Record<Skill, SkillCoverage>} />);
  expect(html).toContain("Grammaire");
  expect(html).toContain("0%");
});
