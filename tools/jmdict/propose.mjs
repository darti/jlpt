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
import { toHiragana } from "../graph/readings.mjs";

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

/**
 * Le bloc de décisions prêt à coller : mot → lecture proposée, pour les seuls mots où JMdict
 * en propose une.
 *
 * ⚠ La lecture est repliée en HIRAGANA ici, et pas seulement au moment de l application :
 * readings.mjs le fait de toute façon (une lecture de mot sert de furigana), et un bloc qui
 * afficherait « カイ » là où « かい » atterrit ferait une transformation silencieuse APRÈS
 * validation. Ce qu on relit doit être ce qui entre dans le graphe.
 *
 * ⚠ AIDE À LA SAISIE, pas décision. Ce bloc vit dans le document de propositions ; le copier
 * dans data/ reste un geste de l auteur — c est cette étape qui fait que le graphe porte une
 * décision humaine et non une extraction d un jeu sous CC BY-SA.
 */
export function blocDecisions(sansLecture, index) {
  const sures = {};
  const aArbitrer = [];
  for (const m of sansLecture) {
    const nom = m["schema:name"];
    const paires = index.get(nom) ?? [];
    if (!paires.length) continue;

    const lectures = [...new Set(paires.map((p) => toHiragana(p.reb)))];
    if (lectures.length === 1) { sures[nom] = lectures[0]; continue; }

    // Concurrence : JMdict tranche lui-même s'il marque UNE lecture comme plus courante
    // (`*_pri`). Sinon on ne tranche pas — le critère « la plus courte » de bestReading n'a
    // aucun rapport avec la justesse, et donnait 構 → かじ (le mûrier à papier) contre かまえ.
    const maxPri = Math.max(...paires.map((p) => p.pri));
    const tetes = [...new Set(paires.filter((p) => p.pri === maxPri).map((p) => toHiragana(p.reb)))];
    if (maxPri > 0 && tetes.length === 1) sures[nom] = tetes[0];
    else aArbitrer.push({ mot: nom, lectures });
  }
  return { sures, aArbitrer };
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
  const { sures, aArbitrer } = blocDecisions(sansLecture, index);
  const monoBloc = Object.keys(sures).filter((m) => [...m].length === 1).length;

  writeFileSync(SORTIE,
    `# Lectures à arbitrer\n\n`
    + `${sansLecture.length} mots du graphe sont sans lecture. JMdict en propose ${proposees}.\n\n`
    + `**Ces propositions ne sont PAS dans le graphe.** Rien n'entre dans \`word.jsonld\` — un\n`
    + `fichier LIVRÉ — sans passer par une saisie à la main dans \`${DECISIONS}\`. C'est ce qui\n`
    + `évite l'attribution CC BY-SA sur chaque écran et le ShareAlike sur \`data/graph/\`.\n\n`
    + `## Marche à suivre\n\n`
    + `1. Le bloc ci-dessous ne contient QUE les ${Object.keys(sures).length} mots dont la lecture\n`
    + `   ne fait pas de doute : JMdict n'en connaît qu'une, ou en marque une comme nettement\n`
    + `   plus courante. Le relire, puis le copier dans \`${DECISIONS}\`.\n`
    + `2. Les ${aArbitrer.length} mots à lectures **concurrentes** sont listés à part, plus bas.\n`
    + `   Ils demandent un choix de sens, et aucune heuristique ne peut le faire : départager\n`
    + `   par « la lecture la plus courte » donnait 構 → かじ, le mûrier à papier, au lieu de\n`
    + `   かまえ. Choisir à la main, ajouter au même fichier.\n`
    + `3. \`bun tools/graph/readings.mjs\` — idempotent, n'écrase jamais une lecture existante.\n`
    + `4. \`bun tools/validate-graph.mjs\` pour confirmer.\n\n`
    + `> ⚠ **JMdict est un dictionnaire de MOTS, et ce qui reste est surtout du kanji isolé.**\n`
    + `> ${monoBloc}/${Object.keys(sures).length} entrées du bloc sont des kanji seuls, pour\n`
    + `> lesquels JMdict donne la lecture du *nom* — souvent obscure : 温 → ぬく (tiède) plutôt\n`
    + `> que おん, 覚 → さとり (l'éveil) plutôt que かく. Or leur entité \`jlpt:Kanji\` porte DÉJÀ\n`
    + `> ses lectures on/kun, arbitrées depuis KANJIDIC2. Avant de coller, se demander si ces\n`
    + `> entrées doivent seulement exister comme mots.\n\n`
    + `<details>\n<summary>Bloc prêt à coller — ${Object.keys(sures).length} lectures sans`
    + ` concurrence, <strong>à relire avant de valider</strong></summary>\n\n`
    + "```json\n" + JSON.stringify(sures, null, 2) + "\n```\n\n</details>\n\n"
    + (aArbitrer.length
      ? `## ${aArbitrer.length} mots à trancher — plusieurs lectures attestées\n\n`
        + `| mot | lectures attestées |\n|---|---|\n`
        + aArbitrer.map((a) => `| ${a.mot} | ${a.lectures.join(" · ")} |`).join("\n") + "\n\n"
      : "")
    + `> Propositions établies à partir de JMdict (EDRDG, CC BY-SA 4.0,\n`
    + `> https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project). Ce document\n`
    + `> est un outil de travail : ni JMdict ni ce fichier ne sont livrés avec l'application.\n\n`
    + `## Toutes les propositions, pour mémoire\n\n`
    + `| mot | proposition JMdict | autres lectures attestées |\n|---|---|---|\n`
    + lignes.join("\n") + "\n");

  console.log(`✓ ${SORTIE}`);
  console.log(`  ${Object.keys(sures).length} lectures sans concurrence (bloc prêt à coller)`);
  console.log(`  ${aArbitrer.length} à trancher (lectures concurrentes)`);
  console.log(`  ${sansLecture.length - proposees} sans piste dans JMdict`);
  return 0;
}

if (process.argv[1]?.endsWith("propose.mjs")) process.exit(await main());
