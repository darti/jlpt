import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { ROOT, isServedData } from "./copy-static.mjs";

// Regression guard: `bun run build` once shipped an _site/ without sw.js, so the served
// version never changed and « Forcer la mise à jour » did nothing. The service worker and
// PWA/stub files MUST stay in the delivered-files ledger.
test("ROOT ledger includes the service worker and PWA/stub assets", () => {
  for (const f of ["sw.js", "manifest.webmanifest", "quiz.html", "app-n3.html", "icon-192.png"]) {
    expect(ROOT).toContain(f);
  }
});

test("isServedData selects the runtime-fetched data files", () => {
  for (const f of ["cours-gram.json", "cours-method.json"]) {
    expect(isServedData(f)).toBe(true);
  }
});

test("isServedData livre les documents du graphe", () => {
  for (const f of ["q-kanji.jsonld", "corpus.jsonld", "word.jsonld", "context.jsonld"]) {
    expect(isServedData(f), `${f} doit être livré`).toBe(true);
  }
});

test("isServedData excludes lesson-source and non-served files", () => {
  // bank.json et les sources d'auteur grammar/kanji/vocab.json sont validés mais PAS
  // fetchés : le runtime lit data/graph/. dict.json est absorbé par word.jsonld.
  for (const f of ["bank.json", "dict.json", "grammar.json", "kanji.json", "vocab.json",
                   "examples.json", "README.md", "styles.gen.css"]) {
    expect(isServedData(f)).toBe(false);
  }
});

test("les banques dérivées ne sont plus livrées — elles n'existent plus", () => {
  // Régression : bank-*.json + bank-index.json ont été supprimés avec tools/split-bank.mjs.
  // Les re-livrer ferait grossir _site de 5,7 Mo que plus personne ne lit.
  for (const f of ["bank-grammaire.json", "bank-kanji.json", "bank-index.json"]) {
    expect(isServedData(f), `${f} ne doit plus être livré`).toBe(false);
  }
});

// --- les TROIS inventaires de fichiers livrés ----------------------------------
//
// Ajouter un document au graphe impose de toucher copy-static.mjs (build + prod),
// scripts/dev.ts STATIC_FILES (sinon 404 en `bun run dev` SEULEMENT) et sw.js GRAPH
// (sinon absent hors ligne SEULEMENT). Chaque oubli est une panne silencieuse et locale
// à un seul contexte — donc invisible tant qu'on ne se place pas exactement dans ce
// contexte-là. Ce test lit les trois et les confronte au contenu réel de data/graph/.

const graphDocs = readdirSync("data/graph").filter((f) => f.endsWith(".jsonld"));

test("data/graph n'est pas vide (sinon les contrôles suivants ne prouvent rien)", () => {
  expect(graphDocs.length).toBeGreaterThan(5);
});

test("inventaire 1 — copy-static livre tous les documents du graphe", () => {
  for (const f of graphDocs) expect(isServedData(f), `${f} absent du build`).toBe(true);
});

test("inventaire 2 — scripts/dev.ts sert tous les documents du graphe", () => {
  const dev = readFileSync("scripts/dev.ts", "utf8");
  for (const f of graphDocs) {
    expect(dev.includes(`"/data/graph/${f}"`), `${f} absent de STATIC_FILES → 404 en dev`).toBe(true);
  }
});

test("inventaire 3 — sw.js précache les documents du graphe fetchés au runtime", () => {
  const sw = readFileSync("sw.js", "utf8");
  // shapes.jsonld ne sert qu'à la validation hors ligne de build : il n'est jamais fetché.
  for (const f of graphDocs.filter((f) => f !== "shapes.jsonld")) {
    expect(sw.includes(`'data/graph/${f}'`), `${f} absent du GRAPH du SW → manquant hors ligne`).toBe(true);
  }
});

test("sw.js traite les .jsonld en network-first, pas en cache-first", () => {
  // Sans ça, les documents du graphe tombent dans la branche des icônes et le corpus reste
  // figé à vie chez le client — la panne exacte décrite en tête de sw.js.
  const sw = readFileSync("sw.js", "utf8");
  const isData = /const isData = ([\s\S]*?);\n/.exec(sw)?.[1] ?? "";
  expect(isData).toContain(".jsonld");
});
