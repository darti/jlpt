import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { visualBreak } from "./dict.ts";

// Invariant de l'auteur : « concatène la valeur des blocs, tu dois retrouver la phrase ».
// L'analyse en blocs de couleur d'un exemple est une PARTITION de la phrase — chaque bloc en
// couvre un segment consécutif, et leur mise bout à bout redonne le japonais d'origine. Un bloc
// mal coupé le trahit aussitôt : recouvrement (先生 + 先生のおかげで → 先生 dupliqué) ou trou
// (particule oubliée : 京都[が]いい). Ce test passe les 227 exemples au crible.

/** Surface d'un bloc telle qu'elle apparaît dans la phrase : sans furigana, et pour une dérivation
 *  « base→forme » c'est la FORME FINALE (après le dernier →) qui figure dans le texte. */
function blockSurfaces(html: string): string[] {
  const out: string[] = [];
  const re = /<span class="tok tok-\w+"><span class="tok-jp">([\s\S]*?)<\/span>(?:<span class="tok-g">[\s\S]*?<\/span>)?<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let jp = m[1]
      .replace(/<span class="furi-rt">[\s\S]*?<\/span>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/（[^）]*）/g, "")
      .replace(/[＋+]/g, "")
      .trim();
    if (jp.includes("→")) jp = jp.split("→").pop()!.trim();
    out.push(jp);
  }
  return out;
}
const norm = (s: string) => (s || "").replace(/[。、！？「」『』・\s（）()…]/g, "");

interface Ex { "@type"?: string; "jlpt:jp"?: string; "jlpt:analysis"?: unknown }
const graph = JSON.parse(readFileSync(new URL("../../data/graph/example.jsonld", import.meta.url), "utf8"))["@graph"] as Ex[];
const examples = graph.filter((e) => Array.isArray(e["jlpt:analysis"]) && e["jlpt:jp"]);

test("le corpus d'exemples existe (garde-fou de chargement)", () => {
  expect(examples.length).toBeGreaterThan(200);
});

test("concaténer les blocs de chaque analyse redonne la phrase (partition, aucun recouvrement/trou)", () => {
  const fails: string[] = [];
  for (const e of examples) {
    const phrase = norm(e["jlpt:jp"] as string);
    const concat = norm(blockSurfaces(visualBreak((e["jlpt:analysis"] as string[]).join(" · "), { legend: false })).join(""));
    if (concat !== phrase) fails.push(`${e["jlpt:jp"]}\n    blocs→ ${concat}`);
  }
  expect(fails).toEqual([]);
});
