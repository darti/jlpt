import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Corrige } from "./Corrige.tsx";
import type { Question } from "../../types/quiz.ts";

const gram: Question = { id: 1, cat: "grammaire", d: 1, q: "", o: ["a", "b"], a: 0,
  e: "<b>〜たら</b> = « quand »", tests: ["jlpt:gram/たら"] };
const vocab: Question = { id: 2, cat: "vocabulaire", d: 1, q: "", o: ["a", "b"], a: 0, e: "sens" };

const RAPPEL_GRAM = {
  kind: "gram" as const, iri: "jlpt:gram/たら", titre: "〜たら", lecture: "",
  sens: "« quand/dès que ».", niv: "N3", group: "g4", coursCat: "gram",
};

test("Corrige montre le rappel dun point de grammaire, avec son lien profond", () => {
  const html = renderToStaticMarkup(<Corrige question={gram} correct={true} rappel={RAPPEL_GRAM} />);
  expect(html).toContain("Rappel");
  expect(html).toContain("〜たら");
  expect(html).toContain("N3");
  expect(html).toContain("voir le point de grammaire");
  // le lien vise le point exact (groupe + item focalisé) et signale la provenance quiz
  expect(html).toContain("#/cours/gram/g4?focus=jlpt%3Agram%2F%E3%81%9F%E3%82%89&amp;from=quiz");
});

test("Corrige montre la phrase dexemple du point testé", () => {
  const html = renderToStaticMarkup(
    <Corrige question={gram} correct={true}
      rappel={{ ...RAPPEL_GRAM, exemple: { jp: "健康のために走る。", fr: "Je cours." } }} />,
  );
  expect(html).toContain("Je cours.");
});

test("Corrige montre un rappel pour un KANJI, avec sa lecture on・kun", () => {
  const q: Question = { id: 9, cat: "kanji", d: 1, q: "", o: ["a", "b"], a: 0, tests: ["jlpt:kanji/校"] };
  const html = renderToStaticMarkup(
    <Corrige question={q} correct={true}
      rappel={{ kind: "kanji", iri: "jlpt:kanji/校", titre: "校", lecture: "コウ", sens: "école", niv: "", group: "k1", coursCat: "kanji" }} />,
  );
  expect(html).toContain("コウ");
  expect(html).toContain("école");
  expect(html).toContain("voir le kanji dans le cours");
});

test("Corrige nemet AUCUN lien quand aucune leçon ne couvre lentité", () => {
  // Un lien vers /cours/<cat>/ sans groupe mène à une page inexistante : pire que pas de lien.
  const html = renderToStaticMarkup(
    <Corrige question={gram} correct={true} rappel={{ ...RAPPEL_GRAM, group: "" }} />,
  );
  expect(html).toContain("〜たら");
  expect(html).not.toContain("voir le point de grammaire");
});

test("Corrige shows the fallback link for a grammar question with no match", () => {
  const html = renderToStaticMarkup(<Corrige question={gram} correct={true} rappel={null} />);
  expect(html).toContain("Revoir la grammaire dans le cours");
  expect(html).toContain("Revoir la grammaire");
});

test("Corrige shows NO rappel block for a non-grammar question", () => {
  const html = renderToStaticMarkup(<Corrige question={vocab} correct={true} rappel={null} />);
  expect(html).not.toContain("Rappel de cours");
});

test("targeted → badge de renforcement (question réservée sur une confusion), même sur une bonne réponse", () => {
  const html = renderToStaticMarkup(<Corrige question={vocab} correct={true} targeted={true} />);
  expect(html).toContain("Renforcement");
});

test("par défaut (non ciblée) → PAS de badge de renforcement", () => {
  const html = renderToStaticMarkup(<Corrige question={vocab} correct={true} />);
  expect(html).not.toContain("Renforcement");
});
