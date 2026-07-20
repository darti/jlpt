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
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ARBITRAGES = "data/lectures-arbitrees.json";

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
  // Décisions de l'auteur sur les lectures (cf. tools/jmdict/propose.mjs). C'est la
  // SEULE voie par laquelle une lecture proposée entre dans le graphe : JMdict n'est
  // jamais lu ici, seulement ce fichier, écrit et relu par un humain.
  const arbitrees = existsSync(ARBITRAGES) ? J(ARBITRAGES) : {};

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
      author: authorReading.get(w) ?? arbitrees[w] ?? null,
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


/** Sujet testé, extrait des 「…」 de l'énoncé. 80 % des questions en portent un. */
export function subjectOf(q) {
  const m = /「([^」]+)」/.exec(String(q.q ?? ""));
  return m ? m[1] : null;
}

/** Forme de grammaire testée = contenu du premier <b> du corrigé. C'est l'heuristique
 *  qu'utilisait coursGramIndex À L'EXÉCUTION, à 48,7 % de résolution. Ici elle ne sert
 *  qu'UNE fois, à la migration, et son résultat devient une arête explicite : ce qui
 *  échoue devient un trou mesurable au lieu d'un échec silencieux de correspondance. */
export function gramFormOf(q) {
  const m = /<b>([\s\S]*?)<\/b>/.exec(String(q.e ?? ""));
  if (!m) return null;
  const form = m[1].replace(/<[^>]*>/g, "").trim();
  return form || null;
}


// Corrections de contenu établies par l'audit du 2026-07-20, appliquées À LA GÉNÉRATION
// plutôt que dans bank.json : elles restent ainsi lisibles comme un ensemble, et les
// contrôles de tools/graph/integrity.mjs prouvent qu'elles ont pris. Clé = position
// d'origine dans bank.json.
const FIXES = {
  // « なながつ » figurait deux fois : la question n'avait que 3 options réelles.
  1381: (q) => ({ ...q, o: ["しちがつ", "なながつ", "しちげつ", "ななつき"] }),
  // Cinq paires d'homophones proposaient les MÊMES options et désignaient une bonne
  // réponse différente : aucune des deux n'était défendable. On désambiguïse l'énoncé
  // par le sens visé, ce qui rend chaque question répondable sans en supprimer aucune.
  5884: (q) => ({ ...q, q: "「いる」（存在する）を漢字で書くと？" }),
  5886: (q) => ({ ...q, q: "「いる」（必要だ）を漢字で書くと？" }),
  6182: (q) => ({ ...q, q: "「さす」（傘を〜）を漢字で書くと？" }),
  9014: (q) => ({ ...q, q: "「さす」（針で〜）を漢字で書くと？" }),
  6348: (q) => ({ ...q, q: "「つく」（到着する）を漢字で書くと？" }),
  6862: (q) => ({ ...q, q: "「つく」（明かりが〜）を漢字で書くと？" }),
  7594: (q) => ({ ...q, q: "「かてい」（家族の〜）を漢字で書くと？" }),
  8448: (q) => ({ ...q, q: "「かてい」（もし〜すれば）を漢字で書くと？" }),
  7618: (q) => ({ ...q, q: "「かみ」（頭の〜）を漢字で書くと？" }),
  8468: (q) => ({ ...q, q: "「かみ」（神社の〜）を漢字で書くと？" }),
};

/** Doublons purs inter-catégories : même énoncé, mêmes options, même réponse, rangés
 *  dans deux compétences. On garde l'occurrence kanji et on écarte celle de vocabulaire —
 *  ce sont des questions de lecture de kanji. */
const DROP = new Set([4530, 4696, 5108]);

export function applyFixes(q, ord) {
  const fix = FIXES[ord];
  return fix ? fix(q) : q;
}

export function isDropped(ord) {
  return DROP.has(ord);
}

const SKILLS = ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"];
const arrOf = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** Arêtes `tests` d'une question : la forme de grammaire du corrigé, ou le sujet 「…」
 *  de l'énoncé résolu vers un mot puis un kanji. Extrait de la boucle de buildQuestions
 *  pour que la double passe sur les ordinaux reste lisible — même code, déplacé. */
export function edgesFor(q, { known, gramByForm }) {
  const tests = [];
  if (q.cat === "grammaire") {
    const f = gramFormOf(q);
    const id = f ? gramByForm.get(slugify(f)) : undefined;
    if (id) tests.push(id);
  } else {
    const sujet = subjectOf(q);
    if (sujet) {
      for (const cand of [`jlpt:word/${sujet}`, `jlpt:kanji/${sujet}`]) {
        if (known.has(cand)) { tests.push(cand); break; }
      }
    }
  }
  return tests;
}

/** Une question de bank.json en sujet jlpt:Question. */
export function sujetQuestion(q, ord, tests) {
  return {
    "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question",
    "jlpt:skill": q.cat, "jlpt:difficulty": q.d, "jlpt:ord": ord,
    "jlpt:stem": q.q,
    opts: q.o,
    "jlpt:answer": q.a,
    ...(q.e ? { "schema:description": q.e } : {}),
    ...(q.g ? { "jlpt:gloss": q.g } : {}),
    ...(q.od ? { "jlpt:optionNote": q.od } : {}),
    ...(q.script ? { "jlpt:script": q.script } : {}),
    ...(q.passage ? { "jlpt:passage": q.passage } : {}),
    ...(tests.length ? { tests } : {}),
  };
}

/** Les 10310 questions de bank.json en sujets jlpt:Question, shardés par compétence.
 *  L'ordinal est DÉRIVÉ ici une fois pour toutes, jamais saisi à la main : il indexe le
 *  bitset de couverture. */
export function buildQuestions({ kanji, word, gram }) {
  const bank = J("data/bank.json");
  const known = new Set([...kanji, ...word, ...gram].map((s) => s["@id"]));
  const gramByForm = new Map();
  for (const g of gram) {
    gramByForm.set(slugify(g["jlpt:form"]), g["@id"]);
    for (const alt of arrOf(g["jlpt:altForm"])) gramByForm.set(slugify(alt), g["@id"]);
  }

  // Deux passes : on range d'abord par compétence, on numérote ensuite. L'ordinal groupé
  // permet à corpus.jsonld de décrire tout le corpus en 5 intervalles au lieu d'un index de
  // 190 Ko — et un index absent ne peut pas se désynchroniser.
  //
  // L'ordinal est aussi RÉATTRIBUÉ après filtrage : écarter une question laisserait sinon
  // un trou, et checkCorpus exige des ordinaux denses.
  const brut = Object.fromEntries(SKILLS.map((s) => [s, []]));
  for (const [source, q0] of bank.entries()) {
    if (isDropped(source)) continue;
    brut[q0.cat].push(applyFixes(q0, source));
  }

  const bySkill = Object.fromEntries(SKILLS.map((s) => [s, []]));
  let ord = 0;
  let linked = 0;
  for (const skill of SKILLS) {
    for (const q of brut[skill]) {
      const tests = edgesFor(q, { known, gramByForm });
      if (tests.length) linked++;
      bySkill[skill].push(sujetQuestion(q, ord, tests));
      ord++;
    }
  }
  return { bySkill, linkRate: ord ? linked / ord : 0, total: ord };
}

/** Décrit le corpus en 5 intervalles. Remplace bank-index.json (190 Ko) : avec des
 *  ordinaux groupés, « à quelle compétence appartient l'id N » est une comparaison de
 *  bornes. checkCorpus vérifie ces intervalles contre les questions réelles — c'est ce
 *  qui rend la désynchronisation impossible, et non seulement improbable. */
export function buildCorpus(bySkill) {
  const out = [];
  for (const skill of SKILLS) {
    const qs = bySkill[skill];
    if (!qs.length) continue;
    out.push({
      "@id": `jlpt:corpus/${skill}`, "@type": "jlpt:SkillRange",
      "jlpt:skill": skill,
      "jlpt:from": qs[0]["jlpt:ord"],
      "jlpt:count": qs.length,
    });
  }
  return out;
}


/** Les trois cours ont des ids de groupe indépendants : on préfixe par la piste pour
 *  qu'un même id dans deux cours ne produise pas une seule leçon. */
export function lessonId(track, groupId) {
  return `jlpt:lesson/${track}-${slugify(groupId)}`;
}

/**
 * Une leçon ORDONNE des entités existantes ; elle n'en recopie plus mot/lecture/sens.
 * C'est le cœur de la promesse du graphe : corriger la lecture de 影響 sur son nœud
 * atteint le quiz, le dictionnaire ET le cours, parce qu'il n'y a qu'un nœud.
 *
 * Un item qui ne correspond à aucune entité est ignoré et COMPTÉ — le nombre dit
 * combien de contenu du cours n'est pas encore adossé au référentiel. C'est une
 * mesure, pas un échec silencieux.
 */
export function buildLessons({ kanji, word, gram }) {
  const known = new Set([...kanji, ...word, ...gram].map((s) => s["@id"]));
  const gramByForm = new Map();
  for (const g of gram) gramByForm.set(slugify(g["jlpt:form"]), g["@id"]);

  const lessons = [];
  let orphans = 0;
  for (const track of ["gram", "vocab", "kanji"]) {
    const src = J(`data/cours-${track}.json`);
    (src.groups ?? []).forEach((grp, order) => {
      const covers = [];
      for (const it of grp.items ?? []) {
        let iri = null;
        if (track === "gram" && it.form) {
          iri = gramByForm.get(slugify(String(it.form).split(" / ")[0])) ?? null;
        } else if (track === "vocab" && it.mot) {
          iri = `jlpt:word/${norm(it.mot)}`;
        } else if (track === "kanji" && it.kanji) {
          // ⚠ Le champ diffère par piste : « mot » côté vocab, « kanji » côté kanji,
          // « form » côté grammaire. Réutiliser « mot » ici reliait 0 item sur 551,
          // en silence — un taux nul est un bug, jamais une donnée.
          iri = `jlpt:kanji/${norm(it.kanji)}`;
        }
        if (iri && known.has(iri)) covers.push(iri);
        else orphans++;
      }
      lessons.push({
        "@id": lessonId(track, grp.id), "@type": "jlpt:Lesson",
        "schema:name": norm(grp.title) || grp.id,
        "jlpt:order": order,
        "jlpt:track": track,
        ...(covers.length ? { covers: [...new Set(covers)] } : {}),
      });
    });
  }
  return { lessons, orphans };
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

  const { bySkill, linkRate, total } = buildQuestions({ kanji, word, gram });
  for (const [skill, sujets] of Object.entries(bySkill)) {
    writeFileSync(`data/graph/q-${skill}.jsonld`, doc(sujets));
  }
  writeFileSync("data/graph/corpus.jsonld", doc(buildCorpus(bySkill)));

  const aArbitrer = conflicts.filter((c) => c.retenu === "(à arbitrer)").length;
  console.log(`kanji ${kanji.length} · mots ${word.length} · grammaire ${gram.length}`);
  console.log(`${ecartes} motifs grammaticaux écartés des mots (ils appartiennent à la grammaire)`);
  console.log(`conflits ${conflicts.length} (dont ${aArbitrer} non tranchés)`);
  const { lessons, orphans } = buildLessons({ kanji, word, gram });
  writeFileSync("data/graph/lesson.jsonld", doc(lessons));

  console.log(`questions ${total} · arêtes tests ${(linkRate * 100).toFixed(1)} %`);
  console.log(`leçons ${lessons.length} · items de cours sans entité ${orphans}`);
}
