#!/usr/bin/env node
// Télécharge KANJIDIC2 dans .kanjidic/ — dossier GITIGNORÉ.
//
// ⚠ KANJIDIC2 est publié par l'EDRDG sous CC BY-SA 4.0, comme JMdict. Cette licence impose
// une attribution sur CHAQUE écran affichant du contenu du dictionnaire, et le ShareAlike sur
// tout jeu de données dérivé. Le projet a donc choisi de ne PAS redistribuer ses données :
// KANJIDIC ne sert qu'à PROPOSER des lectures (tools/kanjidic/propose.mjs), que l'auteur
// valide à la main. Ce sont ces saisies validées qui entrent dans le graphe.
//
//   https://www.edrdg.org/wiki/index.php/KANJIDIC_Project
//   https://www.edrdg.org/edrdg/licence.html
//
// Ne jamais commiter .kanjidic/, ne jamais le copier dans data/ ni dans _site/.
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";

const URL_SRC = "http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz";
export const DIR = ".kanjidic";
export const XML = `${DIR}/kanjidic2.xml`;

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
  console.log("  Source : KANJIDIC2, EDRDG, CC BY-SA 4.0 — non redistribué, non livré.");
  return 0;
}

if (process.argv[1]?.endsWith("fetch.mjs")) process.exit(await main());
