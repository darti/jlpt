import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
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

// ⚠ Spec §4.2 : « Échap remonte à CategoryIndex ». Omis dans le premier passage — seuls
// ArrowLeft/ArrowRight étaient gérés.
test("Echap remonte a l index de categorie", async () => {
  let pathname = "";
  function LocationProbe() {
    pathname = useLocation().pathname;
    return null;
  }
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={["/cours/gram/g2"]}>
        <LocationProbe />
        <Deck category={category} group={group} stateOf={() => "neuf"} onKnown={() => {}} />
      </MemoryRouter>,
    );
  });
  expect(pathname).toBe("/cours/gram/g2");
  await act(async () => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
  expect(pathname).toBe("/cours/gram");
});

// ── « Je sais déjà » ────────────────────────────────────────────────────────────────────────
// Le bouton ne s'affichait que sur `neuf`, ce qui excluait le cas le plus fréquent d'un apprenant
// qui reprend un programme : un point déjà rencontré, mais su. Il couvre désormais tout état non
// acquis — et disparaît sur `acquis`, où le geste ne pourrait que dégrader la carte.
const LIBELLE = "Je sais déjà";

test("le bouton je sais deja s affiche sur une entite neuve", async () => {
  const el = await monter("", () => "neuf");
  expect(el.textContent).toContain(LIBELLE);
});

test("le bouton je sais deja s affiche sur une entite en cours ou a revoir", async () => {
  for (const etat of ["en-cours", "a-revoir"] as const) {
    const el = await monter("", () => etat);
    expect(el.textContent).toContain(LIBELLE);
    await act(async () => { root!.unmount(); });
    root = null;
  }
});

test("le bouton je sais deja disparait sur une entite acquise", async () => {
  const el = await monter("", () => "acquis");
  expect(el.textContent).not.toContain(LIBELLE);
});

test("le bouton je sais deja declare l entite courante et avance d une carte", async () => {
  const vus: string[] = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={["/cours/gram/g2"]}>
        <Deck
          category={category} group={group}
          stateOf={() => "neuf"} onKnown={(iri) => vus.push(iri)}
        />
      </MemoryRouter>,
    );
  });
  const bouton = [...host.querySelectorAll("button")]
    .find((b) => b.textContent?.includes(LIBELLE));
  await act(async () => { bouton?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  expect(vus).toEqual(["jlpt:gram/ば"]);
  // … et le paquet a avancé : on ne redemande pas la carte qu'on vient d'évacuer.
  expect(host.querySelector("[data-cours-item]")?.getAttribute("data-cours-item"))
    .toBe("jlpt:gram/たら");
});
