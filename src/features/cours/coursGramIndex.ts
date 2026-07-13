/** Index of N3/N4 grammar points from data/cours-gram.json, keyed by normalized form, so a quiz
 *  corrigé can show a "Rappel de cours" for the tested grammar point. Pure logic + a memoized loader.
 *  data/cours-gram.json is now the unified Category › Group › Item schema (tools/transform-cours.mjs) :
 *  a "learn" category whose groups hold GramItem (form/niv/mean/examples), one item per form. */
import type { LearnCategory } from "./coursSchema.ts";
import type { Question } from "../../types/quiz.ts";

export interface GrammarRappel { forme: string; niv: string; sens: string }
export type CoursGramIndex = Map<string, GrammarRappel>;

type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;

/** Normalize a grammar form for matching: keep the part after a colon, drop 〜 and whitespace. */
export function normalizeForm(s: string): string {
  const colon = s.lastIndexOf(":");
  const core = colon >= 0 ? s.slice(colon + 1) : s;
  return core.replace(/〜/g, "").replace(/\s+/g, "");
}

/** Build the form→point index from the cours-gram category. One GramItem = one index entry
 *  (alternative forms are already split into distinct items by tools/transform-cours.mjs). */
export function buildCoursGramIndex(category: LearnCategory): CoursGramIndex {
  const index: CoursGramIndex = new Map();
  for (const group of category.groups) {
    for (const item of group.items) {
      if (!("form" in item)) continue; // vocab/kanji items share the CoursItem union
      const key = normalizeForm(item.form);
      if (key) index.set(key, { forme: item.form, niv: item.niv ?? "", sens: item.mean ?? "" });
    }
  }
  return index;
}

/** The grammar form tested by a question = content of the first <b>…</b> in its explanation `e`. */
export function extractGrammarForm(e: string): string | null {
  const m = /<b>([\s\S]*?)<\/b>/.exec(e ?? "");
  if (!m) return null;
  const form = m[1].replace(/<[^>]*>/g, "").trim();
  return form || null;
}

/** Resolve the "Rappel de cours" point for a question, or null (non-grammar, no form, no match, no index). */
export function resolveGrammarRappel(question: Question, index: CoursGramIndex | null): GrammarRappel | null {
  if (!index || question.cat !== "grammaire") return null;
  const form = extractGrammarForm(typeof question.e === "string" ? question.e : "");
  if (!form) return null;
  return index.get(normalizeForm(form)) ?? null;
}

let cache: Promise<CoursGramIndex> | null = null;

/** Clears the memoized index (test isolation). */
export function clearCoursGramCache(): void { cache = null; }

/** Load + memoize the cours-gram index. Failure → empty index (every grammar corrigé falls back to the link). */
export function loadCoursGramIndex(fetchImpl: FetchLike = fetch as FetchLike): Promise<CoursGramIndex> {
  if (!cache) {
    cache = fetchImpl("data/cours-gram.json")
      .then((r) => r.json() as Promise<LearnCategory>)
      .then(buildCoursGramIndex)
      .catch(() => new Map<string, GrammarRappel>());
  }
  return cache;
}
