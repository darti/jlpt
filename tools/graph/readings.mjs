// Applique les lectures ARBITRÉES par l'auteur sur data/graph/word.jsonld.
//
// Remplace la voie qu'ouvrait tools/migrate-to-graph.mjs, supprimé au lot 4 — mais avec
// l'invariant inverse : ce script **ajoute** une lecture manquante, il ne régénère rien.
// Il est idempotent et n'écrase jamais une valeur existante, donc le relancer est sans
// danger. C'est exactement ce que le générateur ne pouvait pas promettre.
//
// La chaîne complète, et la raison licencielle qui la justifie :
//   1. bun tools/jmdict/fetch.mjs      → .jmdict/ (hors dépôt, jamais commité)
//   2. bun tools/jmdict/propose.mjs    → docs/…/lectures-a-arbitrer.md (propositions)
//   3. l'auteur relit et consigne SES décisions dans data/lectures-arbitrees.json
//   4. bun tools/graph/readings.mjs    → patch de data/graph/word.jsonld
// Aucune donnée JMdict n'entre dans le graphe : seules les décisions de l'auteur le font.
// On ne redistribue pas JMdict, on s'en sert pour décider — d'où pas d'attribution
// CC BY-SA sur chaque écran ni de ShareAlike sur le jeu dérivé.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { splitOnKun } from "./kana.mjs";

const DECISIONS = "data/lectures-arbitrees.json";
const MOTS = "data/graph/word.jsonld";
const DECISIONS_KANJI = "data/lectures-kanji-arbitrees.json";
const KANJI = "data/graph/kanji.jsonld";

/** Katakana → hiragana. Une lecture de MOT sert de furigana, et les furigana s'écrivent
 *  en hiragana. ⚠ Ne s'applique PAS aux lectures ON d'un kanji, où le katakana est la
 *  convention — mais ce script ne touche qu'aux jlpt:Word. */
export function toHiragana(s) {
  return String(s ?? "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/**
 * Pose les lectures décidées sur les sujets `jlpt:Word` qui n'en portent pas.
 *
 * Rend les sujets patchés et trois compteurs qui font le rapport : ce qui a été posé, les
 * mots que la décision visait sans les trouver, et les cas où le graphe portait DÉJÀ une
 * lecture différente. Ces derniers ne sont pas appliqués — le graphe fait autorité, et un
 * désaccord doit être vu, pas résolu en silence.
 */
export function applyReadings(sujets, decisions) {
  const vises = new Set(Object.keys(decisions));
  const poses = [];
  const conflits = [];
  const out = sujets.map((s) => {
    if (!arr(s["@type"]).includes("jlpt:Word")) return s;
    const nom = s["schema:name"];
    if (typeof nom !== "string" || !(nom in decisions)) return s;
    vises.delete(nom);
    const lecture = toHiragana(decisions[nom]).trim();
    if (!lecture) return s;
    const actuelle = s["jlpt:reading"];
    if (typeof actuelle === "string" && actuelle) {
      if (actuelle !== lecture) conflits.push(nom);
      return s;
    }
    poses.push(nom);
    return { ...s, "jlpt:reading": lecture };
  });
  return { sujets: out, poses: poses.length, mots: poses, conflits, inconnus: [...vises] };
}

/**
 * Pose les lectures on/kun décidées sur les sujets `jlpt:Kanji` qui n'en portent pas.
 *
 * Même invariant que `applyReadings` : on ajoute, on n'écrase jamais. La décision est écrite
 * dans la forme unique du projet (« ハチ・や・や(つ) ») et découpée par script — c'est
 * `splitOnKun` qui fait foi, la même fonction que la migration du cours a utilisée.
 */
export function applyKanjiReadings(sujets, decisions) {
  const vises = new Set(Object.keys(decisions));
  const poses = [];
  const conflits = [];
  const out = sujets.map((s) => {
    if (!arr(s["@type"]).includes("jlpt:Kanji")) return s;
    const nom = s["schema:name"];
    if (typeof nom !== "string" || !(nom in decisions)) return s;
    vises.delete(nom);
    const { on, kun } = splitOnKun(String(decisions[nom]).trim());
    if (!on.length && !kun.length) return s;
    if (arr(s["jlpt:onReading"]).length || arr(s["jlpt:kunReading"]).length) {
      conflits.push(nom);
      return s;
    }
    poses.push(nom);
    return {
      ...s,
      ...(on.length ? { "jlpt:onReading": on } : {}),
      ...(kun.length ? { "jlpt:kunReading": kun } : {}),
    };
  });
  return { sujets: out, poses: poses.length, kanji: poses, conflits, inconnus: [...vises] };
}

/** Applique un fichier de décisions sur un document du graphe. Rend le rapport. */
function passe(fichier, document, apply, quoi) {
  if (!existsSync(fichier)) return { fait: false };
  const decisions = JSON.parse(readFileSync(fichier, "utf8"));
  const doc = JSON.parse(readFileSync(document, "utf8"));
  const { sujets, poses, conflits, inconnus } = apply(doc["@graph"] ?? [], decisions);
  writeFileSync(document, JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n");

  console.log(`${poses} lecture(s) de ${quoi} posée(s) sur ${document}`);
  if (conflits.length) {
    console.log(`⚠ ${conflits.length} décision(s) ignorée(s) — le graphe porte déjà une autre`);
    console.log(`  lecture (il fait autorité) : ${conflits.join(", ")}`);
  }
  if (inconnus.length) {
    console.log(`⚠ ${inconnus.length} décision(s) sans ${quoi} correspondant : ${inconnus.join(", ")}`);
  }
  return { fait: true };
}

const PROPOSITIONS_MOTS = "docs/superpowers/plans/2026-07-20-lectures-a-arbitrer.md";
const PROPOSITIONS_KANJI = "docs/superpowers/plans/2026-07-20-kanji-a-arbitrer.md";

/**
 * Que dire quand aucun fichier de décisions n'existe.
 *
 * ⚠ Le message précédent envoyait relancer `fetch` + `propose`, ce que l'utilisateur venait
 * de faire — et qui ne pouvait pas aider : `propose.mjs` écrit un DOCUMENT DE PROPOSITIONS
 * dans docs/, jamais le fichier de décisions dans data/. L'étape manquante est l'ARBITRAGE,
 * une saisie à la main, et c'est délibéré : c'est elle qui fait que ce qui entre dans le
 * graphe est une décision de l'auteur et non une extraction d'un jeu sous CC BY-SA.
 *
 * Le message doit donc dépendre de l'état réel : renvoyer produire les propositions si elles
 * manquent, mais pointer l'arbitrage si elles sont déjà là.
 */
export function messageAbsence({ propositionsMots, propositionsKanji }) {
  const l = [`✗ ni ${DECISIONS} ni ${DECISIONS_KANJI}.`, ""];
  const aArbitrer = [];
  if (propositionsMots) aArbitrer.push([PROPOSITIONS_MOTS, DECISIONS, "mots"]);
  if (propositionsKanji) aArbitrer.push([PROPOSITIONS_KANJI, DECISIONS_KANJI, "kanji"]);

  if (aArbitrer.length) {
    l.push("Les propositions sont DÉJÀ produites — il reste à les arbitrer, à la main :", "");
    for (const [doc, dec, quoi] of aArbitrer) {
      l.push(`  ${quoi} : relire les propositions de`, `    ${doc}`,
        `  puis reporter TES décisions, corrigées, dans`, `    ${dec}`, "");
    }
    l.push("Cette étape ne peut pas être automatisée : c'est elle qui fait entrer dans le",
      "graphe une décision d'auteur, et non une extraction d'un jeu sous CC BY-SA.");
  }

  const aProduire = [];
  if (!propositionsMots) aProduire.push("    bun tools/jmdict/fetch.mjs   && bun tools/jmdict/propose.mjs   # mots");
  if (!propositionsKanji) aProduire.push("    bun tools/kanjidic/fetch.mjs && bun tools/kanjidic/propose.mjs # kanji");
  if (aProduire.length) {
    if (aArbitrer.length) l.push("");
    l.push("Propositions encore à produire :", ...aProduire);
  }
  return l;
}

if (process.argv[1]?.endsWith("readings.mjs")) {
  const mots = passe(DECISIONS, MOTS, applyReadings, "mot");
  const kanji = passe(DECISIONS_KANJI, KANJI, applyKanjiReadings, "kanji");

  if (!mots.fait && !kanji.fait) {
    for (const ligne of messageAbsence({
      propositionsMots: existsSync(PROPOSITIONS_MOTS),
      propositionsKanji: existsSync(PROPOSITIONS_KANJI),
    })) console.error(ligne);
    process.exit(1);
  }
  console.log("Relancer `bun tools/validate-graph.mjs` pour confirmer.");
}
