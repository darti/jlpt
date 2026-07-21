#!/usr/bin/env node
// Pose `jlpt:trapKind` sur chaque option, depuis sa note (`jlpt:optionNote`).
//
// ⚠ Idempotent, et n'écrase JAMAIS un tableau existant — même invariant que readings.mjs
// et link-answers.mjs. Ce n'est pas un générateur : il ajoute ce qui manque. Corriger un type
// à la main dans le graphe est donc définitif ; pour re-dériver une question, supprimer son
// champ.
//
// ⚠ PÉRIMÈTRE : kanji et vocabulaire, et eux seuls. La grammaire n'atteint que 20 % de typage
// (un distracteur de grammaire est presque toujours « un autre point, de valeur différente » :
// le type y est constant, donc muet), et l'écoute comme la lecture testent la compréhension,
// pas la forme. LA PRÉSENCE DU CHAMP DÉFINIT LE PÉRIMÈTRE — c'est ce qui permet au runtime de
// distinguer « hors périmètre » de « dans le périmètre mais non classé ».
//
// ⚠ Revue post-implémentation : `jlpt:answer` absent ou hors bornes n'a aucun index qui
// matche `i === ans` — SANS garde, la bonne réponse recevrait elle aussi un `trapKind`, en
// silence, ce qui romprait l'invariant « case vide = bonne réponse ». Mesuré sur le corpus
// réel : 0 occurrence sur les 9049 questions à options des deux shards (`jlpt:answer` y est
// toujours un entier dans les bornes) — donc aucun sujet réel n'est concerné aujourd'hui. Le
// garde ci-dessous suit quand même la convention du dépôt (`readings.mjs` : signaler un
// désaccord au lieu de le résoudre en silence) plutôt que de compter sur cette mesure pour
// rester vraie indéfiniment.
//
// Zéro dépendance, exécuté par `bun`.
import { readFileSync, writeFileSync } from "node:fs";
import { trapKind } from "./trap-kinds.mjs";

const DIR = "data/graph";

/** Les seuls shards typés. */
export const SHARDS = ["q-kanji", "q-vocabulaire"];

/**
 * Pose le tableau sur les sujets qui n'en portent pas. Rend les sujets patchés, le compte, et
 * les sujets ignorés faute de `jlpt:answer` exploitable (ni posés, ni comptés dans `poses`).
 */
export function applyTrapKinds(sujets) {
  let poses = 0;
  const invalides = [];
  const out = sujets.map((s) => {
    if (Array.isArray(s["jlpt:trapKind"])) return s;
    const opts = Array.isArray(s.opts) ? s.opts : [];
    if (!opts.length) return s;
    const ans = s["jlpt:answer"];
    if (!Number.isInteger(ans) || ans < 0 || ans >= opts.length) {
      invalides.push(s["@id"]);
      return s;
    }
    const notes = Array.isArray(s["jlpt:optionNote"]) ? s["jlpt:optionNote"] : [];
    poses++;
    return { ...s, "jlpt:trapKind": opts.map((_, i) => (i === ans ? "" : trapKind(notes[i]))) };
  });
  return { sujets: out, poses, invalides };
}

if (process.argv[1]?.endsWith("traps.mjs")) {
  let total = 0;
  for (const shard of SHARDS) {
    const chemin = `${DIR}/${shard}.jsonld`;
    const doc = JSON.parse(readFileSync(chemin, "utf8"));
    const { sujets, poses, invalides } = applyTrapKinds(doc["@graph"] ?? []);
    writeFileSync(chemin, JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n");
    console.log(`${shard} : ${poses} question(s) typée(s)`);
    if (invalides.length) {
      console.log(`⚠ ${invalides.length} ignorée(s) — jlpt:answer absent ou hors bornes : ${invalides.join(", ")}`);
    }
    total += poses;
  }
  console.log(`\n${total} au total. Relancer \`bun tools/validate-graph.mjs\` pour confirmer.`);
}
