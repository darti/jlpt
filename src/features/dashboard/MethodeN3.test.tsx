import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MethodeN3 } from "./MethodeN3.tsx";

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MethodeN3 />
    </MemoryRouter>,
  );
}

test("MethodeN3 rend les 3 blocs de méthode dans une section repliable", () => {
  const html = render();
  expect(html).toContain("<details");                 // repliable
  expect(html).toContain("La méthode N3");             // titre du summary
  expect(html).toContain("Ce qu&#x27;il faut");        // bloc 1 (apostrophe échappée)
  expect(html).toContain("Les 4 phases");              // bloc 2
  expect(html).toContain("Routine quotidienne");       // bloc 3
  expect(html).toContain("650");                        // stat kanji (~650)
});

test("MethodeN3 lie Entraînement et Cours", () => {
  const html = render();
  // MemoryRouter rend les hrefs en chemins nus (sans #, contrairement à HashRouter)
  expect(html).toContain('href="/entrainement"');
  expect(html).toContain('href="/cours"');
});
