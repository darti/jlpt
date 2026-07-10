import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionCard } from "./QuestionCard.tsx";
import { Corrige } from "./Corrige.tsx";
import { Results } from "./Results.tsx";
import type { Question } from "../../types/quiz.ts";

const q: Question = { id: 0, cat: "grammaire", d: 1, q: "家に帰っ___、電話します。",
  o: ["たら", "なら", "ば", "と"], a: 0, e: "<b>〜たら</b> = quand/dès que.", g: "帰る→帰ったら", od: ["ok", "b", "c", "d"] };

test("QuestionCard renders the stem and all options", () => {
  const html = renderToStaticMarkup(<QuestionCard question={q} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} />);
  expect(html).toContain("電話します");
  for (const o of q.o) expect(html).toContain(o);
});

test("Corrige shows the explanation and per-option analysis", () => {
  const html = renderToStaticMarkup(<Corrige question={q} correct={false} />);
  expect(html).toContain("quand/dès que");
  expect(html).toContain("帰ったら");
});

test("Results shows the session score", () => {
  const html = renderToStaticMarkup(<Results count={10} right={7} onRestart={() => {}} />);
  expect(html).toContain("7");
  expect(html).toContain("10");
});
