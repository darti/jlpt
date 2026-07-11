import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardView } from "./App.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import type { Progress } from "./types/progress.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R, t: 60 }, vocabulaire: { R, t: 60 }, kanji: { R, t: 60 }, lecture: { R, t: 60 } },
});

test("DashboardView renders the dashboard stats + install/sync sections (no shell)", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(<DashboardView model={model} days={model.days} onProgressChanged={() => {}} />);
  expect(html).toContain("17%");                              // stat
  expect(html).toContain("Installer");                        // InstallPrompt
  expect(html).toContain("Synchronisation multi-appareils");  // SyncSection
  expect(html).not.toContain("Accueil");                      // shell moved to AppShell
});
