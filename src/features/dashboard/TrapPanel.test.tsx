import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TrapPanel } from "./TrapPanel.tsx";

test("sans modèle, invite à répondre plutôt que d'afficher un tableau vide", () => {
  const html = renderToStaticMarkup(<TrapPanel model={null} />);
  expect(html).toContain("pas encore");
});

test("liste les pièges actifs avec leur libellé français", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [{ kind: "voisement", recent: 8 }], resolved: [], untyped: 0, outOfScope: 0 }} />,
  );
  expect(html).toContain("Voisement erroné");
  expect(html).toContain("8");
});

test("montre les types résolus", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [], resolved: ["lecture-on-kun"], untyped: 0, outOfScope: 0 }} />,
  );
  expect(html).toContain("Lecture on / kun");
  expect(html).toContain("résolu");
});

test("distingue les non typées des hors périmètre — jamais un seul chiffre", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [], resolved: [], untyped: 12, outOfScope: 34 }} />,
  );
  expect(html).toContain("12");
  expect(html).toContain("34");
  expect(html).toContain("hors périmètre");
});

test("des erreurs sans type nommé montrent une phrase de contexte, pas un footer nu", () => {
  // Sinon le panneau n'afficherait que « 12 non typées · 34 hors périmètre » et se lirait
  // comme une carte cassée (revue Task 6).
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [], resolved: [], untyped: 12, outOfScope: 34 }} />,
  );
  expect(html).toContain("Aucun type de piège récurrent");
});

test("un piège nommé N'affiche PAS la phrase « aucun type »", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [{ kind: "voisement", recent: 3 }], resolved: [], untyped: 0, outOfScope: 0 }} />,
  );
  expect(html).not.toContain("Aucun type de piège récurrent");
});
