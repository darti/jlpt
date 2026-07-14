import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { GroupDetail } from "./GroupDetail.tsx";
import { MethodPage } from "./MethodPage.tsx";
import type { LearnCategory, MethodCategory, CoursGroup } from "./coursSchema.ts";

const vocabCat: LearnCategory = {
  id: "vocab",
  title: "V",
  kind: "learn",
  groups: [],
};
const vocabGroup: CoursGroup = {
  id: "g1",
  title: "Nourriture",
  items: [
    {
      id: "vocab:食べる",
      mot: "食べる",
      lecture: "たべる",
      sens: "manger",
    },
  ],
};

test("GroupDetail (vocab) rend mot/lecture/sens + un contrôle d'état par item", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <GroupDetail
        category={vocabCat}
        group={vocabGroup}
        progress={{}}
        onToggle={() => {}}
      />
    </MemoryRouter>
  );
  expect(html).toContain("Nourriture");
  expect(html).toContain("食べる");
  expect(html).toContain("manger");
  expect(html).toContain('data-item-id="vocab:食べる"'); // le bouton toggle porte l'id
});

const gramCat: LearnCategory = {
  id: "gram",
  title: "G",
  kind: "learn",
  groups: [],
};
const gramGroup: CoursGroup = {
  id: "g1",
  title: "Conditionnels",
  items: [
    {
      id: "gram:ば",
      form: "〜ば",
      struct: "V(ば)",
      mean: "« si »",
      examples: [
        {
          jp: "安ければ買う",
          ro: "yasukereba kau",
          fr: "si bon marche j achete",
          an: ["安い→安ければ « verbe »"],
        },
      ],
    },
  ],
};

test("GroupDetail (grammaire) rend forme/structure/exemple", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <GroupDetail
        category={gramCat}
        group={gramGroup}
        progress={{ "gram:ば": "known" }}
        onToggle={() => {}}
      />
    </MemoryRouter>
  );
  expect(html).toContain("〜ば");
  expect(html).toContain("V(ば)");
  expect(html).toContain("安ければ買う");
});

test("GroupDetail deep-linked (?focus + ?from=quiz) surligne l'item et offre le retour", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/cours/gram/g1?focus=gram:ば&from=quiz"]}>
      <GroupDetail
        category={gramCat}
        group={gramGroup}
        progress={{}}
        onToggle={() => {}}
      />
    </MemoryRouter>
  );
  // l'item ciblé porte l'ancre de scroll + le surlignage
  expect(html).toContain('data-cours-item="gram:ば"');
  expect(html).toContain("ring-accent");
  // la flèche « Revenir à la question » rouvre le corrigé via le handoff resume
  expect(html).toContain("#/entrainement?resume=1");
  expect(html).toContain("Revenir");
});

test("GroupDetail sans deep link n'affiche ni surlignage ni retour", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <GroupDetail category={gramCat} group={gramGroup} progress={{}} onToggle={() => {}} />
    </MemoryRouter>
  );
  expect(html).not.toContain("ring-accent");
  expect(html).not.toContain("Revenir");
});

test("MethodPage rend les sections de conseils", () => {
  const m: MethodCategory = {
    id: "method",
    title: "Méthode",
    kind: "method",
    sections: [{ title: "読解", tips: ["Lis la question"] }],
  };
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <MethodPage category={m} />
    </MemoryRouter>
  );
  expect(html).toContain("読解");
  expect(html).toContain("Lis la question");
});
