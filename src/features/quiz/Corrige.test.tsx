import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Corrige } from "./Corrige.tsx";
import type { Question } from "../../types/quiz.ts";

const gram: Question = { id: 1, cat: "grammaire", d: 1, q: "", o: ["a", "b"], a: 0, e: "<b>〜たら</b> = « quand »" };
const vocab: Question = { id: 2, cat: "vocabulaire", d: 1, q: "", o: ["a", "b"], a: 0, e: "sens" };

test("Corrige shows a matched Rappel de cours for a grammar question", () => {
  const html = renderToStaticMarkup(
    <Corrige question={gram} correct={true} rappel={{ forme: "〜たら", niv: "N3", sens: "« quand/dès que »." }} />,
  );
  expect(html).toContain("Rappel de cours");
  expect(html).toContain("〜たら");
  expect(html).toContain("N3");
  expect(html).toContain("voir la le"); // "voir la leçon" (avoid the ç just in case)
});

test("Corrige shows the fallback link for a grammar question with no match", () => {
  const html = renderToStaticMarkup(<Corrige question={gram} correct={true} rappel={null} />);
  expect(html).toContain("Rappel de cours");
  expect(html).toContain("Revoir la grammaire");
});

test("Corrige shows NO rappel block for a non-grammar question", () => {
  const html = renderToStaticMarkup(<Corrige question={vocab} correct={true} rappel={null} />);
  expect(html).not.toContain("Rappel de cours");
});
