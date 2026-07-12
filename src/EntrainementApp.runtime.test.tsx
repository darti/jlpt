import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import EntrainementApp from "./EntrainementApp.tsx";

// Runtime smoke: mounts the FULL container (useQuiz + useProgress effects) under happy-dom.
// EntrainementApp is a route component → wrap in MemoryRouter (useSearchParams). No search
// params → no auto-start; phase stays "home" and the hub renders.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  // Seed a realistic returning-user state: progress + a 2-session history + resume.
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({
    total: 60,
    skill: { grammaire: { R: 1600, t: 60 }, vocabulaire: { R: 1600, t: 60 }, kanji: { R: 1600, t: 60 }, lecture: { R: 1600, t: 60 } },
    history: [{ mode: "session", score: 90 }, { mode: "session", score: 120 }],
  }));
  localStorage.setItem("jlptN3quiz_resume", JSON.stringify({ kind: "quiz", ids: [1, 2, 3], qi: 1, right: 1, t: Date.now() }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function renderApp() {
  act(() => {
    root.render(<MemoryRouter><EntrainementApp /></MemoryRouter>);
  });
}

test("mounts live and renders the hub (start card + dashboard stats)", () => {
  renderApp();
  const text = container.textContent ?? "";
  expect(text).toContain("Lancer une session"); // QuizHome start card
  expect(text).toContain("%");                   // Dashboard progress stats
});

test("hub no longer shows settings or sync (moved to Paramétrage)", () => {
  renderApp();
  const text = container.textContent ?? "";
  expect(text).not.toContain("Réglages");
  expect(text).not.toContain("Synchronisation multi-appareils");
});

test("reads the session-score history into the progress chart", () => {
  renderApp();
  const text = container.textContent ?? "";
  expect(text).toContain("estimé /180");
  expect(text).not.toContain("Au moins 2 diagnostics");
});

test("resume banner appears when a valid quiz session is stored", () => {
  renderApp();
  expect(container.textContent ?? "").toContain("Reprendre ma session");
});
