import { test, expect, beforeEach } from "bun:test";
import { furi, lookupDef, visualBreak, applyDictData } from "./dict.ts";

beforeEach(() => {
  // Inject a tiny DICT (data/dict.json shape: word -> {r, m}) — the port sources data
  // at runtime instead of inlining it, so tests feed it directly.
  applyDictData({
    "影響": { r: "えいきょう", m: "influence" },
    "原因": { r: "げんいん", m: "cause" },
    "日本語": { r: "にほんご", m: "langue japonaise" },
    "本": { r: "ほん", m: "livre" },
  });
});

test("furi wraps a known kanji word in <ruby> with its reading", () => {
  const html = furi("影響");
  expect(html).toContain("<ruby");
  expect(html).toContain("影響");
  expect(html).toContain("<rt>えいきょう</rt>");
});

test("furi is greedy — longest match wins (日本語, not 日/本/語)", () => {
  expect(furi("日本語")).toContain("<rt>にほんご</rt>");
});

test("furi leaves kana-only text unchanged", () => {
  expect(furi("これはテスト")).toBe("これはテスト");
});

test("lookupDef returns the entry for a known word", () => {
  expect(lookupDef("影響")).toEqual({ w: "影響", r: "えいきょう", m: "influence" });
});

test("lookupDef falls back to the longest known prefix", () => {
  expect(lookupDef("影響力")?.w).toBe("影響"); // 影響力 unknown → prefix 影響
});

test("lookupDef returns null for unknown text", () => {
  expect(lookupDef("存在")).toBeNull();
});

test("visualBreak renders a ·-separated decomposition as role-tagged pills (data-independent)", () => {
  const html = visualBreak("原因 «cause» · を «COD»");
  expect(html).toContain('class="vbreak"');
  expect(html).toContain("tok-");
  expect(html).toContain("cause");
});
