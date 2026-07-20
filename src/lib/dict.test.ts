import { test, expect, beforeEach } from "bun:test";
import { furi, lookupDef, visualBreak, applyDictData } from "./dict.ts";

beforeEach(() => {
  // Inject a tiny DICT (forme interne : mot -> {r, m}, projetée depuis word.jsonld par
  // wordsToDict) — les données viennent du runtime, les tests les injectent directement.
  applyDictData({
    "影響": { r: "えいきょう", m: "influence" },
    "原因": { r: "げんいん", m: "cause" },
    "日本語": { r: "にほんご", m: "langue japonaise" },
    "本": { r: "ほん", m: "livre" },
  });
});

test("furi enveloppe un mot connu avec sa lecture", () => {
  const html = furi("影響");
  expect(html).toContain("class=\"furi\"");
  expect(html).toContain("影響");
  expect(html).toContain(">えいきょう</span>");
});

test("furi is greedy — longest match wins (日本語, not 日/本/語)", () => {
  expect(furi("日本語")).toContain(">にほんご</span>");
});

test("furi leaves kana-only text unchanged", () => {
  expect(furi("これはテスト")).toBe("これはテスト");
});

test("furi convertit la lecture inline 漢字（かな） et retire les parenthèses", () => {
  // works even for words absent from the DICT — the reading comes from the parens
  const html = furi("毎日（まいにち）");
  expect(html).toBe(`<span class="furi"><span class="furi-rt">まいにち</span>毎日</span>`);
  expect(html).not.toContain("（");
});

test("furi handles a full stem with several inline readings, no parentheses left", () => {
  const html = furi("毎日（まいにち）日本語（にほんご）を勉強（べんきょう）し___。");
  expect(html).not.toContain("（");
  expect(html).toContain(">まいにち</span>");
  expect(html).toContain(">べんきょう</span>");
  expect(html).toContain("を");
  expect(html).toContain("___");
});

test("furi ignore les vidages de dico (on/kun avec · ou okurigana) — kanji en clair", () => {
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
  // 優 et 競 (lectures = vidages) rendus en clair, sans annotation parasite
  expect(html).not.toContain("furi-rt\">ユウ");
  expect(html).not.toContain(">優</span>");
  // les lectures « propres » mono-kana restent utilisées (勝→か, 二→に)
  expect(html).toContain(">か</span>");
  expect(html).toContain(">に</span>");
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

// --- furigana en <span>, pas en <ruby> -----------------------------------------

test("furi() émet un span positionnable, pas un ruby", () => {
  // WebKit IGNORE `position:absolute` sur un <rt> (position calculée = static, mesuré sur
  // WebKit 26.5) : l'annotation retombe dans le flux et se superpose au kanji. Et aucune
  // valeur de `display` ne satisfait « masquable + au-dessus + base intacte » dans les DEUX
  // moteurs — en ruby natif, c'est Chromium qui élargit la base (16→72 px). Un <span>
  // honore position:relative/absolute partout : c'est la seule forme qui marche des deux côtés.
  applyDictData({ "政治": { r: "せいじ", m: "politique" } });
  const html = furi("政治");
  expect(html).toBe('<span class="furi"><span class="furi-rt">せいじ</span>政治</span>');
  expect(html).not.toContain("<ruby>");
  expect(html).not.toContain("<rt>");
});

test("furi() garde la lecture inline 漢字（かな） dans la même forme", () => {
  applyDictData({});
  expect(furi("政治（せいじ）")).toBe('<span class="furi"><span class="furi-rt">せいじ</span>政治</span>');
});

test("furi() laisse le texte sans lecture intact", () => {
  applyDictData({});
  expect(furi("優勝します")).toBe("優勝します");
});

test("la lecture précède la base dans le DOM — l'overlay se pose au-dessus", () => {
  // `.furi-rt` est en position:absolute ; l'ordre DOM ne change pas le rendu, mais le mettre
  // en premier garde la base comme dernier nœud texte, ce dont jpRunAt tire le mot tapé.
  applyDictData({ "本": { r: "ほん", m: "livre" } });
  const html = furi("本");
  expect(html.indexOf("furi-rt")).toBeLessThan(html.indexOf("本<"));
});
