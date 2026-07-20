import { test, expect } from "bun:test";
import { readingsOfCharacter, okuriganaEnParentheses, formatLecture } from "./parse.mjs";

// Fixture au format KANJIDIC2 réel — sous-ensemble suffisant pour ce qu'on lit.
const CHAR = `<character>
<literal>八</literal>
<misc><grade>1</grade><stroke_count>2</stroke_count><jlpt>4</jlpt></misc>
<reading_meaning><rmgroup>
<reading r_type="pinyin">ba1</reading>
<reading r_type="korean_r">phal</reading>
<reading r_type="ja_on">ハチ</reading>
<reading r_type="ja_kun">や</reading>
<reading r_type="ja_kun">や.つ</reading>
<reading r_type="ja_kun">やっ.つ</reading>
<reading r_type="ja_kun">よう</reading>
<meaning>eight</meaning>
<meaning m_lang="fr">huit</meaning>
</rmgroup></reading_meaning>
</character>`;

test("readingsOfCharacter ne retient que les lectures japonaises", () => {
  const r = readingsOfCharacter(CHAR);
  expect(r.literal).toBe("八");
  expect(r.on).toEqual(["ハチ"]);
  expect(r.kun).toEqual(["や", "や.つ", "やっ.つ", "よう"]);
});

test("readingsOfCharacter ignore pinyin et coréen — ce ne sont pas des lectures japonaises", () => {
  const r = readingsOfCharacter(CHAR);
  expect(r.on.concat(r.kun).join("")).not.toContain("ba1");
  expect(r.on.concat(r.kun).join("")).not.toContain("phal");
});

test("readingsOfCharacter rend le sens français quand il existe", () => {
  expect(readingsOfCharacter(CHAR).sens).toBe("huit");
});

test("readingsOfCharacter retombe sur l'anglais sans sens français", () => {
  const sansFr = CHAR.replace('<meaning m_lang="fr">huit</meaning>', "");
  expect(readingsOfCharacter(sansFr).sens).toBe("eight");
});

test("readingsOfCharacter sur un caractère sans lecture rend des listes vides", () => {
  expect(readingsOfCharacter("<character><literal>々</literal></character>"))
    .toEqual({ literal: "々", on: [], kun: [], sens: "" });
});

test("okuriganaEnParentheses convertit la notation KANJIDIC vers celle du projet", () => {
  // KANJIDIC écrit « やさ.しい », le cours et le graphe écrivent « やさ(しい) ».
  expect(okuriganaEnParentheses("やさ.しい")).toBe("やさ(しい)");
  expect(okuriganaEnParentheses("くらい")).toBe("くらい");
  expect(okuriganaEnParentheses("や.つ")).toBe("や(つ)");
});

test("okuriganaEnParentheses laisse intact un préfixe marqué par un tiret", () => {
  // « お-» (préfixe honorifique) n'est pas un okurigana : rien à parenthéser.
  expect(okuriganaEnParentheses("お-")).toBe("お-");
});

test("formatLecture assemble on et kun comme le graphe les attend", () => {
  expect(formatLecture(["ハチ"], ["や", "や.つ"])).toBe("ハチ・や・や(つ)");
  expect(formatLecture([], ["くらい"])).toBe("くらい");
  expect(formatLecture(["イ"], [])).toBe("イ");
  expect(formatLecture([], [])).toBe("");
});

// --- élagage : de la liste exhaustive à une proposition utilisable -------------

import { elaguer } from "./parse.mjs";

test("elaguer ne garde que la première lecture on", () => {
  // KANJIDIC liste toutes les lectures attestées ; 101 des 259 kanji en ont plusieurs.
  expect(elaguer(["イチ", "イツ"], [])).toEqual({ on: ["イチ"], kun: [] });
});

test("elaguer écarte les formes préfixe/suffixe marquées par un tiret", () => {
  // « ひと- » est un préfixe, pas une lecture autonome : le cours ne l'écrirait pas.
  expect(elaguer(["イチ"], ["ひと-", "ひと.つ"])).toEqual({ on: ["イチ"], kun: ["ひと(つ)"] });
});

test("elaguer garde la première lecture kun autonome", () => {
  expect(elaguer(["ハチ", "ハツ"], ["や", "や.つ", "やっ.つ", "よう"]))
    .toEqual({ on: ["ハチ"], kun: ["や"] });
});

test("elaguer rend une liste kun vide si toutes les formes sont des affixes", () => {
  // Rien plutôt qu'une lecture douteuse : la colonne complète reste sous les yeux de l'auteur.
  expect(elaguer(["ショウ"], ["-づけ"])).toEqual({ on: ["ショウ"], kun: [] });
});

test("elaguer sur un kanji sans lecture rend deux listes vides", () => {
  expect(elaguer([], [])).toEqual({ on: [], kun: [] });
});

test("elaguer conserve l'okurigana de la lecture retenue", () => {
  expect(elaguer([], ["あたら.しい", "あら.た"])).toEqual({ on: [], kun: ["あたら(しい)"] });
});
