import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Footer } from "./Footer.tsx";

// Behavioral coverage of the « Forcer la mise à jour » busy state (needs a live DOM —
// happy-dom via bunfig preload). The click must acknowledge itself even when nothing
// changes: disable the button + show « Mise à jour… » before the reload happens.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function button(): HTMLButtonElement {
  const b = container.querySelector("button");
  if (!b) throw new Error("force-refresh button not found");
  return b;
}

function render(onForceRefresh: () => void | Promise<void>) {
  act(() => { root.render(<Footer onForceRefresh={onForceRefresh} version="v89" />); });
}

test("idle button shows the action label and is enabled", () => {
  render(() => {});
  expect(button().textContent).toContain("Forcer la mise à jour");
  expect(button().disabled).toBe(false);
  expect(button().getAttribute("aria-busy")).toBe("false");
});

test("clicking shows « Mise à jour… » and disables the button immediately", () => {
  render(() => new Promise(() => {})); // never resolves: hold the busy state to observe it
  act(() => { button().dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  expect(button().disabled).toBe(true);
  expect(button().getAttribute("aria-busy")).toBe("true");
  expect(button().textContent).toContain("Mise à jour…");
  expect(button().textContent).not.toContain("Forcer la mise à jour");
});

test("the refresh action eventually fires after the visible-feedback delay", async () => {
  let calls = 0;
  render(() => { calls += 1; });
  act(() => { button().dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  expect(calls).toBe(0); // not yet — the busy state is shown first
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  expect(calls).toBe(1);
});
