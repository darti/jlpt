import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./AppShell.tsx";

test("AppShell renders the shell + child route outlet", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>ROUTE_CONTENT</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(html).toContain("JLPT N3");        // Header
  expect(html).toContain("Accueil");        // TopNav
  expect(html).toContain("ROUTE_CONTENT");  // Outlet
  expect(html).toContain("Bon courage");    // Footer
});
