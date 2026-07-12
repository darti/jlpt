import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SkillChart } from "./SkillChart.tsx";
import type { SkillCoverage } from "../../lib/coverage.ts";
import type { Skill } from "../../types/progress.ts";

const mastery = { grammaire: 67, vocabulaire: 75, kanji: 78, lecture: 49, ecoute: 0 };
const cov = (seen: number, mastered: number): SkillCoverage =>
  ({ seen, mastered, seenN: seen, masteredN: mastered, total: 100 });
const coverage: Record<Skill, SkillCoverage> = {
  grammaire: cov(80, 60), vocabulaire: cov(90, 70), kanji: cov(55, 40),
  lecture: cov(30, 20), ecoute: cov(0, 0),
};

test("SkillChart renders each BAR_SKILL label with its mastery %, excluding écoute", () => {
  const html = renderToStaticMarkup(<SkillChart mastery={mastery} />);
  expect(html).toContain("Grammaire");
  expect(html).toContain("67%");
  expect(html).toContain("Vocab");
  expect(html).toContain("75%");
  expect(html).toContain("Kanji");
  expect(html).toContain("78%");
  expect(html).toContain("Lecture");
  expect(html).toContain("49%");
  expect(html).not.toContain("Écoute"); // ecoute has no dashboard bar/axis
});

test("SkillChart renders an accessible radar container for the client-side chart", () => {
  const html = renderToStaticMarkup(<SkillChart mastery={mastery} />);
  expect(html).toContain("skill-chart");
  expect(html).toContain('role="img"');
});

test("without coverage there is no Vu (coverage) series or legend", () => {
  const html = renderToStaticMarkup(<SkillChart mastery={mastery} />);
  expect(html).not.toContain("Vu");
  expect(html).not.toContain("couverture");
});

test("with coverage, overlays a Vu series with a legend and per-skill vu %", () => {
  const html = renderToStaticMarkup(<SkillChart mastery={mastery} coverage={coverage} />);
  expect(html).toContain("Maîtrise");   // legend entry for the mastery series
  expect(html).toContain("couverture"); // legend entry for the coverage (Vu) series
  expect(html).toContain("vu ");        // per-skill coverage figure label
  expect(html).toContain("80%");        // grammaire seen % (not a mastery value)
  expect(html).toContain("30%");        // lecture seen % (not a mastery value)
});
