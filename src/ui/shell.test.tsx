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
  expect(html).toContain('href="/entrainement"');   // merged quiz + hub route
  expect(html).toContain('href="/parametrage"');    // new settings tab
  expect(html).not.toContain('href="/planning"');    // onglet Planning retiré (méthode rapatriée sur l'Accueil)
  expect(html).toContain('href="/cours"');          // Cours now internal too
  expect(html).not.toContain('href="/quiz"');       // Quiz tab merged into Entraînement
  expect(html).not.toContain(".html");               // no external vanilla links left
  expect(html).toContain("ふ");                        // global furigana toggle (kept as-is)
});

test("TopNav tabs render monochrome icons instead of text", () => {
  const html = nav("dark");
  expect(html).toContain('data-icon="house"');       // Accueil
  expect(html).toContain('data-icon="dumbbell"');    // Entraînement
  expect(html).toContain('data-icon="book-open"');   // Cours
  expect(html).toContain('data-icon="gear"');        // Paramétrage
});

test("TopNav tabs keep French labels accessible via aria-label", () => {
  const html = nav("dark");
  expect(html).toContain('aria-label="Accueil"');
  expect(html).toContain('aria-label="Entraînement"');
  expect(html).toContain('aria-label="Cours"');
  expect(html).toContain('aria-label="Paramétrage"');
});

test("TopNav theme toggle shows the sun icon for dark theme", () => {
  const html = nav("dark");
  expect(html).toContain('data-icon="sun"');
  expect(html).toContain("Basculer le thème");
});

test("TopNav theme toggle shows the moon icon for light theme", () => {
  expect(nav("light")).toContain('data-icon="moon"');
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
