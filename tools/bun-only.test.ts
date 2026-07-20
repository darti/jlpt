import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

// Le dépôt est bun-only (CLAUDE.md, première ligne). La règle s'était pourtant érodée sans
// bruit : CLAUDE.md listait la commande de validation sous bun et celle des lectures sous
// l autre runtime, et chaque nouvel outil recopiait le mauvais exemple. Un test le dit
// maintenant. (Ce fichier s exclut du balayage : il DOIT nommer le motif qu il interdit.)

/** Tous les fichiers de tools/ et les configs qui documentent des commandes. */
function fichiers(): string[] {
  const out: string[] = [];
  const marche = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) marche(`${d}/${e.name}`);
      else if (/\.(mjs|ts)$/.test(e.name) && e.name !== "bun-only.test.ts") out.push(`${d}/${e.name}`);
    }
  };
  marche("tools");
  return [...out, "CLAUDE.md", "package.json", ".github/workflows/validate.yml",
          ".github/workflows/deploy.yml"];
}

test("aucune commande du dépôt n'invoque node", () => {
  const fautifs: string[] = [];
  for (const f of fichiers()) {
    const src = readFileSync(f, "utf8");
    src.split("\n").forEach((ligne, i) => {
      // `node:` (builtins) et `node_modules` sont légitimes ; `node <script>` ne l'est pas.
      if (/\bnode\s+\S*tools\//.test(ligne)) fautifs.push(`${f}:${i + 1} — ${ligne.trim()}`);
    });
  }
  expect(fautifs).toEqual([]);
});

test("la CI n'installe plus node", () => {
  const ci = readFileSync(".github/workflows/validate.yml", "utf8");
  expect(ci).not.toContain("actions/setup-node");
  expect(ci).toContain("bun tools/validate-graph.mjs");
});
