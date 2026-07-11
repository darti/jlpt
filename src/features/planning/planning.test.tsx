import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { Planning } from "./Planning.tsx";

test("Planning renders the 20-week plan with phases, countdown + reset", () => {
  const html = renderToStaticMarkup(<MemoryRouter><Planning /></MemoryRouter>);
  expect(html).toContain("Mise en route");        // week 1 title
  expect(html).toContain("Phase 1");               // phase label
  expect(html).toContain("S20");                   // week 20 rendered (apostrophe in title is HTML-escaped)
  expect(html).toContain("JOUR J");                // week 20 item content
  expect(html).toContain("Réinitialiser");         // reset control
  expect(html).toContain("jours restants");        // countdown
  expect(html).toContain("Progression");           // progress text
});
