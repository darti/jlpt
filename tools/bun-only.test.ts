import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

// Le dépôt est bun-only (CLAUDE.md, première ligne). La règle s'était pourtant érodée sans
// bruit : CLAUDE.md listait la commande de validation sous bun et celle des lectures sous
// l'autre runtime, et chaque nouvel outil recopiait le mauvais exemple. Un test le dit
// maintenant. (Ce fichier s'exclut du balayage : il DOIT nommer le motif qu'il interdit.)

/**
 * Le REVIEW du 10 juillet est un CONSTAT de relecture dont tout l'intérêt est que la CI
 * d'alors invoquait l'autre runtime — il l'y relève comme une violation de la règle.
 * Le réécrire rendrait la phrase absurde : elle dirait que la CI viole la règle en la
 * respectant. Un compte rendu daté n'est pas une instruction ; on ne le falsifie pas.
 */
const RECIT_HISTORIQUE = "docs/superpowers/plans/REVIEW-2026-07-10-dashboard-react-bun-slice.md";

/** Fichiers exécutables, configs et documentation qui portent des commandes. */
function fichiers(): string[] {
  const out: string[] = [];
  const marche = (d: string, exts: RegExp) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) marche(p, exts);
      else if (exts.test(e.name) && e.name !== "bun-only.test.ts" && p !== RECIT_HISTORIQUE) {
        out.push(p);
      }
    }
  };
  marche("tools", /\.(mjs|ts)$/);
  marche("docs", /\.md$/);
  return [...out, "CLAUDE.md", "package.json", ".github/workflows/validate.yml",
          ".github/workflows/deploy.yml"];
}

test("aucune commande du dépôt n'invoque node — docs comprises", () => {
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

test("le balayage couvre bien les plans et les specs", () => {
  // Sans ça, exclure un répertoire par erreur rendrait le test ci-dessus vert pour rien.
  const scannes = fichiers();
  expect(scannes.some((f) => f.startsWith("docs/superpowers/plans/"))).toBe(true);
  expect(scannes.some((f) => f.startsWith("docs/superpowers/specs/"))).toBe(true);
  expect(scannes).not.toContain(RECIT_HISTORIQUE);
});

test("la CI n'installe plus node", () => {
  const ci = readFileSync(".github/workflows/validate.yml", "utf8");
  expect(ci).not.toContain("actions/setup-node");
  expect(ci).toContain("bun tools/validate-graph.mjs");
});
