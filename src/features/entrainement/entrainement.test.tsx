import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionLauncher } from "./SessionLauncher.tsx";
import { Settings } from "./Settings.tsx";

test("SessionLauncher shows the minutes prompt and start button", () => {
  const html = renderToStaticMarkup(<SessionLauncher />);
  expect(html).toContain("minutes");
  expect(html).toContain("Démarrer ma session");
});

test("Settings renders font-scale, theme, and data controls", () => {
  const html = renderToStaticMarkup(<Settings theme="dark" onToggleTheme={() => {}} />);
  expect(html).toContain("Police");
  expect(html).toContain("Exporter");
  expect(html).toContain("Réinitialiser");
});
