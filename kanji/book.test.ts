import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Le livre se compose depuis `data/graph/` et rien d'autre. Ce fichier garde
// les DEUX bouts de cette chaine :
//   1. le contrat de donnees dont les fiches dependent — verifiable partout,
//      donc en CI, sans installer quoi que ce soit ;
//   2. la compilation elle-meme — seulement la ou `typst` existe, sinon la CI
//      (qui n'a que bun) virerait au rouge pour une raison etrangere au code.
//
// Le second point n'est pas redondant avec le premier : `kanji/lib/pages.typ`
// porte une assertion sur le nombre de fiches reperees par l'index, et c'est
// la compilation qui la declenche.

const RACINE = join(import.meta.dir, "..");
const graphe = (nom: string) =>
  JSON.parse(readFileSync(join(RACINE, "data/graph", `${nom}.jsonld`), "utf8"))["@graph"] as Record<
    string,
    unknown
  >[];

describe("contrat de donnees du cahier", () => {
  const kanji = graphe("kanji").filter((k) => k["@type"] === "jlpt:Kanji");

  test("chaque kanji porte le couple glyphe + sens, qui EST la fiche", () => {
    // Une fiche sans glose n'apprend rien et n'a pas d'entree d'index : le
    // livre ne doit pas pouvoir se composer avec un trou pareil.
    const muets = kanji.filter((k) => !k["schema:name"] || !k["schema:description"]);
    expect(muets.map((k) => k["@id"])).toEqual([]);
    expect(kanji.length).toBe(810);
  });

  test("les lecons `kanji` couvrent une part majoritaire du corpus", () => {
    // Mesure, pas invariant : 551 sur 810 aujourd'hui. Le reste part dans les
    // chapitres « hors famille », classes par productivite. Si la couverture
    // monte (une chaine d'arbitrage des radicaux, par exemple), REMONTER ce
    // plancher — sinon il cesse de garder quoi que ce soit.
    const lecons = graphe("lesson").filter((l) => l["jlpt:track"] === "kanji");
    const couverts = new Set(lecons.flatMap((l) => (l.covers as string[]) ?? []));
    const ids = new Set(kanji.map((k) => k["@id"] as string));
    const dedans = [...couverts].filter((c) => ids.has(c));
    expect(lecons.length).toBe(51);
    expect(dedans.length).toBe(551);
  });

  test("presque tout kanji a un mot glose ET lu qui l'emploie", () => {
    // La fiche indexe les mots par PRESENCE du caractere, pas par l'arete
    // `usesKanji` — celle-ci est incomplete (泳ぐ, 泳ぎ ne la portent pas) et
    // laissait 180 fiches sans le moindre mot, contre 12 par presence.
    // Ce test fige l'ecart : il redeviendrait vert en silence si la fiche
    // repassait a l'arete, donc il compare LES DEUX.
    const mots = graphe("word").filter((w) => w["jlpt:reading"] && w["schema:description"]);
    const chars = new Set(kanji.map((k) => k["schema:name"] as string));

    const parPresence = new Set<string>();
    const parArete = new Set<string>();
    for (const w of mots) {
      for (const ch of new Set(w["schema:name"] as string)) if (chars.has(ch)) parPresence.add(ch);
      for (const id of (w.usesKanji as string[]) ?? []) parArete.add(id);
    }
    expect(chars.size - parPresence.size).toBe(12);
    expect(chars.size - parArete.size).toBe(180);
  });
});

describe("composition du livre", () => {
  const typst = spawnSync("typst", ["--version"], { encoding: "utf8" });
  const dispo = typst.status === 0;

  test.if(dispo)(
    "typst compose les 889 pages et les assertions internes passent",
    () => {
      const sortie = join(mkdtempSync(join(tmpdir(), "cahier-")), "book.pdf");
      const r = spawnSync("typst", ["compile", "--root", ".", "kanji/book.typ", sortie], {
        cwd: RACINE,
        encoding: "utf8",
      });
      // `stderr` porte les avertissements de police absente, qui dependent de
      // la machine : on juge sur le code de sortie et le PDF produit.
      expect(r.stderr).not.toContain("error:");
      expect(r.status).toBe(0);
      expect(existsSync(sortie)).toBe(true);

      // 3 liminaire + 62 planches + 810 fiches + 14 pages d'index. Un ecart
      // signale une planche qui a deborde sur une seconde page, ce que rien
      // d'autre ne rend visible.
      const pdf = readFileSync(sortie, "latin1");
      expect(pdf.match(/\/Type *\/Page[^s]/g)?.length).toBe(889);
    },
    120_000,
  );

  test.if(!dispo)("typst absent : compilation non verifiee ici", () => {
    expect(dispo).toBe(false);
  });
});
