import { test, expect } from "bun:test";
import { parseShapes } from "./shacl.mjs";

const prefixes = {
  sh: "http://www.w3.org/ns/shacl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  jlpt: "https://okutheory.com/jlpt/vocab#",
};

const shape = (props: unknown[]) => ([{
  "@id": "jlpt:QuestionShape", "@type": "sh:NodeShape",
  "sh:targetClass": "jlpt:Question",
  "sh:property": props,
}]);

test("parseShapes déplie l'IRI de shape et la classe cible", () => {
  const [s] = parseShapes(shape([{ "sh:path": "jlpt:stem", "sh:datatype": "xsd:string" }]), prefixes);
  expect(s.shapeIri).toBe("https://okutheory.com/jlpt/vocab#QuestionShape");
  expect(s.targetClass).toBe("https://okutheory.com/jlpt/vocab#Question");
});

test("parseShapes lit cardinalité, datatype et nodeKind", () => {
  const [s] = parseShapes(shape([
    { "sh:path": "jlpt:stem", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:tests", "sh:nodeKind": "sh:IRI" },
  ]), prefixes);
  expect(s.properties[0].datatype).toBe("http://www.w3.org/2001/XMLSchema#string");
  expect(s.properties[0].minCount).toBe(1);
  expect(s.properties[0].maxCount).toBe(1);
  expect(s.properties[1].nodeKind).toBe("IRI");
});

test("parseShapes lit un sh:in de chaînes", () => {
  const [s] = parseShapes(shape([{ "sh:path": "jlpt:skill", "sh:in": ["kanji", "lecture"] }]), prefixes);
  expect(s.properties[0].allowedValues).toEqual(["kanji", "lecture"]);
});

test("parseShapes REJETTE un sh:in contenant un non-string (Oku l'ignorerait en silence)", () => {
  expect(() => parseShapes(shape([{ "sh:path": "jlpt:difficulty", "sh:in": [1, 2, 3] }]), prefixes))
    .toThrow(/sh:in/);
});

test("parseShapes rejette une contrainte hors du sous-ensemble d'Oku", () => {
  expect(() => parseShapes(shape([{ "sh:path": "jlpt:stem", "sh:pattern": "^a+$" }]), prefixes))
    .toThrow(/sh:pattern/);
});

test("parseShapes rejette une shape sans sh:targetClass", () => {
  const bad = [{ "@id": "jlpt:S", "@type": "sh:NodeShape", "sh:property": [] }];
  expect(() => parseShapes(bad, prefixes)).toThrow(/targetClass/);
});

test("parseShapes rejette une propriété sans sh:path", () => {
  expect(() => parseShapes(shape([{ "sh:datatype": "xsd:string" }]), prefixes)).toThrow(/sh:path/);
});

test("parseShapes ignore les sujets qui ne sont pas des NodeShape", () => {
  expect(parseShapes([{ "@id": "jlpt:x", "@type": "jlpt:Word" }], prefixes)).toEqual([]);
});
