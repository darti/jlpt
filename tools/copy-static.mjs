// Copie les fichiers *livrés* (hors bundle JS/CSS produit par `bun build`) dans _site/,
// pour que `bunx serve _site` en local soit STRICTEMENT identique au déploiement Pages.
//
// SOURCE UNIQUE de la liste des fichiers livrés : `bun run build` ET `.github/workflows/deploy.yml`
// passent par ce script. Sans lui, _site/sw.js (+ data/, manifest, icônes, stubs) restaient
// périmés en local — l'app servait une vieille version et « Forcer la mise à jour » ne changeait
// rien (le serveur renvoyait toujours l'ancien sw.js). Cf. scripts/dev.ts (même inventaire).
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";

const OUT = "_site";

// Fichiers racine livrés : stubs de redirection (anciennes URL → routes hash), PWA, icônes, doc.
export const ROOT = [
  "quiz.html", "app-n3.html",
  "manifest.webmanifest", "sw.js",
  "icon-180.png", "icon-192.png", "icon-512.png",
  "README.md",
];

// Données chargées au runtime par le React : documents du graphe (questions, corpus, mots,
// entités), banques du quiz (+ index), dictionnaire, cours.
// (Même sélection que scripts/dev.ts STATIC_FILES — grammar/kanji/vocab.json ne sont pas servis.)
//
// ⚠ Les `.jsonld` vivent dans le SOUS-répertoire data/graph/, pas à la racine de data/ :
// `copyStatic` l'énumère à part et repasse par ce même prédicat. Un seul inventaire, donc,
// et le test qui garde ce prédicat garde vraiment ce qui est livré.
export const isServedData = (f) =>
  /^bank-.*\.json$/.test(f) || f === "dict.json" || /^cours-.*\.json$/.test(f)
  || /\.jsonld$/.test(f);

export function copyStatic() {
  mkdirSync(`${OUT}/data`, { recursive: true });
  mkdirSync(`${OUT}/data/graph`, { recursive: true });
  const dataFiles = readdirSync("data").filter((f) => f !== "graph").filter(isServedData);
  const graphFiles = existsSync("data/graph") ? readdirSync("data/graph").filter(isServedData) : [];
  let n = 0;
  for (const f of ROOT) {
    if (!existsSync(f)) { console.warn(`  ⚠ ${f} absent — ignoré`); continue; }
    copyFileSync(f, `${OUT}/${f}`); n++;
  }
  for (const f of dataFiles) { copyFileSync(`data/${f}`, `${OUT}/data/${f}`); n++; }
  for (const f of graphFiles) { copyFileSync(`data/graph/${f}`, `${OUT}/data/graph/${f}`); n++; }
  console.log(
    `✓ ${n} fichiers livrés copiés dans ${OUT}/ `
    + `(dont data/ : ${dataFiles.length}, data/graph/ : ${graphFiles.length})`,
  );
  return n;
}

// Effet de bord uniquement quand exécuté directement (`bun tools/copy-static.mjs`),
// jamais à l'import (tests) — sinon importer le module lancerait la copie.
if (import.meta.main) copyStatic();
