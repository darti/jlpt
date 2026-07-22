import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RevisionPanel } from "./RevisionPanel.tsx";

test("sans données, invite à pratiquer plutôt qu'un tableau vide", () => {
  const html = renderToStaticMarkup(<RevisionPanel counts={null} />);
  expect(html).toContain("À réviser");
  expect(html).toContain("Rien à réviser");
});

test("aucune entité due → message « à jour »", () => {
  const html = renderToStaticMarkup(
    <RevisionPanel counts={{ kanji: 0, vocab: 0, gram: 0, autre: 0, total: 0 }} />,
  );
  expect(html).toContain("à jour");
});

test("des entités dues → total et ventilation", () => {
  const html = renderToStaticMarkup(
    <RevisionPanel counts={{ kanji: 4, vocab: 7, gram: 2, autre: 0, total: 13 }} />,
  );
  expect(html).toContain("13");
  expect(html).toContain("Kanji");
  expect(html).toContain("Vocab");
});
