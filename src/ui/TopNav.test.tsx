import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ThemeContext } from "../hooks/useThemeContext.tsx";
import { TopNav } from "./TopNav.tsx";

function nav() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ThemeContext.Provider value={{ theme: "dark", toggle: () => {} }}>
        <TopNav />
      </ThemeContext.Provider>
    </MemoryRouter>,
  );
}

test("TopNav lists the Accueil and Paramétrage tabs", () => {
  const html = nav();
  expect(html).toContain("Accueil");
  expect(html).toContain("Paramétrage");
});
