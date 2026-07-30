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

function chrome(): HTMLElement {
  const el = container.querySelector("[data-chrome]");
  if (!el) throw new Error("chrome wrapper not found");
  return el as HTMLElement;
}

test("pinned chrome applies the frosted backdrop blur", () => {
  renderNav();
  expect(chrome().className).toContain("surface-blur");
});

test("the frosted surface covers the safe-area strip within its own box", () => {
  // On iOS the tab row must clear the notch, so the frosted box has to START at the screen
  // top and push its content down by the inset — hence `pt` + a matching negative `mt`,
  // which hands the space back to the flow so nothing else moves.
  renderNav();
  expect(chrome().className).toContain("pt-[env(safe-area-inset-top)]");
  expect(chrome().className).toContain("mt-[calc(env(safe-area-inset-top)*-1)]");
  expect(chrome().className).toContain("top-0");
});

test("exactly one frosted surface spans notch strip and tab row", () => {
  // Two adjacent blurred layers show a SEAM: each blur clamps its kernel at its own edge,
  // so the tint steps at the boundary (reported on iPhone once the strip was filled by a
  // separate overlay). One box, one blur.
  // Second reason for a single box: an element with `backdrop-filter` is the *backdrop
  // root* of its descendants, so a nested blurred child lying outside its parent's box has
  // an empty backdrop — it paints its colour and blurs nothing (measured in Blink).
  renderNav();
  expect(container.querySelectorAll(".surface-blur").length).toBe(1);
  // Assert on the tag name, not the node: happy-dom serialising a failed DOM match takes
  // minutes, and a regression that looks like a hung suite is a regression nobody reads.
  expect(nav().className.includes("surface-blur") ? "NAV" : null).toBeNull();
});
