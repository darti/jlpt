import { test, expect } from "bun:test";

// After the D5 port, the quiz entry bundles the dict *logic* (from src/lib/dict.ts) but
// NOT the ~120 KB dictionary *data*, which is fetched from data/dict.json at runtime.
// Keyed on a logic-only string (`caretRangeFromPoint`) and a data-only reading (`えいきょう`).
async function entryBundleText(entry: string): Promise<string> {
  const out = await Bun.build({ entrypoints: [entry], target: "browser" });
  expect(out.success).toBe(true);
  const js = out.outputs.filter((o) => o.path.endsWith(".js"));
  return (await Promise.all(js.map((o) => o.text()))).join("");
}

test("quiz entry bundles dict LOGIC but not the dictionary DATA", async () => {
  const js = await entryBundleText("src/entries/quiz.tsx");
  expect(js).toContain("caretRangeFromPoint"); // logic is bundled
  expect(js).not.toContain("えいきょう");        // data is NOT bundled (fetched from data/dict.json)
});

test("app-n3 (hub) entry bundles neither dict logic nor data", async () => {
  const js = await entryBundleText("src/entries/app-n3.tsx");
  expect(js).not.toContain("caretRangeFromPoint");
  expect(js).not.toContain("えいきょう");
});
