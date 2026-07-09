import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppView } from "./App.tsx";
import { dashboardModel } from "./lib/scoring.ts";
import type { Progress } from "./types/progress.ts";

const flat = (R: number): Progress => ({
  total: 60,
  skill: {
    grammaire: { R, t: 60 }, vocabulaire: { R, t: 60 }, kanji: { R, t: 60 }, lecture: { R, t: 60 },
  },
});

test("AppView composes shell + dashboard", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(
    <AppView theme="dark" onToggleTheme={() => {}} updateReady={false}
             onApplyUpdate={() => {}} onForceRefresh={() => {}}
             model={model} days={model.days} />,
  );
  expect(html).toContain("JLPT N3");
  expect(html).toContain("app-n3.html");
  expect(html).toContain("17%");
});
