/**
 * Furigana + tap-to-define, ported from the vanilla `dict.js` for React pages.
 *
 * Two differences from `dict.js`: (1) the dictionary DATA is NOT inlined — it is
 * fetched from `data/dict.json` at runtime via `setupDict()` (migration principle:
 * data from JSON, not bundled), so this module bundles only the ~logic; (2) the
 * definition-popup CSS uses the oku design tokens (`--color-*`) instead of the
 * vanilla `theme.css` vars. Behaviour is otherwise faithful to the original.
 *
 * The strangler migration is complete: the vanilla `dict.js`/pages are gone, so this
 * module is now the sole furigana + tap-to-define implementation for the app.
 */

export interface DictEntry { r?: string; m?: string }
export type Dict = Record<string, DictEntry>;

let DICT: Dict = {};
let READ: Record<string, string> = {}; // mot -> lecture (furigana glouton)

function rebuildRead(): void {
  READ = {};
  for (const w in DICT) { const r = DICT[w].r; if (r) READ[w] = r; }
}

/** Replace the runtime dictionary (from a fetch or a test). Rebuilds the furigana index. */
export function applyDictData(data: Dict): void {
  DICT = data || {};
  rebuildRead();
}

// ---------- furigana (recherche gloutonne du plus long mot) ----------
export function furi(s: string | null | undefined): string {
  if (s == null) return "";
  let out = "", i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[一-鿿]/.test(c)) {
      let m: string | null = null;
      for (let L = Math.min(12, s.length - i); L >= 1; L--) {
        const sub = s.substr(i, L);
        if (/^[一-鿿]+$/.test(sub) && READ[sub]) { m = sub; break; }
      }
      if (m) { out += '<ruby onclick="this.classList.toggle(\'show\')">' + m + "<rt>" + READ[m] + "</rt></ruby>"; i += m.length; }
      else { out += c; i++; }
    } else { out += c; i++; }
  }
  return out;
}

// ---------- analyse visuelle : jetons colorés par rôle ----------
interface Tok { jp: string; gloss: string; role: string }
const PARTGLOSS: Record<string, string> = { "は": "thème", "が": "sujet", "を": "COD", "に": "à / lieu", "へ": "direction", "で": "moyen / lieu", "と": "et / avec", "も": "aussi", "の": "de", "から": "depuis", "まで": "jusqu’à", "より": "que (comp.)", "ね": "n’est-ce pas", "よ": "emphase", "か": "question" };
function _pg(p: string): string { return PARTGLOSS[p] || "particule"; }
const ADV: Record<string, number> = { "とても": 1, "まだ": 1, "もう": 1, "ずっと": 1, "よく": 1, "また": 1, "すぐ": 1, "すぐに": 1, "ちょっと": 1, "たくさん": 1, "あまり": 1, "いつも": 1, "きっと": 1, "たぶん": 1, "ほとんど": 1, "かなり": 1, "やはり": 1, "やっぱり": 1, "ぜひ": 1, "もっと": 1, "少し": 1, "すこし": 1, "けっこう": 1, "だいたい": 1, "しっかり": 1, "はっきり": 1, "ゆっくり": 1, "だんだん": 1, "どんどん": 1, "なかなか": 1, "わざわざ": 1, "ますます": 1 };
function splitParticles(jp: string, gloss: string): Tok[] {
  const out: Tok[] = [], lead = "のはがをにへでとも";
  while (jp.length > 1 && lead.indexOf(jp.charAt(0)) >= 0 && /^[一-鿿]/.test(jp.slice(1))) { out.push({ jp: jp.charAt(0), gloss: _pg(jp.charAt(0)), role: "part" }); jp = jp.slice(1); }
  const TRAIL = ["からは", "までは", "には", "では", "とは", "へは", "のは", "をば", "から", "まで", "より", "は", "が", "を", "に", "へ", "で", "と", "も", "の", "ね", "よ", "か"];
  let trail: Tok[] = [], m: string | null = null;
  for (let i = 0; i < TRAIL.length; i++) { const p = TRAIL[i]; if (jp.length > p.length && jp.slice(-p.length) === p) { const b = jp.charAt(jp.length - p.length - 1); if (b === "）" || /[一-鿿]/.test(b)) { m = p; break; } } }
  if (m) {
    if (m === "から" || m === "まで" || m === "より") trail = [{ jp: m, gloss: _pg(m), role: "part" }];
    else trail = m.split("").map((c) => ({ jp: c, gloss: _pg(c), role: "part" }));
    jp = jp.slice(0, jp.length - m.length);
  }
  const g2 = gloss.replace(/\s*\((?:th[eè]me|sujet|COD|objet|compl[eé]ment|lieu|temps|direction|moyen)[^)]*\)\s*$/i, "").trim();
  out.push({ jp, gloss: g2 || gloss, role: "noun" });
  return out.concat(trail);
}
function splitVerbLead(jp: string, gloss: string): Tok[] {
  const out: Tok[] = [], lead = "にを";
  while (jp.length > 2 && lead.indexOf(jp.charAt(0)) >= 0) { out.push({ jp: jp.charAt(0), gloss: _pg(jp.charAt(0)), role: "part" }); jp = jp.slice(1); }
  out.push({ jp, gloss, role: "verb" });
  return out;
}
export function visualBreak(str: string, opts?: { legend?: boolean }): string {
  if (!str) return "";
  const parts = String(str).split(" · ");
  let hasPart = false, hasVerb = false, hasNoun = false, hasAdj = false, hasAdjNa = false, hasAdv = false;
  let pills = "";
  parts.forEach((seg) => {
    seg = seg.trim(); if (!seg) return;
    let gloss = "", jp = seg;
    const mg = seg.match(/«\s*([^»]*?)\s*»/);
    if (mg) { gloss = mg[1]; jp = seg.slice(0, mg.index); }
    jp = jp.replace(/^[→\s]+/, "").replace(/[。、・\s→]+$/, "").replace(/（[^）]*$/, "").trim();
    if (!jp) return;
    if (!/[一-鿿ぁ-んァ-ンー々]/.test(jp) || (!gloss && /[A-Za-zÀ-ÿ]{2,}/.test(jp) && !/[一-鿿]/.test(jp))) {
      pills += '<span class="tok tok-note"><span class="tok-g">' + (gloss || jp) + "</span></span>"; return;
    }
    const jpPlain = jp.replace(/（[^）]*）/g, "").replace(/[（）]/g, "");
    let role = "noun";
    if (/[→＋]/.test(jp)) role = "verb";
    else if (/^[はがをにへでとやかもねよのばらでもへ〜～ずば・／/]+$/.test(jpPlain)) role = "part";
    else if (ADV[jpPlain] === 1) role = "adv";
    else if ((jpPlain.length >= 3 && jpPlain.charAt(jpPlain.length - 1) === "的" && jpPlain !== "目的") || /な-?adj|adjectif nominal/i.test(gloss)) role = "adjna";
    else if (/しい$/.test(jpPlain) || /\bい-?adj|adjectif/i.test(gloss)) role = "adj";
    else if (/particule|th[eè]me|\bCOD\b|sujet|direction|marque|emphase/i.test(gloss) && jpPlain.length <= 3 && !/[一-鿿]/.test(jpPlain)) role = "part";
    const toks = (role === "noun" && /[一-鿿]/.test(jpPlain)) ? splitParticles(jp, gloss) : (role === "verb" ? splitVerbLead(jp, gloss) : [{ jp, gloss, role }]);
    toks.forEach((t) => {
      if (!t.jp) return;
      if (t.role === "part") hasPart = true; else if (t.role === "verb") hasVerb = true; else if (t.role === "adj") hasAdj = true; else if (t.role === "adjna") hasAdjNa = true; else if (t.role === "adv") hasAdv = true; else hasNoun = true;
      const jpHtml = t.jp.replace(/([一-鿿々]+)（([ぁ-んァ-ンー・]+)）/g, "<ruby>$1<rt>$2</rt></ruby>");
      pills += '<span class="tok tok-' + t.role + '"><span class="tok-jp">' + jpHtml + "</span>" + (t.gloss ? '<span class="tok-g">' + t.gloss + "</span>" : "") + "</span>";
    });
  });
  const leg: string[] = [];
  if (hasNoun) leg.push('<span><i class="tok-noun"></i>nom / groupe</span>');
  if (hasPart) leg.push('<span><i class="tok-part"></i>particule</span>');
  if (hasVerb) leg.push('<span><i class="tok-verb"></i>verbe / forme</span>');
  if (hasAdj) leg.push('<span><i class="tok-adj"></i>adjectif い</span>');
  if (hasAdjNa) leg.push('<span><i class="tok-adjna"></i>adjectif な</span>');
  if (hasAdv) leg.push('<span><i class="tok-adv"></i>adverbe</span>');
  const showLeg = !(opts && opts.legend === false);
  return '<div class="vbreak">' + pills + "</div>" + (showLeg && leg.length > 1 ? '<div class="vbleg">' + leg.join("") + "</div>" : "");
}

// ---------- lookup ----------
interface Def { w: string; r?: string; m: string }
function _cleanM(m: string | undefined): string { return /^\s*N[1-5]\s*$/.test(m || "") ? "" : (m || ""); } // un niveau JLPT n'est pas une définition
export function lookupDef(sel: string): Def | null {
  sel = (sel || "").replace(/[\s。、！？「」（）()]/g, "").trim();
  if (!sel || sel.length > 14) return null;
  if (DICT[sel]) return { w: sel, r: DICT[sel].r, m: _cleanM(DICT[sel].m) };
  for (let L = Math.min(sel.length, 12); L >= 1; L--) {
    const sub = sel.slice(0, L);
    if (DICT[sub]) return { w: sub, r: DICT[sub].r, m: _cleanM(DICT[sub].m) };
  }
  return null;
}

// ---------- bulle de définition (CSS = tokens oku) ----------
function ensurePopup(): HTMLElement {
  if (!document.getElementById("jlpt-defpop-css")) {
    const st = document.createElement("style"); st.id = "jlpt-defpop-css";
    st.textContent = "#defPop{position:fixed;z-index:95;max-width:280px;background:var(--color-panel,#3b4252);border:1px solid var(--color-line,rgba(236,239,244,.12));border-radius:14px;padding:12px 15px 13px;box-shadow:0 24px 64px rgba(18,27,54,.55);-webkit-backdrop-filter:blur(16px) saturate(140%);backdrop-filter:blur(16px) saturate(140%);font-size:.92rem;display:none;line-height:1.5}#defPop .w{font-size:1.2rem;font-weight:700;color:var(--color-fg,#eceff4)}#defPop .r{color:var(--color-accent,#88c0d0);font-size:.85rem;margin:1px 0 5px}#defPop .m{color:var(--color-fg,#eceff4)}#defPop .x{float:right;color:var(--color-fg-muted,rgba(236,239,244,.45));cursor:pointer;margin:-2px -4px 0 8px;font-size:.95rem}#defPop .sp{background:transparent;border:none;color:var(--color-accent,#88c0d0);cursor:pointer;vertical-align:-3px;padding:0 2px}#defPop .sp:active{transform:scale(.9)}";
    (document.head || document.documentElement).appendChild(st);
  }
  let pop = document.getElementById("defPop");
  if (!pop) { pop = document.createElement("div"); pop.id = "defPop"; (document.body || document.documentElement).appendChild(pop); }
  return pop;
}
export function hideDef(): void { const p = document.getElementById("defPop"); if (p) p.style.display = "none"; }

// ---------- prononciation (TTS, ja-JP) ----------
let _jaVoice: SpeechSynthesisVoice | null = null;
function _pickVoice(): void {
  try {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    _jaVoice = vs.filter((v) => /ja[-_]?jp/i.test(v.lang))[0] || vs.filter((v) => /^ja/i.test(v.lang))[0] || vs.filter((v) => /japanese|日本語/i.test(v.name))[0] || null;
  } catch { /* ignore */ }
}
function speakJa(t: string): void {
  if (!t || !("speechSynthesis" in window)) return;
  try { if (!_jaVoice) _pickVoice(); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t)); u.lang = "ja-JP"; u.rate = 0.9; if (_jaVoice) u.voice = _jaVoice; speechSynthesis.speak(u); } catch { /* ignore */ }
}
export function jlptSay(): void { const p = document.getElementById("defPop"); if (p && p.dataset && p.dataset.say) speakJa(p.dataset.say); }
const _SPK = '<button class="sp" onclick="jlptSay()" title="Prononcer" aria-label="Prononcer"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg></button>';

function defShow(px: number, py: number, d: Def | null): boolean {
  const pop = ensurePopup(); if (!d) return false;
  pop.innerHTML = '<span class="x" onclick="hideDef()">✕</span><div class="w">' + furi(d.w) + " " + _SPK + "</div>" + (d.r ? '<div class="r">' + d.r + "</div>" : "") + '<div class="m">' + (d.m || "lecture seule") + "</div>";
  try { pop.dataset.say = (d.r || d.w); } catch { /* ignore */ }
  pop.style.display = "block";
  pop.style.left = Math.max(8, Math.min(px - 20, window.innerWidth - pop.offsetWidth - 12)) + "px";
  pop.style.top = Math.min(py + 16, window.innerHeight - pop.offsetHeight - 12) + "px";
  return true;
}
function defAt(px: number, py: number, word: string): boolean { const d = lookupDef(word); return d ? defShow(px, py, d) : false; }
function showDef(e?: MouseEvent): void { const sel = window.getSelection ? String(window.getSelection()) : ""; defAt((e && e.clientX) || window.innerWidth / 2, (e && e.clientY) || 120, sel); }
function jpRunAt(x: number, y: number): { run: string; rel: number } | null {
  const doc = document as unknown as { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  let range: Range | null = null;
  if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(x, y);
  else if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(x, y); if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); range.collapse(true); } }
  if (!range) return null;
  let node: Node | null = range.startContainer;
  if (node && node.nodeType === 3 && node.parentNode && node.parentNode.nodeName === "RT") {
    const ruby = node.parentNode.parentNode;
    if (ruby) { const base = ([] as Node[]).slice.call(ruby.childNodes).filter((n) => n.nodeName !== "RT").map((n) => n.textContent).join(""); if (/[一-鿿]/.test(base)) return { run: base, rel: 0 }; }
  }
  if (!node || node.nodeType !== 3) return null;
  const t = node.textContent || ""; let i = range.startOffset;
  const isJ = (c: string) => /[一-鿿々〆ヶぁ-んァ-ンー]/.test(c || "");
  if (i >= t.length) i = t.length - 1; if (i < 0) return null;
  if (!isJ(t[i])) { if (i > 0 && isJ(t[i - 1])) i--; else return null; }
  let s = i; let e = i; while (s > 0 && isJ(t[s - 1])) s--; while (e < t.length - 1 && isJ(t[e + 1])) e++;
  return { run: t.slice(s, e + 1), rel: i - s };
}
function defAtPoint(x: number, y: number): boolean {
  const r = jpRunAt(x, y); if (!r) return false;
  const run = r.run, rel = r.rel;
  for (let st = 0; st <= rel && st < run.length; st++) {
    const d = lookupDef(run.slice(st, st + 14));
    if (d && (st + d.w.length) > rel) return defShow(x, y, d);
  }
  const d2 = lookupDef(run);
  return d2 ? defShow(x, y, d2) : false;
}

// ---------- gestes ----------
let _lpT: ReturnType<typeof setTimeout> | null = null, _lpX = 0, _lpY = 0, _lpGuard = false;
function _lpClear(): void { if (_lpT) { clearTimeout(_lpT); _lpT = null; } }
export function initDefs(opts?: { singleTap?: boolean }): void {
  opts = opts || {}; const singleTap = !!opts.singleTap;
  ensurePopup();
  document.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) { _lpClear(); return; }
    const t = e.touches[0]; _lpX = t.clientX; _lpY = t.clientY; _lpClear();
    _lpT = setTimeout(() => {
      _lpT = null;
      let ok = defAtPoint(_lpX, _lpY);
      if (!ok && window.getSelection) ok = defAt(_lpX, _lpY, String(window.getSelection()));
      if (ok) { _lpGuard = true; setTimeout(() => { _lpGuard = false; }, 700); }
    }, 450);
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!_lpT || !e.touches[0]) return; const t = e.touches[0];
    if (Math.abs(t.clientX - _lpX) > 10 || Math.abs(t.clientY - _lpY) > 10) _lpClear();
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    _lpClear();
    if (_lpGuard && e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener("dblclick", showDef as (e: Event) => void);
  document.addEventListener("click", (e) => {
    if (_lpGuard) return;
    const pop = document.getElementById("defPop");
    const target = e.target as Element | null;
    if (pop && target && pop.contains(target)) return;
    if (target && target.closest && target.closest("button,a,input,textarea,select,label,.opt,.chip,.start,.navtoggle,.furibtn,.listenbtn,.topnav")) {
      if (pop && pop.style.display === "block") hideDef(); return;
    }
    if (singleTap) { if (defAtPoint(e.clientX, e.clientY)) return; }
    if (pop && pop.style.display === "block") hideDef();
  });
  window.addEventListener("scroll", hideDef, true);
  try { document.body.style.setProperty("-webkit-touch-callout", "none"); } catch { /* ignore */ }
}

/**
 * Browser entry point: expose the dict functions as globals (React consumers read
 * `window.furi`/`visualBreak`/`initDefs`; the popup's inline handlers need
 * `hideDef`/`jlptSay`), then load the dictionary data from JSON. Best-effort — if the
 * fetch fails (offline first visit), furigana/lookups simply return plain text.
 */
export async function setupDict(url = "data/dict.json"): Promise<void> {
  const w = window as unknown as Record<string, unknown>;
  w.furi = furi; w.visualBreak = visualBreak; w.initDefs = initDefs; w.hideDef = hideDef; w.jlptSay = jlptSay;
  // Attach tap-to-define gestures app-wide. NOT singleTap: a single tap toggles a word's
  // furigana (the ruby's inline onclick); the definition popup is long-press / double-click.
  initDefs();
  if ("speechSynthesis" in window) { _pickVoice(); try { speechSynthesis.onvoiceschanged = _pickVoice; } catch { /* ignore */ } }
  try {
    const res = await fetch(url);
    if (res.ok) applyDictData(await res.json());
  } catch { /* offline / missing → degrade to plain text */ }
}
