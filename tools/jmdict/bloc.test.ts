import { test, expect } from "bun:test";
import { blocDecisions } from "./propose.mjs";

const mot = (nom: string) => ({ "schema:name": nom });
const p = (keb: string, reb: string, pri = 0) => ({ keb, reb, pri });

test("une lecture unique dans JMdict est SÛRE", () => {
  const index = new Map([["影響", [p("影響", "えいきょう")]]]);
  const { sures, aArbitrer } = blocDecisions([mot("影響")], index);
  expect(sures).toEqual({ "影響": "えいきょう" });
  expect(aArbitrer).toEqual([]);
});

test("plusieurs lectures concurrentes → À ARBITRER, jamais dans le bloc", () => {
  // Régression : le départage se faisait sur la lecture la plus COURTE, un critère sans
  // rapport avec la justesse. 構 y gagnait かじ (le mûrier à papier) contre かまえ.
  const index = new Map([["構", [p("構", "かまえ"), p("構", "かじ")]]]);
  const { sures, aArbitrer } = blocDecisions([mot("構")], index);
  expect(sures).toEqual({});
  expect(aArbitrer).toHaveLength(1);
  expect(aArbitrer[0].mot).toBe("構");
  expect(aArbitrer[0].lectures.sort()).toEqual(["かじ", "かまえ"]);
});

test("une lecture marquée prioritaire par JMdict tranche la concurrence", () => {
  // Là, le choix n'est plus arbitraire : JMdict dit lui-même laquelle est courante.
  const index = new Map([["日", [p("日", "ひ", 3), p("日", "か")]]]);
  const { sures, aArbitrer } = blocDecisions([mot("日")], index);
  expect(sures).toEqual({ "日": "ひ" });
  expect(aArbitrer).toEqual([]);
});

test("une égalité de priorité reste à arbitrer", () => {
  const index = new Map([["生", [p("生", "せい", 2), p("生", "なま", 2)]]]);
  expect(blocDecisions([mot("生")], index).sures).toEqual({});
});

test("les lectures en katakana sont repliées en hiragana", () => {
  const index = new Map([["階", [p("階", "カイ")]]]);
  expect(blocDecisions([mot("階")], index).sures).toEqual({ "階": "かい" });
});

test("un mot sans proposition n'apparaît nulle part", () => {
  const r = blocDecisions([mot("謎")], new Map());
  expect(r.sures).toEqual({});
  expect(r.aArbitrer).toEqual([]);
});
