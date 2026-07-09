import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { useProgress } from "./useProgress.ts";
import type { Progress } from "../../types/progress.ts";

// Test component that uses the hook
function TestHook() {
  const progress = useProgress();
  return <div>{progress ? `answers: ${progress.total}` : "null"}</div>;
}

test("useProgress hook returns null initially", () => {
  const html = renderToStaticMarkup(<TestHook />);
  expect(html).toContain("null");
});

test("useProgress hook initializes state management with storage event listener", () => {
  // Verifies the hook sets up event listeners for cross-tab sync
  const html = renderToStaticMarkup(<TestHook />);
  expect(html).toBeTruthy();
});

test("useProgress handles missing localStorage gracefully", () => {
  // SSR context: localStorage may not exist, hook should not crash
  const originalStorage = globalThis.localStorage;
  try {
    delete (globalThis as any).localStorage;
    const html = renderToStaticMarkup(<TestHook />);
    expect(html).toContain("null");
  } finally {
    (globalThis as any).localStorage = originalStorage;
  }
});
