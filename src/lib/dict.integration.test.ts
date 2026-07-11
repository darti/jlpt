import { test, expect } from "bun:test";
import { applyDictData, furi, lookupDef, visualBreak } from "./dict.ts";

// End-to-end with the REAL data/dict.json (the file the quiz fetches at runtime): proves
// the ported logic renders furigana + resolves definitions from the actual dictionary.
test("real data/dict.json drives furigana + lookup end-to-end", async () => {
  const realDict = await Bun.file("data/dict.json").json();
  applyDictData(realDict);

  expect(Object.keys(realDict).length).toBeGreaterThan(2000);
  expect(furi("影響")).toContain("<rt>えいきょう</rt>");        // furigana from real data
  expect(lookupDef("日本語")).toMatchObject({ w: "日本語", r: "にほんご" }); // tap-to-define lookup
  expect(lookupDef("影響力")?.w).toBe("影響");                  // longest-prefix fallback on real data
  expect(visualBreak("影響 «influence» · を «COD»")).toContain('class="vbreak"'); // Corrige analysis
});
