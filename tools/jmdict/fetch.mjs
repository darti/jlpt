#!/usr/bin/env node
// Télécharge JMdict_e dans .jmdict/ — dossier GITIGNORÉ.
//
// ⚠ JMdict est publié par l'EDRDG sous CC BY-SA 4.0. Cette licence impose une
// attribution sur CHAQUE écran affichant du contenu du dictionnaire, et le ShareAlike
// sur tout jeu de données dérivé. Le projet a donc choisi de ne PAS redistribuer ses
// données : JMdict sert uniquement à PROPOSER des lectures (tools/jmdict/propose.mjs),
// que l'auteur valide à la main. Ce sont ces saisies validées qui entrent dans le graphe.
//
//   https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project
//   https://www.edrdg.org/edrdg/licence.html
//
// Ne jamais commiter .jmdict/, ne jamais le copier dans data/ ni dans _site/.
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";

const URL_SRC = "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz";
export const DIR = ".jmdict";
export const XML = `${DIR}/JMdict_e.xml`;

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
  console.log("  Source : JMdict, EDRDG, CC BY-SA 4.0 — non redistribué, non livré.");
  return 0;
}

if (process.argv[1]?.endsWith("fetch.mjs")) process.exit(await main());
