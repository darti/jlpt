import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SkillChart } from "./SkillChart.tsx";

const mastery = { grammaire: 67, vocabulaire: 75, kanji: 78, lecture: 49, ecoute: 0 };

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
