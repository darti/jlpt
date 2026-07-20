// Retire de word.jsonld les entrées FABRIQUÉES, et glose les vrais mots incomplets.
//
// Le défaut : un générateur disparu a importé des distracteurs de quiz comme s'ils étaient
// des mots, en leur recopiant la lecture de la BONNE réponse et sans leur donner de sens.
// 約速、役束、約則 portent ainsi « やくそく », la lecture de 約束. Aucun n'existe en japonais.
// Ils polluent le dictionnaire que l'app sert pour les furigana et le tap-pour-définir, et
// ils faisaient passer des questions saines pour ambiguës (cf. readingIndex dans
// audit-stems.mjs, qui a dû se restreindre aux mots glosés pour les contourner).
//
// La chaîne, en deux temps DÉLIBÉRÉS — une suppression ne se rejoue pas :
//   1. bun tools/graph/purge-words.mjs --proposer  → docs/…/mots-fabriques.md
//   2. l'auteur relit et consigne SES décisions dans data/mots-parasites.json
//   3. bun tools/graph/purge-words.mjs             → applique
//
// `proposePurge` n'écrit rien. C'est voulu : son critère est une heuristique, et une
// heuristique ne doit jamais commander un `delete`. Elle a d'ailleurs proposé trois VRAIS
// mots (始め、始めて、謝り) dont le seul tort était de n'avoir pas de glose.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const DIR = "data/graph";
const MOTS = `${DIR}/word.jsonld`;
const DECISIONS = "data/mots-parasites.json";

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const isWord = (s) => arr(s["@type"]).includes("jlpt:Word");
const isQuestion = (s) => arr(s["@type"]).includes("jlpt:Question");
const glose = (s) => String(s["schema:description"] ?? "").trim();

/** Une lecture est du kana. Comparer deux `undefined` rendrait suspecte n'importe quelle
 *  entrée sans lecture — il y en a 517, et c'est ainsi que « ぐ » a été proposé. */
const EST_KANA = /^[ぁ-ゖァ-ヺー゛゜]+$/;

/** Prédicats qui peuvent pointer vers un mot. Écrits en alias dans nos documents. */
const REF_PREDICATES = ["tests", "usesKanji", "covers", "illustrates"];

/**
 * Propose les entrées qui portent la signature d'une fabrication : aucune glose, une
 * lecture kana identique à celle de la réponse d'une question où elles servent de
 * distracteur, et jamais bonne réponse nulle part.
 *
 * ⚠ HEURISTIQUE, jamais un ordre de suppression. La glose est la seule chose qui
 * distingue ici un non-mot d'un vrai mot à l'entrée incomplète : 謝り (« excuse ») coche
 * tous les autres critères. Relire la proposition n'est pas une formalité.
 */
export function proposePurge(sujets) {
  const mots = sujets.filter(isWord);
  const lecture = new Map(
    mots.filter((m) => EST_KANA.test(String(m["jlpt:reading"] ?? "")))
      .map((m) => [m["schema:name"], m["jlpt:reading"]]),
  );

  const reponses = new Set();
  const distracteurs = new Map();
  for (const q of sujets.filter(isQuestion)) {
    const opts = arr(q.opts);
    opts.forEach((o, i) => {
      if (i === q["jlpt:answer"]) { reponses.add(o); return; }
      if (!distracteurs.has(o)) distracteurs.set(o, []);
      distracteurs.get(o).push(q);
    });
  }

  const out = [];
  for (const m of mots) {
    const nom = m["schema:name"];
    const r = m["jlpt:reading"];
    if (glose(m) || !EST_KANA.test(String(r ?? "")) || reponses.has(nom)) continue;
    const source = (distracteurs.get(nom) ?? [])
      .find((q) => lecture.get(arr(q.opts)[q["jlpt:answer"]]) === r);
    if (source) {
      out.push({ id: m["@id"], nom, lecture: r, copieDe: arr(source.opts)[source["jlpt:answer"]] });
    }
  }
  return out;
}

/**
 * Applique les décisions : retire les `supprimer`, pose les `gloser`.
 *
 * Rend les sujets et cinq rapports. Une suppression est REFUSÉE si quoi que ce soit
 * référence l'entrée — la laisser en place vaut mieux qu'une référence pendante, que
 * checkCorpus signalerait plus tard sans dire d'où elle vient. Une glose n'écrase jamais
 * une glose existante : même invariant que readings.mjs, le graphe fait autorité.
 */
export function applyPurge(sujets, decisions) {
  const aSupprimer = new Set(decisions.supprimer ?? []);
  const aGloser = decisions.gloser ?? {};
  const aRelire = decisions.lectures ?? {};
  const vises = new Set([...aSupprimer]);

  // Qui pointe vers quoi — calculé sur TOUS les sujets, pas seulement les mots.
  const cible = new Set();
  for (const s of sujets) {
    for (const p of REF_PREDICATES) {
      for (const ref of arr(s[p])) cible.add(typeof ref === "object" && ref !== null ? ref["@id"] : ref);
    }
  }

  const retires = [], refuses = [], gloses = [], lectures = [], conflits = [];
  const out = [];
  for (const s of sujets) {
    if (!isWord(s)) { out.push(s); continue; }
    const id = s["@id"];

    if (aSupprimer.has(id)) {
      vises.delete(id);
      if (cible.has(id)) { refuses.push(id); out.push(s); continue; }
      retires.push(id);
      continue;
    }

    const nom = s["schema:name"];
    let patch = null;

    if (nom in aGloser) {
      const veut = String(aGloser[nom] ?? "").trim();
      if (glose(s)) { if (glose(s) !== veut) conflits.push(nom); }
      else if (veut) { gloses.push(nom); patch = { ...(patch ?? s), "schema:description": veut }; }
    }

    if (nom in aRelire) {
      // Invariant qui rend cette correction sûre : on ne remplace QUE ce qui n'est
      // manifestement pas une lecture. L'outil ne peut donc pas servir à en réécrire une
      // bonne — 「今年」 portait « ことし（特別な読み） », une note d'auteur logée dans un
      // champ de donnée ; 「最大」 portait « さいだい / さいしょう », où la seconde est la
      // lecture de son ANTONYME 最小. Ce sont ces valeurs-là, et elles seules, qu'on écrase.
      const veut = String(aRelire[nom] ?? "").trim();
      const actuelle = String(s["jlpt:reading"] ?? "");
      if (EST_KANA.test(actuelle)) {
        if (actuelle !== veut) conflits.push(nom);
      } else if (EST_KANA.test(veut)) {
        lectures.push(nom);
        patch = { ...(patch ?? s), "jlpt:reading": veut };
      }
    }

    out.push(patch ?? s);
  }

  return { sujets: out, retires, refuses, gloses, lectures, conflits, inconnus: [...vises] };
}

if (import.meta.main) {
  const fichiers = readdirSync(DIR)
    .filter((f) => f.endsWith(".jsonld") && f !== "context.jsonld" && f !== "shapes.jsonld");
  const sujets = fichiers.flatMap((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))["@graph"] ?? []);

  if (process.argv.includes("--proposer")) {
    const cands = proposePurge(sujets);
    const L = [
      "# Entrées de dictionnaire suspectées d'être fabriquées",
      "",
      "Généré par `bun tools/graph/purge-words.mjs --proposer`. **Ne pas éditer** :",
      "consigner les décisions dans `data/mots-parasites.json`, puis lancer",
      "`bun tools/graph/purge-words.mjs`.",
      "",
      "⚠ Une entrée n'est proposée que sur une HEURISTIQUE : aucune glose, lecture kana",
      "recopiée de la bonne réponse, jamais réponse ailleurs. Elle a déjà proposé trois",
      "VRAIS mots (始め、始めて、謝り) dont le seul tort était l'absence de glose. Relire.",
      "",
      `${cands.length} entrée(s) proposée(s).`,
      "",
      "| entrée | lecture | recopiée de |",
      "|---|---|---|",
      ...cands.map((c) => `| \`${c.nom}\` | ${c.lecture} | ${c.copieDe} |`),
      "",
      "## Lectures qui n'en sont pas",
      "",
      "`jlpt:reading` doit contenir du kana. Ces entrées y logent autre chose — une note",
      "d'auteur, un tiret, ou DEUX lectures dont l'une appartient à un autre mot. À",
      "corriger via la clé `lectures` du fichier de décisions.",
      "",
      "| entrée | valeur en place | glose |",
      "|---|---|---|",
      ...sujets.filter(isWord)
        .filter((m) => m["jlpt:reading"] !== undefined && !EST_KANA.test(String(m["jlpt:reading"])))
        .map((m) => `| \`${m["schema:name"]}\` | \`${m["jlpt:reading"]}\` | ${glose(m) || "—"} |`),
      "",
    ];
    mkdirSync("docs/superpowers", { recursive: true });
    writeFileSync("docs/superpowers/mots-fabriques.md", L.join("\n") + "\n");
    console.log(`${cands.length} entrée(s) proposée(s) → docs/superpowers/mots-fabriques.md`);
    console.log("Relire, puis consigner les décisions dans data/mots-parasites.json.");
  } else {
    const decisions = JSON.parse(readFileSync(DECISIONS, "utf8"));
    const doc = JSON.parse(readFileSync(MOTS, "utf8"));
    const r = applyPurge(doc["@graph"] ?? [], decisions);
    if (r.retires.length || r.gloses.length || r.lectures.length) {
      writeFileSync(MOTS, JSON.stringify({ ...doc, "@graph": r.sujets }, null, 1) + "\n");
    }
    console.log(`${r.retires.length} entrée(s) retirée(s), ${r.gloses.length} glose(s) posée(s), `
      + `${r.lectures.length} lecture(s) corrigée(s)`);
    if (r.refuses.length) {
      console.log(`⚠ ${r.refuses.length} suppression(s) refusée(s) — quelque chose les référence :`);
      console.log(`  ${r.refuses.join(", ")}`);
    }
    if (r.conflits.length) console.log(`⚠ ${r.conflits.length} glose(s) ignorée(s), le graphe en porte déjà une : ${r.conflits.join(", ")}`);
    // « Absente » est l'état de SUCCÈS d'une suppression : après une première application,
    // toutes les décisions le sont. L'outil ne peut pas distinguer « déjà retirée » de
    // « n'a jamais existé » — il le dit, plutôt que de crier à l'erreur sur un rejeu sain.
    if (r.inconnus.length) {
      console.log(`${r.inconnus.length} décision(s) sans entrée correspondante — attendu si la`);
      console.log("  purge a déjà été appliquée ; à vérifier seulement au premier passage.");
    }
    console.log("Relancer `bun tools/validate-graph.mjs` pour confirmer.");
  }
}
