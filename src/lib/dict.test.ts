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

test("furi turns inline 漢字（かな） readings into ruby and drops the parentheses", () => {
  // works even for words absent from the DICT — the reading comes from the parens
  const html = furi("毎日（まいにち）");
  expect(html).toBe("<ruby>毎日<rt>まいにち</rt></ruby>");
  expect(html).not.toContain("（");
});

test("furi handles a full stem with several inline readings, no parentheses left", () => {
  const html = furi("毎日（まいにち）日本語（にほんご）を勉強（べんきょう）し___。");
  expect(html).not.toContain("（");
  expect(html).toContain("<rt>まいにち</rt>");
  expect(html).toContain("<rt>べんきょう</rt>");
  expect(html).toContain("を");
  expect(html).toContain("___");
});

test("furi ignores dictionary-dump readings (multi on/kun with · or okurigana) — no ruby, plain kanji", () => {
  // Single-kanji dict entries carry full dumps like « ユウ・やさ(しい)・すぐ(れる) ». Used as
  // furigana they are both nonsensical and so wide they stretch the base into big gaps on
  // WebKit. Words absent from the dict (優勝, 競い合う) must NOT borrow these per-kanji dumps.
  applyDictData({
    "優": { r: "ユウ・やさ(しい)・すぐ(れる)", m: "excellent" },
    "勝": { r: "か", m: "victoire" },
    "競": { r: "キョウ・きそ(う)", m: "rivaliser" },
    "二": { r: "に", m: "deux" },
  });
  const html = furi("優勝___二つのチームが競い合った。");
  expect(html).not.toContain("ユウ"); // le vidage de dico n'apparaît jamais en ruby
  expect(html).not.toContain("キョウ");
  expect(html).not.toContain("(しい)");
  // 優 et 競 (lectures = vidages) rendus en clair, sans <ruby> parasite
  expect(html).not.toContain("<ruby>優");
  expect(html).not.toContain("<ruby>競");
  // les lectures « propres » mono-kana restent utilisées (勝→か, 二→に)
  expect(html).toContain("<rt>か</rt>");
  expect(html).toContain("<rt>に</rt>");
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
