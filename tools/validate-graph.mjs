#!/usr/bin/env node
// Valide data/graph/ : shapes SHACL (sous-ensemble Oku) + contrôles impératifs.
// Zéro dépendance, exécuté par `bun`. Exit 1 si invalide.
//
// SEUL validateur du dépôt : data/ ne contient plus que data/graph/.
import { existsSync, readdirSync } from "node:fs";
import { readContext, readDoc } from "./graph/jsonld.mjs";
import { parseShapes, validateAll } from "./graph/shacl.mjs";
import { checkQuestion, checkCorpus } from "./graph/integrity.mjs";

const DIR = "data/graph";
const CONTEXT = `${DIR}/context.jsonld`;
const SHAPES = `${DIR}/shapes.jsonld`;

const isQuestion = (s) => {
  const t = s["@type"];
  return (Array.isArray(t) ? t : [t]).includes("jlpt:Question");
};

function main() {
  for (const f of [DIR, CONTEXT, SHAPES]) {
    if (!existsSync(f)) {
      console.error(`✗ ${f} absent`);
      return 1;
    }
  }

  const context = readContext(CONTEXT);
  const shapes = parseShapes(readDoc(SHAPES, CONTEXT).subjects, context.prefixes);

  const dataFiles = readdirSync(DIR)
    .filter((f) => f.endsWith(".jsonld") && f !== "context.jsonld" && f !== "shapes.jsonld")
    .sort();

  const subjects = [];
  for (const f of dataFiles) subjects.push(...readDoc(`${DIR}/${f}`, CONTEXT).subjects);

  const errors = [
    ...validateAll(subjects, shapes, context),
    ...subjects.filter(isQuestion).flatMap(checkQuestion),
    ...checkCorpus(subjects),
  ];

  const byType = {};
  for (const s of subjects) {
    const t = (Array.isArray(s["@type"]) ? s["@type"][0] : s["@type"]) ?? "(sans type)";
    byType[t] = (byType[t] ?? 0) + 1;
  }
  console.log(`${dataFiles.length} documents, ${subjects.length} sujets, ${shapes.length} shapes`);
  for (const [t, n] of Object.entries(byType).sort()) console.log(`  ${t.padEnd(24)} ${n}`);

  if (errors.length) {
    console.error(`\n✗ ${errors.length} erreur(s) :`);
    for (const e of errors.slice(0, 50)) console.error(`  ${e}`);
    if (errors.length > 50) console.error(`  … +${errors.length - 50} autres`);
    return 1;
  }
  console.log("\n✓ graphe valide");
  return 0;
}

process.exit(main());
