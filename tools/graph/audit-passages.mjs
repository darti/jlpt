#!/usr/bin/env node
// Garde de périmètre des passages de lecture : lit data/passages-arbitres.json et signale ce
// qui sort du N3 ou du gabarit. N'ÉCRIT RIEN — c'est l'applicateur (passages.mjs) qui pose.
//
// ⚠ Le périmètre lexical se prouve ; le naturel de la langue et l'unicité de la réponse
// défendable, non. Cet outil ne remplace pas la relecture du lot 1a.
//
// Zéro dépendance, exécuté par `bun`.
import { readFileSync } from "node:fs";

const DIR = "data/graph";
const DECISIONS = "data/passages-arbitres.json";

/** Gabarit par format : longueur du texte (caractères) et nombre de questions. */
export const GABARIT = {
  tanbun: { min: 100, max: 200, questions: 1 },
  chubun: { min: 300, max: 420, questions: 3 },
  chobun: { min: 500, max: 650, questions: 4 },
  joho:   { min: 150, max: 300, questions: 2 },
};

const KANJI_RE = /[一-龯]/gu;

/**
 * Anomalies d'un jeu de décisions. Pure : les référentiels sont injectés.
 *
 * Deux catégories. `erreurs` = défauts STRUCTURELS, prouvés, qui bloquent la pose.
 * `avertissements` = périmètre lexical, qui ne bloque JAMAIS : `kanji.jsonld` est une liste
 * d'ÉTUDE (810 kanji à apprendre), pas la liste de ce qu'un lecteur N3 sait lire — 不, 用, 工,
 * 便, 場, 方, 室 en sont absents. Bloquer là-dessus condamnerait des textes parfaitement sains,
 * exactement comme l'heuristique de purge avait désigné trois VRAIS mots.
 */
export function auditPassages(decisions, refs) {
  const errs = [];
  const avertissements = [];
  const vus = new Set();
  for (const p of decisions.passages ?? []) {
    const tag = p.id ?? "(sans id)";
    if (!p.id || !/^jlpt:passage\/[a-z]+-\d+$/.test(p.id)) {
      errs.push(`${tag} : id absent ou non conforme à jlpt:passage/<format>-<nn>`);
    }
    if (vus.has(p.id)) errs.push(`${tag} : id en double`);
    vus.add(p.id);
    if (!p.name) errs.push(`${tag} : name manquant`);

    // ⚠ PAS de `continue` sur un format inconnu : les contrôles structurels des questions
    // (cardinalité d'optionNote, réponse hors bornes…) n'en dépendent pas, et les masquer
    // livrerait un rapport trompeur. Seuls les contrôles DÉRIVÉS du gabarit sont sautés.
    const g = GABARIT[p.format];
    if (!g) { errs.push(`${tag} : format inconnu « ${p.format} »`); }

    const jp = String(p.jp ?? "");
    if (g && (jp.length < g.min || jp.length > g.max)) {
      errs.push(`${tag} : longueur ${jp.length} hors gabarit ${p.format} (${g.min}–${g.max})`);
    }
    for (const k of new Set(jp.match(KANJI_RE) ?? [])) {
      if (!refs.kanji.has(k)) avertissements.push(`${tag} : kanji « ${k} » hors du référentiel`);
    }
    for (const mot of refs.motsHorsN3) {
      if (jp.includes(mot)) avertissements.push(`${tag} : mot « ${mot} » hors N3/N4/N5`);
    }

    const qs = p.questions ?? [];
    if (g && qs.length !== g.questions) {
      errs.push(`${tag} : ${qs.length} questions pour un ${p.format} (attendu ${g.questions})`);
    }
    qs.forEach((q, i) => {
      const qtag = `${tag}#${i}`;
      const opts = q.opts ?? [];
      if (opts.length < 2) errs.push(`${qtag} : moins de deux options`);
      if (new Set(opts).size !== opts.length) errs.push(`${qtag} : deux options identiques`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) {
        errs.push(`${qtag} : answer hors bornes`);
      }
      if (![1, 2, 3].includes(q.difficulty)) errs.push(`${qtag} : difficulty hors 1–3`);
      if (!q.stem) errs.push(`${qtag} : stem manquant`);
      const notes = q.optionNote ?? [];
      if (notes.length !== opts.length) {
        errs.push(`${qtag} : optionNote de longueur ${notes.length} pour ${opts.length} options`);
      }
    });
  }
  return { erreurs: errs, avertissements };
}

/** Référentiels lus depuis le graphe : kanji connus, et mots glosés de niveau > N3. */
export function readRefs() {
  const kanjiDoc = JSON.parse(readFileSync(`${DIR}/kanji.jsonld`, "utf8"));
  const wordDoc = JSON.parse(readFileSync(`${DIR}/word.jsonld`, "utf8"));
  const kanji = new Set((kanjiDoc["@graph"] ?? []).map((k) => k["schema:name"]).filter(Boolean));
  const motsHorsN3 = new Set(
    (wordDoc["@graph"] ?? [])
      .filter((w) => ["N2", "N1"].includes(w["jlpt:level"]))
      .map((w) => w["schema:name"])
      .filter(Boolean),
  );
  return { kanji, motsHorsN3 };
}

function main() {
  const decisions = JSON.parse(readFileSync(DECISIONS, "utf8"));
  const { erreurs, avertissements } = auditPassages(decisions, readRefs());
  const n = (decisions.passages ?? []).length;
  const q = (decisions.passages ?? []).reduce((a, p) => a + (p.questions ?? []).length, 0);
  // Les avertissements s'affichent TOUJOURS, verdict compris : c'est à l'auteur de juger si un
  // kanji hors liste d'étude gêne, pas à l'outil de trancher à sa place.
  if (avertissements.length) {
    console.log(`⚠ ${avertissements.length} signalements de périmètre (non bloquants) :`);
    for (const a of avertissements) console.log(`  ${a}`);
  }
  if (!erreurs.length) {
    console.log(`✓ ${n} passages, ${q} questions — conformes`);
    return 0;
  }
  console.error(`✗ ${erreurs.length} erreurs sur ${n} passages :`);
  for (const e of erreurs) console.error(`  ${e}`);
  return 1;
}

if (import.meta.main) process.exit(main());
