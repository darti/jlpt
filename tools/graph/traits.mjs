// Pose `jlpt:strokeCount` sur data/graph/kanji.jsonld — le nombre de traits des 810 kanji.
//
//   bun tools/graph/traits.mjs --proposer   # → data/traits-kanji.json, depuis .kanjidic/ ou .kanjivg/
//   bun tools/graph/traits.mjs              # → pose jlpt:strokeCount sur kanji.jsonld
//
// ⚠ CETTE CHAÎNE N'EST PAS UNE CHAÎNE D'ARBITRAGE, ET C'EST DÉLIBÉRÉ.
//
// Une lecture s'arbitre : KANJIDIC en recense plusieurs, le cours en écrit une, et c'est
// l'auteur qui tranche. Un nombre de traits n'admet qu'une valeur — il est fixé par la
// forme normalisée du caractère, pas par la source qui le publie. Il n'y a donc rien à
// relire, et un fichier de « décisions » y serait un mensonge de forme. `data/traits-kanji.json`
// est une TABLE DE FAITS, régénérable et vérifiable, pas un relevé de jugements.
//
// ⚠ CE QUE CELA CHANGE À LA POSTURE LICENCIELLE — à lire avant de toucher au proposeur.
//
// Le dépôt tient jusqu'ici que rien de JMdict / KANJIDIC2 / KanjiVG n'entre dans le graphe.
// L'invariant visé était la REDISTRIBUTION d'une œuvre : une définition, un tracé. Un compte
// de traits n'en est pas une — c'est un entier, constaté, que toute source publie à
// l'identique parce qu'il n'y a qu'une bonne réponse. C'est précisément ce que le proposeur
// rend vérifiable : lancé avec les DEUX corpus présents, il compare KANJIDIC2 (`stroke_count`)
// et KanjiVG (nombre de tracés) et refuse d'écrire tant qu'ils divergent. Une table que deux
// sources indépendantes reproduisent n'est pas un emprunt à l'une d'elles.
//
// Ce qui reste intact, et doit le rester : AUCUN tracé n'entre dans le graphe. Les diagrammes
// d'ordre des traits restent hors dépôt (.kanjivg/), et seul le PDF en est une œuvre dérivée.
//
// L'applicateur suit l'invariant des autres chaînes : il AJOUTE ce qui manque, n'écrase
// jamais une valeur existante, et signale un désaccord au lieu de le résoudre. Le graphe
// fait autorité.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { graphPath, readGraph, readJson, writeGraph } from "./jsonld.mjs";
import { strokeCountOfCharacter } from "../kanjidic/parse.mjs";
import { cle, traits } from "../kanjivg/strips.mjs";

const KANJI = graphPath("kanji.jsonld");
const TABLE = "data/traits-kanji.json";
const XML_KANJIDIC = ".kanjidic/kanjidic2.xml";
const XML_KANJIVG = ".kanjivg/kanjivg.xml";

/** Le corpus plafonne à 22 traits (驚). La borne est posée plus haut, à 34 — le maximum
 *  des jōyō — parce qu'elle n'est pas là pour dire ce que le N3 contient mais pour
 *  attraper une valeur qui ne peut PAS être un compte de traits : un parsing qui dérive
 *  rend des milliers, pas 35. */
export const TRAITS_MAX = 34;

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const isKanji = (s) => arr(s["@type"]).includes("jlpt:Kanji");

/**
 * Comptes lus dans KANJIDIC2, pour les glyphes demandés.
 *
 * Le XML est découpé par `<character>` : chercher `<stroke_count>` sur le fichier entier
 * mêlerait les caractères, et un `literal` ne suffit pas à délimiter un bloc.
 */
export function countsFromKanjidic(xml, glyphes) {
  const voulus = new Set(glyphes);
  const out = new Map();
  for (const bloc of String(xml).split("<character>").slice(1)) {
    const m = /<literal>([^<]*)<\/literal>/.exec(bloc);
    if (!m || !voulus.has(m[1])) continue;
    const n = strokeCountOfCharacter(bloc);
    if (n !== undefined) out.set(m[1], n);
  }
  return out;
}

/**
 * Comptes lus dans KanjiVG : un tracé `<path>` = un trait, dans l'ordre du document.
 *
 * C'est exactement le comptage sur lequel `tools/kanjivg/strips.mjs` bâtit déjà ses bandes
 * — une case par trait. S'il était faux, les diagrammes le seraient aussi.
 */
export function countsFromKanjivg(xml, glyphes) {
  const out = new Map();
  for (const ch of glyphes) {
    const n = traits(xml, cle(ch)).length;
    if (n > 0) out.set(ch, n);
  }
  return out;
}

/**
 * Confronte deux relevés et rend `{ table, desaccords, sources }`.
 *
 * Un désaccord n'est pas arbitré : la table n'est écrite que si les sources concordent, et
 * c'est le seul contrôle qui vaille ici. Choisir silencieusement l'une des deux ferait
 * exactement ce que cette chaîne prétend éviter — verser un chiffre que rien ne confirme.
 */
export function reconcilier(releves) {
  const presents = releves.filter((r) => r.counts.size > 0);
  const table = {};
  const desaccords = [];
  const glyphes = [...new Set(presents.flatMap((r) => [...r.counts.keys()]))].sort();
  for (const ch of glyphes) {
    const vus = presents.filter((r) => r.counts.has(ch)).map((r) => ({ nom: r.nom, n: r.counts.get(ch) }));
    if (new Set(vus.map((v) => v.n)).size > 1) {
      desaccords.push(`${ch} : ${vus.map((v) => `${v.nom}=${v.n}`).join(", ")}`);
      continue;
    }
    table[ch] = vus[0].n;
  }
  return { table, desaccords, sources: presents.map((r) => r.nom) };
}

/**
 * Pose `jlpt:strokeCount` sur les sujets `jlpt:Kanji` qui n'en portent pas.
 *
 * Rend les sujets patchés et trois relevés : ce qui a été posé, les glyphes que la table
 * ignore, et les cas où le graphe portait DÉJÀ un compte différent — non appliqués, parce
 * que le graphe fait autorité et qu'un désaccord se regarde.
 *
 * ⚠ Le prédicat est inséré APRÈS `schema:description`, pas en fin d'objet : `writeGraph`
 * sérialise dans l'ordre des clés, et 810 sujets réordonnés au petit bonheur rendraient le
 * diff illisible là où une place fixe le garde ligne à ligne.
 */
export function applyStrokes(sujets, table) {
  const poses = [];
  const conflits = [];
  const absents = [];
  const out = sujets.map((s) => {
    if (!isKanji(s)) return s;
    const nom = s["schema:name"];
    const n = table[nom];
    if (!Number.isInteger(n) || n < 1 || n > TRAITS_MAX) {
      absents.push(nom);
      return s;
    }
    const actuel = s["jlpt:strokeCount"];
    if (actuel !== undefined) {
      if (actuel !== n) conflits.push(`${nom} : graphe=${actuel}, table=${n}`);
      return s;
    }
    poses.push(nom);
    const patch = {};
    for (const [k, v] of Object.entries(s)) {
      patch[k] = v;
      if (k === "schema:description") patch["jlpt:strokeCount"] = n;
    }
    if (patch["jlpt:strokeCount"] === undefined) patch["jlpt:strokeCount"] = n;
    return patch;
  });
  return { subjects: out, poses, conflits, absents };
}

function glyphesDuGraphe() {
  return readGraph(KANJI).subjects.filter(isKanji).map((s) => s["schema:name"]);
}

function proposer() {
  const glyphes = glyphesDuGraphe();
  const releves = [];
  if (existsSync(XML_KANJIDIC)) {
    releves.push({ nom: "KANJIDIC2", counts: countsFromKanjidic(readFileSync(XML_KANJIDIC, "utf8"), glyphes) });
  }
  if (existsSync(XML_KANJIVG)) {
    releves.push({ nom: "KanjiVG", counts: countsFromKanjivg(readFileSync(XML_KANJIVG, "utf8"), glyphes) });
  }
  if (releves.length === 0) {
    console.error(`✗ ni ${XML_KANJIDIC} ni ${XML_KANJIVG} — lancer d'abord :`);
    console.error("    bun tools/kanjidic/fetch.mjs   (ou)   bun tools/kanjivg/fetch.mjs");
    return 1;
  }

  const { table, desaccords, sources } = reconcilier(releves);
  if (desaccords.length) {
    console.error(`✗ ${desaccords.length} désaccord(s) entre ${sources.join(" et ")} — rien écrit :`);
    for (const d of desaccords.slice(0, 20)) console.error(`  ${d}`);
    return 1;
  }

  // Table triée par glyphe : l'ordre du graphe est celui d'un cours, il bouge. Un ordre
  // stable est ce qui rend le diff d'une régénération lisible.
  const ordonnee = Object.fromEntries(Object.keys(table).sort().map((ch) => [ch, table[ch]]));
  writeFileSync(TABLE, JSON.stringify(ordonnee, null, 1) + "\n");

  const manquants = glyphes.filter((ch) => !(ch in table));
  console.log(`✓ ${TABLE} — ${Object.keys(table).length} comptes, source(s) : ${sources.join(" + ")}`);
  if (sources.length === 1) {
    console.log(`  ⚠ une seule source : lancer l'autre chaîne pour faire vérifier la table.`);
  } else {
    console.log(`  ${sources.length} sources concordantes sur les ${Object.keys(table).length} glyphes.`);
  }
  if (manquants.length) console.log(`  ${manquants.length} kanji sans compte : ${manquants.slice(0, 20).join("")}`);
  console.log("  Puis : bun tools/graph/traits.mjs");
  return 0;
}

function appliquer() {
  if (!existsSync(TABLE)) {
    console.error(`✗ ${TABLE} absent — lancer d'abord : bun tools/graph/traits.mjs --proposer`);
    return 1;
  }
  const { doc, subjects } = readGraph(KANJI);
  const { subjects: patches, poses, conflits, absents } = applyStrokes(subjects, readJson(TABLE));
  if (poses.length) writeGraph(KANJI, doc, patches);

  console.log(`${poses.length} compte(s) posé(s) sur ${KANJI}`);
  if (absents.length) console.log(`  ${absents.length} kanji hors table : ${absents.slice(0, 20).join("")}`);
  if (conflits.length) {
    // Pas une erreur : le graphe fait autorité. Mais un désaccord silencieux serait pire
    // qu'un compte manquant — on le montre, on ne le corrige pas.
    console.log(`  ⚠ ${conflits.length} désaccord(s), NON appliqués (le graphe fait autorité) :`);
    for (const c of conflits.slice(0, 20)) console.log(`    ${c}`);
  }
  return 0;
}

if (process.argv[1]?.endsWith("traits.mjs")) {
  process.exit(process.argv.includes("--proposer") ? proposer() : appliquer());
}
