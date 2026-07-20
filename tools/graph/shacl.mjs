// Parseur + validateur du sous-ensemble SHACL d'Oku.
// Référence : oku/crates/core/domain-bridge/src/{shape,validate}.rs
//
// Contraintes supportées, et AUCUNE autre : sh:path, sh:datatype, sh:minCount,
// sh:maxCount, sh:in, sh:nodeKind. Le parseur d'Oku échoue sur toute autre contrainte
// (« unsupported constraint ») ; le nôtre doit refuser les mêmes, sinon une shape valide
// ici serait rejetée là-bas.
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { expandIri } from "./jsonld.mjs";

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
