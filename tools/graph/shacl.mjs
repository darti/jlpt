// Parseur + validateur du sous-ensemble SHACL d'Oku.
// Référence : oku/crates/core/domain-bridge/src/{shape,validate}.rs
//
// Contraintes supportées, et AUCUNE autre : sh:path, sh:datatype, sh:minCount,
// sh:maxCount, sh:in, sh:nodeKind. Le parseur d'Oku échoue sur toute autre contrainte
// (« unsupported constraint ») ; le nôtre doit refuser les mêmes, sinon une shape valide
// ici serait rejetée là-bas.
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { expandIri, expandPredicate, isSafeIri } from "./jsonld.mjs";

const SUPPORTED = new Set([
  "sh:path", "sh:datatype", "sh:minCount", "sh:maxCount", "sh:in", "sh:nodeKind",
  "@id", "@type",
]);

function count(v, where) {
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < 0 || v > 0xFFFFFFFF) {
    throw new Error(`${where} : cardinalité invalide ${JSON.stringify(v)}`);
  }
  return v;
}

function parseProperty(p, prefixes, where) {
  for (const k of Object.keys(p)) {
    if (!SUPPORTED.has(k)) throw new Error(`${where} : contrainte non supportée ${k}`);
  }
  const path = p["sh:path"];
  if (typeof path !== "string" || !path) throw new Error(`${where} : sh:path manquant`);

  let allowedValues;
  if (p["sh:in"] !== undefined) {
    const arr = p["sh:in"];
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error(`${where} : sh:in doit être un tableau non vide`);
    }
    // Oku fait filter_map(as_str) : un non-string y disparaît SANS ERREUR, et
    // « sh:in: [1,2,3] » y deviendrait une liste vide. On refuse plutôt que de livrer
    // une shape qui ne veut pas dire la même chose des deux côtés.
    const bad = arr.find((v) => typeof v !== "string");
    if (bad !== undefined) {
      throw new Error(`${where} : sh:in n'accepte que des chaînes (reçu ${JSON.stringify(bad)})`);
    }
    allowedValues = [...arr];
  }

  let nodeKind;
  if (p["sh:nodeKind"] !== undefined) {
    const nk = String(p["sh:nodeKind"]).replace(/^sh:/, "");
    if (nk !== "IRI" && nk !== "Literal") throw new Error(`${where} : sh:nodeKind invalide ${nk}`);
    nodeKind = nk;
  }

  return {
    path: expandIri(path, prefixes),
    datatype: p["sh:datatype"] === undefined ? undefined : expandIri(p["sh:datatype"], prefixes),
    minCount: count(p["sh:minCount"], where),
    maxCount: count(p["sh:maxCount"], where),
    allowedValues,
    nodeKind,
  };
}

const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Extrait les NodeShape d'une liste de sujets. Lève sur shape invalide — une shape fausse
 *  est un bug de modèle, pas une donnée à signaler. */
export function parseShapes(subjects, prefixes) {
  const shapes = [];
  for (const s of subjects) {
    if (!asArray(s["@type"]).includes("sh:NodeShape")) continue;

    const shapeIri = expandIri(s["@id"] ?? "", prefixes);
    const target = s["sh:targetClass"];
    if (typeof target !== "string" || !target) {
      throw new Error(`${s["@id"]} : sh:targetClass manquant`);
    }
    const props = asArray(s["sh:property"]);
    shapes.push({
      shapeIri,
      targetClass: expandIri(target, prefixes),
      properties: props.map((p, i) => parseProperty(p, prefixes, `${s["@id"]}/prop[${i}]`)),
    });
  }
  return shapes;
}

const XSD = "http://www.w3.org/2001/XMLSchema#";

/** Un littéral respecte-t-il le datatype xsd déclaré ? Sous-ensemble : string, integer,
 *  nonNegativeInteger, boolean. `null` pour un datatype inconnu — c'est une erreur de
 *  shape, pas de donnée, et il vaut mieux la signaler que la traiter comme valide. */
function datatypeOk(value, datatype) {
  switch (datatype) {
    case `${XSD}string`: return typeof value === "string";
    case `${XSD}integer`: return Number.isInteger(value);
    case `${XSD}nonNegativeInteger`: return Number.isInteger(value) && value >= 0;
    case `${XSD}boolean`: return typeof value === "boolean";
    default: return null;
  }
}

/** Normalise un contexte `{ prefixes, terms }`. **Lève** si on lui passe la seule table
 *  de préfixes : ce serait rendre les alias de termes invisibles, donc désactiver en
 *  silence toutes les contraintes portées par `tests`, `usesKanji` et `covers`. Autant
 *  échouer bruyamment que valider dans le vide. */
function ctxOf(context) {
  if (!context || typeof context !== "object" || !context.prefixes) {
    throw new Error(
      "validate* attend un contexte { prefixes, terms } : passer la seule table de "
      + "préfixes rendrait les alias (tests, usesKanji, covers) invisibles à la validation",
    );
  }
  return { prefixes: context.prefixes, terms: context.terms ?? {} };
}

/** Valeurs d'un prédicat, que le document l'écrive en alias (`usesKanji`), en forme
 *  préfixée (`jlpt:stem`) ou dépliée : le sh:path est déplié, la comparaison doit l'être
 *  des deux côtés. */
function valuesOf(subject, path, ctx) {
  const out = [];
  for (const [k, v] of Object.entries(subject)) {
    if (k === "@id" || k === "@type") continue;
    // On ACCUMULE au lieu de rendre la première correspondance : un sujet portant à la
    // fois « jlpt:stem » et sa forme dépliée verrait sinon l’une des deux disparaître en
    // silence, et maxCount ne la détecterait pas.
    if (expandPredicate(k, ctx) === path) out.push(...asArray(v));
  }
  return out;
}

/** Valide un sujet contre une shape. Retourne des messages, ne lève pas : une donnée
 *  invalide est un rapport à lire, pas un plantage. */
export function validateSubject(subject, shape, context) {
  const ctx = ctxOf(context);
  const errs = [];
  const id = subject["@id"] ?? "(sans @id)";
  for (const p of shape.properties) {
    const vals = valuesOf(subject, p.path, ctx);
    const short = p.path.split(/[#/]/).pop();

    if (p.minCount !== undefined && vals.length < p.minCount) {
      errs.push(`${id} : ${short} — minCount ${p.minCount}, trouvé ${vals.length}`);
    }
    if (p.maxCount !== undefined && vals.length > p.maxCount) {
      errs.push(`${id} : ${short} — maxCount ${p.maxCount}, trouvé ${vals.length}`);
    }
    for (const v of vals) {
      if (p.datatype !== undefined) {
        const res = datatypeOk(v, p.datatype);
        if (res === null) errs.push(`${id} : ${short} — datatype non supporté ${p.datatype}`);
        else if (!res) errs.push(`${id} : ${short} — attendu ${p.datatype}, reçu ${JSON.stringify(v)}`);
      }
      if (p.allowedValues !== undefined && !p.allowedValues.includes(v)) {
        errs.push(`${id} : ${short} — « ${v} » hors de [${p.allowedValues.join(", ")}]`);
      }
      if (p.nodeKind === "IRI") {
        const iri = typeof v === "object" && v !== null ? v["@id"] : v;
        if (typeof iri !== "string" || !isSafeIri(iri)) {
          errs.push(`${id} : ${short} — IRI invalide ou non sûre ${JSON.stringify(v)}`);
        }
      }
    }
  }
  return errs;
}

/** Valide tous les sujets. Un sujet dont le @type n'a aucune shape est signalé : c'est
 *  presque toujours une faute de frappe, jamais une intention. */
export function validateAll(subjects, shapes, context) {
  const ctx = ctxOf(context);
  const byClass = new Map(shapes.map((s) => [s.targetClass, s]));
  const errs = [];
  for (const s of subjects) {
    const types = asArray(s["@type"]);
    if (types.includes("sh:NodeShape")) continue;
    let matched = false;
    for (const t of types) {
      const shape = byClass.get(expandIri(t, ctx.prefixes));
      if (!shape) continue;
      matched = true;
      errs.push(...validateSubject(s, shape, ctx));
    }
    if (!matched) errs.push(`${s["@id"] ?? "(sans @id)"} : aucune shape pour @type ${JSON.stringify(types)}`);
  }
  return errs;
}
