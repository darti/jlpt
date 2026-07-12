import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { TopNav } from "./TopNav.tsx";
import { ThemeContext } from "../hooks/useThemeContext.tsx";

// Behavioral coverage of the pinned (« stuck ») top-nav. Needs a live DOM: happy-dom's
// getBoundingClientRect() returns top=0, so the mount effect resolves the nav to its
// pinned state, letting us assert the frosted chrome it applies while stuck.
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

function renderNav() {
  act(() => {
    root.render(
      <MemoryRouter>
        <ThemeContext.Provider value={{ theme: "dark", toggle: () => {} }}>
          <TopNav />
        </ThemeContext.Provider>
      </MemoryRouter>,
    );
  });
}

function nav(): HTMLElement {
  const el = container.querySelector("nav");
  if (!el) throw new Error("nav not found");
  return el;
}

test("pinned nav applies the frosted backdrop blur", () => {
  renderNav();
  expect(nav().className).toContain("surface-blur");
});

test("pinned nav extends its frosted backdrop through the safe-area notch strip", () => {
  // On iOS the sticky nav pins at `top: env(safe-area-inset-top)`, below the notch.
  // Without an explicit notch fill, its blur stops at the notch instead of reaching
  // the very top of the screen. The `notch-fill` class paints that strip.
  renderNav();
  expect(nav().className).toContain("notch-fill");
});
