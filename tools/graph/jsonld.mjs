// Sous-ensemble JSON-LD suffisant pour nos documents : résolution des préfixes et des alias
// de termes. PAS une implémentation JSON-LD complète — ni @base, ni @reverse, ni langue,
// ni @vocab. Nos documents écrivent donc TOUJOURS des IRIs préfixées (`jlpt:word/影響`),
// jamais de terme nu : `@vocab` est volontairement absent du contexte plutôt que déclaré
// sans être implémenté, ce qui laisserait croire qu'un `{"@id": "word/影響"}` sera déplié.
//
// Les valeurs rendues restent COMPACTES : `terms.tests.id` vaut « jlpt:tests », et
// `readDoc().subjects` est le @graph brut, non déplié. C'est l'appelant qui déplie via
// expandIri au moment de comparer (cf. shacl.mjs#validateSubject, qui compare
// expandIri(clé) au sh:path déplié — donc tolère les deux formes).
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Caractères qu'Oku refuse dans une IRI (is_safe_iri_for_sql). */
const UNSAFE_SUBSTR = ["'", ";", "--", "\\", "/*"];
// Contrôles ASCII + contrôles de formatage Unicode, en séquences d'échappement :
// les écrire en littéral rendrait le fichier binaire pour grep et les outils.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;

/** Une IRI acceptable par le store Oku (adossé à SQL). L'Unicode japonais passe. */
export function isSafeIri(iri) {
  if (typeof iri !== "string" || iri.length === 0) return false;
  if (UNSAFE_CHARS.test(iri)) return false;
  return !UNSAFE_SUBSTR.some((s) => iri.includes(s));
}

/** `jlpt:Question` → IRI complète. Un préfixe inconnu ou une IRI absolue ressort inchangé :
 *  fabriquer une IRI à partir d'un préfixe non déclaré masquerait une faute de frappe. */
export function expandIri(value, prefixes) {
  if (typeof value !== "string") return value;
  const i = value.indexOf(":");
  if (i <= 0) return value;
  const head = value.slice(0, i);
  const base = prefixes[head];
  return base === undefined ? value : base + value.slice(i + 1);
}

/** Sépare le @context en préfixes (valeurs chaîne) et alias de termes (valeurs objet). */
export function parseContext(ctx) {
  const prefixes = {};
  const terms = {};
  for (const [k, v] of Object.entries(ctx ?? {})) {
    if (typeof v === "string") prefixes[k] = v;
    else if (v && typeof v === "object") {
      terms[k] = { id: v["@id"], type: v["@type"], container: v["@container"] };
    }
  }
  return { prefixes, terms };
}

export function readContext(path) {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  return parseContext(doc["@context"]);
}

/** Lit un document `{ "@context": …, "@graph": [ … ] }`.
 *
 *  Le `@context` peut être : une chaîne — chemin **résolu relativement au document**, c'est
 *  la forme que nos fichiers utilisent (`"@context": "context.jsonld"`) ; un objet inline ;
 *  ou absent, auquel cas `contextPath` sert de repli.
 *
 *  ⚠ La chaîne est réellement suivie. Une version antérieure branchait dessus mais chargeait
 *  `contextPath` : un document désignant un autre contexte aurait été lu avec le mauvais,
 *  sans erreur ni avertissement. */
export function readDoc(path, contextPath = "data/graph/context.jsonld") {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const raw = doc["@context"];
  let ctx;
  if (typeof raw === "string") ctx = readContext(resolve(dirname(path), raw));
  else if (raw && typeof raw === "object") ctx = parseContext(raw);
  else ctx = readContext(contextPath);
  const subjects = Array.isArray(doc["@graph"]) ? doc["@graph"] : [];
  return { context: ctx, subjects };
}
