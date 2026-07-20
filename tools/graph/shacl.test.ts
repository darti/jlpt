import { test, expect } from "bun:test";
import { parseShapes, validateSubject, validateAll } from "./shacl.mjs";

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

// --- validation d'un sujet contre une shape ------------------------------------

const qShape = parseShapes([{
  "@id": "jlpt:QuestionShape", "@type": "sh:NodeShape",
  "sh:targetClass": "jlpt:Question",
  "sh:property": [
    { "sh:path": "jlpt:stem", "sh:datatype": "xsd:string", "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:ord", "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:skill", "sh:in": ["kanji", "lecture"], "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:tests", "sh:nodeKind": "sh:IRI" },
  ],
}], prefixes)[0];

const ok = { "@id": "jlpt:q/1", "@type": "jlpt:Question", "jlpt:stem": "x", "jlpt:ord": 0, "jlpt:skill": "kanji" };

test("validateSubject accepte un sujet conforme", () => {
  expect(validateSubject(ok, qShape, prefixes)).toEqual([]);
});

test("validateSubject signale une propriété obligatoire absente", () => {
  const { ["jlpt:stem"]: _drop, ...sans } = ok;
  expect(validateSubject(sans, qShape, prefixes).join(" ")).toMatch(/stem.*minCount/);
});

test("validateSubject signale un datatype faux", () => {
  expect(validateSubject({ ...ok, "jlpt:ord": "zéro" }, qShape, prefixes).join(" ")).toMatch(/ord/);
});

test("validateSubject refuse un entier négatif pour xsd:nonNegativeInteger", () => {
  expect(validateSubject({ ...ok, "jlpt:ord": -1 }, qShape, prefixes).join(" ")).toMatch(/ord/);
});

test("validateSubject signale une valeur hors sh:in", () => {
  expect(validateSubject({ ...ok, "jlpt:skill": "ecoute" }, qShape, prefixes).join(" ")).toMatch(/skill/);
});

test("validateSubject signale un dépassement de maxCount", () => {
  expect(validateSubject({ ...ok, "jlpt:stem": ["a", "b"] }, qShape, prefixes).join(" ")).toMatch(/maxCount/);
});

test("validateSubject exige une IRI sûre pour sh:nodeKind IRI", () => {
  expect(validateSubject({ ...ok, "jlpt:tests": ["jlpt:gram/a'b"] }, qShape, prefixes).join(" ")).toMatch(/IRI/);
});

test("validateSubject reconnaît un prédicat écrit en forme dépliée", () => {
  // Les documents écrivent en forme compacte, mais rien ne l'impose : le sh:path est
  // déplié, donc la comparaison doit l'être des deux côtés.
  const { ["jlpt:stem"]: _s, ...reste } = ok;
  expect(validateSubject({ ...reste, "https://okutheory.com/jlpt/vocab#stem": "x" }, qShape, prefixes)).toEqual([]);
});

test("validateAll n'applique une shape qu'aux sujets de sa classe cible", () => {
  const wShape = parseShapes([{
    "@id": "jlpt:WordShape", "@type": "sh:NodeShape", "sh:targetClass": "jlpt:Word", "sh:property": [],
  }], prefixes)[0];
  expect(validateAll([ok, { "@id": "jlpt:w/1", "@type": "jlpt:Word" }], [qShape, wShape], prefixes)).toEqual([]);
});

test("validateAll signale un sujet dont le @type n'a aucune shape", () => {
  expect(validateAll([{ "@id": "jlpt:z/1", "@type": "jlpt:Inconnu" }], [qShape], prefixes).join(" "))
    .toMatch(/aucune shape/);
});

test("validateSubject ne perd pas un prédicat écrit deux fois sous ses deux formes", () => {
  // Sinon maxCount:1 serait satisfait à tort alors que deux valeurs sont présentes.
  const doublon = { ...ok, "https://okutheory.com/jlpt/vocab#stem": "y" };
  expect(validateSubject(doublon, qShape, prefixes).join(" ")).toMatch(/stem.*maxCount/);
});
