#!/usr/bin/env node
// Script de migration ONE-SHOT : convertit l'ancien modèle en data/graph/.
//
// SUPPRIMÉ au lot 4, une fois son résultat commité. Il ne doit JAMAIS devenir un
// générateur permanent — c'est exactement ce qui a tué tools/transform-cours.mjs :
// lecture et écriture des mêmes fichiers, non idempotent, et aujourd'hui il planterait
// (il lit data/cours-dokkai.json, supprimé depuis). Le graphe devient la source ; rien
// ne le régénère.
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { readFileSync, writeFileSync } from "node:fs";

const KANA_ONLY = /^[ぁ-んァ-ヴー]+$/;

/** Katakana → hiragana. Une lecture de MOT sert de furigana, et les furigana s'écrivent
 *  en hiragana : 138 entrées de dict.json sont en katakana pur contre 3024 en hiragana.
 *  ⚠ Ne s'applique PAS aux lectures ON d'un kanji, où le katakana est la convention. */
export function toHiragana(s) {
  return String(s ?? "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Forme de grammaire → segment d'IRI sûr. Retire 〜, remplace les séparateurs, et
 *  garantit qu'aucune séquence interdite par Oku ne subsiste (cf. isSafeIri). */
export function slugify(form) {
  return String(form ?? "")
    .replace(/〜/g, "")
    .replace(/\s*\/\s*/g, "-")
    .replace(/[\s'\\;*]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Précédence des lectures (spec § « Précédence en cas de conflit ») :
 *  1. lecture d'auteur (vocab/kanji.json, `読み：…`) — fait foi ;
 *  2. dict.json (miné automatiquement depuis bank.json, jamais relu) — seulement si
 *     (1) est muet ET que la lecture est propre (mono-kana) ;
 *  3. sinon : pas de lecture, et le cas part en ARBITRAGE plutôt qu'en silence.
 *
 * Les 105 divergences constatées entre les deux sources se répartissent ainsi ; celles
 * où l'auteur est muet et le dico suspect (« あんぜん / きけん », un vidage on/kun…) ne
 * sont pas tranchées automatiquement.
 */
export function resolveReading(word, { author, dict }) {
  if (author) {
    return { reading: toHiragana(author), conflict: !!dict && dict !== author, needsArbitration: false };
  }
  if (dict && KANA_ONLY.test(dict)) {
    return { reading: toHiragana(dict), conflict: false, needsArbitration: false };
  }
  if (dict) return { reading: null, conflict: false, needsArbitration: true };
  return { reading: null, conflict: false, needsArbitration: false };
}

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const readingOf = (x) => {
  const m = /読み[：:]\s*([^\s／/]+)/.exec(String(x.struct ?? ""));
  return m ? m[1].trim() : null;
};
const doc = (subjects) =>
  JSON.stringify({ "@context": "context.jsonld", "@graph": subjects }, null, 1) + "\n";

/** Construit les entités du référentiel : kanji, mots, points de grammaire.
 *  Fusionne les DEUX référentiels de grammaire concurrents (246 + 251 formes, dont
 *  122 et 127 disjointes) — c'est la duplication la plus lourde du modèle actuel. */
export function buildEntities() {
  const dict = J("data/dict.json");
  const vocabSrc = J("data/vocab.json");
  const kanjiSrc = J("data/kanji.json");
  const gramSrc = J("data/grammar.json");
  const coursGram = J("data/cours-gram.json");
  const conflicts = [];

  // --- kanji ---
  const kanji = kanjiSrc.map((k) => ({
    "@id": `jlpt:kanji/${norm(k.k)}`, "@type": "jlpt:Kanji",
    "schema:name": norm(k.k),
    "schema:description": norm(k.sens),
    ...(k.lvl ? { "jlpt:level": norm(k.lvl) } : {}),
  }));
  const kanjiSet = new Set(kanjiSrc.map((k) => norm(k.k)));

  // --- grammaire : fusion des deux référentiels ---
  const gram = new Map();
  const put = (form, fields) => {
    const slug = slugify(form);
    if (!slug) return;
    const id = `jlpt:gram/${slug}`;
    const cur = gram.get(id) ?? { "@id": id, "@type": "jlpt:GrammarPoint", "jlpt:form": norm(form) };
    gram.set(id, { ...cur, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) });
  };
  for (const g of gramSrc) {
    put(g.k, {
      "schema:description": norm(g.sens),
      "jlpt:structure": norm(g.struct),
      "jlpt:level": norm(g.lvl),
    });
  }
  for (const grp of coursGram.groups ?? []) {
    for (const it of grp.items ?? []) {
      if (!it.form) continue;
      const [main, ...alts] = String(it.form).split(" / ").map(norm);
      put(main, { "schema:description": norm(it.mean), "jlpt:level": norm(it.niv) });
      if (alts.length) {
        const id = `jlpt:gram/${slugify(main)}`;
        if (gram.has(id)) gram.set(id, { ...gram.get(id), "jlpt:altForm": alts });
      }
    }
  }

  // --- mots : union vocab.json ∪ dict.json, précédence sur la lecture ---
  const authorReading = new Map();
  const authorMeaning = new Map();
  const authorLevel = new Map();
  for (const v of vocabSrc) {
    const k = norm(v.k);
    const r = readingOf(v);
    if (r) authorReading.set(k, r);
    if (norm(v.sens)) authorMeaning.set(k, norm(v.sens));
    if (norm(v.lvl)) authorLevel.set(k, norm(v.lvl));
  }

  // Un motif grammatical n'est pas un mot. dict.json en contient 161 (« 〜うちに »,
  // « お〜する »…), dont 129 sont DÉJÀ des jlpt:GrammarPoint : les importer comme
  // jlpt:Word recréerait exactement la duplication que ce graphe doit supprimer.
  const estMotifGrammatical = (w) => /[〜～]/.test(w) || /[／]/.test(w);
  const word = [];
  let ecartes = 0;
  for (const w of new Set([...authorReading.keys(), ...authorMeaning.keys(), ...Object.keys(dict).map(norm)])) {
    if (!w) continue;
    if (estMotifGrammatical(w)) { ecartes++; continue; }
    const dictR = norm(dict[w]?.r) || null;
    const { reading, conflict, needsArbitration } = resolveReading(w, {
      author: authorReading.get(w) ?? null,
      dict: dictR,
    });
    if (conflict) conflicts.push({ mot: w, auteur: authorReading.get(w), dict: dictR, retenu: reading });
    if (needsArbitration) conflicts.push({ mot: w, auteur: null, dict: dictR, retenu: "(à arbitrer)" });

    const meaning = authorMeaning.get(w) || norm(dict[w]?.m);
    const uses = [...w].filter((c) => kanjiSet.has(c)).map((c) => `jlpt:kanji/${c}`);
    word.push({
      "@id": `jlpt:word/${w}`, "@type": "jlpt:Word",
      "schema:name": w,
      ...(reading ? { "jlpt:reading": reading } : {}),
      ...(meaning ? { "schema:description": meaning } : {}),
      ...(authorLevel.get(w) ? { "jlpt:level": authorLevel.get(w) } : {}),
      ...(uses.length ? { usesKanji: [...new Set(uses)] } : {}),
    });
  }

  return { kanji, word, gram: [...gram.values()], conflicts, ecartes };
}

if (process.argv[1]?.endsWith("migrate-to-graph.mjs")) {
  const { kanji, word, gram, conflicts, ecartes } = buildEntities();
  writeFileSync("data/graph/kanji.jsonld", doc(kanji));
  writeFileSync("data/graph/word.jsonld", doc(word));
  writeFileSync("data/graph/gram.jsonld", doc(gram));

  const lignes = conflicts
    .sort((a, b) => a.mot.localeCompare(b.mot))
    .map((c) => `| ${c.mot} | ${c.auteur ?? "—"} | ${c.dict ?? "—"} | ${c.retenu ?? "—"} |`);
  writeFileSync("docs/superpowers/plans/2026-07-20-conflits-lectures.md",
    `# Lectures à arbitrer\n\n${conflicts.length} cas où \`vocab.json\` et \`dict.json\` divergent.\n\n`
    + `La règle appliquée : la lecture d'auteur fait foi ; à défaut, le dictionnaire miné s'il est\n`
    + `mono-kana ; sinon rien n'est tranché et la ligne porte « (à arbitrer) ».\n\n`
    + `| mot | lecture auteur | lecture dict | retenu |\n|---|---|---|---|\n${lignes.join("\n")}\n`);

  const aArbitrer = conflicts.filter((c) => c.retenu === "(à arbitrer)").length;
  console.log(`kanji ${kanji.length} · mots ${word.length} · grammaire ${gram.length}`);
  console.log(`${ecartes} motifs grammaticaux écartés des mots (ils appartiennent à la grammaire)`);
  console.log(`conflits ${conflicts.length} (dont ${aArbitrer} non tranchés)`);
}
