import { test, expect } from "bun:test";
import {
  normalizeForm, buildCoursGramIndex, extractGrammarForm, resolveGrammarRappel,
  loadCoursGramIndex, clearCoursGramCache,
} from "./coursGramIndex.ts";
import type { Question } from "../../types/quiz.ts";

test("normalizeForm strips 〜, spaces, and keeps the part after a colon", () => {
  expect(normalizeForm("〜たら")).toBe("たら");
  expect(normalizeForm("〜place : 〜場合は")).toBe("場合は");
  expect(normalizeForm(" 〜について ")).toBe("について");
});

// Sujets du graphe. La LEÇON porte le groupe : c est elle qui alimente le lien profond.
const GRAM = [
  { "@id": "jlpt:gram/たら", "jlpt:form": "〜たら", "jlpt:level": "N3", "schema:description": "« quand/dès que »." },
  // un point sans niveau ni sens doit tomber sur "" et non undefined
  { "@id": "jlpt:gram/五段", "jlpt:form": "五段" },
  // une forme composée "A / B" doit produire DEUX clés distinctes
  { "@id": "jlpt:gram/について", "jlpt:form": "〜について / 〜に対して", "jlpt:level": "N3", "schema:description": "au sujet de" },
];
const LESSONS = [
  { "@id": "jlpt:lesson/gram-g1", "jlpt:track": "gram",
    covers: ["jlpt:gram/たら", "jlpt:gram/五段", "jlpt:gram/について"] },
];

test("buildCoursGramIndex indexes every GramItem by normalized form", () => {
  const idx = buildCoursGramIndex(GRAM, LESSONS);
  expect(idx.get("たら")).toEqual({ forme: "〜たら", niv: "N3", sens: "« quand/dès que ».", id: "jlpt:gram/たら", group: "g1" });
  expect(idx.get("五段")).toEqual({ forme: "五段", niv: "", sens: "", id: "jlpt:gram/五段", group: "g1" });
});

test("buildCoursGramIndex splits a compound form 'A / B' into two index entries", () => {
  const idx = buildCoursGramIndex(GRAM, LESSONS);
  // both alternatives resolve to the same source item (id/group), so either deep-links to it
  expect(idx.get("について")).toEqual({ forme: "〜について", niv: "N3", sens: "au sujet de", id: "jlpt:gram/について", group: "g1" });
  expect(idx.get("に対して")).toEqual({ forme: "〜に対して", niv: "N3", sens: "au sujet de", id: "jlpt:gram/について", group: "g1" });
});

test("extractGrammarForm returns the first <b> content, or null", () => {
  expect(extractGrammarForm("<b>〜たら</b> = « quand »")).toBe("〜たら");
  expect(extractGrammarForm("no bold here")).toBeNull();
});

test("resolveGrammarRappel: grammar match, no-match, non-grammar, null index", () => {
  const idx = buildCoursGramIndex(GRAM, LESSONS);
  const g = (e: string, cat = "grammaire"): Question => ({ id: 1, cat: cat as Question["cat"], d: 1, q: "", o: [], a: 0, e });
  expect(resolveGrammarRappel(g("<b>〜たら</b> …"), idx)?.forme).toBe("〜たら");
  expect(resolveGrammarRappel(g("<b>〜inconnu</b> …"), idx)).toBeNull();
  expect(resolveGrammarRappel(g("<b>〜たら</b>", "vocabulaire"), idx)).toBeNull();
  expect(resolveGrammarRappel(g("<b>〜たら</b>"), null)).toBeNull();
});

test("loadCoursGramIndex lit gram.jsonld ET lesson.jsonld, et mémoïse", async () => {
  clearCoursGramCache();
  const urls: string[] = [];
  const fetchImpl = async (url: string) => {
    urls.push(url);
    return { json: async () => ({ "@graph": url.includes("lesson") ? LESSONS : GRAM }) };
  };
  const a = await loadCoursGramIndex(fetchImpl as any);
  const b = await loadCoursGramIndex(fetchImpl as any);
  expect(a).toBe(b);            // memoized
  expect(urls).toEqual(["data/graph/gram.jsonld", "data/graph/lesson.jsonld"]);
  expect(a.get("たら")?.niv).toBe("N3");
});

test("buildCoursGramIndex résout le groupe depuis la LEÇON (lien profond)", () => {
  // Régression : GrammarRappel.group alimente coursItemHref("gram", group, id). Une constante
  // y produirait une URL morte, et gram.jsonld ne sait pas dans quelle leçon vit un point.
  const r = buildCoursGramIndex(GRAM, LESSONS).get("たら");
  expect(r?.group).toBe("g1");
  expect(r?.id).toBe("jlpt:gram/たら");
});

test("buildCoursGramIndex laisse le groupe vide si aucune leçon ne couvre le point", () => {
  const r = buildCoursGramIndex(GRAM, []).get("たら");
  expect(r?.group).toBe("");
});
