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
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

/** Emplacement du graphe — source ET livrable (cf. ARCHITECTURE.md). Huit outils le
 *  retapaient en littéral ; une seule source évite qu'un déplacement en oublie un. */
export const GRAPH_DIR = "data/graph";

/** Chemin d'un document du graphe : `graphPath("word.jsonld")`. */
export function graphPath(nom) {
  return `${GRAPH_DIR}/${nom}`;
}

/** Parse un fichier JSON du dépôt. Sert aussi aux fichiers de DÉCISIONS (`data/*-arbitrees.json`),
 *  qui ne sont pas des documents du graphe mais se lisent de la même façon. */
export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Lit un document du graphe SANS interpréter son `@context` — le pendant écriture-compatible
 * de `readDoc`.
 *
 * Rend le document ENTIER (`doc`) en plus de ses sujets : c'est ce que `writeGraph` doit
 * recevoir pour préserver `@context` et toute autre clé de tête. `readDoc`, lui, rend le
 * contexte *analysé* — utile pour valider, inutilisable pour réécrire.
 */
export function readGraph(path) {
  const doc = readJson(path);
  return { doc, subjects: Array.isArray(doc["@graph"]) ? doc["@graph"] : [] };
}

/**
 * Réécrit un document en remplaçant son `@graph`, dans le FORMAT du dépôt : indentation 1,
 * saut de ligne final, japonais en clair.
 *
 * ⚠ Ce format n'est pas cosmétique : c'est la forme sous laquelle 10 351 questions sont
 * versionnées. Il était retapé à l'identique dans huit outils — une indentation qui dérive
 * d'un cran dans un seul réécrit le fichier entier et rend le diff illisible. D'où une
 * seule définition, gardée par `graphio.test.ts`.
 *
 * `@graph` est REMPLACÉ, jamais fusionné : l'appelant a déjà bâti la liste complète.
 */
export function writeGraph(path, doc, subjects) {
  writeFileSync(path, JSON.stringify({ ...doc, "@graph": subjects }, null, 1) + "\n");
}

/** Caractères qu'Oku refuse dans une IRI (is_safe_iri_for_sql). */
const UNSAFE_SUBSTR = ["'", ";", "--", "\\", "/*"];
// Contrôles C0 (\u0000-\u001F) puis DEL+C1 (\u007F-\u009F), et contrôles de FORMATAGE
// Unicode. C1 est de catégorie Cc comme C0 : s'arrêter à l'ASCII 7 bits laissait passer
// NEL (U+0085), pourtant un contrôle de saut de ligne.
// ⚠ NE PAS replier en un seul \u0000-\u009F : cet intervalle avale tout l'ASCII
// imprimable (lettres, « : », « / ») et rejetterait toutes nos IRIs.
// En séquences d'échappement : en littéral, le fichier devient binaire pour grep.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;

/**
 * Une IRI acceptable par le store Oku (adossé à SQL). L'Unicode japonais passe.
 *
 * ⚠ Défense en profondeur, JAMAIS l'unique garde : une liste de refus est incomplète par
 * construction, le store doit passer par des requêtes paramétrées et Oku refait sa propre
 * vérification côté Rust.
 *
 * ⚠ On ne normalise PAS en NFKC avant de vérifier, alors que ce serait la parade usuelle au
 * contournement par variantes pleine chasse. Ici ce serait nuisible : NFKC replie les
 * katakana demi-chasse (ｱ → ア) et déformerait le contenu japonais, qui est exactement ce
 * que ces IRIs transportent.
 */
export function isSafeIri(iri) {
  if (typeof iri !== "string" || iri.length === 0) return false;
  if (UNSAFE_CHARS.test(iri)) return false;
  return !UNSAFE_SUBSTR.some((s) => iri.includes(s));
}

/** `jlpt:Question` → IRI complète. Un préfixe inconnu ou une IRI absolue ressort inchangé :
 *  fabriquer une IRI à partir d'un préfixe non déclaré masquerait une faute de frappe.
 *  `Object.hasOwn` plutôt que `prefixes[head]` : sur un objet ordinaire, lire `__proto__`
 *  rend `Object.prototype` au lieu de `undefined`, et « __proto__:x » se déplierait en
 *  « [object Object]x ». */
export function expandIri(value, prefixes) {
  if (typeof value !== "string") return value;
  const i = value.indexOf(":");
  if (i <= 0) return value;
  const head = value.slice(0, i);
  if (!Object.hasOwn(prefixes ?? {}, head)) return value;
  return prefixes[head] + value.slice(i + 1);
}

/** Sépare le @context en préfixes (valeurs chaîne) et alias de termes (valeurs objet). */
export function parseContext(ctx) {
  // Sans prototype : un @context contenant la clé « __proto__ » (JSON.parse en fait une
  // propriété propre énumérable) échangerait sinon le prototype de l'objet construit.
  const prefixes = Object.create(null);
  const terms = Object.create(null);
  for (const [k, v] of Object.entries(ctx ?? {})) {
    if (typeof v === "string") prefixes[k] = v;
    else if (v && typeof v === "object") {
      terms[k] = { id: v["@id"], type: v["@type"], container: v["@container"] };
    }
  }
  return { prefixes, terms };
}

export function readContext(path) {
  const doc = readJson(path);
  return parseContext(doc["@context"]);
}

/** Résout `rel` sous `base` et refuse d'en sortir. `rel` vient du CONTENU d'un document :
 *  sans cette borne, « ../../../../etc/hostname » ou un chemin absolu ferait lire n'importe
 *  quel fichier accessible au processus. */
function resolveInside(base, rel) {
  const root = resolve(base);
  const target = resolve(root, rel);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`@context sort du dossier du document : ${rel}`);
  }
  return target;
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
  const doc = readJson(path);
  const raw = doc["@context"];
  let ctx;
  if (typeof raw === "string") ctx = readContext(resolveInside(dirname(path), raw));
  else if (raw && typeof raw === "object") ctx = parseContext(raw);
  else ctx = readContext(contextPath);
  const subjects = Array.isArray(doc["@graph"]) ? doc["@graph"] : [];
  return { context: ctx, subjects };
}

/** Résout une clé de prédicat d'un document : alias de terme déclaré au `@context`
 *  d'abord (`usesKanji` → `jlpt:usesKanji`), puis dépliage du préfixe.
 *
 *  ⚠ Sans cette étape, un document écrit avec les alias (ce que fait le nôtre) verrait
 *  ses prédicats de relation ne correspondre à AUCUN `sh:path` : les contraintes
 *  `sh:nodeKind: IRI` sur `tests`/`usesKanji`/`covers` ne se déclencheraient jamais,
 *  sans la moindre erreur. */
export function expandPredicate(key, ctx) {
  const alias = ctx?.terms?.[key]?.id;
  return expandIri(alias ?? key, ctx?.prefixes ?? {});
}
