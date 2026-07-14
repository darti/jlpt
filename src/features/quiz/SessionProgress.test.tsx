import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionProgress } from "./SessionProgress.tsx";

test("SessionProgress (normal) shows « Question X / N » and fills the bar to position", () => {
  const html = renderToStaticMarkup(<SessionProgress index={4} count={20} mode="normal" />);
  expect(html).toContain("Question 5 / 20"); // index is 0-based → 5e question
  expect(html).toContain("width:25%");        // 5/20
  expect(html).toContain('role="progressbar"');
});

test("SessionProgress (normal) shows the ✓ bonnes / ✗ mauvaises tally", () => {
  // 4 answered so far, 3 right → 1 wrong
  const html = renderToStaticMarkup(<SessionProgress index={4} count={20} mode="normal" right={3} answered={4} />);
  expect(html).toContain("✓ 3");
  expect(html).toContain("✗ 1");
});

test("SessionProgress hides the tally before any answer and in diagnostic mode", () => {
  // nothing answered yet → no tally
  expect(renderToStaticMarkup(<SessionProgress index={0} count={20} mode="normal" right={0} answered={0} />)).not.toContain("✓");
  // diagnostic conceals the score until the end-of-test corrigé
  expect(renderToStaticMarkup(<SessionProgress index={2} count={10} mode="diagnostic" right={2} answered={2} />)).not.toContain("✓");
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
