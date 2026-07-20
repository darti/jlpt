/** Index of N3/N4 grammar points from data/cours-gram.json, keyed by normalized form, so a quiz
 *  corrigé can show a "Rappel de cours" for the tested grammar point. Pure logic + a memoized
 *  loader. data/cours-gram.json is now the unified Category › Group › Item schema
 *  (issu de la conversion vers ce schéma, outil supprimé depuis) : a "learn" category
 *  (form/niv/mean/examples), one item per form. */
import type { Question } from "../../types/quiz.ts";

/** `id`/`group` locate the point in the cours master-detail (`/cours/gram/<group>` + item
 *  `data-item-id`), so a quiz corrigé can deep-link straight to the tested rule. */
export interface GrammarRappel { forme: string; niv: string; sens: string; id: string; group: string }
export type CoursGramIndex = Map<string, GrammarRappel>;

type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;

/** Normalize a grammar form for matching: keep the part after a colon, drop 〜 and whitespace. */
export function normalizeForm(s: string): string {
  const colon = s.lastIndexOf(":");
  const core = colon >= 0 ? s.slice(colon + 1) : s;
  return core.replace(/〜/g, "").replace(/\s+/g, "");
}

type Sujet = Record<string, unknown>;
const g = (v: unknown): string => (typeof v === "string" ? v : "");
const gl = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string")
    : (typeof v === "string" ? [v] : []);

/** Build the form→point index from the graph. A form may be a compound "〜A / 〜B"
 *  (e.g. "〜ようだ / 〜みたいだ") — each alternative is indexed separately so a quiz testing
 *  either one resolves to the same rappel ; `jlpt:altForm` l est de même.
 *
 *  ⚠ Les LEÇONS sont nécessaires : `group` alimente le lien profond /cours/gram/<group>
 *  (coursDeepLink#coursItemHref), et seule la leçon sait où vit un point de grammaire.
 *  Le remplir avec une constante produirait une URL morte. */
export function buildCoursGramIndex(gram: Sujet[], lessons: Sujet[]): CoursGramIndex {
  const groupOf = new Map<string, string>();
  for (const les of lessons) {
    if (g(les["jlpt:track"]) !== "gram") continue;
    // Même règle que coursFromGraph : on retire le préfixe de piste pour retrouver l id
    // de groupe d origine, sinon le lien profond pointe vers /cours/gram/gram-g1.
    const gid = (g(les["@id"]).split("/").pop() ?? "").replace(/^gram-/, "");
    for (const iri of gl(les.covers)) if (!groupOf.has(iri)) groupOf.set(iri, gid);
  }

  const index: CoursGramIndex = new Map();
  for (const p of gram) {
    const iri = g(p["@id"]);
    const form = g(p["jlpt:form"]);
    if (!form) continue;
    for (const f of [...form.split(" / "), ...gl(p["jlpt:altForm"])]) {
      const key = normalizeForm(f);
      if (!key) continue;
      index.set(key, {
        forme: f.trim(), niv: g(p["jlpt:level"]), sens: g(p["schema:description"]),
        id: iri, group: groupOf.get(iri) ?? "",
      });
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

const graphDoc = (fetchImpl: FetchLike, n: string): Promise<Sujet[]> =>
  fetchImpl(`data/graph/${n}.jsonld`)
    .then((r) => r.json() as Promise<{ "@graph"?: Sujet[] }>)
    .then((d) => d["@graph"] ?? []);

/** Load + memoize the index depuis le graphe. Échec → index vide (chaque corrigé de grammaire
 *  retombe sur le lien simple). */
export function loadCoursGramIndex(fetchImpl: FetchLike = fetch as FetchLike): Promise<CoursGramIndex> {
  if (!cache) {
    cache = Promise.all([graphDoc(fetchImpl, "gram"), graphDoc(fetchImpl, "lesson")])
      .then(([gr, les]) => buildCoursGramIndex(gr, les))
      .catch(() => new Map<string, GrammarRappel>());
  }
  return cache;
}
