import { test, expect } from "bun:test";
import { anchorIndex, selectAnchor, clearAnchorCache } from "./anchor.ts";
import type { Question } from "../../types/quiz.ts";

/** Les questions du corpus réel, réduites à ce dont l'ancrage a besoin.
 *  ⚠ `readsPassage` en fait PARTIE : 44 questions de `q-lecture` portent à la fois des arêtes
 *  `tests` et un passage, et `anchorIndex` les écarte. Sans le champ ici, ces cliquets
 *  mesureraient un ancrage que le runtime ne produit pas. */
async function corpus(): Promise<Question[]> {
  const out: Question[] = [];
  for (const f of ["kanji", "vocabulaire", "grammaire", "lecture", "ecoute"]) {
    const doc = await Bun.file(`data/graph/q-${f}.jsonld`).json();
    for (const s of doc["@graph"] as Record<string, unknown>[]) {
      const t = s.tests;
      const tests = Array.isArray(t) ? (t as string[]) : (typeof t === "string" ? [t] : undefined);
      const pid = typeof s.readsPassage === "string" ? (s.readsPassage as string) : undefined;
      out.push({
        id: s["jlpt:ord"], cat: f, d: 1, q: "", o: [], a: 0,
        ...(tests ? { tests } : {}), ...(pid ? { passageId: pid } : {}),
      } as unknown as Question);
    }
  }
  return out;
}

/** Les entités enseignées par une piste du cours, dans l'ordre des leçons. */
async function enseignees(track: string): Promise<string[]> {
  const doc = await Bun.file("data/graph/lesson.jsonld").json();
  const out: string[] = [];
  for (const l of doc["@graph"] as Record<string, unknown>[]) {
    if (l["jlpt:track"] !== track) continue;
    const c = l.covers;
    out.push(...(Array.isArray(c) ? (c as string[]) : [c as string]));
  }
  return out;
}

/**
 * TEST DE MESURE — fige le taux d'ancrage réel, piste par piste. Ce sont des CLIQUETS :
 * si les arêtes `tests` du graphe s'enrichissent, ces seuils doivent être REMONTÉS, jamais
 * abaissés. Un seuil laissé en place cesse de garder quoi que ce soit.
 */
test("le taux d ancrage reel par piste tient ses cliquets", async () => {
  clearAnchorCache();
  const index = anchorIndex(await corpus());
  const taux: Record<string, number> = {};
  for (const track of ["gram", "vocab", "kanji"]) {
    const items = await enseignees(track);
    const ancres = items.filter((iri) => selectAnchor(iri, index, new Set()) !== null).length;
    taux[track] = ancres / items.length;
  }
  expect(taux.gram).toBeGreaterThanOrEqual(0.84);
  expect(taux.vocab).toBeGreaterThanOrEqual(0.87);
  expect(taux.kanji).toBeGreaterThanOrEqual(0.93);
});

/**
 * TEST DE MESURE — la piste kanji ne s'ancre QUE par le pont. Fige le fait qui justifie
 * l'existence de `parKanji` : si un jour des arêtes `jlpt:kanji` directes apparaissent sur les
 * kanji du cours, ce test échouera en annonçant un PROGRÈS, et il faudra le reformuler.
 */
test("aucun kanji enseigne n est teste par une arete directe", async () => {
  clearAnchorCache();
  const index = anchorIndex(await corpus());
  const items = await enseignees("kanji");
  const directs = items.filter((iri) => (index.direct.get(iri) ?? []).length > 0);
  expect(directs).toEqual([]);
});
