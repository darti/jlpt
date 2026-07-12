import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CoursView } from "./Cours.tsx";
import type { CoursSection } from "./useCours.ts";

const sections: CoursSection[] = [
  {
    id: "gram",
    title: "文法 — Grammaire N3 par leçons",
    lessons: [
      {
        tag: "S2",
        title: "Leçon 1 — Conditionnels",
        points: [
          { form: "〜ば", struct: "V(forme ば)", mean: "« si… »", examples: [{ jp: "安ければ買います。", ro: "yasukereba kaimasu.", fr: "Si c'est bon marché, je l'achète.", an: ["安い（やすい）→安ければ « conditionnel »", "を « COD »"] }] },
        ],
        tip: "と/ば/たら/なら : nuances.",
      },
    ],
  },
  { id: "dokkai", title: "読解 — Méthode", tips: ["<b>Lis la question d'abord</b>."] },
];

test("CoursView renders sections, lessons, points, examples + method tips", () => {
  const html = renderToStaticMarkup(<CoursView sections={sections} />);
  expect(html).toContain("Grammaire N3");        // section title
  expect(html).toContain("Leçon 1 — Conditionnels"); // lesson
  expect(html).toContain("〜ば");                  // grammar point form
  expect(html).toContain("安ければ買います");        // example jp
  expect(html).toContain("bon marché");            // example fr (apostrophe would be HTML-escaped)
  expect(html).toContain("Lis la question");       // method tip
  // Analyse visuelle : les annotations deviennent des jetons colorés par rôle (regression:
  // ce rendu « blocs de couleur » avait sauté au port React, l'app n'affichait qu'une liste).
  expect(html).toContain('class="vbreak"');        // colored-block container
  expect(html).toContain("tok-verb");              // 安ければ (contient →) → verbe
  expect(html).toContain("tok-part");              // を → particule
});
