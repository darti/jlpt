#!/usr/bin/env node
// Script de migration ONE-SHOT : absorbe data/cours-*.json dans data/graph/.
//
// ⚠ SUPPRIMÉ dans le commit de la Task 6, une fois son résultat commité. Il ne doit JAMAIS
// devenir un générateur permanent — c'est ce qui a tué transform-cours.mjs et migrate-to-graph.mjs.
// Le graphe est la source ; rien ne le régénère. Ce qui porte une règle durable a été extrait
// avant (splitOnKun → tools/graph/kana.mjs).
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { readFileSync, writeFileSync } from "node:fs";
import { splitOnKun } from "./graph/kana.mjs";

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const G = (n) => J(`data/graph/${n}`);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const doc = (subjects) =>
  JSON.stringify({ "@context": "context.jsonld", "@graph": subjects }, null, 1) + "\n";

/** Slug d'une forme de grammaire → segment d'IRI. Même règle que le graphe existant. */
const slugify = (form) =>
  String(form ?? "").replace(/〜/g, "").replace(/\s*\/\s*/g, "-")
    .replace(/[\s'\\;*]/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

/** Mot du cours → nom d'entité : retire le suffixe entre parenthèses (« 予防(する) ») et
 *  prend la première forme d'une cellule « A / B ». 63 des 66 items non résolus le sont
 *  par cette seule normalisation. */
export function normalizeMot(mot) {
  return norm(norm(mot).split(" / ")[0].replace(/[（(].*?[)）]/g, ""));
}

/** Les exemples du cours de grammaire, rattachés à l'ENTITÉ qu'ils illustrent. */
export function buildExamples(coursGram, gramByForm) {
  const out = [];
  for (const g of coursGram.groups ?? []) {
    for (const it of g.items ?? []) {
      const iri = gramByForm.get(slugify(String(it.form ?? "").split(" / ")[0]));
      if (!iri) continue;
      (it.examples ?? []).forEach((ex, i) => {
        out.push({
          "@id": `jlpt:example/${slugify(it.form)}-${i + 1}`,
          "@type": "jlpt:Example",
          illustrates: iri,
          "jlpt:jp": norm(ex.jp),
          ...(norm(ex.ro) ? { "jlpt:romaji": norm(ex.ro) } : {}),
          ...(norm(ex.fr) ? { "schema:description": norm(ex.fr) } : {}),
          ...(ex.an?.length ? { "jlpt:analysis": ex.an.map(norm) } : {}),
        });
      });
    }
  }
  return out;
}

/** Les sections de méthode. Nœuds isolés, sans arête : c'est de la prose. */
export function buildMethod(coursMethod) {
  return (coursMethod.sections ?? []).map((s, i) => ({
    "@id": `jlpt:method/${i === 0 ? "dokkai" : "choukai"}`,
    "@type": "jlpt:MethodNote",
    "schema:name": norm(s.title),
    "jlpt:order": i,
    "jlpt:tip": (s.tips ?? []).map(norm),
  }));
}

/** Pose les lectures on/kun et le composé sur les kanji, et CRÉE les absents.
 *  N'écrase jamais une valeur déjà portée par le graphe : il fait autorité. */
export function enrichKanji(sujets, coursKanji) {
  const parNom = new Map(sujets.map((s) => [s["schema:name"], { ...s }]));
  let crees = 0;
  let lectures = 0;
  for (const g of coursKanji.groups ?? []) {
    for (const it of g.items ?? []) {
      const k = norm(it.kanji);
      if (!k) continue;
      let s = parNom.get(k);
      if (!s) {
        s = { "@id": `jlpt:kanji/${k}`, "@type": "jlpt:Kanji", "schema:name": k };
        parNom.set(k, s);
        crees++;
      }
      if (!s["schema:description"] && norm(it.sens)) s["schema:description"] = norm(it.sens);
      const { on, kun } = splitOnKun(it.lecture);
      if (!s["jlpt:onReading"] && on.length) { s["jlpt:onReading"] = on; lectures++; }
      if (!s["jlpt:kunReading"] && kun.length) s["jlpt:kunReading"] = kun;
      if (!s["jlpt:compound"] && norm(it.exemple)) s["jlpt:compound"] = norm(it.exemple);
    }
  }
  return { sujets: [...parNom.values()], crees, lectures };
}

/** Comble les lectures de mots absentes du graphe. Le graphe fait autorité : une divergence
 *  est LISTÉE, jamais appliquée. Même règle que tools/graph/readings.mjs. */
export function fillWordReadings(sujets, coursVocab) {
  const parNom = new Map(sujets.map((s) => [s["schema:name"], { ...s }]));
  let comblees = 0;
  const divergences = [];
  for (const g of coursVocab.groups ?? []) {
    for (const it of g.items ?? []) {
      const nom = normalizeMot(it.mot);
      const lecture = norm(it.lecture);
      const s = parNom.get(nom);
      if (!s || !lecture) continue;
      if (!s["jlpt:reading"]) { s["jlpt:reading"] = lecture; comblees++; }
      else if (s["jlpt:reading"] !== lecture) divergences.push(nom);
    }
  }
  return { sujets: [...parNom.values()], comblees, divergences };
}

/** Un motif n'est pas un mot, où qu'il soit rangé.
 *
 *  Le cours de vocabulaire contient des MOTIFS grammaticaux (« なかなか〜ない ») — le lot 1
 *  les avait exclus de word.jsonld pour cette raison exacte, mais rien ne les avait alors
 *  reversés à la grammaire, donc ils n'existaient nulle part. On applique ici la règle
 *  symétrique : un item de vocabulaire portant 〜 devient un jlpt:GrammarPoint.
 *
 *  Le graphe fait autorité : un motif qui a déjà son entité n'est pas recréé. */
export function patternsAsGram(coursVocab, gram) {
  const parId = new Map(gram.map((g) => [g["@id"], g]));
  const crees = [];
  for (const g of coursVocab.groups ?? []) {
    for (const it of g.items ?? []) {
      const mot = norm(it.mot);
      if (!/[〜～]/.test(mot)) continue;
      const id = `jlpt:gram/${slugify(mot)}`;
      if (parId.has(id)) continue;
      const sujet = {
        "@id": id, "@type": "jlpt:GrammarPoint", "jlpt:form": mot,
        ...(norm(it.sens) ? { "schema:description": norm(it.sens) } : {}),
      };
      parId.set(id, sujet);
      crees.push(mot);
    }
  }
  return { sujets: [...parId.values()], crees };
}

/** Régénère les leçons. Après enrichKanji + normalizeMot, il ne doit rester AUCUN orphelin. */
export function rebuildLessons(cours, known, gramByForm) {
  const lessons = [];
  const orphelins = [];
  for (const track of ["gram", "vocab", "kanji"]) {
    (cours[track].groups ?? []).forEach((grp, order) => {
      const covers = [];
      for (const it of grp.items ?? []) {
        let iris = [];
        if (track === "gram" && it.form) {
          const iri = gramByForm.get(slugify(String(it.form).split(" / ")[0]));
          if (iri) iris = [iri];
        } else if (track === "vocab" && it.mot) {
          if (/[〜～]/.test(norm(it.mot))) {
            // Un motif grammatical rangé dans le vocabulaire pointe vers la GRAMMAIRE.
            iris = [`jlpt:gram/${slugify(norm(it.mot))}`];
          } else {
            // Une cellule « A / B » énumère plusieurs mots : chacun devient une arête.
            iris = norm(it.mot).split(" / ").map((m) => `jlpt:word/${normalizeMot(m)}`);
          }
        } else if (track === "kanji" && it.kanji) {
          iris = [`jlpt:kanji/${norm(it.kanji)}`];
        }
        const bons = iris.filter((i) => known.has(i));
        if (!bons.length) orphelins.push(`${track}: ${it.mot ?? it.kanji ?? it.form}`);
        covers.push(...bons);
      }
      lessons.push({
        "@id": `jlpt:lesson/${track}-${slugify(grp.id)}`,
        "@type": "jlpt:Lesson",
        "schema:name": norm(grp.title) || grp.id,
        "jlpt:order": order,
        "jlpt:track": track,
        ...(covers.length ? { covers: [...new Set(covers)] } : {}),
      });
    });
  }
  return { lessons, orphelins };
}

if (process.argv[1]?.endsWith("migrate-cours.mjs")) {
  const cours = {
    gram: J("data/cours-gram.json"),
    vocab: J("data/cours-vocab.json"),
    kanji: J("data/cours-kanji.json"),
    method: J("data/cours-method.json"),
  };

  const gram = G("gram.jsonld")["@graph"];
  const gramByForm = new Map();
  for (const g of gram) {
    gramByForm.set(slugify(g["jlpt:form"]), g["@id"]);
    for (const alt of [].concat(g["jlpt:altForm"] ?? [])) gramByForm.set(slugify(alt), g["@id"]);
  }

  const pat = patternsAsGram(cours.vocab, gram);
  if (pat.crees.length) {
    writeFileSync("data/graph/gram.jsonld", doc(pat.sujets));
    for (const f of pat.crees) gramByForm.set(slugify(f), `jlpt:gram/${slugify(f)}`);
  }

  const k = enrichKanji(G("kanji.jsonld")["@graph"], cours.kanji);
  writeFileSync("data/graph/kanji.jsonld", doc(k.sujets));
  const w = fillWordReadings(G("word.jsonld")["@graph"], cours.vocab);
  writeFileSync("data/graph/word.jsonld", doc(w.sujets));

  const examples = buildExamples(cours.gram, gramByForm);
  writeFileSync("data/graph/example.jsonld", doc(examples));
  writeFileSync("data/graph/method.jsonld", doc(buildMethod(cours.method)));

  const known = new Set([...k.sujets, ...w.sujets, ...pat.sujets].map((s) => s["@id"]));
  const { lessons, orphelins } = rebuildLessons(cours, known, gramByForm);
  writeFileSync("data/graph/lesson.jsonld", doc(lessons));

  console.log(`kanji : ${k.crees} créés, ${k.lectures} lectures posées (total ${k.sujets.length})`);
  console.log(`mots : ${w.comblees} lectures comblées, ${w.divergences.length} divergences (graphe prioritaire)`);
  if (w.divergences.length) console.log(`  ${w.divergences.join(", ")}`);
  console.log(`motifs reversés à la grammaire : ${pat.crees.length} (${pat.crees.join(", ")})`);
  console.log(`exemples ${examples.length} · leçons ${lessons.length}`);
  if (orphelins.length) {
    console.error(`✗ ${orphelins.length} item(s) de cours sans entité :`);
    for (const o of orphelins.slice(0, 40)) console.error(`  ${o}`);
    process.exit(1);
  }
  console.log("✓ zéro orphelin");
}
