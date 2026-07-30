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

test("pinned nav renders a notch fill covering the safe-area strip", () => {
  // On iOS the sticky nav pins at `top: env(safe-area-inset-top)`, below the notch, so
  // the status-bar strip above it needs its own frosted surface to reach the screen top.
  renderNav();
  const fill = container.querySelector("[data-notch-fill]");
  expect(fill).not.toBeNull();
  expect(fill!.className).toContain("surface-blur");
  expect(fill!.className).toContain("h-[env(safe-area-inset-top)]");
});

test("notch fill is not nested inside a backdrop-filtered surface", () => {
  // Measured in Blink (and the reported iOS symptom): an element carrying
  // `backdrop-filter` becomes the *backdrop root* of its descendants, so a descendant's
  // backdrop is empty outside that ancestor's box — it paints its colour but blurs
  // nothing. The previous implementation was a `::before` on the blurred nav itself,
  // placed at `bottom: 100%` (fully outside it), which is exactly that dead case.
  // The fill must therefore stay a sibling, in the same backdrop root as the content.
  renderNav();
  const fill = container.querySelector("[data-notch-fill]");
  // `closest` from the element itself would match its own `surface-blur`; walk the
  // ANCESTRY, which is what decides the backdrop root. Assert on the tag name, not the
  // node: happy-dom serialising a failed DOM match takes minutes, and a regression that
  // looks like a hung suite is a regression nobody reads.
  const blurredAncestor = fill!.parentElement!.closest(".surface-blur");
  expect(blurredAncestor?.tagName ?? null).toBeNull();
});
