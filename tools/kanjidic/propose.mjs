#!/usr/bin/env node
// Produit un document d'ARBITRAGE : pour chaque kanji du graphe sans lecture, propose celle
// que KANJIDIC2 donne.
//
// ⚠ Aucune donnée KANJIDIC n'entre dans le graphe par ce script. Sa sortie est un document
// que l'auteur relit et valide ; ce sont ses décisions, consignées dans
// data/lectures-kanji-arbitrees.json, que tools/graph/readings.mjs applique. C'est ce qui
// permet de se passer des obligations CC BY-SA (attribution sur chaque écran, ShareAlike sur
// le jeu dérivé) : on ne redistribue pas KANJIDIC, on s'en sert pour décider.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { createReadStream, existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { readDoc } from "../graph/jsonld.mjs";
import { readingsOfCharacter, formatLecture, elaguer } from "./parse.mjs";

const XML = ".kanjidic/kanjidic2.xml";
const SORTIE = "docs/superpowers/plans/2026-07-20-kanji-a-arbitrer.md";
const DECISIONS = "data/lectures-kanji-arbitrees.json";

/** Balaie le XML caractère par caractère, sans jamais le charger en entier.
 *  Ne retient que les kanji voulus : le reste est jeté au fil de l'eau. */
export async function scanKanjidic(path, voulus) {
  const index = new Map();
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let buf = "";
  let dans = false;
  for await (const ligne of rl) {
    if (ligne.includes("<character>")) { dans = true; buf = ""; }
    if (dans) buf += ligne + "\n";
    if (ligne.includes("</character>")) {
      dans = false;
      const c = readingsOfCharacter(buf);
      if (c.literal && voulus.has(c.literal)) index.set(c.literal, c);
      buf = "";
    }
  }
  return index;
}

async function main() {
  if (!existsSync(XML)) {
    console.error(`✗ ${XML} absent — lancer d'abord : bun tools/kanjidic/fetch.mjs`);
    return 1;
  }
  const kanji = readDoc("data/graph/kanji.jsonld", "data/graph/context.jsonld").subjects;
  const sans = kanji.filter((k) => !k["jlpt:onReading"] && !k["jlpt:kunReading"]);
  const voulus = new Set(sans.map((k) => k["schema:name"]));

  console.log(`${kanji.length} kanji dans le graphe, ${sans.length} sans lecture.`);
  console.log(`Balayage de ${XML} …`);
  const index = await scanKanjidic(XML, voulus);

  const lignes = [];
  const elaguees = {};
  let sansProposition = 0;
  for (const k of sans) {
    const nom = k["schema:name"];
    const c = index.get(nom);
    if (!c || (!c.on.length && !c.kun.length)) { sansProposition++; continue; }
    const complet = formatLecture(c.on, c.kun);
    const court = elaguer(c.on, c.kun);
    const courte = [...court.on, ...court.kun].join("・");
    if (courte) elaguees[nom] = courte;
    // La colonne « toutes » reste affichée : c est elle qui permet de contester l élagage.
    lignes.push(`| ${nom} | ${k["schema:description"] ?? ""} | ${c.sens} | \`${courte}\` | \`${complet}\` |`);
  }

  writeFileSync(SORTIE,
    `# Lectures de kanji à arbitrer\n\n`
    + `${sans.length} kanji du graphe n'ont aucune lecture. KANJIDIC2 en propose ${lignes.length}`
    + `${sansProposition ? ` (${sansProposition} sans proposition)` : ""}.\n\n`
    + `**Ces propositions ne sont PAS dans le graphe.** Rien n'entre dans \`kanji.jsonld\` — un\n`
    + `fichier LIVRÉ — sans passer par une saisie à la main dans \`${DECISIONS}\`. C'est ce qui\n`
    + `évite l'attribution CC BY-SA sur chaque écran et le ShareAlike sur \`data/graph/\`.\n\n`
    + `## Marche à suivre\n\n`
    + `1. Parcourir la colonne **proposé**, en s'aidant de la dernière colonne pour contester\n`
    + `   l'élagage : KANJIDIC recense TOUTES les lectures attestées, la proposition n'en garde\n`
    + `   qu'une par type (première lecture on ; première kun qui ne soit pas un affixe).\n`
    + `2. Copier le bloc ci-dessous dans \`${DECISIONS}\`, **corriger ce qui doit l'être**, et\n`
    + `   retirer les lignes dont on ne veut pas.\n`
    + `3. \`bun tools/graph/readings.mjs\` — idempotent, n'écrase jamais une lecture existante.\n`
    + `4. \`bun tools/validate-graph.mjs\` pour confirmer.\n\n`
    + `<details>\n<summary>Bloc prêt à coller — <strong>à relire avant de valider</strong></summary>\n\n`
    + "```json\n" + JSON.stringify(elaguees, null, 2) + "\n```\n\n</details>\n\n"
    + `| kanji | sens (graphe) | sens (KANJIDIC) | **proposé** | toutes les lectures KANJIDIC |\n|---|---|---|---|---|\n`
    + `${lignes.join("\n")}\n`);

  console.log(`✓ ${SORTIE} — ${lignes.length} propositions`);
  if (sansProposition) console.log(`  ${sansProposition} kanji sans lecture dans KANJIDIC`);
  console.log(`  Reporter les décisions dans ${DECISIONS}, puis : bun tools/graph/readings.mjs`);
  return 0;
}

if (process.argv[1]?.endsWith("propose.mjs")) process.exit(await main());
