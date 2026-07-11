import { test, expect } from "bun:test";

// The single SPA entry bundles the dict *logic* (from src/lib/dict.ts, loaded by AppShell)
// but NOT the ~120 KB dictionary *data*, which is fetched from data/dict.json at runtime.
// Keyed on a logic-only string (`caretRangeFromPoint`) and a data-only reading (`えいきょう`).
async function entryBundleText(entry: string): Promise<string> {
  const out = await Bun.build({ entrypoints: [entry], target: "browser" });
  expect(out.success).toBe(true);
  const js = out.outputs.filter((o) => o.path.endsWith(".js"));
  return (await Promise.all(js.map((o) => o.text()))).join("");
}

test("the SPA entry bundles dict LOGIC but not the dictionary DATA", async () => {
  const js = await entryBundleText("src/entries/index.tsx");
  expect(js).toContain("caretRangeFromPoint"); // logic is bundled (via AppShell → setupDict)
  expect(js).not.toContain("えいきょう");        // data is NOT bundled (fetched from data/dict.json)
});
