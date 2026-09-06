#!/usr/bin/env node
// Télécharge KanjiVG dans .kanjivg/ — dossier GITIGNORÉ.
//
// ⚠ CE FICHIER EST DIFFÉRENT DES DEUX AUTRES CHAÎNES, ET LA DIFFÉRENCE EST LICENCIELLE.
//
// JMdict et KANJIDIC2 servent à PROPOSER : l'auteur arbitre, et ce sont ses saisies qui
// entrent dans le graphe. Rien de la source n'est redistribué, donc rien n'est contaminé.
//
// Un ordre de traits ne s'arbitre pas : c'est un TRACÉ, et l'afficher, c'est le redistribuer.
// KanjiVG est publié par Ulrich Apel sous CC BY-SA 3.0. En conséquence :
//
//   * le graphe `data/graph/` n'est PAS touché — l'app reste libre de toute attribution ;
//   * seul le PDF `kanji/kanjis.pdf` incorpore ces tracés. Il devient une œuvre dérivée :
//     attribution obligatoire (elle est imprimée sur sa page de crédits) et ShareAlike si
//     vous le DISTRIBUEZ. Pour un cahier d'usage personnel, rien de tout cela ne se pose ;
//   * .kanjivg/ n'est jamais commité, jamais copié dans data/ ni dans _site/.
//
// Si cette contrainte n'est pas acceptable, la parade est de ne pas composer les diagrammes :
// `bun run cahier --input traits=non` les retire, et le livre redevient entièrement à vous.
//
//   https://kanjivg.tagaini.net/
//   https://creativecommons.org/licenses/by-sa/3.0/
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";

const VERSION = "r20240807";
const URL_SRC = `https://github.com/KanjiVG/kanjivg/releases/download/${VERSION}/kanjivg-20240807.xml.gz`;
export const DIR = ".kanjivg";
export const XML = `${DIR}/kanjivg.xml`;

async function main() {
  if (existsSync(XML)) {
    const mo = (statSync(XML).size / 1048576).toFixed(0);
    console.log(`${XML} déjà présent (${mo} Mo) — rien à faire.`);
    return 0;
  }
  mkdirSync(DIR, { recursive: true });
  console.log(`Téléchargement de ${URL_SRC} …`);
  const res = await fetch(URL_SRC);
  if (!res.ok) {
    console.error(`✗ HTTP ${res.status}`);
    return 1;
  }
  await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream(XML));
  console.log(`✓ ${XML} (${(statSync(XML).size / 1048576).toFixed(0)} Mo, décompressé)`);
  console.log("  Source : KanjiVG, Ulrich Apel, CC BY-SA 3.0 — hors dépôt, jamais commité.");
  return 0;
}

if (process.argv[1]?.endsWith("fetch.mjs")) process.exit(await main());
