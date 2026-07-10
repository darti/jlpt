import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import type { Progress } from "./types/progress.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: { grammaire: { R, t: 60 }, vocabulaire: { R, t: 60 }, kanji: { R, t: 60 }, lecture: { R, t: 60 } },
});

function view(scores: number[]) {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  return renderToStaticMarkup(
    <EntrainementAppView
      theme="dark" onToggleTheme={() => {}}
      updateReady={false} onApplyUpdate={() => {}} onForceRefresh={() => {}} version="v83"
      model={model} days={model.days} scores={scores} onProgressChanged={() => {}}
    />,
  );
}

test("EntrainementAppView composes shell + progress stats + session launcher + deferred stubs", () => {
  const html = view([]);
  expect(html).toContain("JLPT N3");             // shell header
  expect(html).toContain("17%");                 // progress stat (réussite estimée) — reused Dashboard
  expect(html).toContain("Démarrer ma session"); // SessionLauncher
  expect(html).toContain("bientôt");             // deferred Diagnostic/Apprendre/Erreurs stubs
});

test("EntrainementAppView shows the empty-state chart when there are <2 session scores", () => {
  expect(view([])).toContain("Au moins 2 diagnostics");
});

test("EntrainementAppView renders the Gist sync section under SSR", () => {
  expect(view([])).toContain("Synchronisation multi-appareils");
});
