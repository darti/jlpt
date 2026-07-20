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

const DECISIONS = "data/lectures-arbitrees.json";
const MOTS = "data/graph/word.jsonld";

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

if (process.argv[1]?.endsWith("readings.mjs")) {
  if (!existsSync(DECISIONS)) {
    console.error(`✗ ${DECISIONS} absent — produire d'abord les propositions :`);
    console.error("    node tools/jmdict/fetch.mjs && node tools/jmdict/propose.mjs");
    process.exit(1);
  }
  const decisions = JSON.parse(readFileSync(DECISIONS, "utf8"));
  const doc = JSON.parse(readFileSync(MOTS, "utf8"));
  const { sujets, poses, conflits, inconnus } = applyReadings(doc["@graph"] ?? [], decisions);

  writeFileSync(MOTS, JSON.stringify({ ...doc, "@graph": sujets }, null, 1) + "\n");
  console.log(`${poses} lecture(s) posée(s) sur ${MOTS}`);
  if (conflits.length) {
    console.log(`⚠ ${conflits.length} décision(s) ignorée(s) — le graphe porte déjà une autre`);
    console.log(`  lecture (il fait autorité) : ${conflits.join(", ")}`);
  }
  if (inconnus.length) {
    console.log(`⚠ ${inconnus.length} décision(s) sans mot correspondant : ${inconnus.join(", ")}`);
  }
  console.log("Relancer `node tools/validate-graph.mjs` pour confirmer.");
}
