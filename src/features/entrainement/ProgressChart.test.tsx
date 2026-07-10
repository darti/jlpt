import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressChart } from "./ProgressChart.tsx";

test("empty-state when <2 diagnostics (SSR renders without touching ECharts/DOM)", () => {
  const html = renderToStaticMarkup(<ProgressChart scores={[]} />);
  expect(html).toContain("Au moins 2 diagnostics");
});

test("renders a chart container when there is data (no throw under SSR)", () => {
  const html = renderToStaticMarkup(<ProgressChart scores={[80, 95, 110]} />);
  expect(html).toContain("progress-chart"); // the container div; ECharts inits in useEffect only
});
