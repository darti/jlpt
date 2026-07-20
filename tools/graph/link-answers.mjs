#!/usr/bin/env node
// Pose l'arête `tests` d'une question depuis sa RÉPONSE — la bonne option EST l'entité testée.
//
// Pourquoi c'était manquant. La migration dérivait l'arête du sujet entre 「…」 de l'énoncé.
// Or les questions d'écriture — « 「えいきょう」を漢字で書くと？ » — mettent la LECTURE entre
// 「…」, pas le mot : la résolution cherchait `jlpt:word/えいきょう`, qui n'existe pas, et
// abandonnait. Le mot testé était dans la réponse depuis le début.
//
// ⚠ Chaque piste cherche dans SON référentiel, et c'est tout l'enjeu. Chercher une réponse
// de grammaire parmi les mots donne 食べられた, お座り, 撮って — des formes fléchies entrées
// dans word.jsonld par le minage des options, qui s'afficheraient comme des mots du
// référentiel. Cherchée dans gram.jsonld, la même réponse résout proprement.
//
// ⚠ LECTURE et ÉCOUTE restent exclues : leur réponse est un fragment de texte ou un choix
// de compréhension, pas une entité.
//
// ⚠ Idempotent, et n'écrase JAMAIS une arête existante — même invariant que readings.mjs.
// Ce n'est pas un générateur : il ajoute ce qui manque, il ne régénère rien.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "data/graph";
/** Les seules pistes où la réponse EST l'entité testée. */
const PISTES = { vocabulaire: "q-vocabulaire", kanji: "q-kanji" };
/** Toutes les pistes traitées, grammaire comprise — elle résout dans gram.jsonld. */
const SHARDS = { ...PISTES, grammaire: "q-grammaire" };

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** Forme de grammaire → segment d'IRI. Même règle que le reste du graphe. */
const slugify = (form) =>
  String(form ?? "").replace(/〜/g, "").replace(/\s*\/\s*/g, "-")
    .replace(/[\s'\\;*]/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

/** Index forme normalisée → IRI, formes alternatives comprises. */
export function gramIndex(sujets) {
  const index = new Map();
  for (const g of sujets) {
    const iri = g["@id"];
    for (const f of [g["jlpt:form"], ...arr(g["jlpt:altForm"])]) {
      const k = slugify(f);
      if (k) index.set(k, iri);
    }
  }
  return index;
}

/**
 * L'IRI de l'entité qu'une question teste, lue sur sa réponse. `null` si la piste n'est pas
 * concernée, ou si la réponse ne correspond à aucune entité du graphe.
 *
 * ⚠ Chaque piste cherche dans SON référentiel, et nulle part ailleurs.
 *
 * La grammaire dans `gram.jsonld` : c'est l'erreur qui l'avait d'abord fait exclure. Ses
 * réponses (`食べられた`, `お座り`, `撮って`) figurent dans `word.jsonld` par le minage des
 * options, et les y chercher montrerait une conjugaison comme un mot du référentiel.
 * Cherchées au bon endroit, 198 questions se relient proprement.
 *
 * Le vocabulaire et les kanji dans `word`/`kanji` : le mot l'emporte à nom égal, 約束 étant
 * un mot et non un caractère.
 */
export function edgeFromAnswer(question, known, gram) {
  const skill = question["jlpt:skill"];
  const rep = String(arr(question.opts)[question["jlpt:answer"]] ?? "").trim();
  if (!rep) return null;

  if (skill === "grammaire") return gram?.get(slugify(rep)) ?? null;
  if (!(skill in PISTES)) return null;
  for (const iri of [`jlpt:word/${rep}`, `jlpt:kanji/${rep}`]) {
    if (known.has(iri)) return iri;
  }
  return null;
}

/** Pose l'arête sur les sujets qui n'en portent pas. Rend les sujets patchés et le compte. */
export function applyAnswerEdges(sujets, known, gram) {
  const mots = [];
  const out = sujets.map((s) => {
    if (arr(s.tests).length) return s;
    const iri = edgeFromAnswer(s, known, gram);
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

  const gram = gramIndex(J(`${DIR}/gram.jsonld`)["@graph"]);

  let total = 0;
  for (const shard of Object.values(SHARDS)) {
    const chemin = `${DIR}/${shard}.jsonld`;
    const doc = J(chemin);
    const { sujets, poses } = applyAnswerEdges(doc["@graph"] ?? [], known, gram);
    writeFileSync(chemin, JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n");
    console.log(`${shard} : ${poses} arête(s) posée(s)`);
    total += poses;
  }
  console.log(`\n${total} au total. Relancer \`bun tools/validate-graph.mjs\` pour confirmer.`);
}
