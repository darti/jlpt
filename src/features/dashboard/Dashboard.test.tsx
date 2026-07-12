import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Dashboard } from "./Dashboard.tsx";
import { dashboardModel } from "../../lib/scoring.ts";
import type { Progress } from "../../types/progress.ts";

const flat = (R: number, total: number, ecouteT = 0): Progress => ({
  total,
  skill: {
    grammaire: { R, t: total },
    vocabulaire: { R, t: total },
    kanji: { R, t: total },
    lecture: { R, t: total },
    ecoute: { R, t: ecouteT },
  },
});

test("empty state prompts to start a quiz", () => {
  const html = renderToStaticMarkup(<Dashboard model={null} days={150} />);
  expect(html).toContain("Aucune donnée");
  expect(html).toContain("150");
});

test("renders pass %, score, level once there is data (estimated listening, ecoute.t<3)", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("17%");
  expect(html).toContain("86/180");
  expect(html).toContain("N3-");
});

test("switches to measured listening once ecoute.t>=3, producing different values", () => {
  const m = dashboardModel(flat(1600, 60, 60), new Date("2026-07-10T00:00:00"));
  expect(m.passPct).toBe(27);
  expect(m.sectionTotal).toBe(90);
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("27%");
  expect(html).toContain("90/180");
});

test("shows placeholders under 5 answers", () => {
  const m = dashboardModel(flat(1600, 3), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("?");
  expect(html).toContain("—");
});

test("delegates skill mastery to the radar chart for the four BAR_SKILLS only, not ecoute", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("Grammaire");
  expect(html).toContain("Vocab");
  expect(html).toContain("Kanji");
  expect(html).toContain("Lecture");
  expect(html).not.toContain("Écoute");
  expect(html).toContain("skill-chart"); // radar container is rendered (chart draws client-side)
});

test("renders confidence percentage", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("fiabilité");
  expect(html).toContain("100%");
});

test("handles model with zero answers (empty state)", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  m.answers = 0; // Force empty state
  const html = renderToStaticMarkup(<Dashboard model={m} days={150} />);
  expect(html).toContain("Aucune donnée");
});

test("gauge marker renders at the pass % once there is enough data", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00")); // passPct 17
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("clamp(1%, 17%, 99%)");
});

test("gauge is hidden when there is not enough data", () => {
  const m = dashboardModel(flat(1600, 3), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).not.toContain("clamp(");
});

test("pass-% threshold color is the risk (bad) tone below 40%", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00")); // passPct 17 -> bad
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  // Assert the color class is on the pass-% figure itself (not just present anywhere,
  // since "jours restants" also uses text-status-completed unconditionally).
  expect(html).toContain('text-status-failed">17%');
});

test("pass-% threshold color is the ok tone at/above 70%", () => {
  const m = dashboardModel(flat(1700, 60, 60), new Date("2026-07-10T00:00:00")); // passPct 80 -> ok
  expect(m.passPct).toBe(80);
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain('text-status-completed">80%');
});
