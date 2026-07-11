import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header.tsx";
import { TopNav } from "./TopNav.tsx";
import { Footer } from "./Footer.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";
import { ThemeContext } from "../hooks/useThemeContext.tsx";

function nav(theme: "light" | "dark") {
  // MemoryRouter renders NavLink hrefs as paths (/quiz); production HashRouter adds the `#`.
  return renderToStaticMarkup(
    <MemoryRouter>
      <ThemeContext.Provider value={{ theme, toggle: () => {} }}>
        <TopNav />
      </ThemeContext.Provider>
    </MemoryRouter>,
  );
}

test("Header shows the French title", () => {
  expect(renderToStaticMarkup(<Header />)).toContain("JLPT N3");
});

test("TopNav renders internal router links + external vanilla links", () => {
  const html = nav("dark");
  expect(html).toContain('href="/quiz"');           // NavLink → router route
  expect(html).toContain('href="/entrainement"');
  expect(html).toContain('href="cours-n3.html"');    // still-vanilla external
  expect(html).toContain("Planning");
});

test("TopNav theme toggle button renders with correct emoji for dark theme", () => {
  const html = nav("dark");
  expect(html).toContain("☀");
  expect(html).toContain("Basculer le thème");
});

test("TopNav theme toggle button renders with correct emoji for light theme", () => {
  expect(nav("light")).toContain("☾");
});

test("Footer renders encouragement message", () => {
  expect(renderToStaticMarkup(<Footer onForceRefresh={() => {}} version="—" />)).toContain("頑張ってください！");
});

test("Footer renders force refresh button", () => {
  expect(renderToStaticMarkup(<Footer onForceRefresh={() => {}} version="—" />)).toContain("Forcer la mise à jour");
});

test("Footer shows a placeholder version before it resolves", () => {
  expect(renderToStaticMarkup(<Footer onForceRefresh={() => {}} version="—" />)).toContain("version —");
});

test("Footer shows the resolved version string", () => {
  expect(renderToStaticMarkup(<Footer onForceRefresh={() => {}} version="v80" />)).toContain("version v80");
});

test("UpdateBanner renders nothing when hidden", () => {
  expect(renderToStaticMarkup(<UpdateBanner show={false} onApply={() => {}} />)).toBe("");
});

test("UpdateBanner renders the reload prompt when shown", () => {
  expect(renderToStaticMarkup(<UpdateBanner show={true} onApply={() => {}} />)).toContain("Recharger");
});
