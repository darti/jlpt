import { test, expect } from "bun:test";
import { readingsOfEntry, bestReading } from "./parse.mjs";

const entree = (xml: string) => `<entry><ent_seq>1</ent_seq>${xml}</entry>`;

test("readingsOfEntry associe chaque forme kanji à ses lectures", () => {
  const e = entree(`
    <k_ele><keb>影響</keb><ke_pri>ichi1</ke_pri></k_ele>
    <r_ele><reb>えいきょう</reb><re_pri>ichi1</re_pri></r_ele>`);
  expect(readingsOfEntry(e)).toEqual([{ keb: "影響", reb: "えいきょう", pri: 1 }]);
});

test("readingsOfEntry respecte re_restr : une lecture restreinte ne vaut que pour sa forme", () => {
  const e = entree(`
    <k_ele><keb>ＣＤプレーヤー</keb></k_ele>
    <k_ele><keb>ＣＤプレイヤー</keb></k_ele>
    <r_ele><reb>シーディープレーヤー</reb><re_restr>ＣＤプレーヤー</re_restr></r_ele>
    <r_ele><reb>シーディープレイヤー</reb><re_restr>ＣＤプレイヤー</re_restr></r_ele>`);
  const out = readingsOfEntry(e);
  expect(out).toContainEqual({ keb: "ＣＤプレーヤー", reb: "シーディープレーヤー", pri: 0 });
  expect(out).toContainEqual({ keb: "ＣＤプレイヤー", reb: "シーディープレイヤー", pri: 0 });
  expect(out).toHaveLength(2); // et surtout PAS le produit croisé
});

test("readingsOfEntry croise toutes les formes quand aucune restriction n'est déclarée", () => {
  const e = entree(`
    <k_ele><keb>取り消す</keb></k_ele>
    <k_ele><keb>取消す</keb></k_ele>
    <r_ele><reb>とりけす</reb></r_ele>`);
  expect(readingsOfEntry(e)).toHaveLength(2);
});

test("readingsOfEntry ignore une entrée sans forme kanji (kana seul)", () => {
  expect(readingsOfEntry(entree(`<r_ele><reb>ひらがな</reb></r_ele>`))).toEqual([]);
});

test("readingsOfEntry ignore les lectures marquées re_nokanji", () => {
  const e = entree(`
    <k_ele><keb>格好</keb></k_ele>
    <r_ele><reb>かっこう</reb></r_ele>
    <r_ele><reb>カッコ</reb><re_nokanji/></r_ele>`);
  expect(readingsOfEntry(e).map((r) => r.reb)).toEqual(["かっこう"]);
});

test("bestReading préfère la lecture la plus fréquente (re_pri), puis la plus courte", () => {
  expect(bestReading([
    { keb: "生", reb: "せい", pri: 0 },
    { keb: "生", reb: "なま", pri: 2 },
  ])).toBe("なま");
  expect(bestReading([
    { keb: "x", reb: "ああああ", pri: 0 },
    { keb: "x", reb: "あ", pri: 0 },
  ])).toBe("あ");
});

test("bestReading rend null sur une liste vide", () => {
  expect(bestReading([])).toBeNull();
});

test("bestReading préfère l'hiragana au katakana", () => {
  // JMdict propose « ロン » pour 栄 (terme de mahjong) avant « えい ». Une lecture de mot
  // sert de furigana : le katakana y signale presque toujours un emploi spécialisé.
  expect(bestReading([
    { keb: "栄", reb: "ロン", pri: 3 },
    { keb: "栄", reb: "えい", pri: 0 },
  ])).toBe("えい");
});
