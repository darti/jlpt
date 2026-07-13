/** Index of N3/N4 grammar points from data/cours-gram.json, keyed by normalized form, so a quiz
 *  corrigé can show a "Rappel de cours" for the tested grammar point. Pure logic + a memoized loader. */
import type { CoursSection, CoursLesson } from "./useCours.ts";
import type { Question } from "../../types/quiz.ts";

export interface GrammarRappel { forme: string; niv: string; sens: string }
export type CoursGramIndex = Map<string, GrammarRappel>;

type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;

const GRAM_HEADERS = ["Forme", "Niv.", "Sens"];

/** Normalize a grammar form for matching: keep the part after a colon, drop 〜 and whitespace. */
export function normalizeForm(s: string): string {
  const colon = s.lastIndexOf(":");
  const core = colon >= 0 ? s.slice(colon + 1) : s;
  return core.replace(/〜/g, "").replace(/\s+/g, "");
}

/** Build the form→point index from the cours-gram section. Only the ['Forme','Niv.','Sens'] table
 *  counts; a Forme cell may hold `A / B` alternatives (each becomes its own key). */
export function buildCoursGramIndex(section: CoursSection): CoursGramIndex {
  const index: CoursGramIndex = new Map();
  const walk = (lessons: CoursLesson[] | undefined): void => {
    for (const lesson of lessons ?? []) {
      const t = lesson.table;
      if (t && GRAM_HEADERS.every((h, i) => t.headers[i] === h)) {
        for (const row of t.rows) {
          const [forme, niv, sens] = row;
          for (const alt of forme.split(" / ")) {
            const key = normalizeForm(alt);
            if (key) index.set(key, { forme: alt.trim(), niv, sens });
          }
        }
      }
      walk(lesson.lessons);
    }
  };
  walk(section.lessons);
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
      .then((r) => r.json() as Promise<CoursSection>)
      .then(buildCoursGramIndex)
      .catch(() => new Map<string, GrammarRappel>());
  }
  return cache;
}
