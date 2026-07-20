// Contrôles que SHACL ne peut pas exprimer : relations entre deux propriétés d'un même
// sujet, et invariants portant sur l'ensemble du corpus.
//
// SHACL contraint la FORME d'un sujet (cardinalité, type, énumération). Il ne sait pas
// dire « answer doit indexer opts », « ces deux questions se contredisent » ni « les
// ordinaux doivent être denses ». Tout ça vit ici, et y restera même après le passage
// chez Oku — c'est du code, pas de la déclaration.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.

import { isSafeIri } from "./jsonld.mjs";

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Contrôles internes à une question. */
export function checkQuestion(s) {
  const errs = [];
  const id = s["@id"] ?? "(sans @id)";
  const opts = arr(s.opts);
  const answer = s["jlpt:answer"];
  const notes = s["jlpt:optionNote"];
  const diff = s["jlpt:difficulty"];

  if (opts.length < 2) errs.push(`${id} : au moins 2 options attendues, trouvé ${opts.length}`);

  if (!Number.isInteger(answer) || answer < 0 || answer >= opts.length) {
    errs.push(`${id} : answer ${JSON.stringify(answer)} hors des ${opts.length} options`);
  }

  // Normalisé : deux options que seuls les espaces séparent sont un doublon réel, et
  // rendraient la question sans réponse défendable (cf. #1381, « なながつ » en double).
  if (new Set(opts.map(norm)).size !== opts.length) {
    errs.push(`${id} : options identiques — [${opts.join(" | ")}]`);
  }

  if (notes !== undefined && arr(notes).length !== opts.length) {
    errs.push(`${id} : optionNote de longueur ${arr(notes).length} pour ${opts.length} options`);
  }

  // La plage 1–3 ne peut PAS être un sh:in : Oku fait filter_map(as_str) et laisserait
  // tomber les valeurs numériques, produisant une contrainte vide.
  if (![1, 2, 3].includes(diff)) {
    errs.push(`${id} : difficulty ${JSON.stringify(diff)} hors de 1–3`);
  }

  return errs;
}

const isQuestion = (s) => arr(s["@type"]).includes("jlpt:Question");

/** Prédicats qui portent une référence vers un autre sujet. Écrits en alias dans nos
 *  documents (cf. context.jsonld) — c'est cette forme qu'on lit ici. */
const REF_PREDICATES = ["tests", "usesKanji", "covers", "illustrates"];

/** Une leçon doit couvrir au moins une entité. Sinon elle rend un groupe VIDE dans la vue :
 *  du contenu disparu sans la moindre erreur. C'est le garde-fou durable qui remplace le
 *  décompte d'orphelins de la migration — celui-ci n'avait de sens que face à cours-*.json,
 *  et une IRI pendante est déjà attrapée par l'intégrité référentielle. */
export function checkLessonCoverage(subjects) {
  const errs = [];
  for (const s of subjects) {
    if (!arr(s["@type"]).includes("jlpt:Lesson")) continue;
    if (!arr(s.covers).length) errs.push(`${s["@id"]} : la leçon ne couvre aucune entité`);
  }
  return errs;
}

/** Invariants portant sur l'ensemble du corpus : densité et unicité des ordinaux,
 *  intégrité référentielle, questions contradictoires. */
export function checkCorpus(subjects) {
  const errs = [];
  const questions = subjects.filter(isQuestion);

  // --- identité des sujets ---
  // Aucune shape ne contraint le @id : sh:nodeKind ne porte que sur les VALEURS de
  // prédicats. Or ces IRIs partent dans un store adossé à SQL, et slugify() est la
  // seule chose entre une forme de grammaire et son @id. On vérifie donc ici.
  const vus = new Set();
  for (const s of subjects) {
    const id = s["@id"];
    if (!isSafeIri(id)) errs.push(`@id absent ou non sûr : ${JSON.stringify(id)}`);
    else if (vus.has(id)) errs.push(`@id en double : ${id}`);
    vus.add(id);
  }

  // --- ordinaux : uniques et denses sur [0, n-1] ---
  // L'ordinal indexe le bitset de couverture (seen/mastered) : un trou décale tout,
  // un doublon fait que deux questions partagent le même bit.
  const byOrd = new Map();
  for (const q of questions) {
    const o = q["jlpt:ord"];
    if (!byOrd.has(o)) byOrd.set(o, []);
    byOrd.get(o).push(q["@id"]);
  }
  for (const [o, ids] of byOrd) {
    if (ids.length > 1) errs.push(`ord ${o} en double : ${ids.join(", ")}`);
  }
  for (let i = 0; i < questions.length; i++) {
    if (!byOrd.has(i)) {
      errs.push(`ord non dense : ${i} manquant sur ${questions.length} questions`);
      break;
    }
  }

  // --- cohérence des SkillRange ---
  // corpus.jsonld décrit le corpus ; s'il ment, l'app résout les ids vers la mauvaise
  // compétence sans la moindre erreur. On le confronte donc aux questions réelles.
  const ranges = subjects.filter((s) => arr(s["@type"]).includes("jlpt:SkillRange"));
  if (ranges.length) {
    const parSkill = new Map();
    for (const q of questions) {
      const s = q["jlpt:skill"];
      if (!parSkill.has(s)) parSkill.set(s, []);
      parSkill.get(s).push(q["jlpt:ord"]);
    }
    for (const r of ranges) {
      const ords = (parSkill.get(r["jlpt:skill"]) ?? []).sort((a, b) => a - b);
      const from = r["jlpt:from"];
      const count = r["jlpt:count"];
      if (ords.length !== count) {
        errs.push(`SkillRange ${r["jlpt:skill"]} : count ${count}, mais ${ords.length} questions`);
      } else if (ords.length && (ords[0] !== from || ords[ords.length - 1] !== from + count - 1)) {
        errs.push(`SkillRange ${r["jlpt:skill"]} : intervalle [${from}, ${from + count - 1}] ≠ réel [${ords[0]}, ${ords[ords.length - 1]}]`);
      }
    }
  }

  // --- intégrité référentielle ---
  // Classe d'erreur qu'AUCUN mécanisme ne pouvait détecter avant que le lien ne devienne
  // une donnée : le rappel de cours était deviné en parsant la prose du corrigé.
  const known = new Set(subjects.map((s) => s["@id"]).filter(Boolean));
  for (const s of subjects) {
    for (const pred of REF_PREDICATES) {
      for (const ref of arr(s[pred])) {
        const iri = typeof ref === "object" && ref !== null ? ref["@id"] : ref;
        if (!known.has(iri)) errs.push(`${s["@id"]} : référence pendante ${pred} → ${iri}`);
      }
    }
  }

  // --- questions contradictoires ---
  // Même énoncé, même JEU d'options, mais bonne réponse différente : quel que soit le
  // choix de l'apprenant, l'une des deux le corrige à tort. Les options sont triées pour
  // la clé, mais la réponse est comparée par sa VALEUR — une simple permutation des
  // options est une redondance, pas une contradiction.
  const byKey = new Map();
  for (const q of questions) {
    const opts = arr(q.opts).map(norm);
    const key = `${norm(q["jlpt:stem"])}||${[...opts].sort().join("|")}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(q);
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const answers = new Set(group.map((q) => norm(arr(q.opts)[q["jlpt:answer"]])));
    if (answers.size > 1) {
      errs.push(
        `réponses contradictoires entre ${group.map((q) => q["@id"]).join(", ")} — `
        + `« ${norm(group[0]["jlpt:stem"])} » → ${[...answers].join(" ≠ ")}`,
      );
    }
  }

  errs.push(...checkLessonCoverage(subjects));

  return errs;
}
