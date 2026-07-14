import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionProgress } from "./SessionProgress.tsx";

test("SessionProgress (normal) shows « Question X / N » and fills the bar to position", () => {
  const html = renderToStaticMarkup(<SessionProgress index={4} count={20} mode="normal" />);
  expect(html).toContain("Question 5 / 20"); // index is 0-based → 5e question
  expect(html).toContain("width:25%");        // 5/20
  expect(html).toContain('role="progressbar"');
});

test("SessionProgress (diagnostic) keeps the legacy « Test · question X / N » wording", () => {
  const html = renderToStaticMarkup(<SessionProgress index={0} count={10} mode="diagnostic" />);
  expect(html).toContain("Test · question 1 / 10");
});

test("SessionProgress clamps the position and renders nothing for an empty session", () => {
  // index beyond the last question never overflows the count
  expect(renderToStaticMarkup(<SessionProgress index={99} count={3} mode="normal" />)).toContain("Question 3 / 3");
  // no session → nothing to show
  expect(renderToStaticMarkup(<SessionProgress index={0} count={0} mode="normal" />)).toBe("");
});
