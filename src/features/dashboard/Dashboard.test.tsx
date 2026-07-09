import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Dashboard } from "./Dashboard.tsx";
import { dashboardModel } from "../../lib/scoring.ts";
import type { Progress } from "../../types/progress.ts";

const flat = (R: number, total: number): Progress => ({
  total,
  skill: { grammaire: { R }, vocabulaire: { R }, kanji: { R }, lecture: { R } },
});

test("empty state prompts to start a quiz", () => {
  const html = renderToStaticMarkup(<Dashboard model={null} days={150} />);
  expect(html).toContain("Aucune donnée");
  expect(html).toContain("150");
});

test("renders pass %, score, level once there is data", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("17%");
  expect(html).toContain("86/180");
  expect(html).toContain("N3-");
});

test("shows placeholders under 5 answers", () => {
  const m = dashboardModel(flat(1600, 3), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("?");
  expect(html).toContain("—");
});

test("displays skill mastery bars for all four skills", () => {
  const m = dashboardModel(flat(1600, 60), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<Dashboard model={m} days={m.days} />);
  expect(html).toContain("Grammaire");
  expect(html).toContain("Vocab");
  expect(html).toContain("Kanji");
  expect(html).toContain("Lecture");
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
