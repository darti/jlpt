// Applique les lectures ARBITRÉES par l'auteur sur data/graph/word.jsonld.
//
// Remplace la voie qu'ouvrait tools/migrate-to-graph.mjs, supprimé au lot 4 — mais avec
// l'invariant inverse : ce script **ajoute** une lecture manquante, il ne régénère rien.
// Il est idempotent et n'écrase jamais une valeur existante, donc le relancer est sans
// danger. C'est exactement ce que le générateur ne pouvait pas promettre.
//
// La chaîne complète, et la raison licencielle qui la justifie :
//   1. node tools/jmdict/fetch.mjs      → .jmdict/ (hors dépôt, jamais commité)
//   2. node tools/jmdict/propose.mjs    → docs/…/lectures-a-arbitrer.md (propositions)
//   3. l'auteur relit et consigne SES décisions dans data/lectures-arbitrees.json
//   4. node tools/graph/readings.mjs    → patch de data/graph/word.jsonld
// Aucune donnée JMdict n'entre dans le graphe : seules les décisions de l'auteur le font.
// On ne redistribue pas JMdict, on s'en sert pour décider — d'où pas d'attribution
// CC BY-SA sur chaque écran ni de ShareAlike sur le jeu dérivé.
//
// Node pur : la CI exécute `node`, jamais `bun`.
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

if (process.argv[1]?.endsWith("readings.mjs")) {
  const mots = passe(DECISIONS, MOTS, applyReadings, "mot");
  const kanji = passe(DECISIONS_KANJI, KANJI, applyKanjiReadings, "kanji");

  if (!mots.fait && !kanji.fait) {
    console.error(`✗ ni ${DECISIONS} ni ${DECISIONS_KANJI} — produire d'abord les propositions :`);
    console.error("    node tools/jmdict/fetch.mjs   && node tools/jmdict/propose.mjs   # mots");
    console.error("    node tools/kanjidic/fetch.mjs && node tools/kanjidic/propose.mjs # kanji");
    process.exit(1);
  }
  console.log("Relancer `node tools/validate-graph.mjs` pour confirmer.");
}
