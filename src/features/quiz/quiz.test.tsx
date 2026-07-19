import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionCard } from "./QuestionCard.tsx";
import { Corrige } from "./Corrige.tsx";
import { Results } from "./Results.tsx";
import type { Question } from "../../types/quiz.ts";

/** Texte de base (kanji + kana) sans les lectures furigana : retire les <rt>…</rt> puis toute
 *  balise. Rend les assertions robustes au ruby (le furigana peut couper une sous-chaîne JP). */
const baseText = (h: string): string => h.replace(/<rt>.*?<\/rt>/g, "").replace(/<[^>]+>/g, "");

const q: Question = { id: 0, cat: "grammaire", d: 1, q: "家に帰っ___、電話します。",
  o: ["たら", "なら", "ば", "と"], a: 0, e: "<b>〜たら</b> = quand/dès que.", g: "帰る→帰ったら", od: ["ok", "b", "c", "d"] };

test("QuestionCard renders the stem and all options", () => {
  const html = renderToStaticMarkup(<QuestionCard question={q} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} />);
  expect(baseText(html)).toContain("電話します");
  for (const o of q.o) expect(html).toContain(o);
});

test("Corrige shows the explanation and per-option analysis", () => {
  const html = renderToStaticMarkup(<Corrige question={q} correct={false} />);
  expect(html).toContain("quand/dès que");
  expect(baseText(html)).toContain("帰ったら");
});

test("Corrige shows the transcript for an écoute question with a script", () => {
  const ecouteQ: Question = { id: 1, cat: "ecoute", d: 1, q: "何と言っていますか。",
    script: "すみません、駅はどこですか。", o: ["A", "B", "C", "D"], a: 0 };
  const html = renderToStaticMarkup(<Corrige question={ecouteQ} correct={true} />);
  expect(html).toContain("Transcription");
  expect(baseText(html)).toContain("すみません、駅はどこですか。");
});

test("Results shows the session score", () => {
  const html = renderToStaticMarkup(<Results count={10} right={7} onRestart={() => {}} />);
  expect(html).toContain("7");
  expect(html).toContain("10");
});
