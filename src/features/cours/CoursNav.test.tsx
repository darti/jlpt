import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CoursHub } from "./CoursHub.tsx";
import { CategoryIndex } from "./CategoryIndex.tsx";
import type { CoursCategory, LearnCategory } from "./coursSchema.ts";

const gram: LearnCategory = {
  id: "gram",
  title: "文法 — Grammaire",
  kind: "learn",
  groups: [
    {
      id: "g1",
      title: "Conditionnels",
      items: [
        { id: "gram:ば", form: "〜ば" },
        { id: "gram:たら", form: "〜たら" }
      ]
    }
  ]
};
const cats: CoursCategory[] = [
  gram,
  { id: "method", title: "Méthode", kind: "method", sections: [] }
];

test("CoursHub liste les catégories avec un lien par catégorie", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <CoursHub categories={cats} progress={{}} />
    </MemoryRouter>
  );
  expect(html).toContain("Grammaire");
  expect(html).toContain("Méthode");
  expect(html).toContain('href="#/cours/gram"');
  expect(html).toContain('href="#/cours/method"');
});

test(
  "CategoryIndex montre une carte par thème + ratio de progression",
  () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CategoryIndex
          category={gram}
          progress={{ "gram:ば": "known" }}
        />
      </MemoryRouter>
    );
    expect(html).toContain("Conditionnels");
    expect(html).toContain('href="#/cours/gram/g1"');
    expect(html).toContain("1/2 appris");
  }
);
