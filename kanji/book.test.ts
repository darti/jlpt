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

describe("licence des tracés", () => {
  // Garde-fou licenciel, pas cosmétique : KanjiVG est en CC BY-SA 3.0. Tant que
  // ses tracés restent hors dépôt, le graphe et l'app n'empruntent rien et ne
  // doivent aucune attribution ; un `.kanjivg/` committé par mégarde changerait
  // la licence du dépôt entier, sans que rien ne le signale.
  test(".kanjivg/ est ignoré par git et absent du graphe", () => {
    const ignore = readFileSync(join(RACINE, ".gitignore"), "utf8");
    expect(ignore).toContain(".kanjivg/");

    const suivi = spawnSync("git", ["ls-files", ".kanjivg"], { cwd: RACINE, encoding: "utf8" });
    expect(suivi.stdout.trim()).toBe("");

    const graphe = readFileSync(join(RACINE, "data/graph/kanji.jsonld"), "utf8");
    expect(graphe.toLowerCase()).not.toContain("kanjivg");
  });
});

describe("composition du livre", () => {
  const typst = spawnSync("typst", ["--version"], { encoding: "utf8" });
  const dispo = typst.status === 0;
  const avecTraits = existsSync(join(RACINE, ".kanjivg/traits/index.json"));

  const compose = (entrees: string[]) => {
    const sortie = join(mkdtempSync(join(tmpdir(), "cahier-")), "kanjis.pdf");
    const r = spawnSync("typst", ["compile", "--root", ".", ...entrees, "kanji/book.typ", sortie], {
      cwd: RACINE,
      encoding: "utf8",
    });
    // `stderr` porte les avertissements de police absente, qui dépendent de la
    // machine : on juge sur le code de sortie et le PDF produit.
    expect(r.stderr).not.toContain("error:");
    expect(r.status).toBe(0);
    expect(existsSync(sortie)).toBe(true);

    const b = readFileSync(sortie, "latin1");
    const boite = b.match(/MediaBox\[0 0 ([\d.]+) ([\d.]+)\]/);
    return {
      pages: b.match(/\/Type *\/Page[^s]/g)?.length ?? 0,
      largeur: Math.round(Number(boite?.[1] ?? 0)),
      hauteur: Math.round(Number(boite?.[2] ?? 0)),
      signets: Number(b.match(/\/Outlines[\s\S]{0,200}?\/Count (\d+)/)?.[1] ?? 0),
    };
  };

  // 92 × 163 mm en points : la page est PORTRAIT, son contenu composé en
  // paysage puis posé pivoté. Une page paysage ici voudrait dire que
  // `tournee()` a cessé de tourner quoi que ce soit.
  const PORTRAIT = [261, 462];

  test.if(dispo)(
    "sans les diagrammes : 910 pages portrait, et les assertions internes passent",
    () => {
      // Ce chemin-là doit marcher sur une machine qui n'a jamais lancé la chaîne
      // KanjiVG — c'est ce qui garde le livre composable sans rien télécharger.
      //
      // Test de MESURE : il fige un état. Le total bouge dès que `ECHELLE`
      // change ou que le graphe grossit, et il faut alors le remonter
      // DÉLIBÉRÉMENT, après avoir regardé les pages. Ce qu'il attrape n'a rien
      // de théorique : sur une page pivotée rien ne « coule », donc un bloc trop
      // haut se superpose au lieu de passer à la page suivante — la planche de
      // la famille 亻 et les colonnes d'index l'ont fait, sans une erreur.
      const p = compose([]);
      expect(p.pages).toBe(910);
      expect([p.largeur, p.hauteur]).toEqual(PORTRAIT);
      expect(p.signets).toBe(62);
    },
    180_000,
  );

  test.if(dispo && avecTraits)(
    "avec les diagrammes : 911 pages portrait (une planche de plus, et les crédits)",
    () => {
      const p = compose(["--input", "traits=oui"]);
      expect(p.pages).toBe(911);
      expect([p.largeur, p.hauteur]).toEqual(PORTRAIT);
      expect(p.signets).toBe(62);
    },
    180_000,
  );

  test.if(!dispo)("typst absent : compilation non vérifiée ici", () => {
    expect(dispo).toBe(false);
  });
});
