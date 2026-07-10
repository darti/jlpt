import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import EntrainementApp from "./EntrainementApp.tsx";

// Runtime smoke: mounts the FULL container (hooks + effects, not just SSR) under happy-dom,
// so it exercises the mount effect (readSessionScores/applyFontScale/initDefs), useProgress,
// useServiceWorker and the whole live tree — catching client-only errors SSR can't.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty("--fs-ui");
  // Seed a realistic returning-user state: progress + a 2-session history + font scale + resume.
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({
    total: 60,
    skill: { grammaire: { R: 1600, t: 60 }, vocabulaire: { R: 1600, t: 60 }, kanji: { R: 1600, t: 60 }, lecture: { R: 1600, t: 60 } },
    history: [{ mode: "session", score: 90 }, { mode: "session", score: 120 }],
  }));
  localStorage.setItem("jlptN3_fsUi", "1.2");
  localStorage.setItem("jlptN3quiz_resume", JSON.stringify({ kind: "quiz", ids: [1, 2, 3], qi: 1, right: 1, t: Date.now() }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

test("EntrainementApp mounts live without throwing and renders the whole hub", () => {
  act(() => { root.render(<EntrainementApp />); });
  const text = container.textContent ?? "";
  expect(text).toContain("Démarrer ma session"); // SessionLauncher
  expect(text).toContain("Réglages");            // Settings
  expect(text).toContain("Synchronisation multi-appareils"); // SyncSection (full tree mounted)
  expect(text).toContain("%");                   // Dashboard progress stats rendered from seeded progress
});

test("mount effect applies the persisted font scale", () => {
  act(() => { root.render(<EntrainementApp />); });
  expect(document.documentElement.style.getPropertyValue("--fs-ui")).toBe("1.2");
});

test("resume banner appears when a valid quiz session is stored", () => {
  act(() => { root.render(<EntrainementApp />); });
  expect(container.textContent ?? "").toContain("Reprendre ma session");
});
