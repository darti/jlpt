#!/usr/bin/env node
// Pose les passages arbitrés (data/passages-arbitres.json) dans le graphe : passage.jsonld,
// q-lecture.jsonld et corpus.jsonld.
//
// ⚠ Idempotent, et n'écrase JAMAIS un @id existant — même invariant que readings.mjs,
// link-answers.mjs et traps.mjs. Ce n'est pas un générateur : il ajoute ce qui manque.
// Corriger un texte à la main dans le graphe est donc définitif.
//
// ⚠ Les ordinaux sont posés en FIN DE CORPUS (jlpt:ord global, dense, jamais renuméroté : il
// indexe les bitsets persistés). La lecture n'étant pas la dernière compétence, cela lui ouvre
// un SECOND intervalle dans corpus.jsonld — ce que checkCorpus et coverageBySkill savent lire.
//
// Zéro dépendance, exécuté par `bun`.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "data/graph";
const DECISIONS = "data/passages-arbitres.json";

const lire = (f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
const ecrire = (f, doc, sujets) =>
  writeFileSync(`${DIR}/${f}`, JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n");

/** Premier ordinal libre = max(ord) + 1 sur TOUS les shards de questions. */
export function nextOrd(shards) {
  let max = -1;
  for (const sujets of shards) {
    for (const s of sujets) {
      const o = s["jlpt:ord"];
      if (Number.isInteger(o) && o > max) max = o;
    }
  }
  return max + 1;
}

/** Pose ce qui manque. Pure : les documents sont injectés, rien n'est lu ni écrit ici. */
export function applyPassages(decisions, docs) {
  const passages = [...docs.passages];
  const questions = [...docs.lecture];
  const corpus = [...docs.corpus];
  const connus = new Set(passages.map((p) => p["@id"]));
  let ord = docs.nextOrd;
  let poses = 0, deja = 0, premierOrd = null;

  for (const p of decisions.passages ?? []) {
    if (connus.has(p.id)) { deja++; continue; }
    const sujet = {
      "@id": p.id,
      "@type": "jlpt:Passage",
      "schema:name": p.name,
      "jlpt:format": p.format,
      "jlpt:jp": p.jp,
    };
    if (p.fr) sujet["schema:description"] = p.fr;
    if (p.tests?.length) sujet.tests = p.tests;
    passages.push(sujet);
    connus.add(p.id);

    for (const q of p.questions ?? []) {
      if (premierOrd === null) premierOrd = ord;
      const sq = {
        "@id": `jlpt:q/${ord}`,
        "@type": "jlpt:Question",
        "jlpt:skill": "lecture",
        "jlpt:difficulty": q.difficulty,
        "jlpt:ord": ord,
        "jlpt:stem": q.stem,
        opts: q.opts,
        "jlpt:answer": q.answer,
        readsPassage: p.id,
      };
      if (q.description) sq["schema:description"] = q.description;
      if (q.gloss) sq["jlpt:gloss"] = q.gloss;
      if (q.optionNote?.length) sq["jlpt:optionNote"] = q.optionNote;
      if (q.tests?.length) sq.tests = q.tests;
      questions.push(sq);
      ord++;
    }
    poses++;
  }

  if (premierOrd !== null) {
    const ajoutees = ord - premierOrd;
    // ⚠ REMPLACER l'objet, jamais le muter : `[...docs.corpus]` ne copie que le tableau, pas
    // les objets qu'il contient. Un `existant["jlpt:count"] += …` modifierait le document de
    // l'appelant sous ses pieds — et la fonction cesserait d'être pure, contrairement à ce que
    // son propre commentaire affirme.
    const i = corpus.findIndex((c) => c["@id"] === "jlpt:corpus/lecture-2");
    if (i >= 0) corpus[i] = { ...corpus[i], "jlpt:count": corpus[i]["jlpt:count"] + ajoutees };
    else corpus.push({
      "@id": "jlpt:corpus/lecture-2",
      "@type": "jlpt:SkillRange",
      "jlpt:skill": "lecture",
      "jlpt:from": premierOrd,
      "jlpt:count": ajoutees,
    });
  }
  return { passages, questions, corpus, poses, deja };
}

function main() {
  const decisions = JSON.parse(readFileSync(DECISIONS, "utf8"));
  const docP = lire("passage.jsonld");
  const docQ = lire("q-lecture.jsonld");
  const docC = lire("corpus.jsonld");
  const shards = readdirSync(DIR)
    .filter((f) => /^q-.*\.jsonld$/.test(f))
    .map((f) => lire(f)["@graph"] ?? []);

  const r = applyPassages(decisions, {
    passages: docP["@graph"] ?? [],
    lecture: docQ["@graph"] ?? [],
    corpus: docC["@graph"] ?? [],
    nextOrd: nextOrd(shards),
  });

  if (!r.poses) {
    console.log(`✓ rien à poser (${r.deja} passages déjà présents) — le graphe fait autorité`);
    return 0;
  }
  ecrire("passage.jsonld", docP, r.passages);
  ecrire("q-lecture.jsonld", docQ, r.questions);
  ecrire("corpus.jsonld", docC, r.corpus);
  console.log(`✓ ${r.poses} passages posés (${r.deja} déjà présents), ${r.questions.length - (docQ["@graph"] ?? []).length} questions ajoutées`);
  console.log("  → penser à rejouer : bun tools/graph/traps.mjs, puis bun tools/validate-graph.mjs");
  return 0;
}

if (import.meta.main) process.exit(main());
