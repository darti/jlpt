import { test, expect } from "bun:test";
import { buildCours, type CoursDocs, type Sujet } from "./coursFromGraph.ts";
import type { LearnCategory, GramItem, KanjiItem, VocabItem } from "./coursSchema.ts";

// ⚠ Ce fichier meurt avec data/cours-*.json (Task 6). Il n'existe que pour prouver, UNE fois,
// que la migration n'a perdu aucun champ. Comparer le graphe à sa source est le seul moment
// où c'est possible — après la suppression, la source de vérité n'existe plus.

const G = async (n: string): Promise<Sujet[]> =>
  (await Bun.file(`data/graph/${n}.jsonld`).json())["@graph"] ?? [];
const C = (n: string) => Bun.file(`data/cours-${n}.json`).json();

async function vue() {
  const [lesson, gram, kanji, word, example, method] = await Promise.all(
    ["lesson", "gram", "kanji", "word", "example", "method"].map(G),
  );
  return buildCours({ lesson, gram, kanji, word, example, method } as CoursDocs);
}

test("chaque kanji du cours survit avec SA LECTURE et un sens non vide", async () => {
  // La lecture est le champ que la migration a failli perdre : kanji.jsonld n'en portait
  // aucun, et elle doit se retrouver À L'IDENTIQUE.
  //
  // ⚠ Le SENS, lui, n'est pas comparé à l'identique, et c'est voulu : le graphe fait autorité
  // (D3 — enrichKanji n'écrase jamais). Mesuré : 246 kanji ont dans le graphe une définition
  // PLUS RICHE que celle du cours (« rang, position » → « rang, position, place »), héritée de
  // la fusion des référentiels au lot 1. Zéro a un sens vide. Exiger l'égalité stricte
  // reviendrait à demander une régression.
  const cat = (await vue()).find((c) => c.id === "kanji") as LearnCategory;
  const parKanji = new Map(
    (cat.groups.flatMap((g) => g.items) as KanjiItem[]).map((i) => [i.kanji, i]),
  );
  for (const g of (await C("kanji")).groups) {
    for (const it of g.items) {
      const v = parKanji.get(it.kanji);
      expect(v, `kanji ${it.kanji} absent de la vue`).toBeTruthy();
      expect(v!.lecture, `lecture de ${it.kanji}`).toBe(it.lecture);
      expect(v!.sens, `sens vide pour ${it.kanji}`).not.toBe("");
    }
  }
});

test("les 227 exemples de grammaire et leur analyse survivent", async () => {
  // Compté côté VUE : la forme d'un item est celle de l'entité, pas celle du cours (29 points
  // écrivent une forme composée « 〜ても / 〜でも » là où l'entité porte « 〜てもいい »).
  // Comparer les totaux est donc le seul décompte fidèle.
  const cat = (await vue()).find((c) => c.id === "gram") as LearnCategory;
  const items = cat.groups.flatMap((g) => g.items) as GramItem[];
  const rendus = items.reduce((n, it) => n + (it.examples?.length ?? 0), 0);

  const source = (await C("gram")).groups
    .flatMap((g: { items: { examples?: unknown[] }[] }) => g.items)
    .reduce((n: number, it: { examples?: unknown[] }) => n + (it.examples?.length ?? 0), 0);

  expect(rendus).toBe(source);
  expect(rendus).toBe(227);
  // Et l'analyse ligne à ligne suit les exemples, elle n'est pas perdue en route.
  const analyses = items.reduce(
    (n, it) => n + (it.examples ?? []).reduce((m, e) => m + (e.an?.length ?? 0), 0), 0);
  expect(analyses).toBe(992);
});

test("chaque item de vocabulaire survit avec son sens", async () => {
  const cat = (await vue()).find((c) => c.id === "vocab") as LearnCategory;
  const items = cat.groups.flatMap((g) => g.items) as VocabItem[];
  const source = (await C("vocab")).groups.flatMap((g: { items: unknown[] }) => g.items);
  // Une cellule « A / B » devient deux items : la vue en a au moins autant que la source.
  expect(items.length).toBeGreaterThanOrEqual(source.length);
  expect(items.filter((i) => !i.sens)).toEqual([]); // aucun sens perdu
});

test("les 12 conseils de méthode survivent", async () => {
  const v = (await vue()).find((c) => c.id === "method");
  const src = await C("method");
  expect(v!.kind).toBe("method");
  const total = (s: { sections: { tips: string[] }[] }) =>
    s.sections.reduce((n, x) => n + x.tips.length, 0);
  expect(total(v as never)).toBe(total(src));
});

test("aucun groupe de cours ne devient vide", async () => {
  // Régression : la leçon « Famille 立 » rendait un groupe VIDE avant migration.
  for (const cat of await vue()) {
    if (cat.kind !== "learn") continue;
    for (const g of cat.groups) {
      expect(g.items.length, `groupe vide : ${cat.id}/${g.id} — ${g.title}`).toBeGreaterThan(0);
    }
  }
});
