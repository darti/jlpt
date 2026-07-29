// Déplace le PARADIGME DE CONJUGAISON logé à tort dans schema:description de dix
// jlpt:GrammarPoint vers jlpt:structure, et pose dans schema:description la glose française
// arbitrée par l'auteur.
//
// Le défaut : une phase de cours affiche jlpt:structure en chasse fixe et
// schema:description en prose. Dix points de gram.jsonld portaient un paradigme
// (« 行く · 行かない · 行った · 行かなかった ») directement dans schema:description — repérable
// sans arbitrage, puisqu'aucune lettre latine n'y figure alors que toutes les autres
// descriptions du document sont en français. Résultat mesuré : la carte de cours affiche le
// paradigme deux fois (jlpt:form et description) et jamais de sens.
//
// La chaîne, même forme que les six précédentes :
//   1. le défaut est mesuré (aucune lettre latine dans schema:description, aucune
//      jlpt:structure déjà posée — rien à écraser)
//   2. l'auteur arbitre la glose et consigne dans data/formes-arbitrees.json
//   3. bun tools/graph/formes.mjs → patch de data/graph/gram.jsonld
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { graphPath, readGraph, readJson, writeGraph } from "./jsonld.mjs";

const DECISIONS = "data/formes-arbitrees.json";
const GRAM = graphPath("gram.jsonld");

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const isGrammarPoint = (s) => arr(s["@type"]).includes("jlpt:GrammarPoint");

/** Une description en français contient forcément une lettre latine. Ces dix entrées n'en
 *  portaient aucune : c'est ce qui les a désignées, sans heuristique ni faux positif. */
const HAS_LATIN = /[A-Za-z]/;

/**
 * Pose `jlpt:structure` et corrige `schema:description` sur les `jlpt:GrammarPoint` visés par
 * les décisions, indexées par `@id`.
 *
 * Deux invariants, comme les six chaînes précédentes : le graphe fait autorité, un désaccord
 * est signalé plutôt que résolu en silence — et rejouer l'outil sur un graphe déjà corrigé ne
 * change rien (idempotence). D'où deux gardes symétriques :
 *   - `jlpt:structure` existant → jamais écrasé (le champ est libre : sur ces dix entrées il
 *     n'y avait rien avant le premier passage, donc rien à perdre, mais l'invariant doit tenir
 *     même si une structure a été posée par ailleurs entre-temps) ;
 *   - `schema:description` qui contient déjà une lettre latine → déjà glosée, jamais écrasée.
 * Dans les deux cas, si la valeur en place diffère de la décision, c'est un conflit signalé ;
 * si elle coïncide déjà (rejeu), ce n'est pas une erreur, juste un no-op.
 */
export function applyFormes(sujets, decisions) {
  const vises = new Set(Object.keys(decisions));
  const poses = [];
  const conflits = [];
  const out = sujets.map((s) => {
    if (!isGrammarPoint(s)) return s;
    const id = s["@id"];
    if (typeof id !== "string" || !(id in decisions)) return s;
    vises.delete(id);
    const { structure, description } = decisions[id];
    let patch = null;
    let change = false;

    const structureActuelle = s["jlpt:structure"];
    if (typeof structureActuelle === "string" && structureActuelle) {
      if (structureActuelle !== structure) conflits.push(id);
    } else if (structure) {
      patch = { ...(patch ?? s), "jlpt:structure": structure };
      change = true;
    }

    const descriptionActuelle = String(s["schema:description"] ?? "");
    if (HAS_LATIN.test(descriptionActuelle)) {
      if (descriptionActuelle !== description) conflits.push(id);
    } else if (description) {
      patch = { ...(patch ?? s), "schema:description": description };
      change = true;
    }

    if (change) poses.push(id);
    return patch ?? s;
  });
  return { sujets: out, poses: poses.length, formes: poses, conflits, inconnus: [...vises] };
}

if (import.meta.main) {
  const decisions = readJson(DECISIONS);
  // La clé `_` du fichier de décisions est un commentaire d'auteur, pas une décision.
  const { _, ...corrections } = decisions;
  const { doc, subjects } = readGraph(GRAM);
  const { sujets, poses, conflits, inconnus } = applyFormes(subjects, corrections);
  writeGraph(GRAM, doc, sujets);

  console.log(`${poses} forme(s) corrigée(s) sur ${GRAM}`);
  if (conflits.length) {
    console.log(`⚠ ${conflits.length} décision(s) ignorée(s) — le graphe porte déjà une autre`);
    console.log(`  valeur (il fait autorité) : ${conflits.join(", ")}`);
  }
  if (inconnus.length) {
    console.log(`⚠ ${inconnus.length} décision(s) sans point de grammaire correspondant : ${inconnus.join(", ")}`);
  }
  console.log("Relancer `bun tools/validate-graph.mjs` pour confirmer.");
}
