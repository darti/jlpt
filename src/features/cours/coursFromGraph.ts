/**
 * Projette les documents du graphe vers le type `CoursCategory` de la vue.
 *
 * C'est le SEUL module du cours qui connaisse le vocabulaire JSON-LD : les composants
 * (`CategoryIndex`, `GroupDetail`, la progression) reçoivent exactement ce qu'ils recevaient
 * de `data/cours-*.json`, et leurs tests passent inchangés — c'est ce qui prouve que la
 * bascule n'a pas touché aux vues. Même rôle que `src/lib/graph.ts` pour le quiz.
 */
import type {
  CoursCategory, CoursExample, CoursGroup, CoursItem,
  GramItem, KanjiItem, LearnCategory, MethodCategory, VocabItem,
} from "./coursSchema.ts";

export type Sujet = Record<string, unknown>;
export interface CoursDocs {
  lesson: Sujet[]; gram: Sujet[]; kanji: Sujet[]; word: Sujet[]; example: Sujet[]; method: Sujet[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string")
    : (typeof v === "string" ? [v] : []);

const TITRES: Record<string, string> = {
  gram: "文法 — Grammaire N3 par leçons",
  vocab: "語彙 — Vocabulaire par thèmes",
  kanji: "漢字 — Kanji N3 par thèmes",
};

/** Exemples d'un point de grammaire, indexés par l'IRI qu'ils illustrent. */
function examplesByIri(sujets: Sujet[]): Map<string, CoursExample[]> {
  const out = new Map<string, CoursExample[]>();
  for (const e of sujets) {
    const cible = str(e.illustrates);
    if (!cible) continue;
    const ex: CoursExample = {
      jp: str(e["jlpt:jp"]), ro: str(e["jlpt:romaji"]), fr: str(e["schema:description"]),
    };
    const an = list(e["jlpt:analysis"]);
    if (an.length) ex.an = an;
    if (!out.has(cible)) out.set(cible, []);
    out.get(cible)!.push(ex);
  }
  return out;
}

/** Une entité → l'item de cours correspondant, selon la piste. `null` si l'entité manque. */
function toItem(
  track: string, iri: string, entites: Map<string, Sujet>, ex: Map<string, CoursExample[]>,
): CoursItem | null {
  const s = entites.get(iri);
  if (!s) return null;

  // ⚠ La piste dit où l'item est ENSEIGNÉ, le sujet dit ce qu'il EST. Un motif grammatical
  // rangé dans le cours de vocabulaire (« なかなか〜ない ») est un GrammarPoint : le rendre
  // comme un mot afficherait une case vide. On se fie donc au sujet, pas à la piste.
  const estGram = str(s["jlpt:form"]) !== "";

  if (track === "gram" || estGram) {
    const it: GramItem = { id: iri, form: str(s["jlpt:form"]) };
    const struct = str(s["jlpt:structure"]); if (struct) it.struct = struct;
    const mean = str(s["schema:description"]); if (mean) it.mean = mean;
    const niv = str(s["jlpt:level"]); if (niv) it.niv = niv;
    const exs = ex.get(iri); if (exs?.length) it.examples = exs;
    // La vue vocabulaire lit `mot`/`sens` : on les fournit aussi pour qu'un motif classé
    // en vocabulaire s'affiche, sans que la vue ait à connaître le cas.
    return track === "vocab"
      ? ({ ...it, mot: it.form, lecture: "", sens: it.mean ?? "" } as unknown as CoursItem)
      : it;
  }

  if (track === "kanji") {
    // La vue attend la lecture telle que le cours l'écrivait : « イ・くらい ».
    const lecture = [...list(s["jlpt:onReading"]), ...list(s["jlpt:kunReading"])].join("・");
    const it: KanjiItem = {
      id: iri, kanji: str(s["schema:name"]), lecture, sens: str(s["schema:description"]),
    };
    const comp = str(s["jlpt:compound"]); if (comp) it.exemple = comp;
    return it;
  }

  const it: VocabItem = {
    id: iri, mot: str(s["schema:name"]), lecture: str(s["jlpt:reading"]),
    sens: str(s["schema:description"]),
  };
  const niv = str(s["jlpt:level"]); if (niv) it.niv = niv;
  return it;
}

/** Documents du graphe → les quatre catégories de la route /cours. */
export function buildCours(docs: CoursDocs): CoursCategory[] {
  const entites = new Map<string, Sujet>();
  for (const s of [...docs.gram, ...docs.kanji, ...docs.word]) entites.set(str(s["@id"]), s);
  const ex = examplesByIri(docs.example);

  const cats: CoursCategory[] = [];
  for (const track of ["gram", "vocab", "kanji"] as const) {
    const groups: CoursGroup[] = docs.lesson
      .filter((l) => str(l["jlpt:track"]) === track)
      .slice()
      .sort((a, b) => (a["jlpt:order"] as number) - (b["jlpt:order"] as number))
      .map((l) => ({
        // L'IRI est `jlpt:lesson/<piste>-<groupe>` ; on retire le préfixe de piste pour
        // rendre l'id du groupe d'origine (`g1`). Le garder produirait `/cours/gram/gram-g1`
        // et casserait les liens profonds déjà partagés (coursDeepLink#coursItemHref).
        id: (str(l["@id"]).split("/").pop() ?? "").replace(new RegExp(`^${track}-`), ""),
        title: str(l["schema:name"]),
        items: list(l.covers)
          .map((iri) => toItem(track, iri, entites, ex))
          .filter((i): i is CoursItem => i !== null),
      }));
    cats.push({ id: track, title: TITRES[track], kind: "learn", groups } as LearnCategory);
  }

  const method: MethodCategory = {
    id: "method", title: "読解・聴解 — Méthode", kind: "method",
    sections: docs.method
      .slice()
      .sort((a, b) => (a["jlpt:order"] as number) - (b["jlpt:order"] as number))
      .map((m) => ({ title: str(m["schema:name"]), tips: list(m["jlpt:tip"]) })),
  };
  cats.push(method);
  return cats;
}
