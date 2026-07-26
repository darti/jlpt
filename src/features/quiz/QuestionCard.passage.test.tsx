import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionCard } from "./QuestionCard.tsx";
import type { Question } from "../../types/quiz.ts";

/** Texte de base sans les annotations furigana — même assistant que `quiz.test.tsx` : une
 *  assertion sur un kanji brut est un flake (furi() scinde le mot en spans). */
const baseText = (h: string): string =>
  h.replace(/<span class="furi-rt">.*?<\/span>/g, "").replace(/<[^>]+>/g, "");

const avecPassage: Question = {
  id: 10307, cat: "lecture", d: 2, q: "何 が 分かりますか。", o: ["a", "b"], a: 0,
  passageId: "jlpt:passage/tanbun-01",
  passage: { jp: "あしたは やすみ です。", format: "tanbun" },
};

test("QuestionCard rend le texte du passage résolu", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={avecPassage} chosen={null} answered={false}
                  onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(baseText(html)).toContain("あしたは やすみ です。");
});

test("QuestionCard sans passage rend l'énoncé seul", () => {
  const sansPassage: Question = { id: 1, cat: "lecture", d: 1, q: "どこ ですか。", o: ["a", "b"], a: 0 };
  const html = renderToStaticMarkup(
    <QuestionCard question={sansPassage} chosen={null} answered={false}
                  onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(baseText(html)).toContain("どこ ですか。");
  expect(baseText(html)).not.toContain("やすみ");
});
