import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeContext, useThemeContext } from "./useThemeContext.tsx";

function Probe() {
  const { theme } = useThemeContext();
  return <span>{theme}</span>;
}

test("useThemeContext reads the provided theme", () => {
  const html = renderToStaticMarkup(
    <ThemeContext.Provider value={{ theme: "light", toggle: () => {} }}>
      <Probe />
    </ThemeContext.Provider>,
  );
  expect(html).toContain("light");
});
