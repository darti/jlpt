import { test, expect, afterAll } from "bun:test";
import { readGraph, writeGraph, GRAPH_DIR, graphPath } from "./jsonld.mjs";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Le FORMAT d'écriture des documents du graphe était retapé dans huit outils, à l'identique :
 * `JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n"`. Ce n'est pas un détail de
 * style — c'est la forme sous laquelle 10 351 questions sont versionnées. Une indentation qui
 * dérive d'un cran dans UN outil réécrit le fichier entier, et le diff devient illisible.
 *
 * Ces tests figent le format en un seul endroit, pour que les huit appelants en héritent.
 */

const tmp = mkdtempSync(join(tmpdir(), "graphio-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function ecrire(nom, contenu) {
  const p = join(tmp, nom);
  writeFileSync(p, contenu);
  return p;
}

test("readGraph rend le document ENTIER et ses sujets", () => {
  const p = ecrire("a.jsonld", JSON.stringify({ "@context": "context.jsonld", "@graph": [{ "@id": "x" }] }));
  const { doc, subjects } = readGraph(p);
  expect(doc["@context"]).toBe("context.jsonld");
  expect(subjects).toEqual([{ "@id": "x" }]);
});

test("readGraph : @graph absent ou non-tableau → []", () => {
  expect(readGraph(ecrire("b.jsonld", JSON.stringify({ "@context": "c" }))).subjects).toEqual([]);
  expect(readGraph(ecrire("c.jsonld", JSON.stringify({ "@graph": 3 }))).subjects).toEqual([]);
});

test("writeGraph : indentation 1, saut de ligne final — le format du dépôt", () => {
  const p = join(tmp, "d.jsonld");
  writeGraph(p, { "@context": "context.jsonld" }, [{ "@id": "x" }]);
  const brut = readFileSync(p, "utf8");
  expect(brut.endsWith("\n")).toBe(true);
  expect(brut).toBe('{\n "@context": "context.jsonld",\n "@graph": [\n  {\n   "@id": "x"\n  }\n ]\n}\n');
});

test("writeGraph préserve toute clé du document hors @graph", () => {
  const p = join(tmp, "e.jsonld");
  writeGraph(p, { "@context": "c", "@id": "doc", extra: 1, "@graph": [{ vieux: true }] }, [{ neuf: true }]);
  const { doc, subjects } = readGraph(p);
  expect(doc["@context"]).toBe("c");
  expect(doc["@id"]).toBe("doc");
  expect(doc.extra).toBe(1);
  expect(subjects).toEqual([{ neuf: true }]); // @graph remplacé, pas fusionné
});

test("round-trip readGraph → writeGraph : octet pour octet", () => {
  const source = '{\n "@context": "context.jsonld",\n "@graph": [\n  {\n   "@id": "jlpt:word/影響",\n   "jlpt:reading": "えいきょう"\n  }\n ]\n}\n';
  const p = ecrire("f.jsonld", source);
  const { doc, subjects } = readGraph(p);
  writeGraph(p, doc, subjects);
  expect(readFileSync(p, "utf8")).toBe(source);
});

test("le japonais reste en clair — jamais d'échappement \\uXXXX", () => {
  const p = join(tmp, "g.jsonld");
  writeGraph(p, {}, [{ "@id": "jlpt:word/影響" }]);
  expect(readFileSync(p, "utf8")).toContain("影響");
});

test("GRAPH_DIR / graphPath : une seule source pour l'emplacement du graphe", () => {
  expect(GRAPH_DIR).toBe("data/graph");
  expect(graphPath("word.jsonld")).toBe("data/graph/word.jsonld");
});
