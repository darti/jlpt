import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionLauncher } from "./SessionLauncher.tsx";

test("SessionLauncher shows the minutes prompt and start button", () => {
  const html = renderToStaticMarkup(<SessionLauncher />);
  expect(html).toContain("minutes");
  expect(html).toContain("Démarrer ma session");
});
