import { test, expect } from "bun:test";
import { itemFromRappel } from "./rappelItem.ts";
import { itemKind } from "../cours/EntityCard.tsx";
import type { Rappel } from "./rappel.ts";

const base: Omit<Rappel, "kind"> = {
  iri: "x", titre: "t", lecture: "l", sens: "s", niv: "N3", group: "g1", coursCat: "gram",
};

test("itemFromRappel rend un item de grammaire pour kind gram", () => {
  const it = itemFromRappel({ ...base, kind: "gram", titre: "〜ば" });
  expect(itemKind(it)).toBe("gram");
  expect(it.id).toBe("x");
});

test("itemFromRappel rend un item de kanji pour kind kanji", () => {
  const it = itemFromRappel({ ...base, kind: "kanji", titre: "位" });
  expect(itemKind(it)).toBe("kanji");
});

test("itemFromRappel rend un item de vocabulaire pour kind word", () => {
  const it = itemFromRappel({ ...base, kind: "word", titre: "影響" });
  expect(itemKind(it)).toBe("vocab");
});

test("itemFromRappel reporte l exemple d un point de grammaire", () => {
  const it = itemFromRappel({
    ...base, kind: "gram", titre: "〜ば",
    exemple: { jp: "安ければ買います。", fr: "Si c est bon marche" },
  });
  expect((it as { examples?: unknown[] }).examples).toHaveLength(1);
});
