import { test, expect } from "bun:test";
import { buildRappelIndex, resolveRappel, type RappelDocs, type Sujet } from "./rappel.ts";
import { toQuestion } from "../../lib/graph.ts";

// Confronte l'index au graphe RÉEL. Les autres tests travaillent sur cinq sujets inventés ;
// celui-ci mesure la portée effective — et la fige, pour qu'une régression de rattachement
// (une arête perdue, une entité renommée) fasse rougir la suite au lieu de vider un corrigé.

const G = async (n: string): Promise<Sujet[]> =>
  (await Bun.file(`data/graph/${n}.jsonld`).json())["@graph"] ?? [];

async function index() {
  const [gram, word, kanji, example, lesson] = await Promise.all(
    ["gram", "word", "kanji", "example", "lesson"].map(G),
  );
  return buildRappelIndex({ gram, word, kanji, example, lesson } as RappelDocs);
}

async function couverture(shard: string) {
  const idx = await index();
  const qs = (await G(shard)).map(toQuestion);
  const resolus = qs.filter((q) => resolveRappel(q, idx) !== null).length;
  return { total: qs.length, resolus };
}

test("les questions de grammaire résolvent leur point, exemple compris", async () => {
  const { total, resolus } = await couverture("q-grammaire");
  expect(total).toBe(1174);
  expect(resolus).toBe(636); // identique à l'heuristique : les arêtes en sont issues
});

test("le VOCABULAIRE gagne un rappel — il n'en avait aucun", async () => {
  const { total, resolus } = await couverture("q-vocabulaire");
  expect(total).toBe(5901);
  expect(resolus).toBe(2969);
});

test("les KANJI gagnent un rappel — ils n'en avaient aucun", async () => {
  const { total, resolus } = await couverture("q-kanji");
  expect(total).toBe(3148);
  expect(resolus).toBe(2485);
});

test("un rappel de kanji ENSEIGNÉ porte sa lecture on・kun", async () => {
  const idx = await index();
  const r = idx.get("jlpt:kanji/位");
  expect(r?.titre).toBe("位");
  expect(r?.lecture).toBe("イ・くらい");
  expect(r?.sens).not.toBe("");
});

test("TOUS les kanji portent une lecture — le trou est comblé", async () => {
  // Il en manquait 259 : ceux hérités de l'ancien kanji.json, que le cours n'enseigne pas.
  // Comblés depuis KANJIDIC2, via l'arbitrage de l'auteur (data/lectures-kanji-arbitrees.json).
  // Ce test empêche la régression : un kanji ajouté sans lecture rendrait un rappel muet.
  const idx = await index();
  const kanji = [...idx.values()].filter((r) => r.kind === "kanji");
  expect(kanji.length).toBe(810);
  expect(kanji.filter((r) => r.lecture === "").map((r) => r.titre)).toEqual([]);
});

test("556 questions de grammaire peuvent montrer une phrase d'exemple", async () => {
  // C'est la contrepartie de la décision D1 (un exemple illustre l'ENTITÉ, pas la leçon) :
  // rattaché à la leçon, il serait resté enfermé dans le cours.
  const idx = await index();
  const qs = (await G("q-grammaire")).map(toQuestion);
  const avecExemple = qs.filter((q) => resolveRappel(q, idx)?.exemple).length;
  expect(avecExemple).toBe(556);
});

test("aucun rappel ne propose un lien mort", async () => {
  // `group` vide ⇒ rappelHref rend null ⇒ pas de lien. Ce test garde l'invariant côté données :
  // un group non vide DOIT désigner une leçon existante.
  const lessons = await G("lesson.jsonld".replace(".jsonld", ""));
  const CAT: Record<string, string> = { gram: "gram", vocab: "vocab", kanji: "kanji" };
  const groupes = new Set(
    lessons.map((l) => {
      const track = String(l["jlpt:track"] ?? "");
      const g = String(l["@id"]).split("/").pop()?.replace(new RegExp(`^${track}-`), "");
      return `${CAT[track]}/${g}`;
    }),
  );
  const idx = await index();
  const morts: string[] = [];
  for (const r of idx.values()) {
    if (!r.group) continue;
    if (!groupes.has(`${r.coursCat}/${r.group}`)) morts.push(`${r.coursCat}/${r.group} (${r.iri})`);
  }
  expect(morts).toEqual([]);
});
