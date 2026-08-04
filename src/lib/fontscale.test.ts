import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFs, bumpFs, applyFontScale } from "./fontscale.ts";
import { memStore } from "../testing/memStore.ts";


test("readFs defaults to 1 when unset or out of range", () => {
  expect(readFs("Ui", memStore())).toBe(1);
  expect(readFs("Jp", memStore({ jlptN3_fsJp: "9" }))).toBe(1);
  expect(readFs("Ui", memStore({ jlptN3_fsUi: "1.3" }))).toBe(1.3);
});

test("readFs boundary values for valid range [0.7, 2]", () => {
  // Boundary: valid at 0.7
  expect(readFs("Ui", memStore({ jlptN3_fsUi: "0.7" }))).toBe(0.7);
  // Boundary: valid at 2.0
  expect(readFs("Jp", memStore({ jlptN3_fsJp: "2" }))).toBe(2);
  // Below range: 0.69 returns default
  expect(readFs("Ui", memStore({ jlptN3_fsUi: "0.69" }))).toBe(1);
  // Above range: 2.01 returns default
  expect(readFs("Jp", memStore({ jlptN3_fsJp: "2.01" }))).toBe(1);
});

test("bumpFs steps by 0.1, clamps to [0.8,1.8], persists key + updatedAt", () => {
  const s = memStore({ jlptN3_fsUi: "1.0" });
  expect(bumpFs("Ui", +1, s)).toBe(1.1);
  expect(s._get("jlptN3_fsUi")).toBe("1.1");
  expect(typeof s._get("jlptN3_updatedAt")).toBe("string");
  const hi = memStore({ jlptN3_fsUi: "1.8" });
  expect(bumpFs("Ui", +1, hi)).toBe(1.8); // clamp high
  const lo = memStore({ jlptN3_fsJp: "0.8" });
  expect(bumpFs("Jp", -1, lo)).toBe(0.8); // clamp low
});

test("bumpFs isolated negative direction (not within clamp test)", () => {
  const s = memStore({ jlptN3_fsUi: "1.5" });
  expect(bumpFs("Ui", -1, s)).toBe(1.4);
  expect(s._get("jlptN3_fsUi")).toBe("1.4");
});

test("applyFontScale sets --fs-ui/--fs-jp from stored values", () => {
  const props: Record<string, string> = {};
  const root = { style: { setProperty: (k: string, v: string) => { props[k] = v; } } } as unknown as HTMLElement;
  applyFontScale(root, memStore({ jlptN3_fsUi: "1.2", jlptN3_fsJp: "1.4" }));
  expect(props["--fs-ui"]).toBe("1.2");
  expect(props["--fs-jp"]).toBe("1.4");
});

/**
 * ⚠ LE MAILLON QUI MANQUAIT — et que rien au-dessus ne peut voir.
 *
 * Les tests ci-dessus prouvent que la préférence est lue, bornée, persistée, et posée sur la
 * racine. Ils sont restés VERTS pendant que les deux réglages n'avaient aucun effet : le portage
 * vanilla → React a emporté l'écriture et laissé la lecture derrière lui (le `theme.css` qui
 * consommait ces variables a été supprimé). Personne ne lisait `--fs-ui` ni `--fs-jp`.
 *
 * On compile donc la feuille et on assert la CONSOMMATION. Deux raisons de compiler plutôt que
 * de greper les sources :
 *   — `styles.gen.css` est généré ET gitignoré : sur une machine propre il est absent, sur une
 *     machine de dev il peut être périmé — le greper ne prouve rien ;
 *   — le Tailwind vendorisé est un SOUS-ENSEMBLE : une utilité arbitraire écrite dans un
 *     composant peut parfaitement ne jamais être émise. Seule la sortie fait foi.
 */
test("la feuille compilée CONSOMME les deux échelles de police", async () => {
  const sortie = join(tmpdir(), `jlpt-fs-check-${process.pid}.css`);
  const p = Bun.spawn(
    ["bunx", "@tailwindcss/cli", "-i", "src/styles/tailwind.css", "-o", sortie],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [code, err] = await Promise.all([p.exited, new Response(p.stderr).text()]);
  expect(err).not.toContain("CssSyntaxError");
  expect(code).toBe(0);
  const css = readFileSync(sortie, "utf8");

  // L'interface : l'échelle porte sur la font-size de la RACINE (toutes les utilités Tailwind
  // sont en rem) et sur `--ts` (les quelques tailles en px du chrome, insensibles au rem).
  expect(css).toContain("font-size: calc(100% * var(--fs-ui");
  expect(css).toMatch(/--ts:\s*var\(--fs-ui/);
  // Le japonais : au moins une taille réellement émise qui en dépend.
  expect(css).toMatch(/font-size:\s*calc\([^)]*var\(--fs-jp/);
}, 60_000);
