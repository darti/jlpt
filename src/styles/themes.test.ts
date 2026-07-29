/**
 * Invariants de `themes.css`, lus dans le CSS source lui-même.
 *
 * Raison d'être : la classe de bug du thème clair n'est pas « une mauvaise valeur », c'est
 * « le bloc clair n'override pas ce que le bloc sombre définit ». Trois tokens en relevaient
 * — deux couleurs de compétence identiques (deux anneaux de `CoverageRings` confondus), les
 * `--color-danger-*` restés aux valeurs sombres de `@theme` (bloc rouge quasi noir), et
 * `--elevation-hover` en noir `.38`. Aucun n'est détectable au typecheck ni au rendu SSR :
 * ils ne se voient que sur l'écran concerné, dans le bon thème.
 *
 * Le test de parité (§1) fige la classe entière, pas les trois occurrences trouvées.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CSS = readFileSync(join(import.meta.dir, "themes.css"), "utf8");
const TAILWIND = readFileSync(join(import.meta.dir, "tailwind.css"), "utf8");

/** Déclarations `--token: valeur;` du bloc de `src` ouvert par `selecteur`.
 *
 *  ⚠ Le sélecteur est ancré en DÉBUT DE LIGNE et doit être suivi de son `{` : les mêmes
 *  sélecteurs sont cités dans les commentaires de `themes.css`, et un `indexOf` nu attrapait
 *  la prose puis lisait le bloc suivant — le test passait alors sur le mauvais bloc. */
function tokensOf(src: string, selecteur: string): Map<string, string> {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = src.search(new RegExp(`^${echappe}\\s*\\{`, "m"));
  if (start < 0) throw new Error(`bloc introuvable : ${selecteur}`);
  const open = src.indexOf("{", start);
  const close = src.indexOf("\n}", open);
  const body = src.slice(open + 1, close);
  const out = new Map<string, string>();
  for (const [, nom, val] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(nom, val.trim());
  }
  return out;
}

const dark = tokensOf(CSS, ':root[data-theme="dark"]');
const light = tokensOf(CSS, ':root[data-theme="light"]');

/** Valeurs réellement appliquées : `@theme` (tailwind.css) sert de socle, le bloc de thème
 *  l'écrase. Le sombre ne redéclare pas les couleurs de compétence — les asserter sur son seul
 *  bloc rendrait le test vide. */
const THEME_BASE = tokensOf(TAILWIND, "@theme");
const effectif = (bloc: Map<string, string>) => new Map([...THEME_BASE, ...bloc]);

const SKILLS = ["grammaire", "vocabulaire", "kanji", "lecture"] as const;

describe("themes.css", () => {
  test("les deux blocs sont lus et non vides", () => {
    expect(dark.size).toBeGreaterThan(20);
    expect(light.size).toBeGreaterThan(20);
  });

  test("tout token défini par le thème sombre est défini par le thème clair", () => {
    const manquants = [...dark.keys()].filter((k) => !light.has(k));
    expect(manquants).toEqual([]);
  });

  test("les quatre couleurs de compétence sont deux à deux distinctes en clair", () => {
    const vals = SKILLS.map((s) => effectif(light).get(`--color-skill-${s}`));
    expect(vals.every(Boolean)).toBe(true);
    expect(new Set(vals).size).toBe(SKILLS.length);
  });

  test("les quatre couleurs de compétence sont deux à deux distinctes en sombre", () => {
    const vals = SKILLS.map((s) => effectif(dark).get(`--color-skill-${s}`));
    expect(vals.every(Boolean)).toBe(true);
    expect(new Set(vals).size).toBe(SKILLS.length);
  });

  test("le filtre de l'aurore est défini par les deux thèmes", () => {
    // `body::before` le lit ; un thème sans valeur retomberait sur le repli du var(), qui
    // n'est pas le sien.
    expect(dark.get("--aurora-filter")).toBeTruthy();
    expect(light.get("--aurora-filter")).toBeTruthy();
  });

  test("le calque d'aurore lit le filtre thémable plutôt qu'une valeur en dur", () => {
    expect(CSS).toContain("filter: var(--aurora-filter");
  });

  // La feuille compile-t-elle réellement ? Rien d'autre ne le vérifie : `typecheck` ignore le
  // CSS, et `styles.gen.css` est GÉNÉRÉ ET GITIGNORÉ — un exemplaire périmé traîne donc sur
  // toute machine de dev et masque un échec de compilation. La panne s'est produite : un `*/`
  // de trop fermait un commentaire au milieu d'une phrase, l'apostrophe de « n'a » devenait
  // une chaîne non terminée, et la CI ne l'a signalé qu'à travers un test de bundle se
  // plaignant d'un `styles.gen.css` INTROUVABLE — le symptôme, pas la cause.
  test("la feuille de style compile", async () => {
    const sortie = join(tmpdir(), `jlpt-css-check-${process.pid}.css`);
    const p = Bun.spawn(
      ["bunx", "@tailwindcss/cli", "-i", "src/styles/tailwind.css", "-o", sortie],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [code, err] = await Promise.all([p.exited, new Response(p.stderr).text()]);
    // Tailwind rend 0 même en erreur sur certaines versions : on assert AUSSI l'absence
    // d'erreur dans la sortie, sinon le test ne garderait rien.
    expect(err).not.toContain("CssSyntaxError");
    expect(err).not.toContain("Error:");
    expect(code).toBe(0);
  }, 60_000);

  test("l'élévation de carte du thème clair porte un liseré interne", () => {
    // La lumière de bord haute est ce qui fait lire une surface comme du verre ; le bloc
    // clair l'avait perdue alors que le sombre la porte.
    expect(light.get("--elevation-card")).toContain("inset");
  });
});
