import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Deck, initialIndex } from "./Deck.tsx";
import type { CoursGroup, CoursItem, LearnCategory } from "./coursSchema.ts";
import type { EntityState } from "./entityState.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const items: CoursItem[] = [
  { id: "jlpt:gram/ば", form: "〜ば" },
  { id: "jlpt:gram/たら", form: "〜たら" },
  { id: "jlpt:gram/なら", form: "〜なら" },
];
const group: CoursGroup = { id: "g2", title: "Conditionnels", items };
const category: LearnCategory = {
  id: "gram", title: "文法 — Grammaire", kind: "learn", groups: [group],
};

test("initialIndex ouvre sur la premiere carte non acquise", () => {
  const acquis = (iri: string) => iri === "jlpt:gram/ば";
  expect(initialIndex(items, null, acquis)).toBe(1);
});

test("initialIndex ouvre sur zero quand tout est acquis", () => {
  expect(initialIndex(items, null, () => true)).toBe(0);
});

test("initialIndex positionne sur le focus, meme acquis", () => {
  expect(initialIndex(items, "jlpt:gram/なら", () => true)).toBe(2);
});

test("initialIndex ignore un focus inconnu", () => {
  expect(initialIndex(items, "jlpt:gram/inexistant", () => false)).toBe(0);
});

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  root = null; host = null;
});

async function monter(search: string, stateOf: (iri: string) => EntityState) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[`/cours/gram/g2${search}`]}>
        <Deck category={category} group={group} stateOf={stateOf} onKnown={() => {}} />
      </MemoryRouter>,
    );
  });
  return host!;
}

test("le paquet montre UNE carte a la fois", async () => {
  const el = await monter("", () => "neuf");
  expect(el.querySelectorAll("[data-cours-item]").length).toBe(1);
  expect(el.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/ば");
});

test("focus positionne le paquet sur la carte visee", async () => {
  const el = await monter("?focus=jlpt%3Agram%2F%E3%81%AA%E3%82%89", () => "neuf");
  expect(el.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/なら");
});

test("la fleche droite avance d une carte", async () => {
  const el = await monter("", () => "neuf");
  await act(async () => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  });
  expect(el.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/たら");
});

test("la fleche gauche ne depasse pas la premiere carte", async () => {
  const el = await monter("", () => "neuf");
  await act(async () => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  });
  expect(el.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/ば");
});

test("from=quiz affiche le lien de retour au corrige", async () => {
  const el = await monter("?from=quiz", () => "neuf");
  expect(el.textContent).toContain("Revenir à la question");
});

test("sans from=quiz il n y a pas de lien de retour", async () => {
  const el = await monter("", () => "neuf");
  expect(el.textContent).not.toContain("Revenir à la question");
});
