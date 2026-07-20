import { test, expect } from "bun:test";
import { readContext, readDoc } from "./jsonld.mjs";
import { parseShapes, validateAll } from "./shacl.mjs";

/** Résolus depuis ce fichier : un `bun test` lancé d'un sous-dossier ne doit pas échouer
 *  pour une raison sans rapport avec le code. */
const CONTEXT = new URL("../../data/graph/context.jsonld", import.meta.url).pathname;
const SHAPES = new URL("../../data/graph/shapes.jsonld", import.meta.url).pathname;

const shapes = () => parseShapes(readDoc(SHAPES, CONTEXT).subjects, readContext(CONTEXT).prefixes);

test("shapes.jsonld se parse et couvre les cinq types du domaine", () => {
  const classes = shapes().map((s) => s.targetClass.split("#").pop()).sort();
  expect(classes).toEqual(["GrammarPoint", "Kanji", "Lesson", "Question", "Word"]);
});

test("la shape Question impose stem, answer, ord, skill et difficulty", () => {
  const q = shapes().find((s) => s.targetClass.endsWith("#Question"));
  const paths = q.properties.map((p) => p.path.split("#").pop());
  for (const p of ["stem", "answer", "ord", "skill", "difficulty"]) expect(paths).toContain(p);
  expect(q.properties.find((p) => p.path.endsWith("#ord")).minCount).toBe(1);
});

test("difficulty utilise xsd:integer et NON un sh:in numérique", () => {
  // Oku fait filter_map(as_str) sur sh:in : « [1,2,3] » y deviendrait une liste vide
  // qui validerait n'importe quoi. La plage 1–3 est vérifiée côté impératif.
  const q = shapes().find((s) => s.targetClass.endsWith("#Question"));
  const d = q.properties.find((p) => p.path.endsWith("#difficulty"));
  expect(d.datatype).toBe("http://www.w3.org/2001/XMLSchema#integer");
  expect(d.allowedValues).toBeUndefined();
});

test("les prédicats de relation sont déclarés sh:nodeKind IRI", () => {
  const byClass = Object.fromEntries(shapes().map((s) => [s.targetClass.split("#").pop(), s]));
  const kind = (cls: string, pred: string) =>
    byClass[cls].properties.find((p) => p.path.endsWith("#" + pred))?.nodeKind;
  expect(kind("Question", "tests")).toBe("IRI");
  expect(kind("Word", "usesKanji")).toBe("IRI");
  expect(kind("Lesson", "covers")).toBe("IRI");
});

test("les niveaux JLPT sont énumérés en chaînes partout où ils apparaissent", () => {
  const withLevel = shapes()
    .flatMap((s) => s.properties.filter((p) => p.path.endsWith("#level")));
  expect(withLevel.length).toBeGreaterThan(0);
  for (const p of withLevel) expect(p.allowedValues).toEqual(["N5", "N4", "N3", "N2", "N1"]);
});

// --- de bout en bout : les shapes acceptent-elles les sujets réels ? -----------

const ctx = () => readContext(CONTEXT);

/** Les sujets d'exemple de la spec, un par type. */
const SUJETS = [
  { "@id": "jlpt:kanji/政", "@type": "jlpt:Kanji",
    "schema:name": "政", "schema:description": "politique, gouvernement",
    "jlpt:onReading": ["セイ", "ショウ"], "jlpt:kunReading": ["まつりごと"], "jlpt:level": "N3" },
  { "@id": "jlpt:word/影響", "@type": "jlpt:Word",
    "schema:name": "影響", "jlpt:reading": "えいきょう", "schema:description": "influence",
    "jlpt:level": "N3", "usesKanji": ["jlpt:kanji/影", "jlpt:kanji/響"] },
  { "@id": "jlpt:gram/tara", "@type": "jlpt:GrammarPoint",
    "jlpt:form": "〜たら", "jlpt:level": "N4",
    "schema:description": "quand / si… — condition ponctuelle",
    "jlpt:structure": "V(forme た) ＋ ら" },
  { "@id": "jlpt:q/0", "@type": "jlpt:Question",
    "jlpt:skill": "grammaire", "jlpt:difficulty": 1, "jlpt:ord": 0,
    "jlpt:stem": "家に帰っ___、電話します。",
    "opts": ["たら", "なら", "ば", "と"], "jlpt:answer": 0,
    "tests": ["jlpt:gram/tara"],
    "schema:description": "<b>〜たら</b> = « quand/dès que »." },
  { "@id": "jlpt:lesson/gram-conditionnel", "@type": "jlpt:Lesson",
    "schema:name": "Le conditionnel", "jlpt:order": 3, "jlpt:track": "gram",
    "covers": ["jlpt:gram/tara"] },
];

test("les cinq sujets d'exemple de la spec passent leurs shapes", () => {
  expect(validateAll(SUJETS, shapes(), ctx())).toEqual([]);
});

test("un sujet réel fautif est bien attrapé, shape par shape", () => {
  const casses = [
    { ...SUJETS[0], "jlpt:level": "N6" },                       // hors sh:in
    { ...SUJETS[1], "usesKanji": ["jlpt:kanji/a;b"] },          // IRI non sûre
    { ...SUJETS[3], "jlpt:difficulty": "1" },                   // chaîne, pas entier
    { ...SUJETS[4], "jlpt:order": -1 },                         // nonNegativeInteger
  ];
  const errs = validateAll(casses, shapes(), ctx());
  expect(errs).toHaveLength(4);
});

test("un prédicat non déclaré par la shape ne fait pas échouer (opts, optionNote)", () => {
  // Volontaire : ce sont des @list, dont la longueur et l'alignement se vérifient
  // côté impératif — un sh:maxCount compterait la liste, pas ses éléments.
  const q = { ...SUJETS[3], "jlpt:optionNote": ["a", "b", "c", "d"] };
  expect(validateAll([q], shapes(), ctx())).toEqual([]);
});
