#!/usr/bin/env node
// Produit un document d'ARBITRAGE : pour chaque mot du graphe sans lecture, ou dont les
// deux sources divergeaient, propose la lecture que JMdict donne.
//
// ⚠ Aucune donnée JMdict n'entre dans le graphe par ce script. Sa sortie est un document
// que l'auteur relit et valide ; ce sont ses décisions, consignées dans
// data/lectures-arbitrees.json, que la migration consulte. C'est ce qui permet de se
// passer des obligations CC BY-SA (attribution sur chaque écran, ShareAlike sur le jeu
// dérivé) : on ne redistribue pas JMdict, on s'en sert pour décider.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { createReadStream, existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { readDoc } from "../graph/jsonld.mjs";
import { readingsOfEntry, bestReading } from "./parse.mjs";

const XML = ".jmdict/JMdict_e.xml";
const SORTIE = "docs/superpowers/plans/2026-07-20-lectures-a-arbitrer.md";
const DECISIONS = "data/lectures-arbitrees.json";

/** Balaie le XML entrée par entrée, sans jamais le charger en entier (60 Mo).
 *  Ne retient que les formes qui nous intéressent : le reste est jeté au fil de l'eau. */
export async function scanJmdict(path, voulus) {
  const index = new Map();
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let buf = "";
  let dans = false;
  for await (const ligne of rl) {
    if (ligne.includes("<entry>")) { dans = true; buf = ""; }
    if (dans) buf += ligne + "\n";
    if (ligne.includes("</entry>")) {
      dans = false;
      for (const p of readingsOfEntry(buf)) {
        if (!voulus.has(p.keb)) continue;
        if (!index.has(p.keb)) index.set(p.keb, []);
        index.get(p.keb).push(p);
      }
      buf = "";
    }
  }
  return index;
}

async function main() {
  if (!existsSync(XML)) {
    console.error(`✗ ${XML} absent — lancer d'abord : bun tools/jmdict/fetch.mjs`);
    return 1;
  }
  const mots = readDoc("data/graph/word.jsonld", "data/graph/context.jsonld").subjects;
  const sansLecture = mots.filter((m) => !m["jlpt:reading"]);
  const voulus = new Set(sansLecture.map((m) => m["schema:name"]));

  console.log(`${mots.length} mots dans le graphe, ${sansLecture.length} sans lecture.`);
  console.log(`Balayage de ${XML} …`);
  const index = await scanJmdict(XML, voulus);

  const lignes = [];
  let proposees = 0;
  for (const m of sansLecture) {
    const nom = m["schema:name"];
    const paires = index.get(nom) ?? [];
    const prop = bestReading(paires);
    if (prop) proposees++;
    const autres = [...new Set(paires.map((p) => p.reb))].filter((r) => r !== prop);
    lignes.push(`| ${nom} | ${prop ?? "—"} | ${autres.join(" · ") || "—"} |`);
  }

  writeFileSync(SORTIE,
    `# Lectures à arbitrer\n\n`
    + `${sansLecture.length} mots du graphe sont sans lecture. JMdict en propose ${proposees}.\n\n`
    + `**Comment s'en servir.** Chaque proposition est une SUGGESTION à valider, pas une\n`
    + `donnée acquise : reporte les lectures que tu retiens dans \`${DECISIONS}\`, sous la\n`
    + `forme \`{ "影響": "えいきょう" }\`. La migration ne lit que ce fichier — jamais JMdict.\n\n`
    + `> Propositions établies à partir de JMdict (EDRDG, CC BY-SA 4.0,\n`
    + `> https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project). Ce document\n`
    + `> est un outil de travail : ni JMdict ni ce fichier ne sont livrés avec l'application.\n\n`
    + `| mot | proposition JMdict | autres lectures attestées |\n|---|---|---|\n`
    + lignes.join("\n") + "\n");

  console.log(`✓ ${SORTIE}`);
  console.log(`  ${proposees}/${sansLecture.length} mots ont une proposition ; ${sansLecture.length - proposees} restent sans piste.`);
  return 0;
}

if (process.argv[1]?.endsWith("propose.mjs")) process.exit(await main());
