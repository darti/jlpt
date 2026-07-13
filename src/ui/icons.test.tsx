import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { IconHome, IconDumbbell, IconBookOpen, IconGear, IconMoon, IconSun } from "./icons.tsx";

test("IconHome renders a monochrome svg with a stable data-icon name", () => {
  const html = renderToStaticMarkup(<IconHome />);
  expect(html).toContain('data-icon="house"');
  expect(html).toContain('fill="currentColor"'); // monochrome: inherits surrounding text color
  expect(html).toContain('aria-hidden="true"');  // decorative — label lives on the parent control
});

test("each icon exposes its FontAwesome name via data-icon", () => {
  expect(renderToStaticMarkup(<IconDumbbell />)).toContain('data-icon="dumbbell"');
  expect(renderToStaticMarkup(<IconBookOpen />)).toContain('data-icon="book-open"');
  expect(renderToStaticMarkup(<IconGear />)).toContain('data-icon="gear"');
  expect(renderToStaticMarkup(<IconMoon />)).toContain('data-icon="moon"');
  expect(renderToStaticMarkup(<IconSun />)).toContain('data-icon="sun"');
});

test("icons forward className so callers can theme them", () => {
  expect(renderToStaticMarkup(<IconHome className="text-accent" />)).toContain('class="text-accent"');
});
