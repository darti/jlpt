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

test("les chiffres comptent des ERREURS, pas des catégories — les deux sont sur des lignes séparées", () => {
  // Le « 34 » était collé à « (grammaire, écoute, lecture) » : un lecteur comptait 3 items et
  // s'étonnait du 34 (revue « Pourquoi 4 catégories exclues ? »). Le nombre porte sur des
  // événements d'erreur ; la liste des compétences est une phrase à part.
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [], resolved: [], untyped: 12, outOfScope: 34 }} />,
  );
  expect(html).toContain("erreurs"); // les chiffres sont ancrés sur « erreurs », pas sur les compétences
  expect(html).toContain("grammaire, écoute et lecture");
  // Le compte et la liste des compétences ne partagent PAS le même paragraphe.
  const compte = html.slice(html.indexOf("34"), html.indexOf("34") + 60);
  expect(compte).not.toContain("grammaire");
});

test("sans erreur hors périmètre, la liste des compétences exclues ne s'affiche pas", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [{ kind: "voisement", recent: 3 }], resolved: [], untyped: 2, outOfScope: 0 }} />,
  );
  expect(html).not.toContain("grammaire, écoute et lecture");
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

test("des pièges ACTIFS annoncent qu'ils sont retravaillés en priorité (relie à la sélection)", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [{ kind: "voisement", recent: 3 }], resolved: [], untyped: 0, outOfScope: 0 }} />,
  );
  expect(html).toContain("priorité dans tes sessions");
});

test("sans piège actif, PAS de note de priorité", () => {
  const html = renderToStaticMarkup(
    <TrapPanel model={{ active: [], resolved: ["lecture-on-kun"], untyped: 2, outOfScope: 0 }} />,
  );
  expect(html).not.toContain("priorité dans tes sessions");
});
