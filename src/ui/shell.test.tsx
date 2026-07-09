import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Header } from "./Header.tsx";
import { TopNav } from "./TopNav.tsx";
import { Footer } from "./Footer.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";

test("Header shows the French title", () => {
  expect(renderToStaticMarkup(<Header />)).toContain("JLPT N3");
});

test("TopNav links to the still-vanilla pages", () => {
  const html = renderToStaticMarkup(<TopNav theme="dark" onToggleTheme={() => {}} />);
  expect(html).toContain("app-n3.html");
  expect(html).toContain("cours-n3.html");
  expect(html).toContain("planning-n3.html");
});

test("TopNav theme toggle button renders with correct emoji for dark theme", () => {
  const html = renderToStaticMarkup(<TopNav theme="dark" onToggleTheme={() => {}} />);
  expect(html).toContain("☀");
  expect(html).toContain("Basculer le thème");
});

test("TopNav theme toggle button renders with correct emoji for light theme", () => {
  const html = renderToStaticMarkup(<TopNav theme="light" onToggleTheme={() => {}} />);
  expect(html).toContain("☾");
});

test("Footer renders encouragement message", () => {
  expect(renderToStaticMarkup(<Footer onForceRefresh={() => {}} />)).toContain("頑張ってください！");
});

test("Footer renders force refresh button", () => {
  expect(renderToStaticMarkup(<Footer onForceRefresh={() => {}} />)).toContain("Forcer la mise à jour");
});

test("UpdateBanner renders nothing when hidden", () => {
  expect(renderToStaticMarkup(<UpdateBanner show={false} onApply={() => {}} />)).toBe("");
});

test("UpdateBanner renders the reload prompt when shown", () => {
  expect(renderToStaticMarkup(<UpdateBanner show={true} onApply={() => {}} />)).toContain("Recharger");
});
