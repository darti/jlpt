import { expect, test } from "bun:test";
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
  for (const f of ["bank-grammaire.json", "bank-index.json", "dict.json", "cours-gram.json", "cours-choukai.json"]) {
    expect(isServedData(f)).toBe(true);
  }
});

test("isServedData excludes lesson-source and non-served files", () => {
  // grammar/kanji/vocab.json are validated but NOT fetched at runtime (cf. scripts/dev.ts).
  for (const f of ["grammar.json", "kanji.json", "vocab.json", "examples.json", "README.md", "styles.gen.css"]) {
    expect(isServedData(f)).toBe(false);
  }
});
