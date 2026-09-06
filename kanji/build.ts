#!/usr/bin/env bun
// Compose le cahier. `bun run cahier`
//
// Le seul rôle de ce script est de décider si les diagrammes d'ordre des traits
// entrent dans le livre : Typst ne sait pas demander si un fichier existe, et
// `json()` sur un chemin absent est une erreur de compilation. On regarde donc
// ici, et on passe `--input traits=oui` seulement si la chaîne KanjiVG a tourné.
//
// Sans elle le livre se compose quand même, sans les diagrammes — et il reste
// alors entièrement libre de droits (cf. tools/kanjivg/fetch.mjs).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const INDEX = ".kanjivg/traits/index.json";
const SORTIE = process.argv[2] ?? "kanji/kanjis.pdf";
const surveille = process.env.CAHIER_WATCH === "1";

const traits = existsSync(INDEX);
if (!traits) {
  console.log("· Diagrammes d'ordre des traits ABSENTS — le livre se compose sans eux.");
  console.log("  Pour les avoir : bun tools/kanjivg/fetch.mjs && bun tools/kanjivg/strips.mjs");
  console.log("  (KanjiVG, CC BY-SA 3.0 : le PDF devient alors une œuvre dérivée.)");
}

const args = [
  surveille ? "watch" : "compile",
  "--root",
  ".",
  ...(traits ? ["--input", "traits=oui"] : []),
  "kanji/book.typ",
  SORTIE,
];
const r = spawnSync("typst", args, { stdio: "inherit" });
if (r.error) {
  console.error("✗ `typst` introuvable sur le PATH — https://typst.app/open-source/");
  process.exit(127);
}
process.exit(r.status ?? 1);
