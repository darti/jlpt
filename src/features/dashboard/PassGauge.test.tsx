import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PassGauge } from "./PassGauge.tsx";

// SSR renders the caption + aria-label only; the ECharts dial is drawn client-side (effect).

test("PassGauge captions the value and the zone in words (SSR/offline fallback)", () => {
  const html = renderToStaticMarkup(<PassGauge passPct={73} />);
  expect(html).toContain("73%");
  expect(html).toContain("Prêt");   // ≥70 → ok zone, stated in words (not colour alone)
});

test("PassGauge labels a low estimate as at-risk", () => {
  const html = renderToStaticMarkup(<PassGauge passPct={20} />);
  expect(html).toContain("20%");
  expect(html).toContain("Risque");
});

test("PassGauge clamps out-of-range input to 0..100", () => {
  expect(renderToStaticMarkup(<PassGauge passPct={150} />)).toContain("100%");
  expect(renderToStaticMarkup(<PassGauge passPct={-5} />)).toContain("0%");
});
