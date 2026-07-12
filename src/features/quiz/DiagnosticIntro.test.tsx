import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DiagnosticIntro } from "./DiagnosticIntro.tsx";

test("DiagnosticIntro shows test-mode heading, count, and both buttons", () => {
  const html = renderToStaticMarkup(<DiagnosticIntro count={15} onStart={() => {}} onLater={() => {}} />);
  expect(html).toContain("Mode test");
  expect(html).toContain("15");
  expect(html).toContain("Commencer le test");
  expect(html).toContain("Plus tard");
});
