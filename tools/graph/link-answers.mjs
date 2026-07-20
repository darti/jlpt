#!/usr/bin/env node
// Pose l'arête `tests` des questions de VOCABULAIRE et de KANJI depuis leur réponse.
//
// Pourquoi c'était manquant. La migration dérivait l'arête du sujet entre 「…」 de l'énoncé.
// Or les questions d'écriture — « 「えいきょう」を漢字で書くと？ » — mettent la LECTURE entre
// 「…」, pas le mot : la résolution cherchait `jlpt:word/えいきょう`, qui n'existe pas, et
// abandonnait. Le mot testé était dans la réponse depuis le début. 3 571 questions étaient
// dans ce cas, soit 35 % du corpus.
//
// ⚠ Grammaire, lecture et écoute sont EXCLUES. Les réponses de grammaire sont des formes
// fléchies (食べられた, お座り, 撮って) entrées dans word.jsonld par le minage des options :
// les lier afficherait une conjugaison comme s'il s'agissait d'un mot du référentiel.
//
// ⚠ Idempotent, et n'écrase JAMAIS une arête existante — même invariant que readings.mjs.
// Ce n'est pas un générateur : il ajoute ce qui manque, il ne régénère rien.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "data/graph";
/** Les seules pistes où la réponse EST l'entité testée. */
const PISTES = { vocabulaire: "q-vocabulaire", kanji: "q-kanji" };

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/**
 * L'IRI de l'entité qu'une question teste, lue sur sa réponse. `null` si la piste n'est pas
 * concernée, ou si la réponse ne correspond à aucune entité du graphe.
 *
 * Le mot l'emporte sur le kanji à nom égal : 約束 est un mot, pas un caractère.
 */
export function edgeFromAnswer(question, known) {
  if (!(question["jlpt:skill"] in PISTES)) return null;
  const rep = String(arr(question.opts)[question["jlpt:answer"]] ?? "").trim();
  if (!rep) return null;
  for (const iri of [`jlpt:word/${rep}`, `jlpt:kanji/${rep}`]) {
    if (known.has(iri)) return iri;
  }
  return null;
}

/** Pose l'arête sur les sujets qui n'en portent pas. Rend les sujets patchés et le compte. */
export function applyAnswerEdges(sujets, known) {
  const mots = [];
  const out = sujets.map((s) => {
    if (arr(s.tests).length) return s;
    const iri = edgeFromAnswer(s, known);
    if (!iri) return s;
    mots.push(s["@id"]);
    return { ...s, tests: [iri] };
  });
  return { sujets: out, poses: mots.length, questions: mots };
}

if (process.argv[1]?.endsWith("link-answers.mjs")) {
  const known = new Set(
    ["word", "kanji"].flatMap((n) => J(`${DIR}/${n}.jsonld`)["@graph"].map((s) => s["@id"])),
  );

  let total = 0;
  for (const shard of Object.values(PISTES)) {
    const chemin = `${DIR}/${shard}.jsonld`;
    const doc = J(chemin);
    const { sujets, poses } = applyAnswerEdges(doc["@graph"] ?? [], known);
    writeFileSync(chemin, JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n");
    console.log(`${shard} : ${poses} arête(s) posée(s)`);
    total += poses;
  }
  console.log(`\n${total} au total. Relancer \`bun tools/validate-graph.mjs\` pour confirmer.`);
}
