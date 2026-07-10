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
             model={model} days={model.days} version="v80" />,
  );
  expect(html).toContain("JLPT N3");
  expect(html).toContain("app-n3.html");
  expect(html).toContain("17%");
});

test("AppView renders the install prompt without throwing under SSR (no window/navigator DOM)", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(
    <AppView theme="dark" onToggleTheme={() => {}} updateReady={false}
             onApplyUpdate={() => {}} onForceRefresh={() => {}}
             model={model} days={model.days} version="v80" />,
  );
  expect(html).toContain("Installer");
  expect(html).toContain("application");
});

test("AppView threads the resolved version into the footer", () => {
  const model = dashboardModel(flat(1600), new Date("2026-07-10T00:00:00"));
  const html = renderToStaticMarkup(
    <AppView theme="dark" onToggleTheme={() => {}} updateReady={false}
             onApplyUpdate={() => {}} onForceRefresh={() => {}}
             model={model} days={model.days} version="v80" />,
  );
  expect(html).toContain("version v80");
});
