import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeContext } from "../../hooks/useThemeContext.tsx";
import { Parametrage } from "./Parametrage.tsx";

test("Parametrage renders font, theme, data and sync sections", () => {
  const html = renderToStaticMarkup(
    <ThemeContext.Provider value={{ theme: "dark", toggle: () => {} }}>
      <Parametrage />
    </ThemeContext.Provider>,
  );
  expect(html).toContain("Police");                          // Settings font section
  expect(html).toContain("Exporter");                        // Settings data section
  expect(html).toContain("Réinitialiser");                   // Settings data section
  expect(html).toContain("Synchronisation multi-appareils"); // SyncSection
});
