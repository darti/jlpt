import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityCard, itemKind, splitStruct } from "./EntityCard.tsx";
import type { CoursItem } from "./coursSchema.ts";

test("splitStruct coupe sur les barres de premier niveau", () => {
  expect(splitStruct("V(ば形) ／ い-adj：〜ければ")).toEqual([
    "V(ば形)", "い-adj：〜ければ",
  ]);
});

test("splitStruct laisse intactes les barres entre parentheses", () => {
  expect(splitStruct("〜て（口語：〜ちゃう／〜じゃう）")).toEqual([
    "〜て（口語：〜ちゃう／〜じゃう）",
  ]);
});

// ⚠ La nature se lit sur les CHAMPS, pas sur la piste : un motif grammatical rangé dans le
// cours de vocabulaire porte `form` ET `mot` (cf. coursFromGraph.ts) — `form` doit gagner.
test("itemKind se fie aux champs et non a la piste", () => {
  expect(itemKind({ id: "a", form: "〜ば" } as CoursItem)).toBe("gram");
  expect(itemKind({ id: "b", kanji: "位", lecture: "イ", sens: "rang" } as CoursItem)).toBe("kanji");
  expect(itemKind({ id: "c", mot: "影響", lecture: "えいきょう", sens: "influence" } as CoursItem)).toBe("vocab");
  const mixte = { id: "d", form: "なかなか〜ない", mot: "なかなか〜ない", lecture: "", sens: "" };
  expect(itemKind(mixte as CoursItem)).toBe("gram");
});

test("EntityCard rend la structure et le sens d un point de grammaire", () => {
  const html = renderToStaticMarkup(
    <EntityCard
      item={{ id: "jlpt:gram/ば", form: "〜ば", struct: "V(ば形)", mean: "condition generale" }}
      state="neuf"
    />,
  );
  expect(html).toContain("V(ば形)");
  expect(html).toContain("condition generale");
});

test("EntityCard rend la lecture et le sens d un kanji", () => {
  const html = renderToStaticMarkup(
    <EntityCard
      item={{ id: "jlpt:kanji/位", kanji: "位", lecture: "イ・くらい", sens: "rang" }}
      state="acquis"
    />,
  );
  expect(html).toContain("イ・くらい");
  expect(html).toContain("rang");
});

// ⚠ Ne JAMAIS asserter un kanji rendu par furi() en sous-chaîne brute (furi scinde les mots en
// spans et le DICT fuit entre fichiers de test) — on asserte la LECTURE et le SENS, jamais 影響.
test("EntityCard rend la lecture et le sens d un mot", () => {
  const html = renderToStaticMarkup(
    <EntityCard
      item={{ id: "jlpt:word/影響", mot: "影響", lecture: "えいきょう", sens: "influence" }}
      state="en-cours"
    />,
  );
  expect(html).toContain("えいきょう");
  expect(html).toContain("influence");
});

test("la variante compacte n affiche pas les exemples", () => {
  const item: CoursItem = {
    id: "jlpt:gram/ば", form: "〜ば",
    examples: [{ jp: "安ければ買います。", ro: "yasukereba", fr: "Si c est bon marche" }],
  };
  const carte = renderToStaticMarkup(<EntityCard item={item} state="neuf" />);
  const compacte = renderToStaticMarkup(<EntityCard item={item} state="neuf" variant="compacte" />);
  expect(carte).toContain("yasukereba");
  expect(compacte).not.toContain("yasukereba");
});
