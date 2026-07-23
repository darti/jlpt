import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QuestionCard } from "./QuestionCard.tsx";
import type { Question } from "../../types/quiz.ts";

// Montage réel (createRoot) : le patron du dépôt fixe ce flag pour que `act()` fasse
// effet (cf. src/ui/Footer.handlers.test.tsx).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ecoute: Question = { id: 1, cat: "ecoute", d: 1, q: "何を頼みましたか。", o: ["A", "B"], a: 0, script: "…" };
const gram: Question = { id: 2, cat: "grammaire", d: 1, q: "家に___", o: ["A", "B"], a: 0 };

test("SSR : une question d'écoute rend Réécouter + le sélecteur de vitesse", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={ecoute} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(html).toContain("Réécouter");
  expect(html).toContain("Lent");
  expect(html).toContain("Rapide");
});

test("SSR : une question de grammaire n'a AUCUN contrôle audio", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={gram} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(html).not.toContain("Réécouter");
});

test("auto-play : monter une question d'écoute appelle onSpeak une fois", () => {
  const calls: unknown[] = [];
  const div = document.createElement("div"); document.body.appendChild(div);
  const root = createRoot(div);
  act(() => {
    root.render(<QuestionCard question={ecoute} chosen={null} answered={false} onChoose={() => {}} onSpeak={(r) => calls.push(r)} />);
  });
  expect(calls.length).toBe(1);
  act(() => root.unmount());
  div.remove();
});

test("pas d'auto-play sur une question non-écoute", () => {
  const calls: unknown[] = [];
  const div = document.createElement("div"); document.body.appendChild(div);
  const root = createRoot(div);
  act(() => {
    root.render(<QuestionCard question={gram} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => calls.push(1)} />);
  });
  expect(calls.length).toBe(0);
  act(() => root.unmount());
  div.remove();
});
