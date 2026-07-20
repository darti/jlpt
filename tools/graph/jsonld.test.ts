import { test, expect } from "bun:test";
import { expandIri, isSafeIri, readContext, readDoc } from "./jsonld.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const prefixes = { jlpt: "https://okutheory.com/jlpt/vocab#", sh: "http://www.w3.org/ns/shacl#" };

test("expandIri déplie un terme préfixé", () => {
  expect(expandIri("jlpt:Question", prefixes)).toBe("https://okutheory.com/jlpt/vocab#Question");
});

test("expandIri laisse une IRI absolue intacte", () => {
  expect(expandIri("https://schema.org/name", prefixes)).toBe("https://schema.org/name");
});

test("expandIri laisse un préfixe inconnu intact plutôt que de fabriquer une IRI fausse", () => {
  expect(expandIri("inconnu:X", prefixes)).toBe("inconnu:X");
});

test("isSafeIri accepte le japonais et les IRIs usuelles", () => {
  expect(isSafeIri("https://okutheory.com/jlpt/vocab#word/影響")).toBe(true);
  expect(isSafeIri("urn:oku:note:1")).toBe(true);
});

test("isSafeIri rejette les caractères dangereux pour SQL et la chaîne vide", () => {
  for (const bad of ["", "urn:foo'bar", "urn:foo;bar", "urn:foo--bar", "urn:foo\\bar", "urn:foo/*bar"]) {
    expect(isSafeIri(bad)).toBe(false);
  }
});

test("isSafeIri rejette les contrôles ASCII et les contrôles de formatage Unicode", () => {
  expect(isSafeIri("urn:oku:" + String.fromCharCode(0x0007))).toBe(false); // contrôle ASCII
  expect(isSafeIri("urn:oku:" + String.fromCharCode(0x200b))).toBe(false); // espace de largeur nulle
  expect(isSafeIri("urn:oku:" + String.fromCharCode(0xfeff))).toBe(false); // BOM
});

test("readContext expose préfixes et alias de termes séparément", () => {
  const ctx = readContext("data/graph/context.jsonld");
  expect(ctx.prefixes.jlpt).toBe("https://okutheory.com/jlpt/vocab#");
  expect(ctx.terms.tests.id).toBe("jlpt:tests");
  expect(ctx.terms.covers.container).toBe("@list");
});

// --- readDoc -------------------------------------------------------------------
// Régression : une version antérieure branchait sur un `@context` en chaîne mais
// chargeait le contextPath par défaut, ignorant la valeur. Le bug était invisible
// tant que les deux désignaient le même fichier — ces tests le rendent détectable.

const tmp = mkdtempSync(join(tmpdir(), "jlpt-jsonld-"));

test("readDoc suit le chemin donné par un @context en chaîne", () => {
  writeFileSync(join(tmp, "autre.jsonld"), JSON.stringify({ "@context": { ex: "https://exemple.test/" } }));
  writeFileSync(join(tmp, "doc.jsonld"), JSON.stringify({ "@context": "autre.jsonld", "@graph": [{ "@id": "ex:x" }] }));
  const { context, subjects } = readDoc(join(tmp, "doc.jsonld"));
  expect(context.prefixes.ex).toBe("https://exemple.test/"); // et NON le contexte par défaut
  expect(subjects).toHaveLength(1);
});

test("readDoc accepte un @context inline", () => {
  writeFileSync(join(tmp, "inline.jsonld"), JSON.stringify({ "@context": { in: "https://inline.test/" }, "@graph": [] }));
  expect(readDoc(join(tmp, "inline.jsonld")).context.prefixes.in).toBe("https://inline.test/");
});

test("readDoc retombe sur contextPath quand le document n'a pas de @context", () => {
  writeFileSync(join(tmp, "nu.jsonld"), JSON.stringify({ "@graph": [{ "@id": "a" }] }));
  expect(readDoc(join(tmp, "nu.jsonld"), "data/graph/context.jsonld").context.prefixes.jlpt)
    .toBe("https://okutheory.com/jlpt/vocab#");
});

test("readDoc rend une liste vide quand @graph est absent", () => {
  writeFileSync(join(tmp, "vide.jsonld"), JSON.stringify({ "@context": { a: "https://a.test/" } }));
  expect(readDoc(join(tmp, "vide.jsonld")).subjects).toEqual([]);
});
