import { test, expect } from "bun:test";
import {
  normalizeForm, buildCoursGramIndex, extractGrammarForm, resolveGrammarRappel,
  loadCoursGramIndex, clearCoursGramCache,
} from "./coursGramIndex.ts";
import type { LearnCategory } from "./coursSchema.ts";
import type { Question } from "../../types/quiz.ts";

test("normalizeForm strips 〜, spaces, and keeps the part after a colon", () => {
  expect(normalizeForm("〜たら")).toBe("たら");
  expect(normalizeForm("〜place : 〜場合は")).toBe("場合は");
  expect(normalizeForm(" 〜について ")).toBe("について");
});

const section: LearnCategory = {
  id: "gram", title: "文法", kind: "learn",
  groups: [
    { id: "g1", title: "Leçon 1", items: [
      { id: "gram:たら", form: "〜たら", niv: "N3", mean: "« quand/dès que »." },
      { id: "gram:について", form: "〜について", niv: "N3", mean: "« au sujet de »." },
      { id: "gram:に対して", form: "〜に対して", niv: "N3", mean: "« au sujet de »." },
      // an item without niv/mean (e.g. from a conjugation table) must default to "" not undefined
      { id: "gram:五段", form: "五段" },
    ] },
  ],
};

test("buildCoursGramIndex indexes every GramItem by normalized form", () => {
  const idx = buildCoursGramIndex(section);
  expect(idx.get("たら")).toEqual({ forme: "〜たら", niv: "N3", sens: "« quand/dès que »." });
  expect(idx.get("について")).toEqual({ forme: "〜について", niv: "N3", sens: "« au sujet de »." });
  expect(idx.get("に対して")).toEqual({ forme: "〜に対して", niv: "N3", sens: "« au sujet de »." });
  expect(idx.get("五段")).toEqual({ forme: "五段", niv: "", sens: "" });
});

test("extractGrammarForm returns the first <b> content, or null", () => {
  expect(extractGrammarForm("<b>〜たら</b> = « quand »")).toBe("〜たら");
  expect(extractGrammarForm("no bold here")).toBeNull();
});

test("resolveGrammarRappel: grammar match, no-match, non-grammar, null index", () => {
  const idx = buildCoursGramIndex(section);
  const g = (e: string, cat = "grammaire"): Question => ({ id: 1, cat: cat as Question["cat"], d: 1, q: "", o: [], a: 0, e });
  expect(resolveGrammarRappel(g("<b>〜たら</b> …"), idx)?.forme).toBe("〜たら");
  expect(resolveGrammarRappel(g("<b>〜inconnu</b> …"), idx)).toBeNull();
  expect(resolveGrammarRappel(g("<b>〜たら</b>", "vocabulaire"), idx)).toBeNull();
  expect(resolveGrammarRappel(g("<b>〜たら</b>"), null)).toBeNull();
});

test("loadCoursGramIndex fetches cours-gram.json, builds the index, and memoizes", async () => {
  clearCoursGramCache();
  let calls = 0;
  const fetchImpl = async (_url: string) => { calls++; return { json: async () => section }; };
  const a = await loadCoursGramIndex(fetchImpl as any);
  const b = await loadCoursGramIndex(fetchImpl as any);
  expect(a).toBe(b);            // memoized
  expect(calls).toBe(1);
  expect(a.get("たら")?.niv).toBe("N3");
});
