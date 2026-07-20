// Applique les énoncés ARBITRÉS par l'auteur sur les shards de questions.
//
// Même invariant que readings.mjs, et pour la même raison : ce script **pose** une
// décision, il ne régénère rien. Il est idempotent, et il n'écrase jamais un énoncé que
// le graphe porte déjà et que la décision n'attendait pas — un désaccord est signalé,
// pas résolu en silence. Le graphe fait autorité.
//
// La chaîne :
//   1. bun tools/graph/audit-stems.mjs  → rapport + squelette de décisions
//   2. l'auteur rédige SES phrases dans data/enonces-arbitres.json
//   3. bun tools/graph/stems.mjs        → patch des shards q-*.jsonld
//   4. bun tools/validate-graph.mjs     → confirme
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "data/graph";
const DECISIONS = "data/enonces-arbitres.json";

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const isQuestion = (s) => arr(s["@type"]).includes("jlpt:Question");

/**
 * Pose les énoncés décidés sur les questions visées.
 *
 * Rend les sujets patchés et cinq rapports : ce qui a été posé, les décisions refusées
 * (cible mal formée), les conflits (le graphe porte un énoncé imprévu), les décisions
 * sans cible, et `vus` — les décisions dont la question EXISTE ici, quelle que soit
 * l'issue. Seul `poses` écrit ; tout le reste se contente de signaler.
 *
 * ⚠ `vus` n'est pas redondant avec `poses` : une décision déjà appliquée ne pose rien et
 * ne refuse rien. Sans lui, un appelant qui balaie plusieurs shards croit la question
 * introuvable dès le second passage — c'est-à-dire précisément quand tout va bien.
 */
export function applyStems(sujets, decisions) {
  const vises = new Set(Object.keys(decisions));
  const poses = [];
  const refuses = [];
  const conflits = [];
  const vus = [];

  const out = sujets.map((s) => {
    if (!isQuestion(s)) return s;
    const id = s["@id"];
    const d = decisions[id];
    if (!d) return s;
    vises.delete(id);
    vus.push(id);

    const cible = norm(d.stem);
    const actuel = norm(s["jlpt:stem"]);

    // Déjà posé : rien à faire. C'est ce qui rend le script rejouable sans danger.
    if (actuel === cible) return s;

    // Le graphe a bougé depuis l'audit : on ne décide pas à la place de l'auteur.
    if (actuel !== norm(d.from)) { conflits.push(id); return s; }

    // Décision incomplète : refuser vaut mieux qu'un format bâtard.
    if (!cible || !/_{3,}/.test(cible)) { refuses.push(id); return s; }

    // Un énoncé qui contient la réponse en clair n'apprend rien — le trou serait décoratif.
    // ⚠ Comparaison par sous-chaîne : une réponse d'un seul caractère peut apparaître
    // légitimement dans le contexte (日 dans 日曜日) et sera refusée à tort. C'est voulu :
    // un refus est visible et l'auteur reformule, là où une écriture fautive est muette.
    const reponse = arr(s.opts)[s["jlpt:answer"]];
    if (typeof reponse === "string" && reponse && cible.includes(reponse)) {
      refuses.push(id);
      return s;
    }

    poses.push(id);
    return { ...s, "jlpt:stem": cible, ...(norm(d.gloss) ? { "jlpt:gloss": norm(d.gloss) } : {}) };
  });

  return { sujets: out, poses: poses.length, questions: poses, refuses, conflits, vus, inconnus: [...vises] };
}

if (process.argv[1]?.endsWith("stems.mjs")) {
  const decisions = JSON.parse(readFileSync(DECISIONS, "utf8"));
  const shards = readdirSync(DIR).filter((f) => f.startsWith("q-") && f.endsWith(".jsonld")).sort();

  let total = 0;
  const refuses = [], conflits = [];
  // Une décision n'est « sans question » que si AUCUN shard ne l'a vue — pas si le shard
  // courant ne l'a pas posée. Une décision déjà appliquée ne pose rien : la compter comme
  // introuvable ferait crier l'outil au second passage, quand justement tout va bien.
  const restants = new Set(Object.keys(decisions));

  for (const f of shards) {
    const chemin = `${DIR}/${f}`;
    const doc = JSON.parse(readFileSync(chemin, "utf8"));
    const r = applyStems(doc["@graph"] ?? [], decisions);
    if (r.poses) writeFileSync(chemin, JSON.stringify({ ...doc, "@graph": r.sujets }, null, 1) + "\n");
    for (const id of r.vus) restants.delete(id);
    refuses.push(...r.refuses);
    conflits.push(...r.conflits);
    total += r.poses;
    if (r.poses) console.log(`${f} : ${r.poses} énoncé(s) posé(s)`);
  }

  console.log(`\n${total} énoncé(s) posé(s) au total`);
  if (refuses.length) {
    console.log(`⚠ ${refuses.length} décision(s) refusée(s) — cible sans ___ ou contenant la réponse :`);
    console.log(`  ${refuses.join(", ")}`);
  }
  if (conflits.length) {
    console.log(`⚠ ${conflits.length} conflit(s) — le graphe porte un énoncé imprévu (il fait autorité) :`);
    console.log(`  ${conflits.join(", ")}`);
  }
  if (restants.size) console.log(`⚠ ${restants.size} décision(s) sans question : ${[...restants].join(", ")}`);
  console.log("Relancer `bun tools/validate-graph.mjs` pour confirmer.");
}
