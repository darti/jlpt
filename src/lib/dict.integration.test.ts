import { test, expect } from "bun:test";
import { applyDictData, furi, lookupDef, visualBreak, wordsToDict } from "./dict.ts";

// End-to-end avec le VRAI data/graph/word.jsonld (le document que l'app fetche au runtime) :
// prouve que la projection wordsToDict + la logique portée rendent les furigana et résolvent
// les définitions depuis le dictionnaire réel. C'est le seul test qui confronte le code au
// contenu livré — les autres travaillent sur des dictionnaires inventés de trois entrées.
test("le vrai word.jsonld pilote furigana + lookup de bout en bout", async () => {
  const doc = await Bun.file("data/graph/word.jsonld").json();
  const realDict = wordsToDict(doc["@graph"] ?? []);
  applyDictData(realDict);

  expect(Object.keys(realDict).length).toBeGreaterThan(2000);
  expect(furi("影響")).toContain("<rt>えいきょう</rt>");        // furigana from real data
  expect(lookupDef("日本語")).toMatchObject({ w: "日本語", r: "にほんご" }); // tap-to-define lookup
  expect(lookupDef("影響力")?.w).toBe("影響");                  // longest-prefix fallback on real data
  expect(visualBreak("影響 «influence» · を «COD»")).toContain('class="vbreak"'); // Corrige analysis
});
