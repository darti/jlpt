import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MethodPage } from "./MethodPage.tsx";
import type { MethodCategory } from "./coursSchema.ts";

// Restauré après la bascule vers le paquet de cartes : `GroupDetail.test.tsx` (supprimé) portait
// cette couverture sur `MethodPage`, composant que ce lot ne touche pas. Forme reprise telle
// quelle depuis `git show 4641dd1^:src/features/cours/GroupDetail.test.tsx`.
test("MethodPage rend les sections de conseils", () => {
  const m: MethodCategory = {
    id: "method",
    title: "Méthode",
    kind: "method",
    sections: [{ title: "読解", tips: ["Lis la question"] }],
  };
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <MethodPage category={m} />
    </MemoryRouter>
  );
  expect(html).toContain("読解");
  expect(html).toContain("Lis la question");
});
