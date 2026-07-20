/**
 * Le « Rappel » d'un corrigé, résolu par les arêtes `tests` de la question.
 *
 * Chaque question porte, en donnée, l'IRI de l'entité qu'elle teste — un point de grammaire,
 * un mot ou un kanji. Ce module lit cette arête au lieu de deviner la notion en parsant le
 * `<b>` du corrigé, comme le faisait `coursGramIndex`. Deux conséquences :
 *
 *  1. **Retoucher un corrigé ne casse plus le lien.** L'heuristique dépendait d'un balisage
 *     éditorial ; l'arête est une donnée, validée par `integrity.mjs` (référence pendante =
 *     erreur de build).
 *  2. **Le vocabulaire et les kanji en profitent.** 5 454 questions portent une arête que
 *     rien ne lisait : leur corrigé n'avait aucun rappel.
 *
 * ⚠ La couverture, elle, ne change pas pour la grammaire : les arêtes avaient été construites
 * AVEC cette heuristique, elles en sont la matérialisation. Le gain est de robustesse et de
 * portée, pas de taux de résolution.
 */
import type { Question } from "../../types/quiz.ts";

export type Sujet = Record<string, unknown>;
export interface RappelDocs {
  gram: Sujet[]; word: Sujet[]; kanji: Sujet[]; example: Sujet[]; lesson: Sujet[];
}

export type RappelKind = "gram" | "word" | "kanji";

export interface Rappel {
  kind: RappelKind;
  iri: string;
  titre: string;
  /** Lecture : kana d'un mot, on・kun d'un kanji. Vide pour un point de grammaire. */
  lecture: string;
  sens: string;
  niv: string;
  /** Groupe de la leçon qui couvre l'entité — vide si aucune, et alors PAS de lien profond. */
  group: string;
  /** Catégorie de `/cours` où la notion est ENSEIGNÉE, lue sur la leçon et non déduite du type
   *  d'entité : « なかなか〜ない » est un point de grammaire rangé dans le cours de vocabulaire,
   *  et déduire la catégorie du type produisait un lien mort vers `/cours/gram/g24`. */
  coursCat: string;
  exemple?: { jp: string; fr: string };
}

export type RappelIndex = Map<string, Rappel>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string")
    : (typeof v === "string" ? [v] : []);

/** Piste d'une leçon → catégorie de la route `/cours`. */
const CAT_DE_PISTE: Record<string, string> = { gram: "gram", vocab: "vocab", kanji: "kanji" };

/** Index IRI → rappel, construit une fois depuis les documents du graphe. Pur. */
export function buildRappelIndex(docs: RappelDocs): RappelIndex {
  // Où chaque entité est enseignée : le lien profond a besoin du groupe, et seule la leçon
  // le sait. Le préfixe de piste est retiré comme dans coursFromGraph (`gram-g3` → `g3`),
  // sinon l'URL pointe vers /cours/gram/gram-g3.
  const groupOf = new Map<string, { group: string; cat: string }>();
  for (const l of docs.lesson) {
    const track = str(l["jlpt:track"]);
    const cat = CAT_DE_PISTE[track] ?? "";
    if (!cat) continue;
    const group = (str(l["@id"]).split("/").pop() ?? "").replace(new RegExp(`^${track}-`), "");
    for (const iri of list(l.covers)) if (!groupOf.has(iri)) groupOf.set(iri, { group, cat });
  }

  const exemples = new Map<string, { jp: string; fr: string }>();
  for (const e of docs.example) {
    const cible = str(e.illustrates);
    // Le premier exemple suffit : un corrigé en montre un, pas la liste du cours.
    if (cible && !exemples.has(cible)) {
      exemples.set(cible, { jp: str(e["jlpt:jp"]), fr: str(e["schema:description"]) });
    }
  }

  const index: RappelIndex = new Map();
  const ajoute = (s: Sujet, kind: RappelKind, titre: string, lecture: string) => {
    const iri = str(s["@id"]);
    if (!iri || !titre) return;
    const ex = exemples.get(iri);
    index.set(iri, {
      kind, iri, titre, lecture,
      sens: str(s["schema:description"]),
      niv: str(s["jlpt:level"]),
      group: groupOf.get(iri)?.group ?? "",
      coursCat: groupOf.get(iri)?.cat ?? "",
      ...(ex ? { exemple: ex } : {}),
    });
  };

  /** Lecture on・kun d'une entité kanji, dans la forme du cours (« シャ・やしろ »). */
  const lectureKanji = (s: Sujet) =>
    [...list(s["jlpt:onReading"]), ...list(s["jlpt:kunReading"])].join("・");

  // Lectures des kanji, indexées par caractère — le repli ci-dessous en a besoin, et
  // `docs.kanji` est parcouru après les mots.
  const parCaractere = new Map<string, string>();
  for (const s of docs.kanji) {
    const nom = str(s["schema:name"]);
    if (nom) parCaractere.set(nom, lectureKanji(s));
  }

  for (const s of docs.gram) ajoute(s, "gram", str(s["jlpt:form"]), "");
  for (const s of docs.word) {
    const nom = str(s["schema:name"]);
    // ⚠ Repli sur l'entité Kanji, et UNIQUEMENT pour un caractère unique. 175 mots du graphe
    // sont un kanji isolé sans lecture, dont 172 ont pourtant leur Kanji renseigné : sans ce
    // repli, 271 corrigés affichent un rappel muet alors que la lecture est là, à une arête.
    //
    // Strictement mono-caractère : 影響 n'a pas d'entité « 影響 », et lui prêter la lecture
    // de 影 serait faux. Et jamais en remplacement — une lecture de mot fait autorité.
    const lecture = str(s["jlpt:reading"])
      || ([...nom].length === 1 ? (parCaractere.get(nom) ?? "") : "");
    ajoute(s, "word", nom, lecture);
  }
  for (const s of docs.kanji) ajoute(s, "kanji", str(s["schema:name"]), lectureKanji(s));
  return index;
}

/** Le rappel d'une question, via sa première arête `tests` résoluble. `null` si aucune. */
export function resolveRappel(question: Question, index: RappelIndex | null): Rappel | null {
  if (!index) return null;
  for (const iri of list(question.tests)) {
    const r = index.get(iri);
    if (r) return r;
  }
  return null;
}

const DOCS = ["gram", "word", "kanji", "example", "lesson"] as const;
type FetchLike = (url: string) => Promise<{ json: () => Promise<unknown> }>;
let cache: Promise<RappelIndex> | null = null;

/** Vide la mémoïsation (isolation des tests). */
export function clearRappelCache(): void { cache = null; }

/**
 * Charge et mémoïse l'index. Échec → index vide : un corrigé sans rappel reste lisible,
 * c'est exactement la dégradation qu'avait `loadCoursGramIndex`.
 *
 * ⚠ `word.jsonld` (982 Ko) est déjà fetché au démarrage par `setupDict` et précaché par le
 * service worker : ce second appel sort du cache HTTP, il ne retélécharge rien.
 */
export function loadRappelIndex(fetchImpl: FetchLike = fetch as FetchLike): Promise<RappelIndex> {
  if (!cache) {
    cache = Promise.all(
      DOCS.map((n) => fetchImpl(`data/graph/${n}.jsonld`)
        .then((r) => r.json() as Promise<{ "@graph"?: Sujet[] }>)
        .then((d) => d["@graph"] ?? [])),
    )
      .then((docs) =>
        buildRappelIndex(Object.fromEntries(DOCS.map((n, i) => [n, docs[i]])) as unknown as RappelDocs))
      .catch(() => { cache = null; return new Map<string, Rappel>(); });
  }
  return cache;
}
