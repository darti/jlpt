import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { EntrainementAppView } from "./EntrainementApp.tsx";
import type { Question } from "./types/quiz.ts";

const vocab: Question = { id: 1, cat: "vocabulaire", d: 1, q: "約束", o: ["やくそく", "X", "Y", "Z"], a: 0 };

test("hub : un toggle « rappel actif » est présent", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView
        phase="home" question={null} count={0} right={0} minutes={10} resume={null} chosen={null}
        onStart={() => {}} onChoose={() => {}} onNext={() => {}} onRestart={() => {}}
        onSetMinutes={() => {}} onResumeNow={() => {}} onDismissResume={() => {}}
        production={false} onToggleProduction={() => {}}
      />
    </MemoryRouter>,
  );
  expect(html).toContain("rappel actif");
});

test("question éligible + production : le champ de saisie remplace les options", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView
        phase="question" question={vocab} count={5} right={0} minutes={10} resume={null} chosen={null} index={0}
        onStart={() => {}} onChoose={() => {}} onNext={() => {}} onRestart={() => {}}
        onSetMinutes={() => {}} onResumeNow={() => {}} onDismissResume={() => {}}
        production={true} onSubmitTyped={() => {}} typed={null}
      />
    </MemoryRouter>,
  );
  expect(html).toContain("Tapez la lecture");
});

test("diagnostic : la production est ignorée, les questions restent en QCM", () => {
  // Régression I1 : un débutant qui active la production puis démarre passe par le diagnostic,
  // qui rend ses questions en phase « question » ; il doit rester en QCM (spec §3.6).
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EntrainementAppView
        phase="question" mode="diagnostic" question={vocab} count={5} right={0} minutes={10} resume={null} chosen={null} index={0}
        onStart={() => {}} onChoose={() => {}} onNext={() => {}} onRestart={() => {}}
        onSetMinutes={() => {}} onResumeNow={() => {}} onDismissResume={() => {}}
        production={true} onSubmitTyped={() => {}} typed={null}
      />
    </MemoryRouter>,
  );
  expect(html).not.toContain("Tapez la lecture"); // pas de champ
  expect(html).toContain("やくそく"); // les options QCM sont présentes
});
