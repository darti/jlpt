import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import type { Phase } from "./features/quiz/useQuiz.ts";
import type { Question } from "./types/quiz.ts";

const q: Question = {
  id: 0, cat: "grammaire", d: 1, q: "家に帰っ___、電話します。",
  o: ["たら", "なら", "ば", "と"], a: 0, e: "<b>〜たら</b>", g: "帰る→帰ったら", od: ["ok", "b", "c", "d"],
};

const handlers = {
  onStart: () => {}, onChoose: () => {}, onNext: () => {}, onRestart: () => {},
  onSetMinutes: () => {}, onResumeNow: () => {}, onDismissResume: () => {},
};

/** Texte de base sans annotations furigana : `furi()` peut couper une sous-chaîne JP (le
 *  `</span>` d'un mot annoté s'insère avant la suite) selon l'état du DICT partagé entre
 *  fichiers de test → asserter le brut flake. Même helper que quiz.test.tsx. */
const baseText = (h: string): string =>
  h.replace(/<span class="furi-rt">.*?<\/span>/g, "").replace(/<[^>]+>/g, "");

function view(phase: Phase, question: Question | null) {
  return renderToStaticMarkup(
    <EntrainementAppView
      phase={phase} question={question} count={1} right={0}
      minutes={10} resume={null}
      chosen={null}
      {...handlers}
    />,
  );
}

test("home phase renders the single session card (no categories, no stubs)", () => {
  const html = view("home", null);
  expect(html).toContain("Ta session du moment"); // SessionCard title
  expect(html).toContain("Commencer");            // start button
  expect(html).not.toContain("Lancer une session"); // old start-card title gone
  expect(html).not.toContain("bientôt");            // deferred stubs gone
  expect(html).not.toContain("réussite estimée");   // Dashboard stats on Accueil
  expect(html).not.toContain("Progression");        // chart on Accueil
});

test("home phase no longer renders settings or sync (moved to Paramétrage)", () => {
  const html = view("home", null);
  expect(html).not.toContain("Réglages");
  expect(html).not.toContain("Synchronisation multi-appareils");
});

test("question phase renders the question card, not the hub", () => {
  const html = view("question", q);
  expect(baseText(html)).toContain("電話します"); // robuste au furigana (cf. flake CI 映像)
  expect(html).not.toContain("Ta session du moment");
});
