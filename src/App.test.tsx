import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App.tsx";

test("App renders the title", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("JLPT N3");
});
