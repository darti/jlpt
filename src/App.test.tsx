import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardView } from "./App.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import type { Progress } from "./types/progress.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R, t: 60 }, vocabulaire: { R, t: 60 }, kanji: { R, t: 60 }, lecture: { R, t: 60 } },
});

test("DashboardView renders stats + install prompt + progression chart (no sync)", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<DashboardView model={model} days={model.days} scores={[]} />);
  expect(html).toContain("17%");                                 // Dashboard stat
  expect(html).toContain("Installer");                           // InstallPrompt
  expect(html).toContain("Progression");                         // chart section moved from Entraînement
  expect(html).toContain("Au moins 2 diagnostics");              // ProgressChart empty state
  expect(html).not.toContain("Synchronisation multi-appareils"); // sync moved to Paramétrage
});
